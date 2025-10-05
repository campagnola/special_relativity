// ABOUTME: User interface controls for object creation, parameter editing, and state management
// ABOUTME: Handles clock/grid creation, acceleration programming, validation, and UI updates

export function clockDefaults(name) {
    return {
        type: 'clock',
        name,
        x0: 0,
        y0: 0,
        v0: 0,
        m0: 1,
        t0: 0,
        size: 12,
        color: [1, 0.3, 0.3],
        prog: [
            [0, 0]
        ]
    };
}

export function gridDefaults(name) {
    return {
        type: 'grid',
        name,
        count: 5,
        spacing: 1,
        template: clockDefaults(name + ' Template')
    };
}

export function colorHex([r, g, b]) {
    const to = v => ('0' + Math.round(v * 255).toString(16)).slice(-2);
    return `#${to(r)}${to(g)}${to(b)}`;
}

export function colorArr(hex) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '#ffffff');
    if (!m) return [1, 1, 1];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

export function validate(appState) {
    const msgs = [];
    const names = new Set();
    for (const o of appState.objects) {
        if (!o.name || !o.name.trim()) msgs.push('Object with empty name');
        if (names.has(o.name)) msgs.push('Duplicate name: ' + o.name);
        names.add(o.name);
        if (o.type === 'clock') {
            if (!Number.isFinite(o.v0) || Math.abs(o.v0) >= 1) msgs.push(`${o.name}: |v0| must be < 1`);
            if (!Array.isArray(o.prog) || o.prog.some(p => !(Array.isArray(p) && p.length === 2))) msgs.push(`${o.name}: invalid accel program`);
        } else if (o.type === 'grid') {
            if (!Number.isInteger(o.count) || o.count < 1) msgs.push(`${o.name}: count must be ≥1`);
            if (!Number.isFinite(o.spacing)) msgs.push(`${o.name}: spacing must be finite`);
        }
    }
    return msgs;
}

