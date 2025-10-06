// ABOUTME: Core relativity simulation physics engine and mathematical calculations
// ABOUTME: Implements hyperbolic motion, Lorentz transformations, and spacetime calculations

export const EPS = 1e-12;
export const gamma = v => 1 / Math.sqrt(Math.max(EPS, 1 - v * v));
export const invGamma = v => Math.sqrt(Math.max(EPS, 1 - v * v));

export function hypTStep(dt, v0, x0, tau0, g) {
    // Faithful to Python ordering and guards.
    const a = Math.abs(g);
    if (a < EPS) {
        const ig = invGamma(v0);
        return {
            v: v0,
            x: x0 + v0 * dt,
            tau: tau0 + dt * ig
        };
    }
    const oneMinusV2 = Math.max(EPS, 1 - v0 * v0);
    const ig0 = Math.sqrt(oneMinusV2); // invGamma(v0)
    const T0 = v0 / (g * ig0);
    const u = dt + T0;
    const gu = g * u;
    const B = Math.sqrt(1 + gu * gu);
    const v1 = g * u / B;
    const dtau = (Math.asinh(gu) - Math.asinh(g * T0)) / g;
    const tau1 = tau0 + dtau;
    const x1 = x0 + (1 / g) * (B - 1 / ig0);
    // Clamp velocity to (-1,1)
    const vmax = 1 - 1e-12;
    const vcl = Math.max(-vmax, Math.min(vmax, v1));
    return {
        v: vcl,
        x: x1,
        tau: tau1
    };
}

export function tauStep(dTau, v0, x0, t0, g) {
    // Convert a proper-time increment to a lab-time step; then reuse hypTStep.
    const a = Math.abs(g);
    const gam = gamma(v0);
    let dt;
    if (a < EPS) {
        dt = dTau * gam;
    } else {
        const w0 = v0 * gam; // v*sinh(gamma)
        dt = (Math.sinh(dTau * g + Math.asinh(w0)) - w0) / g;
    }
    const s = hypTStep(dt, v0, x0, 0, g);
    return {
        v: s.v,
        x: s.x,
        t: t0 + dt
    };
}

export function hypIntersect(xr, tr, vr, x, t, v, g) {
    // Solve for lab time t* where accelerated worldline intersects simultaneity line through (xr,tr) with slope vr.
    if (Math.abs(g) < EPS) {
        // Inertial worldline case has a linear solution
        return (-tr + t * v * vr - vr * x + vr * xr) / (-1 + v * vr);
    }
    const gam = gamma(v);
    // Branch rule matches Python: parity of (g>0) and (vr<0)
    let sel = ((g > 0) ? 1 : 0) + ((vr < 0) ? 1 : 0);
    sel &= 1;
    const dv = v - vr;
    const dx = x - xr;
    const dt = t - tr;
    const vr2 = vr * vr;
    const gg = g * g;
    const Aplus = -gg * tr + g * gam * vr + gg * t * vr2 - g * gam * v * vr2 - gg * vr * x + gg * vr * xr;
    const Aminus = gg * tr - g * gam * vr - gg * t * vr2 + g * gam * v * vr2 + gg * vr * x - gg * vr * xr;
    const disc = (vr2) * (1 + gam * gam * dv * dv - vr2 + 2 * g * gam * dv * (-dt + vr * dx) + gg * (dt - vr * dx) * (dt - vr * dx)) * gg;
    const root = Math.sqrt(Math.max(0, disc));
    const denom = gg * (-1 + vr2);
    if (sel === 0) {
        return (Aplus + root) / denom;
    } else {
        return -(Aminus + root) / denom;
    }
}

export class Clock {
    constructor(cfg) {
        Object.assign(this, cfg);
        this.x = this.x0;
        this.v = this.v0;
        this.t = this.t0;
        this.pt = 0;
        this.m = this.m0;
        this.refx = this.x;
        this.refv = this.v;
        this.reft = this.t;
        this.refm = this.m;
        this._progIdx = 0;
        this.inert = null;
        this.ref = null;
    }
    resetToInitial() {
        this.x = this.x0;
        this.v = this.v0;
        this.t = this.t0;
        this.pt = 0;
        this.m = this.m0;
        this._progIdx = 0;
    }
    colorCss() {
        const [r, g, b] = this.color;
        return `rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},1)`;
    }
    accelAt(tau) {
        const p = this.prog || [];
        // Handle empty program like Python: return 0.0
        if (p.length === 0) {
            return 0.0;
        }
        // advance index monotonically as proper time increases
        while (this._progIdx + 1 < p.length && tau >= p[this._progIdx + 1][0] - 1e-12) this._progIdx++;
        // If the first command starts at τ>0, acceleration before that is 0 (faithful to Python behavior)
        if (tau < p[0][0] - 1e-12) return 0;
        return p[this._progIdx][1] || 0;
    }

