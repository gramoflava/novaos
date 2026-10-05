const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');

function browser(saved = {}) {
    const storage = new Map(Object.entries(saved));
    const events = new EventTarget();
    const requests = [];
    const prompts = [];
    const windows = new Map();
    let nonceId = 0;
    const node = () => ({ onclick: null, onkeydown: null, value: '', disabled: false, focus() {}, select() {} });
    const context = {
        console, setTimeout, clearTimeout, TextEncoder, Uint8Array, AbortController, URL, crypto: webcrypto,
        document: { readyState: 'loading', currentScript: { src: 'https://nova.test/js/apps/game2048.js' } },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        CustomEvent: class extends Event { constructor(name, init) { super(name); this.detail = init?.detail; } },
        WindowManager: { windows, create(options) {
            const nodes = new Map();
            windows.set(options.id, { content: { querySelector(selector) {
                if (!nodes.has(selector)) nodes.set(selector, node());
                return nodes.get(selector);
            } }, options });
        }, close(id) { const win = windows.get(id); if (win?.cleanup) win.cleanup(); windows.delete(id); } },
        Scores: { showScorePrompt(...args) { prompts.push(args); } },
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (url.includes('/challenges')) return { ok: true, json: async () => ({ ticket: (++nonceId).toString(16).padStart(48, '0'), difficulty: 1, waitMs: 0, expiresIn: 7200 }) };
            return { ok: true, json: async () => ({ saved: true }) };
        }
    };
    context.window = context;
    context.addEventListener = events.addEventListener.bind(events);
    context.removeEventListener = events.removeEventListener.bind(events);
    context.dispatchEvent = events.dispatchEvent.bind(events);
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/uplink.js'), 'utf8'), context);
    const startRun = context.NovaUplink.bindGame('game2048');
    context.document.readyState = 'complete';
    return { context, uplink: context.NovaUplink, startRun, storage, windows, requests, prompts };
}
const enabled = { nova_score_uplink_v1: JSON.stringify({ asked: true, enabled: true }) };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('legacy localStorage scores do not authorize upload or make pre-consent requests', async () => {
    const b = browser({ nova_scores: '{"game2048":[{"initials":"AAA","score":999999}]}' });
    await b.uplink.publish({ game: 'game2048', score: 999999 }, 'AAA');
    b.startRun('game2048')(100, true);
    await tick();
    assert.equal(b.requests.length, 0);
    assert.equal(b.prompts.length, 1);
});

test('new run is single-use and its immutable receipt cannot be forged', async () => {
    const b = browser(enabled);
    const finish = b.startRun('game2048');
    finish(100, true);
    finish(500, true);
    assert.equal(b.prompts.length, 1);
    const receipt = b.prompts[0][5];
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(await b.uplink.publish({ ...receipt }, 'FAK'), 'local');
    assert.equal(await b.uplink.publish(receipt, '<b>'), 'sent');
    const post = b.requests.find(r => r.url.endsWith('/results'));
    assert.deepEqual(Object.keys(JSON.parse(post.options.body)).sort(), ['duration', 'initials', 'nonce', 'score', 'ticket']);
    assert.equal(JSON.parse(post.options.body).initials, 'B');
    assert.equal(post.options.credentials, 'omit');
    assert.equal(post.options.referrerPolicy, 'no-referrer');
});

test('first save opens consent, decline persists, and factory reset re-arms it', async () => {
    const b = browser();
    b.startRun('game2048')(100, true);
    const publishing = b.uplink.publish(b.prompts[0][5], 'ABC');
    assert.equal(b.windows.size, 1);
    const consent = [...b.windows.values()][0];
    consent.content.querySelector('[data-uplink="no"]').onclick();
    assert.equal(await publishing, 'local');
    assert.equal(b.requests.length, 0);
    assert.equal(JSON.parse(b.storage.get('nova_score_uplink_v1')).asked, true);
    b.uplink.reset();
    assert.equal(b.storage.has('nova_score_uplink_v1'), false);
    assert.equal(b.uplink.enabled, false);
});

test('consent permits the first saved score but sends no local history', async () => {
    const b = browser({ nova_scores: '{"game2048":[{"initials":"FAK","score":999999}]}' });
    b.startRun('game2048')(100, true);
    const publishing = b.uplink.publish(b.prompts[0][5], 'ABC');
    [...b.windows.values()][0].content.querySelector('[data-uplink="yes"]').onclick();
    assert.equal(await publishing, 'sent');
    assert.equal(b.requests.filter(r => r.url.endsWith('/results')).length, 1);
    assert.equal(JSON.parse(b.requests[1].options.body).score, 100);
});

