// ABOUTME: HTML templates for UI components to keep markup separate from logic
// ABOUTME: Provides clean, readable templates for clock cards, grid cards, and other UI elements

export function clockCardTemplate(o, colorHex) {
    return `
        <details open>
            <summary class="hdr">
                <span class="obj-type">Clock:</span>
                <input class="nm" type="text" value="${o.name}" title="Object name (must be unique)">
                <input class="color" type="color" value="${colorHex}" title="Display color for this clock">
                <button class="del" title="Delete this clock">🗑</button>
            </summary>
            <div class="kv">
                <label>x₀</label>
                <input class="x0" type="number" step="0.01" value="${o.x0}" title="Initial position in space">
                <label>t₀</label>
                <input class="t0" type="number" step="0.01" min="0" value="${o.t0}" title="Initial proper time offset">
                <label>Vertical position</label>
                <input class="y0" type="number" step="0.01" value="${o.y0}" title="Vertical position in animation view (no physical meaning)">
                <label>v₀</label>
                <input class="v0" type="number" step="0.001" min="-1" max="1" value="${o.v0}" title="Initial velocity as fraction of light speed (-1 to 1)">
                <label>size</label>
                <input class="size" type="number" step="0.5" min="1" value="${o.size}" title="Visual size of the clock">
            </div>
            <div class="accel-wrap">
                <label class="accel-label">Acceleration Commands</label>
                <table class="accel">
                    <thead>
                        <tr>
                            <th title="Proper time when acceleration changes">τ (s)</th>
                            <th title="Acceleration value">a</th>
                            <th class="actions"></th>
                        </tr>
                    </thead>
                    <tbody class="accel-body"></tbody>
                </table>
                <div class="row">
                    <button class="add-row" title="Add new acceleration command">Add Command</button>
                </div>
            </div>
        </details>
    `;
}

export function gridCardTemplate(o, t, colorHex) {
    return `
        <details open>
            <summary class="hdr">
                <span class="obj-type">Grid:</span>
                <input class="nm" type="text" value="${o.name}" title="Grid name (must be unique)">
                <input class="color" type="color" value="${colorHex}" title="Display color for all clocks in grid">
                <button class="del" title="Delete this grid">🗑</button>
            </summary>
            <div class="kv">
                <label>count</label>
                <input class="count" type="number" step="1" min="1" value="${o.count}" title="Number of clocks in the grid">
                <label>spacing</label>
                <input class="spacing" type="number" step="0.01" value="${o.spacing}" title="Distance between adjacent clocks">
            </div>
            <details>
                <summary>Template Clock</summary>
                <div class="kv">
                    <label>x₀</label>
                    <input class="x0" type="number" step="0.01" value="${t.x0}" title="Initial position of first clock">
                    <label>t₀</label>
                    <input class="t0" type="number" step="0.01" min="0" value="${t.t0}" title="Initial proper time offset">
                    <label>Vertical position</label>
                    <input class="y0" type="number" step="0.01" value="${t.y0}" title="Vertical position in animation view (no physical meaning)">
                    <label>v₀</label>
                    <input class="v0" type="number" step="0.001" min="-1" max="1" value="${t.v0}" title="Initial velocity for all clocks (-1 to 1)">
                    <label>size</label>
                    <input class="size" type="number" step="0.5" min="1" value="${t.size}" title="Visual size of all clocks">
                </div>
                <div class="accel-wrap">
                    <label class="accel-label">Acceleration Commands</label>
                    <table class="accel">
                        <thead>
                            <tr>
                                <th title="Proper time when acceleration changes">τ (s)</th>
                                <th title="Acceleration value">a</th>
                                <th class="actions"></th>
                            </tr>
                        </thead>
                        <tbody class="accel-body"></tbody>
                    </table>
                    <div class="row">
                        <button class="add-row" title="Add new acceleration command">Add Command</button>
                    </div>
                </div>
            </details>
        </details>
    `;
}

export function accelerationRowTemplate(tau, a) {
    return `
        <td class="tau" contenteditable="true" title="Proper time when acceleration changes">${tau}</td>
        <td class="acc" contenteditable="true" title="Acceleration value">${a}</td>
        <td class="actions">
            <button class="ins" title="Insert new command after this one">＋</button>
            <button class="rm" title="Delete this command">🗑</button>
        </td>
    `;
}

export async function loadHelpModal() {
    try {
        const response = await fetch('./help.html');
        const html = await response.text();
        document.body.insertAdjacentHTML('beforeend', html);
    } catch (error) {
        console.error('Failed to load help modal:', error);
    }
}