    force() {
        // Python: return self.force(t) where t=self.pt by default
        return this.accelAt(this.pt) * this.m0;
    }
    accelLimits() {
        const p = this.prog || [];
        // Handle empty program like Python: return (-inf, inf)
        if (p.length === 0) {
            return {
                tau1: -Infinity,
                tau2: Infinity
            };
        }
        // Before the first command at τ>0, treat as an initial segment [0, τ0) with a=0
        if (this.pt < p[0][0] - 1e-12) {
            return {
                tau1: -Infinity,
                tau2: p[0][0]
            };
        }
        const i = this._progIdx;
        const tau1 = p[i][0];
        const tau2 = (i + 1 < p.length) ? p[i + 1][0] : Infinity;
        return {
            tau1,
            tau2
        };
    }
    allocBuffers(n) {
        const A = n => new Float64Array(n);
        this.inert = {
            x: A(n),
            t: A(n),
            v: A(n),
            pt: A(n),
            m: A(n),
            f: A(n)
        };
        this.ref = {
            x: A(n),
            t: A(n),
            v: A(n),
            pt: A(n),
            m: A(n),
            f: A(n)
        };
    }
    recordInert(i) {
        const I = this.inert;
        I.x[i] = this.x;
        I.t[i] = this.t;
        I.v[i] = this.v;
        I.pt[i] = this.pt;
        I.m[i] = this.m;
        I.f[i] = this.m0 * this.accelAt(this.pt);
    }
    recordRef(i) {
        const R = this.ref;
        R.x[i] = this.refx;
        R.t[i] = this.reft;
        R.v[i] = this.refv;
        R.pt[i] = this.pt;
        R.m[i] = this.refm;
        R.f[i] = this.m0 * this.accelAt(this.pt);
    }

    getCurve(ref = true) {
        // Python's getCurve method - returns {curve, points}
        const data = ref ? this.ref : this.inert;
        const x = data.x;
        const y = data.t;
        const pt = data.pt;

        // Skip first element for ref mode like Python: data = self.refData[1:]
        const startIdx = ref ? 1 : 0;

        // Curve data (worldline)
        const curve = {
            x: x.slice(startIdx),
            y: y.slice(startIdx),
            color: this.colorCss()
        };

        // Points data (proper time markers) - exactly like Python getCurve
        const step = 1.0;
        const inds = [startIdx];
        for (let i = startIdx + 1; i < pt.length; i++) {
            const diff = pt[i] - pt[inds[inds.length - 1]];
            if (Math.abs(diff) >= step) {
                inds.push(i);
            }
        }

        const pts = [];
        for (const i of inds) {
            const xVal = x[i];
            const yVal = y[i];

            // Calculate dpt like Python: dpt = data['pt'][i+1]-data['pt'][i]
            let dpt;
            if (i + 1 < pt.length) {
                dpt = pt[i + 1] - pt[i];
            } else {
                dpt = 1; // Python default
            }

            // Python coloring: dpt > 0 -> black (0,0,0), dpt <= 0 -> gray (200,200,200)
            const color = dpt > 0 ? '#000000' : '#c8c8c8';
            pts.push({ x: xVal, y: yVal, color });
        }

        const points = { pts };
        return { curve, points };
    }
}

