// ABOUTME: Test suite for validating simulation physics and invariance properties
// ABOUTME: Includes smoke tests, proper time validation, and reference frame transformations

export function runTests(appState, runPipeline, plotInertial, plotRef, getSpaceline) {
    const tlog = document.getElementById('test-log');
    const tprint = (m) => {
        tlog.textContent += m + "\n";
        tlog.scrollTop = tlog.scrollHeight;
    };

    try {
        tlog.textContent = '';
        const res = runPipeline();
        res.sim1.plot(plotInertial, false);  // inertial frame
        res.sim2.plot(plotRef, true);        // reference frame
        const sl1 = getSpaceline(res.sim1, 'inert', 0);
        const sl2 = getSpaceline(res.sim2, 'ref', 0);
        if (sl1 && typeof sl1.v === 'number') tprint('Spaceline inertial ✓');
        else tprint('Spaceline inertial ✘');
        if (sl2 && Math.abs(sl2.v) < 1e-12) tprint('Spaceline ref horizontal ✓');
        else tprint('Spaceline ref horizontal ✘');
        // New: verify inertial t samples align with global targets i*dt
        const c0 = res.sim1.clocks[0];
        const ok = (() => {
            const eps = 1e-9;
            for (let i = 0; i < res.sim1.frames; i++) {
                const expect = i * res.sim1.dt;
                if (Math.abs(c0.inert.t[i] - expect) > 1e-7) {
                    return false;
                }
            }
            return true;
        })();
        tprint(ok ? 'runInertial time grid ✓' : 'runInertial time grid ✘');
        // Invariance smoke test: shift all accel programs by a constant proper-time offset
        try {
            const base = JSON.parse(JSON.stringify(appState));
            const resA = runPipeline();
            // pick a non-ref clock if available
            const refName = resA.sim2.refName;
            const other = resA.sim2.clocks.find(c => c.name !== refName) || resA.sim2.clocks[0];
            const dtRef = resA.sim2.dt;
            const shiftSteps = 3;
            const shiftTau = dtRef * shiftSteps;
            // build shifted state
            const shifted = JSON.parse(JSON.stringify(base));
            shifted.objects = shifted.objects.map(o => {
                if (o.type === 'clock') {
                    return {
                        ...o,
                        prog: (o.prog || [
                            [0, 0]
                        ]).map(([tau, a]) => [tau + shiftTau, a])
                    };
                } else {
                    const t = o.template;
                    return {
                        ...o,
                        template: {
                            ...t,
                            prog: (t.prog || [
                                [0, 0]
                            ]).map(([tau, a]) => [tau + shiftTau, a])
                        }
                    };
                }
            });
            // temporarily apply and run
            const saved = JSON.parse(JSON.stringify(appState));
            appState.objects = shifted.objects;
            appState.reference = base.reference;
            appState.duration = base.duration;
            appState.animSpeed = base.animSpeed;
            const resB = runPipeline();
            // compare x' curves for the chosen non-ref clock up to length overlap after shift
            const aC = resA.sim2.clocks.find(c => c.name === other.name);
            const bC = resB.sim2.clocks.find(c => c.name === other.name);
            if (aC && bC) {
                const ax = aC.ref.x,
                    bx = bC.ref.x;
                const n = Math.min(ax.length, bx.length - shiftSteps);
                let err = 0,
                    cnt = 0;
                for (let i = 0; i < n; i++) {
                    const d = ax[i] - bx[i + shiftSteps];
                    err += Math.abs(d);
                    cnt++;
                }
                const mae = (cnt ? err / cnt : Infinity);
                tprint(mae < 1e-5 ? 'Ref-frame shape invariance (τ shift) ✓' : 'Ref-frame shape invariance (τ shift) ✘  mae=' + mae.toExponential(2));
            } else {
                tprint('Ref-frame shape invariance (τ shift) skipped (no compare clock)');
            }
            // restore state
            appState.objects = saved.objects;
            appState.reference = saved.reference;
            appState.duration = saved.duration;
            appState.animSpeed = saved.animSpeed;
        } catch (e) {
            tprint('Invariance test error: ' + (e?.message || e));
        }
        // New test: a command starting at proper time τ=1 should not apply at τ<1 when v0=0
        try {
            const saved = JSON.parse(JSON.stringify(appState));
            appState.objects = [{
                type: 'clock',
                name: 'T',
                x0: 0,
                y0: 0,
                v0: 0,
                m0: 1,
                t0: 0,
                size: 10,
                color: [0.8, 0.6, 0.2],
                prog: [
                    [1, 0.3]
                ]
            }];
            appState.reference = 'T';
            appState.duration = 2;
            appState.animSpeed = 1;
            const res = runPipeline();
            const c = res.sim1.clocks[0];
            // Find first non-zero force sample
            let firstIdx = -1;
            for (let i = 0; i < c.inert.f.length; i++) {
                if (Math.abs(c.inert.f[i]) > 1e-12) {
                    firstIdx = i;
                    break;
                }
            }
            if (firstIdx === -1) {
                tprint('τ=1 command test ✘ (never turned on)');
            } else {
                const tAt = c.inert.t[firstIdx];
                const allZeroBefore = c.inert.f.slice(0, firstIdx).every(v => Math.abs(v) <= 1e-12);
                tprint(allZeroBefore && Math.abs(tAt - 1) < 5e-3 ? 'τ=1 command test ✓' : `τ=1 command test ✘  t@on=${tAt.toFixed(4)}`);
            }
            // restore
            appState.objects = saved.objects;
            appState.reference = saved.reference;
            appState.duration = saved.duration;
            appState.animSpeed = saved.animSpeed;
        } catch (e) {
            tprint('τ=1 command test error: ' + (e?.message || e));
        }

        tprint('Pipeline + plotting ✓');
    } catch (e) {
        tprint('Plotting test ✘: ' + (e?.message || e));
    }
}