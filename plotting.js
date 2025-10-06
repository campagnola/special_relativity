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
        spaceline: null,
        spacelines: [],
        currentMarkers: []
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

        // Draw black background for plot area
        ctx.fillStyle = '#000000';
        ctx.fillRect(pad.l, pad.t, W - pad.l - pad.r, H - pad.t - pad.b);

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

            // Python: ScatterPlotItem(pts, pen=self.pen, size=7)
            // Each point has brush for fill, pen for outline
            for (let i = 0; i < xs.length; i++) {
                const [px, py] = worldToPx(xs[i], ys[i]);

                ctx.beginPath();
                ctx.arc(px, py, 3.5, 0, Math.PI * 2); // size=7 -> radius=3.5

                // Fill with marker color (brush)
                ctx.fillStyle = s.color || '#c9d1ff';
                ctx.fill();

                // Outline with clock color (pen) - use associated clock color if available
                ctx.strokeStyle = s.penColor || s.color || '#c9d1ff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    function drawCurrentMarkers() {
        for (const marker of data.currentMarkers) {
            const [px, py] = worldToPx(marker.x, marker.t);

            // Use the clock's defined size, scaled appropriately for plot markers
            const radius = (marker.size || 1) * 4; // Convert clock size to pixel radius

            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);

            // Fill with clock color
            ctx.fillStyle = marker.color;
            ctx.fill();

            // Gray outline to match 1D animation markers
            ctx.strokeStyle = 'rgb(100,100,100)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    function drawSpaceline() {
        const spacelines = data.spacelines || (data.spaceline ? [data.spaceline] : []);
        if (spacelines.length === 0) return;

        for (const sl of spacelines) {
            const {
                x0,
                y0,
                v,
                color
            } = sl;
            const xmin = view.xmin,
                xmax = view.xmax,
                ymin = view.ymin,
                ymax = view.ymax;

            // Reference clock position in screen coordinates
            const [refPx, refPy] = worldToPx(x0, y0);

            // Find intersection points with view boundaries
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
            if (pts.length < 2) continue;

            // Sort points and convert to screen coordinates
            pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const screenPts = pts.map(p => worldToPx(p[0], p[1]));

            // Find the leftmost and rightmost points
            const leftPt = screenPts[0];
            const rightPt = screenPts[screenPts.length - 1];

            // Use reference object color but make it lighter
            const lightenColor = (colorStr) => {
                if (!colorStr) return '#7adfff'; // fallback to original color
                // Parse rgba() format
                const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (!match) return '#7adfff'; // fallback
                const [, r, g, b] = match.map(Number);
                // Lighten by mixing with white (increase RGB values towards 255)
                const lighten = (c) => Math.round(c + (255 - c) * 0.6);
                return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
            };

            ctx.strokeStyle = lightenColor(color);
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);

            // Draw two separate lines from reference position to avoid dash shifting
            // Line from reference to left boundary
            if (leftPt[0] < refPx) {
                ctx.beginPath();
                ctx.moveTo(refPx, refPy);
                ctx.lineTo(leftPt[0], leftPt[1]);
                ctx.stroke();
            }

            // Line from reference to right boundary
            if (rightPt[0] > refPx) {
                ctx.beginPath();
                ctx.moveTo(refPx, refPy);
                ctx.lineTo(rightPt[0], rightPt[1]);
                ctx.stroke();
            }

            ctx.setLineDash([]);
        }
    }

    function draw() {
        autorange();
        drawAxes();
        drawLines();
        drawDots();
        drawCurrentMarkers();
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
                spaceline: null,
                spacelines: [],
                currentMarkers: []
            }, d || {});
            draw();
        },
        setSpaceline(sl) {
            data.spaceline = sl || null;
            draw();
        },
        setSpacelines(spacelines) {
            data.spacelines = spacelines || [];
            draw();
        },
        setCurrentMarkers(markers) {
            data.currentMarkers = markers || [];
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

// buildPlotData removed - now using Python's getCurve/plot structure directly

export function getSpaceline(sim, mode, i) {
    const ref = sim.refClock;
    if (!ref) return null;
    const b = (mode === 'inert') ? ref.inert : ref.ref;
    const n = b.x.length;
    if (n === 0) return null;
    const idx = Math.max(0, Math.min(n - 1, i | 0));
    const x0 = b.x[idx];
    const y0 = b.t[idx];
    const v = b.v[idx];
    return {
        x0,
        y0,
        v,
        color: ref.colorCss()
    };
}

export function getAllSpacelines(sim, mode, i, leftRefName, rightRefName, currentRefName) {
    const spacelines = [];
    const idx = Math.max(0, Math.min(sim.frames - 1, i | 0));

    // Find the clocks for both reference frames
    const leftRefClock = sim.clocks.find(c => c.name === leftRefName);
    const rightRefClock = sim.clocks.find(c => c.name === rightRefName);

    // Helper function to check if we can draw a spaceline
    const canDraw = (observerName) => {
        // Case 1: Simultaneity line for the reference observer (always horizontal)
        if (observerName === currentRefName) return true;

        // Case 2: Reference frame is inertial (empty acceleration program), any other observer's line is straight
        const currentRefClock = sim.clocks.find(c => c.name === currentRefName);
        if (currentRefClock && (!currentRefClock.prog || currentRefClock.prog.length === 0)) return true;

        // Case 3: All other cases cannot be drawn (would be curved)
        return false;
    };

    if (leftRefClock && canDraw(leftRefName)) {
        const b = (mode === 'inert') ? leftRefClock.inert : leftRefClock.ref;
        if (b.x.length > idx) {
            spacelines.push({
                x0: b.x[idx],
                y0: b.t[idx],
                v: b.v[idx],
                color: leftRefClock.colorCss(),
                name: leftRefName
            });
        }
    }

    if (rightRefClock && rightRefName !== leftRefName && canDraw(rightRefName)) {
        const b = (mode === 'inert') ? rightRefClock.inert : rightRefClock.ref;
        if (b.x.length > idx) {
            spacelines.push({
                x0: b.x[idx],
                y0: b.t[idx],
                v: b.v[idx],
                color: rightRefClock.colorCss(),
                name: rightRefName
            });
        }
    }

    return spacelines;
}