export class Simulation {
    constructor({
        clocks,
        refName,
        duration,
        dt
    }) {
        this.clocks = clocks;
        this.refName = refName;
        this.duration = duration;
        this.dt = dt;
        this.frames = Math.floor(duration / dt) + 1;
        this.refClock = clocks.find(c => c.name === refName) || clocks[0] || null;
        this.durationRef = duration;
    }
    runReference() {
        const n = this.frames;
        if (!this.refClock) return n;
        this.clocks.forEach(c => {
            c.resetToInitial();
            c.allocBuffers(n);
            c.recordInert(0);
            c.refx = c.x;
            c.refv = c.v;
            c.reft = c.t;
            c.recordRef(0);
        });
        const ref = this.refClock;
        ref.reft = ref.pt;
        ref.refx = 0;
        ref.refv = 0;
        ref.recordRef(0);
        for (let i = 1; i < n; i++) {
            const targetTau = ref.pt + this.dt;
            while (ref.pt < targetTau - 1e-12) {
                const {
                    tau2
                } = ref.accelLimits();
                const g = ref.accelAt(ref.pt);
                const dTau = Math.min(targetTau - ref.pt, tau2 - ref.pt);
                const s = tauStep(dTau, ref.v, ref.x, ref.t, g);
                ref.v = s.v;
                ref.x = s.x;
                ref.t = s.t;
                ref.pt += dTau;
            }
            ref.reft = ref.pt;
            ref.refx = 0;
            ref.refv = 0;
            ref.recordRef(i);
            ref.recordInert(i);
            for (const cl of this.clocks) {
                if (cl === ref) continue;
                while (true) {
                    const g = cl.accelAt(cl.pt);
                    const {
                        tau1,
                        tau2
                    } = cl.accelLimits();
                    const t1 = hypIntersect(ref.x, ref.t, ref.v, cl.x, cl.t, cl.v, g);
                    const dt1 = t1 - cl.t;
                    const st = hypTStep(dt1, cl.v, cl.x, cl.pt, g);
                    if (st.tau < tau1 - 1e-12) {
                        const dTau = tau1 - cl.pt;
                        const s2 = tauStep(dTau, cl.v, cl.x, cl.t, g);
                        cl.v = s2.v;
                        cl.x = s2.x;
                        cl.t = s2.t;
                        cl.pt = tau1;
                        continue;
                    }
                    if (st.tau > tau2 + 1e-12) {
                        const dTau = tau2 - cl.pt;
                        const s2 = tauStep(dTau, cl.v, cl.x, cl.t, g);
                        cl.v = s2.v;
                        cl.x = s2.x;
                        cl.t = s2.t;
                        cl.pt = tau2;
                        continue;
                    }
                    cl.v = st.v;
                    cl.x = st.x;
                    cl.pt = st.tau;
                    cl.t = t1;
                    break;
                }
                const gamR = gamma(ref.v);
                const dx = cl.x - ref.x;
                const dtLab = cl.t - ref.t;
                cl.refx = gamR * (dx - ref.v * dtLab);
                cl.reft = ref.pt;
                cl.refv = (cl.v - ref.v) / (1 - cl.v * ref.v);
                cl.recordRef(i);
            }
        }
        return n;
    }

    plot(plotApi, ref = true) {
        // Python's Simulation.plot method - exactly like Python
        const lines = [];
        const dots = [];

        for (const cl of this.clocks) {
            // Skip the hidden Inertial clock in plots
            if (cl.name === 'Inertial') continue;

            const { curve, points } = cl.getCurve(ref);

            // Add curve
            lines.push(curve);

            // Add points - group by color like our current plotting system expects
            const blackPts = [], grayPts = [];
            for (const pt of points.pts) {
                if (pt.color === '#000000') {
                    blackPts.push(pt);
                } else {
                    grayPts.push(pt);
                }
            }

            if (blackPts.length) {
                dots.push({
                    x: new Float64Array(blackPts.map(p => p.x)),
                    y: new Float64Array(blackPts.map(p => p.y)),
                    color: '#000000',        // brush (fill)
                    penColor: cl.colorCss()  // pen (outline) - clock color
                });
            }

            if (grayPts.length) {
                dots.push({
                    x: new Float64Array(grayPts.map(p => p.x)),
                    y: new Float64Array(grayPts.map(p => p.y)),
                    color: '#c8c8c8',        // brush (fill)
                    penColor: cl.colorCss()  // pen (outline) - clock color
                });
            }
        }

        const plotData = { lines, dots };
        plotApi.setData(plotData);
        return plotData;
    }

    // Simplified physics engine: only reference frame simulation needed
    // The "Inertial" clock with empty acceleration program provides the inertial frame
    static runSingleReference(objects, refName, duration, dt) {
        const sim = new Simulation({
            clocks: objects.map(o => new Clock(o)),
            refName,
            duration,
            dt
        });
        sim.runReference();
        return sim;
    }
}

export function expandToClocks(objects) {
    const out = [];
    const nameSet = new Set(objects.map(o => o.name));
    const uniq = (base) => {
        let i = 1,
            nm = base;
        while (nameSet.has(nm)) {
            i++;
            nm = `${base} (${i})`;
        }
        nameSet.add(nm);
        return nm;
    };

    // Always add the hidden "Inertial" clock first
    out.push(new Clock({
        type: 'clock',
        name: 'Inertial',
        x0: 0,
        y0: 0,
        v0: 0,
        m0: 1,
        t0: 0,
        size: 12,
        color: [0.5, 0.5, 0.5], // Gray color, though it won't be visible
        prog: [] // Empty acceleration program = inertial frame
    }));

    for (const o of objects) {
        if (o.type === 'clock') {
            out.push(new Clock(o));
        } else if (o.type === 'grid') {
            for (let i = 0; i < o.count; i++) {
                const cfg = JSON.parse(JSON.stringify(o.template));
                cfg.name = uniq(`${o.name} #${i+1}`);
                cfg.x0 = (o.template.x0 || 0) + i * o.spacing;
                cfg.y0 = o.template.y0 || 0;
                out.push(new Clock(cfg));
            }
        }
    }
    return out;
}