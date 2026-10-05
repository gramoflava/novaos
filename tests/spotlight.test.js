const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function setup() {
    const element = () => ({ style: {}, value: '', innerHTML: '', children: [], handlers: {},
        addEventListener(name, fn) { this.handlers[name] = fn; },
        appendChild(child) { this.children.push(child); }, focus() {}, blur() {} });
    const nodes = Object.fromEntries(['spotlight-overlay', 'spotlight-input', 'spotlight-results'].map(id => [id, element()]));
    const launched = [];
    const context = { document: { getElementById: id => nodes[id], addEventListener() {}, createElement: element },
        Apps: { getAll: () => [{ id: 'calculator', name: 'Calculator', iconId: 'calculator' }], launch: id => launched.push(id) },
        Icons: { get: () => '' }, setTimeout: fn => fn() };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(require.resolve('../js/core/spotlight.js'), 'utf8') + '\nthis.search = new SpotlightSearch();', context);
    return { search: context.search, input: nodes['spotlight-input'], results: nodes['spotlight-results'], launched };
}

test('Enter launches a matching app, but never a stale match', () => {
    const { search, input, launched } = setup();
    search.open(); input.value = 'calc'; input.handlers.input();
    input.handlers.keydown({ key: 'Enter', preventDefault() {} });
    assert.deepEqual(launched, ['calculator']);
    assert.equal(search.isOpen, false);
    search.open(); input.value = 'missing'; input.handlers.input();
    input.handlers.keydown({ key: 'Enter', preventDefault() {} });
    assert.equal(launched.length, 1);
});

test('unmatched search text is rendered literally rather than as HTML', () => {
    const { input, results } = setup();
    input.value = '<b>probe</b>'; input.handlers.input();
    assert.equal(results.children[0].textContent, 'No results found for "<b>probe</b>"');
    assert.equal(results.children[0].innerHTML, '');
});
