// ABOUTME: 1D animation canvas system for real-time clock visualization
// ABOUTME: Shows length contraction, force arrows, rotating clock hands, and proper time effects

import { invGamma } from './simulation.js';

export function makeAnimCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const state = {
        sim: null,
        mode: 'inert'
    };

    function applySize(cssW, cssH) {
        const dpr = window.devicePixelRatio || 1;
        const bw = Math.floor(cssW * dpr),
            bh = Math.floor(cssH * dpr);
        if (canvas.width !== bw) canvas.width = bw;
        if (canvas.height !== bh) canvas.height = bh;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(0);
    }

    function draw(t) {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.width / dpr,
            H = canvas.height / dpr;
        ctx.fillStyle = '#0e111a';
        ctx.fillRect(0, 0, W, H);
        if (!state.sim) {
            ctx.fillStyle = '#9aa3b2';
            ctx.font = '13px system-ui';
            ctx.fillText('1‑D animation — no data', 10, 20);
            return;
        }
        const sim = state.sim;
        const mode = state.mode;
        const dur = sim.duration;
        const dt = sim.dt;
        const n = sim.frames;
        if (!n) return;
        const idx = Math.min(n - 1, Math.floor(t / dt));
        const buffers = mode === 'inert' ? 'inert' : 'ref';
        // Use actual y0 values for vertical positioning, exactly like Python setPos(x, y0)
        // Filter out the hidden Inertial clock
        const clocks = sim.clocks.filter(c => c.name !== 'Inertial');

        // Find range of y0 values to map to screen space
        let ymin = Infinity, ymax = -Infinity;
        for (const c of clocks) {
            ymin = Math.min(ymin, c.y0);
            ymax = Math.max(ymax, c.y0);
        }

        // Map y0 data coordinates to screen pixels, scaled for shorter animation view
        const pad = 10; // Reduced padding for shorter view
        const centerY = H / 2; // Center of canvas

        // Scale factor - compress vertically to fit in shorter animation view
        // With 20% height vs 80%, we need stronger compression
        const pixelsPerUnit = Math.min(15, H / 8); // Adaptive scaling based on view height

        for (let ci = 0; ci < clocks.length; ci++) {
            const c = clocks[ci];
            const b = c[buffers];
            const x = b.x[idx];
            const v = b.v[idx];
            const pt = b.pt[idx];
            const f = b.f[idx];
            // Use actual y0 value like Python: setPos(x, y0)
            // Map y0=0 to center, positive y0 upward, negative y0 downward
            // Scale positions to fit in shorter view
            const y = centerY - (c.y0 * pixelsPerUnit);
            // world x -> screen x mapping
            // Use precise pixel mapping from linked plot if available
            let px;
            if (state._linkedMapping) {
                // Use exact same pixel mapping as linked plot for perfect alignment
                const { xmin, scaleX, offsetX } = state._linkedMapping;
                px = offsetX + (x - xmin) * scaleX;
            } else if (state._linkedXRange) {
                // Fallback to basic range matching
                const xmin = state._linkedXRange.xmin;
                const xmax = state._linkedXRange.xmax;
                const pad = 20;
                const scaleX = (W - 2 * pad) / (xmax - xmin);
                px = pad + (x - xmin) * scaleX;
            } else {
                // Auto-fit to current frame's min/max across clocks
                let xmin = Infinity;
                let xmax = -Infinity;
                for (const k of clocks) {
                    const kb = k[buffers];
                    const xv = kb.x[idx];
                    if (isFinite(xv)) {
                        xmin = Math.min(xmin, xv);
                        xmax = Math.max(xmax, xv);
                    }
                }
                if (!isFinite(xmin) || !isFinite(xmax) || Math.abs(xmax - xmin) < 1e-9) {
                    xmin = -10;
                    xmax = 10;
                }
                const pad = 20;
                const scaleX = (W - 2 * pad) / (xmax - xmin);
                px = pad + (x - xmin) * scaleX;
            }

            // Python uses clock.size directly as diameter: QGraphicsEllipseItem(QRectF(0, 0, self.size, self.size))
            // Convert from data units to pixels with reasonable scaling
            const baseR = c.size * 10; // clock.size is diameter in data units, scale to pixels
            const sx = invGamma(v); // length contraction factor (1/gamma)

            // draw contracted body as an ellipse (scale X by sx)
            // Python: setPen(pg.mkPen(100,100,100)) + setBrush(clock.brush)
            ctx.save();
            ctx.translate(px, y);
            ctx.scale(sx, 1);
            ctx.beginPath();
            ctx.arc(0, 0, baseR, 0, Math.PI * 2);

            // Fill with clock color (Python: clock.brush)
            ctx.fillStyle = c.colorCss();
            ctx.fill();

            // Outline with gray (Python: pg.mkPen(100,100,100))
            ctx.strokeStyle = 'rgb(100,100,100)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // clock hand: rotates at -0.25*pt*360°  => angle = -0.5π * pt
            // Python: setPen(pg.mkPen('w')) (white)
            const theta = -0.5 * Math.PI * pt;
            const handR = baseR * 0.9;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(handR * Math.cos(theta), handR * Math.sin(theta));
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Draw proper time text to the right of the clock
            ctx.fillStyle = 'white';
            ctx.font = '12px system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(pt.toFixed(1), px + baseR + 5, y + 4);

            // draw arrow indicating force (flare) - AFTER clock body so it's visible
            // Python: setPen(pg.mkPen('y')) + setBrush(pg.mkBrush(255,150,0))
            const arrowLen = Math.min(40, Math.abs(f) * 18); // back to original scale
            const arrowDir = Math.sign(f) || 0; // + pushes to +x
            if (arrowDir !== 0) {
                ctx.save();
                ctx.translate(px, y);

                // Draw flare as triangle (Python's QPolygonF)
                ctx.beginPath();
                ctx.moveTo(-arrowDir * baseR * 0.25, -baseR * 0.25);  // top vertex
                ctx.lineTo(-arrowDir * baseR * 0.25, baseR * 0.25);   // bottom vertex
                ctx.lineTo(arrowDir * arrowLen, 0);                   // tip vertex
                ctx.closePath();

                // Fill with orange (Python: pg.mkBrush(255,150,0))
                ctx.fillStyle = 'rgb(255,150,0)';
                ctx.fill();

                // Outline with yellow (Python: pg.mkPen('y'))
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();
            }
        }
    }

    const host = canvas.parentElement || canvas;
    const observeSize = (target, onSize) => {
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
    };
    const ro = observeSize(host, () => {
        const r = canvas.getBoundingClientRect();
        applySize(r.width, r.height);
    });
    requestAnimationFrame(() => {
        const r = canvas.getBoundingClientRect();
        applySize(r.width, r.height);
    });
    return {
        draw,
        setSim(sim, mode) {
            state.sim = sim || null;
            state.mode = mode || 'inert';
            draw(0);
        },
        _ro: ro,
        // Axis linking support - compatible with plotting.js interface
        _linkedPlots: [],
        setXRange(xmin, xmax) {
            state._linkedXRange = { xmin, xmax };
            draw(0);
        },
        setXRangeWithMapping(xmin, xmax, mapping) {
            state._linkedXRange = { xmin, xmax };
            state._linkedMapping = mapping;
            draw(0);
        },
        view: {
            get xmin() { return state._linkedXRange?.xmin; },
            get xmax() { return state._linkedXRange?.xmax; },
            set xmin(v) {
                if (!state._linkedXRange) state._linkedXRange = {};
                state._linkedXRange.xmin = v;
            },
            set xmax(v) {
                if (!state._linkedXRange) state._linkedXRange = {};
                state._linkedXRange.xmax = v;
            }
        }
    };
}