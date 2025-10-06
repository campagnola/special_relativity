// ABOUTME: Main application controller that coordinates UI, simulation, plotting, and animation
// ABOUTME: Integrates all modules and manages the application state and event handlers

import { Simulation, expandToClocks } from './simulation.js';
import { makeWorldlinePlot, getAllSpacelines } from './plotting.js';
import { makeAnimCanvas } from './animation.js';
import { clockDefaults, gridDefaults, validate, renderClock, renderGrid } from './controls.js';
import { loadHelpModal } from './templates.js';

// Preset data - converted from Python .cfg format
const defaultPresets = {
    'Twin Paradox (grid)': {
        duration: 27.0,
        animSpeed: 1.0,
        leftReference: 'Inertial',
        rightReference: 'Alice',
        animate: true,
        objects: [
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
            },
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
            }
        ]
    }
};

// Preset management
let currentPresetName = 'Twin Paradox (grid)';

function getUserPresets() {
    try {
        return JSON.parse(localStorage.getItem('relativity-presets') || '{}');
    } catch {
        return {};
    }
}

function saveUserPresets(presets) {
    try {
        localStorage.setItem('relativity-presets', JSON.stringify(presets));
    } catch (e) {
        alert('Failed to save presets: ' + e.message);
    }
}

function getAllPresets() {
    return { ...defaultPresets, ...getUserPresets() };
}

function updatePresetSelect() {
    const presetSelect = document.getElementById('preset-select');
    const allPresets = getAllPresets();

    presetSelect.innerHTML = '<option value="">Select preset...</option>';

    Object.keys(allPresets).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (name === currentPresetName) option.selected = true;
        presetSelect.appendChild(option);
    });
}

function updateCurrentPresetDisplay() {
    document.getElementById('current-preset').textContent = currentPresetName || 'Unsaved';
}

function loadPreset(presetName) {
    if (presetName === '') return;
    const allPresets = getAllPresets();
    const state = allPresets[presetName];
    if (!state) return;
    currentPresetName = presetName;
    updateCurrentPresetDisplay();
    updatePresetSelect();
    loadState(state);
}

function loadState(state) {
    // Clear objects and restore state like Python loadState()
    appState.objects = []; // clearChildren()
    appState.duration = state.duration;
    appState.animSpeed = state.animSpeed;
    appState.animate = state.animate;
    appState.objects = JSON.parse(JSON.stringify(state.objects)); // restoreState()

    // Handle dual references (new format) or legacy single reference
    if (state.leftReference !== undefined && state.rightReference !== undefined) {
        // New dual reference format
        appState.leftReference = state.leftReference;
        appState.rightReference = state.rightReference;
    } else if (state.reference !== undefined) {
        // Legacy single reference format - put Inertial on left, reference on right
        appState.leftReference = 'Inertial';
        appState.rightReference = state.reference || 'Inertial';
    } else {
        // Default fallback
        appState.leftReference = 'Inertial';
        appState.rightReference = 'Inertial';
    }

    // Update UI to reflect loaded values
    document.getElementById('dur').value = appState.duration;
    document.getElementById('speed').value = speedToSlider(appState.animSpeed);
    updateSpeedLabel(appState.animSpeed);
    document.getElementById('animate').checked = appState.animate;
    document.getElementById('time-slider').max = appState.duration;
    renderObjects();

    recalculate(); // Python calls this directly
}

function recalculate() {
    try {
        const res = runPipeline();

        // Each column has a simulation run in its selected reference frame
        const leftSim = res.left;
        const rightSim = res.right;

        // Plot to each column
        leftSim.plot(plotLeft, true);
        rightSim.plot(plotRight, true);

        // Store plot data for updateVisuals
        appState._plots = {
            left: { sim: leftSim, isRef: true },
            right: { sim: rightSim, isRef: true }
        };

        // Set spacelines and animation
        plotLeft.setSpacelines(getAllSpacelines(leftSim, 'ref', 0, appState.leftReference, appState.rightReference, appState.leftReference));
        plotRight.setSpacelines(getAllSpacelines(rightSim, 'ref', 0, appState.leftReference, appState.rightReference, appState.rightReference));
        animLeft.setSim(leftSim, 'ref');
        animRight.setSim(rightSim, 'ref');
    } catch (e) {
        console.error(e);
        alert('Simulation pipeline failed: ' + (e?.message || e));
    }
}

