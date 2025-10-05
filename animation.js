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
        const tSim = (t % Math.max(dt, dur));
        const idx = Math.min(n - 1, Math.floor(tSim / dt));
        const buffers = mode === 'inert' ? 'inert' : 'ref';
        // Use actual y0 values for vertical positioning, exactly like Python setPos(x, y0)
        const clocks = sim.clocks;

        // Find range of y0 values to map to screen space
        let ymin = Infinity, ymax = -Infinity;
        for (const c of clocks) {
            ymin = Math.min(ymin, c.y0);
            ymax = Math.max(ymax, c.y0);
        }

        // Map y0 data coordinates to screen pixels, centered in canvas
        const pad = 40;
        const centerY = H / 2; // Center of canvas
        const pixelsPerUnit = 50; // Scale factor for y0 coordinates

        for (let ci = 0; ci < clocks.length; ci++) {
            const c = clocks[ci];
            const b = c[buffers];
            const x = b.x[idx];
            const v = b.v[idx];
            const pt = b.pt[idx];
            const f = b.f[idx];
            // Use actual y0 value like Python: setPos(x, y0)
            // Map y0=0 to center, positive y0 upward, negative y0 downward
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

            // base radius from size (pixels), clamp sensible range
            const baseR = Math.max(6, Math.min(24, c.size));
            const sx = invGamma(v); // length contraction factor (1/gamma)

            // draw arrow indicating force (use accel magnitude directly like Python flare length)
            const arrowLen = Math.min(40, Math.abs(f) * 18); // scale factor chosen to resemble Python visual
            const arrowDir = Math.sign(f) || 0; // + pushes to +x
            if (arrowDir !== 0) {
                ctx.strokeStyle = c.colorCss();
                ctx.lineWidth = 2;
                ctx.beginPath();
                const ax0 = px - arrowDir * (baseR + 6);
                const ax1 = ax0 + arrowDir * arrowLen;
                ctx.moveTo(ax0, y);
                ctx.lineTo(ax1, y);
                // arrow head
                ctx.lineTo(ax1 - arrowDir * 6, y - 4);
                ctx.moveTo(ax1, y);
                ctx.lineTo(ax1 - arrowDir * 6, y + 4);
                ctx.stroke();
            }

            // draw contracted body as an ellipse (scale X by sx)
            ctx.save();
            ctx.translate(px, y);
            ctx.scale(sx, 1);
            ctx.beginPath();
            ctx.arc(0, 0, baseR, 0, Math.PI * 2);
            ctx.strokeStyle = c.colorCss();
            ctx.lineWidth = 2;
            ctx.stroke();

            // clock hand: rotates at -0.25*pt*360°  => angle = -0.5π * pt
            const theta = -0.5 * Math.PI * pt;
            const handR = baseR * 0.9;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(handR * Math.cos(theta), handR * Math.sin(theta));
            ctx.stroke();
            ctx.restore();
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