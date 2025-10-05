// ABOUTME: Main application controller that coordinates UI, simulation, plotting, and animation
// ABOUTME: Integrates all modules and manages the application state and event handlers

import { Simulation, expandToClocks } from './simulation.js';
import { makeWorldlinePlot, buildPlotData, getSpaceline } from './plotting.js';
import { makeAnimCanvas } from './animation.js';
import { clockDefaults, gridDefaults, validate, renderClock, renderGrid } from './controls.js';
import { runTests } from './testing.js';

// App state
const appState = {
    duration: 20,
    animSpeed: 1,
    reference: null,
    objects: [clockDefaults('Clock 1')],
    dirty: true,
    animate: true
};

function runPipeline() {
    const objects = expandToClocks(appState.objects).map(c => ({
        type: 'clock',
        name: c.name,
        x0: c.x0,
        y0: c.y0,
        v0: c.v0,
        m0: c.m0,
        t0: c.t0,
        size: c.size,
        color: c.color,
        prog: c.prog
    }));
    const dtBase = 0.016;
    const dt = dtBase * Math.max(0.0001, appState.animSpeed);
    const {
        sim1,
        sim2
    } = Simulation.runAll(objects, appState.reference, appState.duration, dt);
    appState.results = {
        sim1,
        sim2
    };
    return appState.results;
}

// Wire UI (minimal from Step 2)
const $ = id => document.getElementById(id);
const objectsRoot = $('objects');
const refSelect = $('reference');
const errBox = $('obj-errors');

function refreshReference() {
    const clocks = appState.objects.filter(o => o.type === 'clock');
    refSelect.innerHTML = '';
    clocks.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        refSelect.appendChild(opt);
    });
    if (!clocks.length) {
        appState.reference = null;
        return;
    }
    if (!clocks.some(c => c.name === appState.reference)) appState.reference = clocks[0].name;
    refSelect.value = appState.reference;
}

function validateObjects() {
    const msgs = validate(appState);
    if (msgs.length) {
        errBox.hidden = false;
        errBox.textContent = msgs.join('\n');
        $('recalc').disabled = true;
    } else {
        errBox.hidden = true;
        errBox.textContent = '';
        if (appState.dirty) $('recalc').disabled = false;
    }
}

function renderObjects() {
    objectsRoot.innerHTML = '';
    const callbacks = { refreshReference, markDirty, renderObjects, validate: validateObjects };
    appState.objects.forEach((o, i) => {
        objectsRoot.appendChild(o.type === 'clock' ? renderClock(o, i, appState, callbacks) : renderGrid(o, i, appState, callbacks));
    });
    refreshReference();
    validateObjects();
}

function markDirty() {
    document.getElementById('recalc').disabled = false;
    appState.dirty = true;
}

function markClean() {
    document.getElementById('recalc').disabled = true;
    appState.dirty = false;
}

// Add & basic controls
document.getElementById('add').addEventListener('click', () => {
    const type = document.getElementById('add-type').value;
    const base = (type === 'clock') ? 'Clock ' : 'Grid ';
    let i = 1;
    const names = new Set(appState.objects.map(o => o.name));
    while (names.has(base + i)) i++;
    const obj = (type === 'clock') ? clockDefaults(base + i) : gridDefaults(base + i);
    appState.objects.push(obj);
    renderObjects();
    markDirty();
});
document.getElementById('dur').addEventListener('input', e => {
    appState.duration = +e.target.value || 20;
    markDirty();
});
document.getElementById('speed').addEventListener('input', e => {
    appState.animSpeed = Math.max(0.0001, +e.target.value || 1);
});
document.getElementById('reference').addEventListener('change', e => {
    appState.reference = e.target.value;
    markDirty();
});
document.getElementById('animate').addEventListener('change', e => {
    appState.animate = e.target.checked;
    if (appState.animate) rafStart();
});

const plotInertial = makeWorldlinePlot(document.getElementById('plot-inertial'));
const plotRef = makeWorldlinePlot(document.getElementById('plot-ref'));
const animInertial = makeAnimCanvas(document.getElementById('anim-inertial'));
const animRef = makeAnimCanvas(document.getElementById('anim-ref'));

// Set up axis linking like Python's setXLink calls
plotInertial.linkXAxis(animInertial);
plotRef.linkXAxis(animRef);

document.getElementById('recalc').addEventListener('click', () => {
    try {
        const res = runPipeline();
        markClean();
        const inertPD = buildPlotData(res.sim1, 'inert');
        const refPD = buildPlotData(res.sim2, 'ref');
        plotInertial.setData(inertPD);
        plotRef.setData(refPD);
        // cache for animation
        appState._plots = {
            inert: {
                sim: res.sim1
            },
            ref: {
                sim: res.sim2
            }
        };
        // set initial spacelines at frame 0
        plotInertial.setSpaceline(getSpaceline(res.sim1, 'inert', 0));
        plotRef.setSpaceline(getSpaceline(res.sim2, 'ref', 0));

        // Set animation simulation data
        animInertial.setSim(res.sim1, 'inert');
        animRef.setSim(res.sim2, 'ref');
    } catch (e) {
        console.error(e);
        alert('Simulation pipeline failed: ' + (e?.message || e));
    }
});

// seed UI
renderObjects();

// animation loop
let rafId = 0;
let t0 = performance.now();

function tick() {
    const now = performance.now();
    const secs = ((now - t0) / 1000); // real seconds since start
    // update animated spacelines if results exist
    const plots = appState._plots;
    if (plots) {
        const {
            sim: sim1
        } = plots.inert || {};
        const {
            sim: sim2
        } = plots.ref || {};
        if (sim1) {
            const tSim = secs * appState.animSpeed;
            const i = Math.min(sim1.frames - 1, Math.floor((tSim % sim1.duration) / sim1.dt));
            plotInertial.setSpaceline(getSpaceline(sim1, 'inert', i));
        }
        if (sim2) {
            const tSim = secs * appState.animSpeed;
            const i = Math.min(sim2.frames - 1, Math.floor((tSim % sim2.duration) / sim2.dt));
            plotRef.setSpaceline(getSpaceline(sim2, 'ref', i));
        }
    }
    animInertial.draw(secs * appState.animSpeed);
    animRef.draw(secs * appState.animSpeed);
    rafId = appState.animate ? requestAnimationFrame(tick) : 0;
}

function rafStart() {
    if (!rafId && appState.animate) {
        t0 = performance.now();
        rafId = requestAnimationFrame(tick);
    }
}
rafStart();

// Test runner
document.getElementById('run-ui-tests').addEventListener('click', () => {
    runTests(appState, runPipeline, plotInertial, plotRef, buildPlotData, getSpaceline);
});