// App state - start with minimal state like Python
const appState = {
    duration: 10.0, // Python default
    animSpeed: 1,
    leftReference: 'Inertial', // Default to Inertial clock
    rightReference: 'Inertial', // Default to Inertial clock
    objects: [], // Start empty like Python
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

    // Run reference simulations for both left and right columns
    // Note: "Inertial" is now just another clock with empty acceleration program
    const leftSim = Simulation.runSingleReference(objects, appState.leftReference, appState.duration, dt);
    const rightSim = Simulation.runSingleReference(objects, appState.rightReference, appState.duration, dt);

    appState.results = {
        left: leftSim,
        right: rightSim
    };
    return appState.results;
}

// Wire UI (minimal from Step 2)
const $ = id => document.getElementById(id);
const objectsRoot = $('objects');
const leftRefSelect = $('left-reference');
const rightRefSelect = $('right-reference');
const errBox = $('obj-errors');

function populateReferenceSelect(selectElement, currentValue) {
    // Get all clocks from the expanded list (includes hidden Inertial clock)
    const allClocks = expandToClocks(appState.objects);

    // Clear select
    selectElement.innerHTML = '';

    // Add all clocks as options
    allClocks.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name === 'Inertial' ? 'Inertial (lab)' : c.name;
        selectElement.appendChild(opt);
    });

    // Set current value if valid
    if (currentValue && allClocks.some(c => c.name === currentValue)) {
        selectElement.value = currentValue;
    } else {
        selectElement.value = 'Inertial'; // Default to Inertial instead of empty
    }
}

function refreshReference() {
    populateReferenceSelect(leftRefSelect, appState.leftReference);
    populateReferenceSelect(rightRefSelect, appState.rightReference);
}

function validateObjects() {
    const msgs = validate(appState);
    if (msgs.length) {
        errBox.hidden = false;
        errBox.textContent = msgs.join('\n');
    } else {
        errBox.hidden = true;
        errBox.textContent = '';
    }
}

function renderObjects() {
    objectsRoot.innerHTML = '';
    const callbacks = { refreshReference, markDirty: recalculate, renderObjects, validate: validateObjects };
    appState.objects.forEach((o, i) => {
        objectsRoot.appendChild(o.type === 'clock' ? renderClock(o, i, appState, callbacks) : renderGrid(o, i, appState, callbacks));
    });
    refreshReference();
    validateObjects();
}

// markDirty/markClean removed - now using direct recalculate() calls

// Add & basic controls
document.getElementById('add-clock').addEventListener('click', () => {
    const base = 'Clock ';
    let i = 1;
    const names = new Set(appState.objects.map(o => o.name));
    while (names.has(base + i)) i++;
    const obj = clockDefaults(base + i);
    appState.objects.push(obj);
    renderObjects();
    recalculate();
});

document.getElementById('add-grid').addEventListener('click', () => {
    const base = 'Grid ';
    let i = 1;
    const names = new Set(appState.objects.map(o => o.name));
    while (names.has(base + i)) i++;
    const obj = gridDefaults(base + i);
    appState.objects.push(obj);
    renderObjects();
    recalculate();
});

document.getElementById('dur').addEventListener('input', e => {
    appState.duration = +e.target.value || 20;
    // Update slider max value
    document.getElementById('time-slider').max = appState.duration;
    recalculate();
});
// Helper functions for logarithmic speed slider
function sliderToSpeed(sliderValue) {
    // Convert 0-100 slider to 0.01-100 logarithmic scale
    const minLog = Math.log10(0.01);
    const maxLog = Math.log10(100);
    const scale = (maxLog - minLog) / 100;
    return Math.pow(10, minLog + sliderValue * scale);
}

function speedToSlider(speed) {
    // Convert 0.01-100 speed to 0-100 slider value
    const minLog = Math.log10(0.01);
    const maxLog = Math.log10(100);
    const scale = (maxLog - minLog) / 100;
    return (Math.log10(speed) - minLog) / scale;
}

function updateSpeedLabel(speed) {
    document.getElementById('speed-label').textContent = speed.toFixed(2) + 'x';
}

document.getElementById('speed').addEventListener('input', e => {
    const sliderValue = +e.target.value;
    const speed = sliderToSpeed(sliderValue);
    appState.animSpeed = speed;
    updateSpeedLabel(speed);
});
leftRefSelect.addEventListener('change', e => {
    appState.leftReference = e.target.value;
    recalculate();
    updateFrameLabels(); // Update labels immediately when reference changes
});