export function renderClock(o, idx, appState, callbacks) {
    const { refreshReference, markDirty, renderObjects } = callbacks;
    const card = document.createElement('div');
    card.className = 'obj-card';
    card.innerHTML = `<details open><summary class="hdr"><span class="obj-type">Clock:</span><input class="nm" type="text" value="${o.name}" title="Object name (must be unique)"><input class="color" type="color" value="${colorHex(o.color)}" title="Display color for this clock"><button class="del" title="Delete this clock">🗑</button></summary><div class="kv"><label>x₀</label><input class="x0" type="number" step="0.01" value="${o.x0}" title="Initial position in space"><label>t₀</label><input class="t0" type="number" step="0.01" min="0" value="${o.t0}" title="Initial proper time offset"><label>Vertical position</label><input class="y0" type="number" step="0.01" value="${o.y0}" title="Vertical position in animation view (no physical meaning)"><label>v₀</label><input class="v0" type="number" step="0.001" min="-1" max="1" value="${o.v0}" title="Initial velocity as fraction of light speed (-1 to 1)"><label>size</label><input class="size" type="number" step="0.5" min="1" value="${o.size}" title="Visual size of the clock"></div><div class="accel-wrap"><label class="accel-label">Acceleration Commands</label><table class="accel"><thead><tr><th title="Proper time when acceleration changes">τ (s)</th><th title="Acceleration value">a</th><th class="actions"></th></tr></thead><tbody class="accel-body"></tbody></table><div class="row"><button class="add-row" title="Add new acceleration command">Add Command</button></div></div></details>`;
    const nm = card.querySelector('.nm');
    nm.addEventListener('input', e => {
        o.name = e.target.value;
        refreshReference();
        markDirty();
        callbacks.validate();
    });
    card.querySelector('.x0').addEventListener('input', e => {
        o.x0 = +e.target.value;
        markDirty();
    });
    card.querySelector('.y0').addEventListener('input', e => {
        o.y0 = +e.target.value;
        markDirty();
    });
    card.querySelector('.v0').addEventListener('input', e => {
        o.v0 = +e.target.value;
        markDirty();
        callbacks.validate();
    });
    card.querySelector('.t0').addEventListener('input', e => {
        o.t0 = +e.target.value;
        markDirty();
    });
    card.querySelector('.size').addEventListener('input', e => {
        o.size = +e.target.value;
        markDirty();
    });
    function updateCardBorder() {
        const detailsEl = card.querySelector('details');
        detailsEl.style.borderColor = colorHex(o.color);
        // Set background to chosen color with 30% opacity
        const [r, g, b] = o.color;
        detailsEl.style.backgroundColor = `rgba(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)}, 0.3)`;
    }
    updateCardBorder();

    card.querySelector('.color').addEventListener('input', e => {
        o.color = colorArr(e.target.value);
        updateCardBorder();
        markDirty();
    });
    const body = card.querySelector('.accel-body');

    function redrawProg() {
        body.innerHTML = '';
        o.prog.slice().forEach((row, rIdx) => {
            const [tau, a] = row;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="tau" contenteditable="true" title="Proper time when acceleration changes">${tau}</td><td class="acc" contenteditable="true" title="Acceleration value">${a}</td><td class="actions"><button class="ins" title="Insert new command after this one">＋</button><button class="rm" title="Delete this command">🗑</button></td>`;
            const tauCell = tr.querySelector('.tau');
            const accCell = tr.querySelector('.acc');

            tauCell.addEventListener('blur', e => {
                const val = +e.target.textContent || 0;
                o.prog[rIdx][0] = val;
                e.target.textContent = val; // normalize display
                markDirty();
                callbacks.validate();
            });
            tauCell.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    accCell.focus();
                } else if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    accCell.focus();
                }
            });

            accCell.addEventListener('blur', e => {
                const val = +e.target.textContent || 0;
                o.prog[rIdx][1] = val;
                e.target.textContent = val; // normalize display
                markDirty();
            });
            accCell.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextRow = tr.nextElementSibling;
                    if (nextRow) {
                        nextRow.querySelector('.tau').focus();
                    }
                } else if (e.key === 'Tab' && e.shiftKey) {
                    e.preventDefault();
                    tauCell.focus();
                }
            });
            tr.querySelector('.ins').addEventListener('click', () => {
                const lastTau = rIdx >= 0 ? o.prog[rIdx][0] : 0;
                o.prog.splice(rIdx + 1, 0, [lastTau + 1, o.prog[rIdx][1] || 0]);
                redrawProg();
                markDirty();
            });
            tr.querySelector('.rm').addEventListener('click', () => {
                o.prog.splice(rIdx, 1);
                if (o.prog.length === 0) o.prog.push([0, 0]);
                redrawProg();
                markDirty();
                callbacks.validate();
            });
            body.appendChild(tr);
        });
    }
    redrawProg();
    card.querySelector('.add-row').addEventListener('click', () => {
        const last = o.prog[o.prog.length - 1];
        o.prog.push([(last ? last[0] : 0) + 1, last ? last[1] : 0]);
        redrawProg();
        markDirty();
    });
    card.querySelector('.del').addEventListener('click', () => {
        appState.objects.splice(idx, 1);
        renderObjects();
        markDirty();
        callbacks.validate();
    });
    return card;
}

export function renderGrid(o, idx, appState, callbacks) {
    const { markDirty, renderObjects } = callbacks;
    const card = document.createElement('div');
    card.className = 'obj-card';
    const t = o.template;
    card.innerHTML = `<details open><summary class="hdr"><span class="obj-type">Grid:</span><input class="nm" type="text" value="${o.name}" title="Grid name (must be unique)"><input class="color" type="color" value="${colorHex(t.color)}" title="Display color for all clocks in grid"><button class="del" title="Delete this grid">🗑</button></summary><div class="kv"><label>count</label><input class="count" type="number" step="1" min="1" value="${o.count}" title="Number of clocks in the grid"><label>spacing</label><input class="spacing" type="number" step="0.01" value="${o.spacing}" title="Distance between adjacent clocks"></div><details><summary>Template Clock</summary><div class="kv"><label>x₀</label><input class="x0" type="number" step="0.01" value="${t.x0}" title="Initial position of first clock"><label>t₀</label><input class="t0" type="number" step="0.01" min="0" value="${t.t0}" title="Initial proper time offset"><label>Vertical position</label><input class="y0" type="number" step="0.01" value="${t.y0}" title="Vertical position in animation view (no physical meaning)"><label>v₀</label><input class="v0" type="number" step="0.001" min="-1" max="1" value="${t.v0}" title="Initial velocity for all clocks (-1 to 1)"><label>size</label><input class="size" type="number" step="0.5" min="1" value="${t.size}" title="Visual size of all clocks"></div><div class="accel-wrap"><label class="accel-label">Acceleration Commands</label><table class="accel"><thead><tr><th title="Proper time when acceleration changes">τ (s)</th><th title="Acceleration value">a</th><th class="actions"></th></tr></thead><tbody class="accel-body"></tbody></table><div class="row"><button class="add-row" title="Add new acceleration command">Add Command</button></div></div></details></details>`;
    card.querySelector('.nm').addEventListener('input', e => {
        o.name = e.target.value;
        markDirty();
        callbacks.validate();
    });
    card.querySelector('.count').addEventListener('input', e => {
        o.count = Math.max(1, Math.floor(+e.target.value || 1));
        e.target.value = o.count;
        markDirty();
        callbacks.validate();
    });
    card.querySelector('.spacing').addEventListener('input', e => {
        o.spacing = +e.target.value;
        markDirty();
        callbacks.validate();
    });
    const u = (cls, key, conv = v => +v) => card.querySelector('.' + cls).addEventListener('input', e => {
        t[key] = conv(e.target.value);
        markDirty();
        callbacks.validate();
    });
    u('x0', 'x0');
    u('y0', 'y0');
    u('v0', 'v0');
    u('t0', 't0');
    u('size', 'size');
    function updateCardBorder() {
        const detailsEl = card.querySelector('details');
        detailsEl.style.borderColor = colorHex(t.color);
        // Set background to chosen color with 30% opacity
        const [r, g, b] = t.color;
        detailsEl.style.backgroundColor = `rgba(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)}, 0.3)`;
    }
    updateCardBorder();

    card.querySelector('.color').addEventListener('input', e => {
        t.color = colorArr(e.target.value);
        updateCardBorder();
        markDirty();
    });
    const body = card.querySelector('.accel-body');

    function redrawProg() {
        body.innerHTML = '';
        t.prog.slice().forEach((row, rIdx) => {
            const [tau, a] = row;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="tau" contenteditable="true" title="Proper time when acceleration changes">${tau}</td><td class="acc" contenteditable="true" title="Acceleration value">${a}</td><td class="actions"><button class="ins" title="Insert new command after this one">＋</button><button class="rm" title="Delete this command">🗑</button></td>`;
            const tauCell = tr.querySelector('.tau');
            const accCell = tr.querySelector('.acc');

            tauCell.addEventListener('blur', e => {
                const val = +e.target.textContent || 0;
                t.prog[rIdx][0] = val;
                e.target.textContent = val; // normalize display
                markDirty();
                callbacks.validate();
            });
            tauCell.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    accCell.focus();
                } else if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    accCell.focus();
                }
            });

            accCell.addEventListener('blur', e => {
                const val = +e.target.textContent || 0;
                t.prog[rIdx][1] = val;
                e.target.textContent = val; // normalize display
                markDirty();
            });
            accCell.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextRow = tr.nextElementSibling;
                    if (nextRow) {
                        nextRow.querySelector('.tau').focus();
                    }
                } else if (e.key === 'Tab' && e.shiftKey) {
                    e.preventDefault();
                    tauCell.focus();
                }
            });
            tr.querySelector('.ins').addEventListener('click', () => {
                const lastTau = rIdx >= 0 ? t.prog[rIdx][0] : 0;
                t.prog.splice(rIdx + 1, 0, [lastTau + 1, t.prog[rIdx][1] || 0]);
                redrawProg();
                markDirty();
            });
            tr.querySelector('.rm').addEventListener('click', () => {
                t.prog.splice(rIdx, 1);
                if (t.prog.length === 0) t.prog.push([0, 0]);
                redrawProg();
                markDirty();
                callbacks.validate();
            });
            body.appendChild(tr);
        });
    }
    redrawProg();
    card.querySelector('.add-row').addEventListener('click', () => {
        const last = t.prog[t.prog.length - 1];
        t.prog.push([(last ? last[0] : 0) + 1, last ? last[1] : 0]);
        redrawProg();
        markDirty();
    });
    card.querySelector('.del').addEventListener('click', () => {
        appState.objects.splice(idx, 1);
        renderObjects();
        markDirty();
        callbacks.validate();
    });
    return card;
}