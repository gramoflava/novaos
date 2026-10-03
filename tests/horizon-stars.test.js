// Run with: node --test tests/horizon-stars.test.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// No browser or GPU needed for the spatial filter's mathematical invariants.
const context = { window: {}, document: { createElement: () => ({}) } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/core/horizon.js'), 'utf8') + '\nthis.StarView = SchwarzschildView;', context);
const view = new context.StarView(24);

test('spatial filtering retains integrated star light across pixel footprints', () => {
    const nx = 7, ny = 7, peak = 200, variance = 0.00072 ** 2;
    const points = new Float32Array(nx * ny * 3);
    for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) {
        const i = (x * ny + y) * 3;
        points[i] = x - 0.5; points[i + 1] = y - 0.5; points[i + 2] = peak;
    }
    const layer = { cell: 1, variance, nx, ny, points, mean: 2 * Math.PI * variance * peak };
    for (const footprint of [0.015, 0.08, 0.35, 0.8, 2]) {
        let flux = 0;
        const samples = 256;
        for (let x = 0; x < samples; x++) for (let y = 0; y < samples; y++) {
            flux += view.starLight(layer, 2 + (x + 0.5) / samples, 2 + (y + 0.5) / samples, footprint, footprint);
        }
        const retained = flux / samples ** 2 / layer.mean;
        assert(Math.abs(retained - 1) < 0.01, `footprint ${footprint}: retained ${retained}`);
    }
});

test('bright stars keep the same angular source and minimum filter width', () => {
    const fine = view.makeStarLayer(0.018, 0.1, false);
    const bright = view.makeStarLayer(0.25, 0.5, true);
    assert(Math.abs(fine.variance * fine.cell ** 2 - bright.variance * bright.cell ** 2) < 1e-15);
    const pointLayer = cell => {
        const points = new Float32Array(5 * 5 * 3), i = (3 * 5 + 3) * 3;
        points[i] = points[i + 1] = 2.5; points[i + 2] = 100;
        return { cell, nx: 5, ny: 5, points, variance: (0.00072 / cell) ** 2, mean: 0 };
    };
    for (const offset of [0, 0.0001, 0.0006, 0.0015]) {
        const sample = cell => view.starLight(pointLayer(cell), 2.5 * cell + offset, 2.5 * cell, 0, 0);
        assert(Math.abs(sample(0.018) - sample(0.25)) < 1e-8, `angular offset ${offset}`);
    }
});