rightRefSelect.addEventListener('change', e => {
    appState.rightReference = e.target.value;
    recalculate();
    updateFrameLabels(); // Update labels immediately when reference changes
});
document.getElementById('animate').addEventListener('change', e => {
    appState.animate = e.target.checked;
    if (appState.animate) {
        rafStart();
    } else {
        // Stop animation but keep visuals at current state
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
    }
});

// Time slider event handlers
const timeSlider = document.getElementById('time-slider');
timeSlider.addEventListener('mousedown', () => {
    sliderDragging = true;
    wasAnimatingBeforeDrag = appState.animate;
    // Don't stop the RAF loop, just prevent time updates
});

timeSlider.addEventListener('input', e => {
    animTime = parseFloat(e.target.value);
    // Force visual update even when animation is paused
    updateVisuals();
});

timeSlider.addEventListener('mouseup', () => {
    sliderDragging = false;
    // Restore animation state if it was running before drag
    if (wasAnimatingBeforeDrag && !appState.animate) {
        // This case shouldn't happen, but handle it anyway
    }
});

// Also handle touch events for mobile
timeSlider.addEventListener('touchstart', () => {
    sliderDragging = true;
    wasAnimatingBeforeDrag = appState.animate;
});

timeSlider.addEventListener('touchend', () => {
    sliderDragging = false;
});

const plotLeft = makeWorldlinePlot(document.getElementById('plot-left'));
const plotRight = makeWorldlinePlot(document.getElementById('plot-right'));
const animLeft = makeAnimCanvas(document.getElementById('anim-left'));
const animRight = makeAnimCanvas(document.getElementById('anim-right'));

// Set up axis linking like Python's setXLink calls
plotLeft.linkXAxis(animLeft);
plotRight.linkXAxis(animRight);

// Auto-recalculation replaces manual button

// Help modal setup - load and initialize
async function setupHelpModal() {
    await loadHelpModal();

    const helpModal = document.getElementById('help-modal');
    const helpBtn = document.getElementById('help-btn');
    const helpClose = document.getElementById('help-close');

    helpBtn.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
    });

    helpClose.addEventListener('click', () => {
        helpModal.classList.add('hidden');
    });

    // Close modal when clicking outside
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.classList.add('hidden');
        }
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Close modal with Escape key
    if (e.key === 'Escape' && !helpModal.classList.contains('hidden')) {
        helpModal.classList.add('hidden');
    }
    // Toggle animation with Space bar
    if (e.key === ' ' || e.key === 'Spacebar') {
        // Prevent page scroll when spacebar is pressed
        e.preventDefault();
        const animateCheckbox = document.getElementById('animate');
        animateCheckbox.checked = !animateCheckbox.checked;
        // Trigger the change event to update appState
        animateCheckbox.dispatchEvent(new Event('change'));
    }
});

// Preset management event handlers
document.getElementById('preset-select').addEventListener('change', (e) => {
    if (e.target.value) {
        loadPreset(e.target.value);
    }
});

document.getElementById('save-preset').addEventListener('click', () => {
    const presetName = document.getElementById('preset-name').value.trim();
    if (!presetName) {
        alert('Please enter a preset name');
        return;
    }

    // Check if it's a default preset
    if (defaultPresets[presetName]) {
        alert('Cannot overwrite default preset. Please choose a different name.');
        return;
    }

    // Save current state
    const currentState = {
        duration: appState.duration,
        animSpeed: appState.animSpeed,
        leftReference: appState.leftReference,
        rightReference: appState.rightReference,
        animate: appState.animate,
        objects: JSON.parse(JSON.stringify(appState.objects))
    };

    const userPresets = getUserPresets();
    userPresets[presetName] = currentState;
    saveUserPresets(userPresets);

    currentPresetName = presetName;
    updateCurrentPresetDisplay();
    updatePresetSelect();
    document.getElementById('preset-name').value = '';
});

document.getElementById('delete-preset').addEventListener('click', () => {
    const selectedPreset = document.getElementById('preset-select').value;
    if (!selectedPreset) {
        alert('Please select a preset to delete');
        return;
    }

    if (defaultPresets[selectedPreset]) {
        alert('Cannot delete default preset');
        return;
    }

    if (confirm(`Delete preset "${selectedPreset}"?`)) {
        const userPresets = getUserPresets();
        delete userPresets[selectedPreset];
        saveUserPresets(userPresets);

        if (currentPresetName === selectedPreset) {
            currentPresetName = null;
            updateCurrentPresetDisplay();
        }
        updatePresetSelect();
    }
});