test('server outage queues only current in-memory receipts; retry succeeds', async () => {
    const b = browser(enabled);
    b.startRun('game2048')(100, true);
    const working = b.context.fetch;
    b.context.fetch = async () => { throw new Error('offline'); };
    assert.equal(await b.uplink.publish(b.prompts[0][5], 'ABC'), 'offline');
    assert.equal(b.uplink.pendingCount, 1);
    assert.equal(b.storage.has('uploadQueue'), false);
    b.context.fetch = working;
    await b.uplink.retry();
    assert.equal(b.uplink.pendingCount, 0);
});

test('switching uplink off cancels sends and clears pending results', async () => {
    const b = browser(enabled);
    b.startRun('game2048')(100, true);
    b.uplink.setEnabled(false);
    assert.equal(await b.uplink.publish(b.prompts[0][5], 'ABC'), 'local');
    assert.equal(b.requests.filter(r => r.url.endsWith('/results')).length, 0);
    assert.equal(b.uplink.pendingCount, 0);
});

test('Explorer prompt appears once across visits, and reset permits it again', () => {
    const b = browser();
    b.uplink.discovered();
    b.uplink.discovered();
    assert.equal(b.windows.size, 1);
    assert.ok(b.storage.get('nova_explorer_v1'));
    const next = browser(Object.fromEntries(b.storage));
    next.uplink.discovered();
    assert.equal(next.windows.size, 0);
    next.uplink.reset();
    next.uplink.discovered();
    assert.equal(next.windows.size, 1);
});

test('Explorer duplicate exposes original date and lets user change initials', async () => {
    const b = browser(enabled);
    b.uplink.discovered();
    const win = [...b.windows.values()][0];
    win.content.querySelector('input').value = 'ABC';
    const working = b.context.fetch;
    b.context.fetch = async (url, options) => url.endsWith('/results')
        ? { ok: false, status: 409, json: async () => ({ existing: { initials: 'ABC', date: 1000 } }) }
        : working(url, options);
    await win.content.querySelector('.explorer-save').onclick();
    assert.match(win.content.querySelector('.explorer-status').textContent, /ABC already arrived/);
    assert.equal(win.content.querySelector('.explorer-save').disabled, false);
    assert.equal(b.uplink.explorer.initials, undefined);
    b.context.fetch = async (url, options) => url.endsWith('/results')
        ? { ok: true, json: async () => ({ initials: 'DEF', date: 2000 }) } : working(url, options);
    win.content.querySelector('input').value = 'DEF';
    await win.content.querySelector('.explorer-save').onclick();
    assert.equal(b.uplink.explorer.initials, 'DEF');
    assert.equal(b.uplink.explorer.date, 2000);
    assert.equal(b.windows.size, 0);
});

test('Explorer API pagination is read completely', async () => {
    const b = browser(enabled);
    let count = 0;
    b.context.fetch = async () => ({ ok: true, json: async () => ++count === 1
        ? { entries: [{ initials: 'ABC', date: 1000 }], next: 200 }
        : { entries: [{ initials: 'DEF', date: 2000 }], next: null } });
    assert.equal((await b.uplink.board('explorers')).length, 2);
    assert.equal(count, 2);
});

 test('console cannot obtain a new reporter after the game scripts finished loading', () => {
    const b = browser(enabled);
    assert.equal(b.uplink.startRun, undefined);
    assert.throws(() => b.uplink.bindGame('game2048'), /registration is closed/);
    assert.throws(() => b.startRun('wordl-5'), /Wrong score reporter/);
});

test('expired server tickets can be renewed by retry without importing localStorage', async () => {
    const b = browser(enabled);
    b.startRun('game2048')(100, true);
    const working = b.context.fetch;
    b.context.fetch = async (url, options) => url.endsWith('/results')
        ? { ok: false, status: 410, json: async () => ({ error: 'Ticket expired' }) }
        : working(url, options);
    assert.equal(await b.uplink.publish(b.prompts[0][5], 'ABC'), 'offline');
    assert.equal(b.uplink.pendingCount, 1);
    b.context.fetch = working;
    await b.uplink.retry();
    assert.equal(b.uplink.pendingCount, 0);
    assert.equal(b.requests.filter(r => r.url.endsWith('/challenges')).length, 2);
});

test('closing the consent window settles it as local-only', async () => {
    const b = browser();
    b.startRun('game2048')(100, true);
    const publishing = b.uplink.publish(b.prompts[0][5], 'ABC');
    b.context.WindowManager.close([...b.windows.keys()][0]);
    assert.equal(await publishing, 'local');
    assert.equal(b.requests.length, 0);
});
