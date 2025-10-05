// ABOUTME: Worldline plotting system for spacetime diagrams with proper time tick marks
// ABOUTME: Handles canvas rendering, autoranging, axes, and animation spacelines

// Resize observer helper
function observeSize(target, onSize) {
    let ticking = false;
    const ro = new ResizeObserver(() => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            const r = target.getBoundingClientRect();
            onSize(Math.max(1, r.width), Math.max(1, r.height));
        });
    });
    ro.observe(target);
    return ro;
}

export function makeWorldlinePlot(canvas) {
    const ctx = canvas.getContext('2d');
    const pad = {
        l: 42,
        t: 10,
        r: 10,
        b: 26
    };
    let data = {
        lines: [],
        dots: [],
        spaceline: null
    };
    let view = {
        xmin: 0,
        xmax: 1,
        ymin: 0,
        ymax: 1
    };

    function applySize(cssW, cssH) {
        const dpr = window.devicePixelRatio || 1;
        const bw = Math.floor(cssW * dpr),
            bh = Math.floor(cssH * dpr);
        if (canvas.width !== bw) canvas.width = bw;
        if (canvas.height !== bh) canvas.height = bh;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }
    const extent = (arr) => {
        let mn = Infinity,
            mx = -Infinity;
        for (let i = 0; i < arr.length; i++) {
            const v = arr[i];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
        }
        return [mn, mx];
    };
    const niceStep = (range) => {
        const raw = range / 5 || 1;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        const n = raw / pow;
        return (n > 5) ? 5 * pow : (n > 2) ? 2 * pow : pow;
    };

    function autorange() {
        let xmin = Infinity,
            xmax = -Infinity,
            ymin = Infinity,
            ymax = -Infinity;
        const touch = (xs, ys) => {
            if (!xs || !ys || xs.length === 0) return;
            const ex = extent(xs),
                ey = extent(ys);
            xmin = Math.min(xmin, ex[0]);
            xmax = Math.max(xmax, ex[1]);
            ymin = Math.min(ymin, ey[0]);
            ymax = Math.max(ymax, ey[1]);
        };
        for (const s of data.lines) touch(s.x, s.y);
        for (const s of data.dots) touch(s.x, s.y);
        if (!isFinite(xmin) || !isFinite(xmax) || !isFinite(ymin) || !isFinite(ymax)) {
            xmin = 0;
            xmax = 1;
            ymin = 0;
            ymax = 1;
        }
        const dx = (xmax - xmin) || 1,
            dy = (ymax - ymin) || 1;
        xmin -= dx * 0.03;
        xmax += dx * 0.03;
        ymin -= dy * 0.05;
        ymax += dy * 0.03;
        view = {
            xmin,
            xmax,
            ymin,
            ymax
        };
    }

    function worldToPx(x, t) {
        const W = canvas.width / (window.devicePixelRatio || 1) - pad.l - pad.r;
        const H = canvas.height / (window.devicePixelRatio || 1) - pad.t - pad.b;
        const px = pad.l + (x - view.xmin) * (W / (view.xmax - view.xmin));
        const py = (pad.t + H) - (t - view.ymin) * (H / (view.ymax - view.ymin));
        return [px, py];
    }

    // Expose coordinate mapping for linked plots
    function getDataToPixelMapping() {
        const W = canvas.width / (window.devicePixelRatio || 1) - pad.l - pad.r;
        const scaleX = W / (view.xmax - view.xmin);
        return {
            xmin: view.xmin,
            xmax: view.xmax,
            offsetX: pad.l,
            scaleX: scaleX,
            canvasWidth: canvas.width / (window.devicePixelRatio || 1)
        };
    }

    function drawAxes() {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.width / dpr,
            H = canvas.height / dpr;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = '#24304a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, H - pad.b);
        ctx.lineTo(W - pad.r, H - pad.b);
        ctx.moveTo(pad.l, H - pad.b);
        ctx.lineTo(pad.l, pad.t);
        ctx.stroke();
        const sx = niceStep(view.xmax - view.xmin),
            sy = niceStep(view.ymax - view.ymin);
        const x0 = Math.ceil(view.xmin / sx) * sx,
            y0 = Math.ceil(view.ymin / sy) * sy;
        ctx.fillStyle = '#6b7690';
        ctx.font = '12px system-ui';
        for (let xv = x0; xv <= view.xmax + 1e-12; xv += sx) {
            const [px] = worldToPx(xv, view.ymin);
            ctx.beginPath();
            ctx.moveTo(px, H - pad.b);
            ctx.lineTo(px, H - pad.b + 4);
            ctx.strokeStyle = '#2b3550';
            ctx.stroke();
            ctx.fillText(xv.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''), px - 10, H - pad.b + 16);
        }
        for (let yt = y0; yt <= view.ymax + 1e-12; yt += sy) {
            const [, py] = worldToPx(view.xmin, yt);
            ctx.beginPath();
            ctx.moveTo(pad.l - 4, py);
            ctx.lineTo(pad.l, py);
            ctx.strokeStyle = '#2b3550';
            ctx.stroke();
            ctx.fillText(yt.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''), pad.l - 38, py + 4);
        }
    }

    function drawLines() {
        for (const s of data.lines) {
            const xs = s.x,
                ys = s.y;
            if (!xs || !ys || xs.length < 2) continue;
            ctx.beginPath();
            let [px, py] = worldToPx(xs[0], ys[0]);
            ctx.moveTo(px, py);
            const stride = Math.max(1, Math.floor(xs.length / 200000));
            for (let i = stride; i < xs.length; i += stride) {
                [px, py] = worldToPx(xs[i], ys[i]);
                ctx.lineTo(px, py);
            }
            ctx.strokeStyle = s.color || '#9aa3b2';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    function drawDots() {
        for (const s of data.dots) {
            const xs = s.x,
                ys = s.y;
            if (!xs || !ys || xs.length === 0) continue;
            ctx.beginPath();
            for (let i = 0; i < xs.length; i++) {
                const [px, py] = worldToPx(xs[i], ys[i]);
                ctx.moveTo(px + 1.5, py);
                ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            }
            ctx.fillStyle = s.color || '#c9d1ff';
            ctx.fill();
        }
    }

    function drawSpaceline() {
        const sl = data.spaceline;
        if (!sl) return;
        const {
            x0,
            y0,
            v
        } = sl;
        const xmin = view.xmin,
            xmax = view.xmax,
            ymin = view.ymin,
            ymax = view.ymax;
        const pts = [];
        const atX = x => y0 + v * (x - x0);
        const atT = t => x0 + (t - y0) / v;
        const tL = atX(xmin),
            tR = atX(xmax);
        if (tL <= ymax && tL >= ymin) pts.push([xmin, tL]);
        if (tR <= ymax && tR >= ymin) pts.push([xmax, tR]);
        if (Math.abs(v) > 1e-12) {
            const xB = atT(ymin),
                xT = atT(ymax);
            if (xB >= xmin && xB <= xmax) pts.push([xB, ymin]);
            if (xT >= xmin && xT <= xmax) pts.push([xT, ymax]);
        }
        if (pts.length < 2) return;
        pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const pA = pts[0],
            pB = pts[pts.length - 1];
        const [ax, ay] = worldToPx(pA[0], pA[1]);
        const [bx, by] = worldToPx(pB[0], pB[1]);
        ctx.strokeStyle = '#7adfff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function draw() {
        autorange();
        drawAxes();
        drawLines();
        drawDots();
        drawSpaceline();
    }
    const host = canvas.parentElement || canvas;
    const ro = observeSize(host, () => {
        const r = canvas.getBoundingClientRect();
        applySize(r.width, r.height);
    });
    requestAnimationFrame(() => {
        const r = canvas.getBoundingClientRect();
        applySize(r.width, r.height);
    });
    const api = {
        setData(d) {
            data = Object.assign({
                lines: [],
                dots: [],
                spaceline: null
            }, d || {});
            draw();
        },
        setSpaceline(sl) {
            data.spaceline = sl || null;
            draw();
        },
        draw,
        _ro: ro,
        // Axis linking support
        _linkedPlots: [],
        linkXAxis(otherPlot) {
            this._linkedPlots.push(otherPlot);
            otherPlot._linkedPlots.push(this);
        },
        getXRange() {
            return { xmin: view.xmin, xmax: view.xmax };
        },
        setXRange(xmin, xmax) {
            view.xmin = xmin;
            view.xmax = xmax;
            draw();
            // Propagate to linked plots with exact pixel mapping
            for (const linked of this._linkedPlots) {
                if (linked.setXRange !== this.setXRange) {
                    const mapping = getDataToPixelMapping();
                    linked.setXRangeWithMapping && linked.setXRangeWithMapping(xmin, xmax, mapping);
                    if (!linked.setXRangeWithMapping) {
                        linked.view.xmin = xmin;
                        linked.view.xmax = xmax;
                        linked.draw && linked.draw();
                    }
                }
            }
        },
        getDataToPixelMapping
    };

    // Override autorange to propagate X range to linked plots
    const originalAutorange = autorange;
    autorange = function() {
        originalAutorange();
        // Propagate X range to linked plots with exact pixel mapping
        for (const linked of api._linkedPlots) {
            const mapping = getDataToPixelMapping();
            if (linked.setXRangeWithMapping) {
                linked.setXRangeWithMapping(view.xmin, view.xmax, mapping);
            } else {
                linked.view.xmin = view.xmin;
                linked.view.xmax = view.xmax;
                linked.draw && linked.draw();
            }
        }
    };

    return api;
}

// Build plotting payloads from buffers
export function buildPlotData(sim, mode = 'inert') {
    const lines = [];
    const dots = [];
    for (const c of sim.clocks) {
        const buf = (mode === 'inert') ? c.inert : c.ref;
        const x = buf.x,
            t = buf.t,
            pt = buf.pt;
        lines.push({
            x,
            y: t,
            color: c.colorCss()
        });
        // Python logic: markers every 1.0 proper time unit, colored by time direction
        const step = 1.0;
        const inds = [0];
        for (let i = 1; i < pt.length; i++) {
            const diff = pt[i] - pt[inds[inds.length - 1]];
            if (Math.abs(diff) >= step) {
                inds.push(i);
            }
        }

        // Separate markers by time direction like Python getCurve()
        const forwardX = [], forwardY = [], backwardX = [], backwardY = [];
        for (let idx = 0; idx < inds.length; idx++) {
            const i = inds[idx];
            const xVal = x[i];
            const yVal = t[i];

            // Calculate dpt like Python: dpt = data['pt'][i+1]-data['pt'][i]
            let dpt;
            if (i + 1 < pt.length) {
                dpt = pt[i + 1] - pt[i];
            } else {
                dpt = 1; // Python default for last point
            }

            // Python coloring: dpt > 0 -> black, dpt <= 0 -> gray
            if (dpt > 0) {
                forwardX.push(xVal);
                forwardY.push(yVal);
            } else {
                backwardX.push(xVal);
                backwardY.push(yVal);
            }
        }

        // Black dots for forward time (Python: (0,0,0))
        if (forwardX.length) dots.push({
            x: new Float64Array(forwardX),
            y: new Float64Array(forwardY),
            color: '#000000'
        });

        // Gray dots for backward time (Python: (200,200,200))
        if (backwardX.length) dots.push({
            x: new Float64Array(backwardX),
            y: new Float64Array(backwardY),
            color: '#c8c8c8'
        });
    }
    // do not attach spaceline here; animated separately
    return {
        lines,
        dots
    };
}

export function getSpaceline(sim, mode, i) {
    const ref = sim.refClock;
    if (!ref) return null;
    const b = (mode === 'inert') ? ref.inert : ref.ref;
    const n = b.x.length;
    if (n === 0) return null;
    const idx = Math.max(0, Math.min(n - 1, i | 0));
    const x0 = b.x[idx];
    const y0 = b.t[idx];
    const v = (mode === 'inert') ? b.v[idx] : 0;
    return {
        x0,
        y0,
        v
    };
}