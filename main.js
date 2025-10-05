// ABOUTME: Main application controller that coordinates UI, simulation, plotting, and animation
// ABOUTME: Integrates all modules and manages the application state and event handlers

import { Simulation, expandToClocks } from './simulation.js';
import { makeWorldlinePlot, getSpaceline } from './plotting.js';
import { makeAnimCanvas } from './animation.js';
import { clockDefaults, gridDefaults, validate, renderClock, renderGrid } from './controls.js';

// Preset data - converted from Python .cfg format
const presets = {
    'Twin Paradox (grid)': {
        duration: 27.0,
        animSpeed: 1.0,
        reference: 'Alice',
        animate: true,
        objects: [
            // Grid with 11 clocks
            {
                type: 'grid',
                name: 'Grid',
                count: 11,
                spacing: 2.0,
                template: {
                    type: 'clock',
                    name: 'Grid Template',
                    x0: -10.0,
                    y0: -2.0,
                    v0: 0,
                    m0: 1.0,
                    t0: 0,
                    size: 1.0,
                    color: [77/255, 77/255, 77/255], // (77,77,77,255) -> normalized RGB
                    prog: []
                }
            },
            // Alice - traveling twin with complex acceleration
            {
                type: 'clock',
                name: 'Alice',
                x0: 0.0,
                y0: 3.0,
                v0: 0,
                m0: 1.0,
                t0: 0,
                size: 1.5,
                color: [82/255, 123/255, 44/255], // (82,123,44,255) -> normalized RGB
                prog: [
                    [1.0, 0.5],   // accelerate
                    [3.0, 0.0],   // coast
                    [8.0, -0.5],  // decelerate
                    [12.0, 0.0],  // coast
                    [17.0, 0.5],  // accelerate
                    [19.0, 0.0]   // coast
                ]
            },
            // Bob - stays at home (no acceleration)
            {
                type: 'clock',
                name: 'Bob',
                x0: 0.0,
                y0: 0.0,
                v0: 0,
                m0: 1.0,
                t0: 0,
                size: 1.5,
                color: [69/255, 69/255, 126/255], // (69,69,126,255) -> normalized RGB
                prog: []
            }
        ]
    }
};

function loadPreset(presetName) {
    if (presetName === '') return;
    const state = presets[presetName];
    if (!state) return;
    loadState(state);
}

function loadState(state) {
    // Clear objects and restore state like Python loadState()
    appState.objects = []; // clearChildren()
    appState.duration = state.duration;
    appState.animSpeed = state.animSpeed;
    appState.reference = state.reference;
    appState.animate = state.animate;
    appState.objects = JSON.parse(JSON.stringify(state.objects)); // restoreState()

    // Update UI to reflect loaded values
    document.getElementById('dur').value = appState.duration;
    document.getElementById('speed').value = appState.animSpeed;
    document.getElementById('animate').checked = appState.animate;
    renderObjects();

    recalculate(); // Python calls this directly
}

function recalculate() {
    try {
        const res = runPipeline();
        markClean();

        // Use Python's plotting structure: sim.plot(plotWidget)
        res.sim1.plot(plotInertial, false);  // inertial frame (ref=false)
        res.sim2.plot(plotRef, true);        // reference frame (ref=true)

        appState._plots = { inert: { sim: res.sim1 }, ref: { sim: res.sim2 } };
        plotInertial.setSpaceline(getSpaceline(res.sim1, 'inert', 0));
        plotRef.setSpaceline(getSpaceline(res.sim2, 'ref', 0));
        animInertial.setSim(res.sim1, 'inert');
        animRef.setSim(res.sim2, 'ref');
    } catch (e) {
        console.error(e);
        alert('Simulation pipeline failed: ' + (e?.message || e));
    }
}

// App state - start with minimal state like Python
const appState = {
    duration: 10.0, // Python default
    animSpeed: 1,
    reference: null,
    objects: [], // Start empty like Python
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
document.getElementById('add-clock').addEventListener('click', () => {
    const base = 'Clock ';
    let i = 1;
    const names = new Set(appState.objects.map(o => o.name));
    while (names.has(base + i)) i++;
    const obj = clockDefaults(base + i);
    appState.objects.push(obj);
    renderObjects();
    markDirty();
});

document.getElementById('add-grid').addEventListener('click', () => {
    const base = 'Grid ';
    let i = 1;
    const names = new Set(appState.objects.map(o => o.name));
    while (names.has(base + i)) i++;
    const obj = gridDefaults(base + i);
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

document.getElementById('recalc').addEventListener('click', recalculate);

// seed UI
renderObjects();

// Load preset on startup like Python: win.loadPreset(None, 'Twin Paradox (grid)')
loadPreset('Twin Paradox (grid)');

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