document.getElementById('export-presets').addEventListener('click', () => {
    const allPresets = getAllPresets();
    const dataStr = JSON.stringify(allPresets, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'relativity-presets.json';
    link.click();

    URL.revokeObjectURL(url);
});

document.getElementById('import-presets').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedPresets = JSON.parse(event.target.result);

            // Validate structure
            for (const [name, preset] of Object.entries(importedPresets)) {
                if (!preset.objects || !Array.isArray(preset.objects)) {
                    throw new Error(`Invalid preset format: ${name}`);
                }
            }

            // Merge with existing user presets
            const userPresets = getUserPresets();
            let overwrites = [];

            for (const [name, preset] of Object.entries(importedPresets)) {
                if (defaultPresets[name]) {
                    continue; // Skip default presets
                }
                if (userPresets[name]) {
                    overwrites.push(name);
                }
                userPresets[name] = preset;
            }

            if (overwrites.length > 0) {
                const overwriteMsg = `The following presets will be overwritten:\n${overwrites.join('\n')}\n\nContinue?`;
                if (!confirm(overwriteMsg)) {
                    return;
                }
            }

            saveUserPresets(userPresets);
            updatePresetSelect();
            alert('Presets imported successfully');
        } catch (error) {
            alert('Failed to import presets: ' + error.message);
        }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
});

// Initialize preset management
updatePresetSelect();
updateCurrentPresetDisplay();

// seed UI
renderObjects();

// Load preset on startup like Python: win.loadPreset(None, 'Twin Paradox (grid)')
loadPreset('Twin Paradox (grid)');

// Time slider state
let sliderDragging = false;
let wasAnimatingBeforeDrag = false;

// animation loop
let rafId = 0;
let lastAnimTime = performance.now() / 1000;
let animTime = 0;

function updateColumnVisuals(columnKey, plot, anim) {
    const plots = appState._plots;
    if (!plots || !plots[columnKey]) return;

    const { sim, isRef } = plots[columnKey];
    const i = Math.min(sim.frames - 1, Math.floor(animTime / sim.dt));
    const frameType = isRef ? 'ref' : 'inert';
    const currentRef = columnKey === 'left' ? appState.leftReference : appState.rightReference;

    plot.setSpacelines(getAllSpacelines(sim, frameType, i, appState.leftReference, appState.rightReference, currentRef));

    // Calculate current position markers for all clocks (excluding hidden Inertial clock)
    const markers = sim.clocks
        .filter(clock => clock.name !== 'Inertial')
        .map(clock => {
            const buffer = isRef ? clock.ref : clock.inert;
            const x = buffer.x[i];
            const t = buffer.t[i];
            return { x, t, color: clock.colorCss(), size: clock.size };
        });
    plot.setCurrentMarkers(markers);
    anim.draw(animTime);
}

function updateVisuals() {
    // Update both columns using the same logic
    updateColumnVisuals('left', plotLeft, animLeft);
    updateColumnVisuals('right', plotRight, animRight);

    // Update frame labels with current time
    updateFrameLabels();
}

function updateFrameLabels() {
    const leftTime = document.getElementById('left-time');
    const rightTime = document.getElementById('right-time');

    leftTime.textContent = `[ t=${animTime.toFixed(1)} ]`;
    rightTime.textContent = `[ t=${animTime.toFixed(1)} ]`;
}

function tick() {
    const now = performance.now() / 1000;

    // Only advance time if not dragging slider
    if (!sliderDragging) {
        const dt = (now - lastAnimTime) * appState.animSpeed;
        animTime += dt;

        // Reset animation time when exceeding duration (like Python)
        if (animTime > appState.duration) {
            animTime = 0;
        }
    }

    lastAnimTime = now;

    // Update slider position if not being dragged
    if (!sliderDragging) {
        const timeSlider = document.getElementById('time-slider');
        timeSlider.value = animTime;
    }

    updateVisuals();
    rafId = appState.animate ? requestAnimationFrame(tick) : 0;
}

function rafStart() {
    if (!rafId && appState.animate) {
        lastAnimTime = performance.now() / 1000;
        rafId = requestAnimationFrame(tick);
    }
}

// Initialize help modal and start animation
setupHelpModal();
rafStart();

