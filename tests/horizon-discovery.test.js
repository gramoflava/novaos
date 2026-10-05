const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function scene() {
    let discoveries = 0;
    const context = { window: { removeEventListener() {}, NovaUplink: { discovered() { discoveries++; } } },
        document: { createElement: () => ({}) }, cancelAnimationFrame() {} };
    context.NovaUplink = context.window.NovaUplink;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/core/horizon.js'), 'utf8'), context);
    return { horizon: context.window.NovaHorizon, discoveries: () => discoveries };
}

test('Explorers is offered after the cinematic has completed and desktop callback ran', () => {
    const s = scene();
    let restored = false;
    s.horizon.onDone = () => { restored = true; assert.equal(s.discoveries(), 0); };
    s.horizon.finish();
    assert.equal(restored, true);
    assert.equal(s.discoveries(), 1);
    assert.equal(s.horizon.running, false);
});

test('Escape-skipped cinematic does not offer an Explorer registration', () => {
    const s = scene();
    s.horizon.t = 0;
    s.horizon.music = { cut() {} };
    s.horizon.onKey({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    s.horizon.finish();
    assert.equal(s.discoveries(), 0);
});
