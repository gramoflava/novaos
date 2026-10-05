const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Arrays from the vm context belong to another realm; compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));

function scores(saved = {}) {
    const storage = new Map(Object.entries(saved));
    const context = {
        localStorage: {
            getItem: key => (storage.has(key) ? storage.get(key) : null),
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: key => storage.delete(key)
        },
        NovaUplink: { normalize: value => String(value || '???').toUpperCase().replace(/[^A-Z0-9?]/g, '').slice(0, 3) || '???' },
        CustomEvent: class extends Event { constructor(name, init) { super(name); this.detail = init?.detail; } },
        Date, Number, String, Math, JSON, Infinity
    };
    context.window = context;
    context.dispatchEvent = () => true;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/scores.js'), 'utf8'), context);
    return { manager: context.Scores, storage };
}

test('old local records migrate once to the new rules', () => {
    const { manager, storage } = scores({
        nova_scores: JSON.stringify({
            'minesweeper-easy': [{ initials: 'AAA', score: 9869, date: 1 }, { initials: 'BAD', score: 9999, date: 2 }],
            minesweeper: [{ initials: 'OLD', score: 9009, date: 3 }],
            'wordl-5': [{ initials: 'WRD', score: 3712, date: 4 }],
            'colorlines-4': [{ initials: 'QCK', score: 80, date: 5 }],
            game2048: [{ initials: 'KEP', score: 20480, date: 6 }]
        })
    });
    assert.deepEqual(plain(manager.getTopScores('minesweeper-easy').map(r => [r.initials, r.score])), [['AAA', 13000]]);
    assert.equal(manager.getTopScores('wordl-5').length, 0);
    assert.equal(manager.getTopScores('colorlines-4').length, 0);
    assert.equal(manager.getTopScores('game2048')[0].score, 20480);
    assert.equal(storage.get('nova_scores_rules'), '2');

    // A second load must not convert the already converted times again.
    const again = scores(Object.fromEntries(storage)).manager;
    assert.equal(again.getTopScores('minesweeper-easy')[0].score, 13000);
});

test('Minesweeper ranks lower times first; points games break ties by duration', () => {
    const { manager } = scores({ nova_scores_rules: '2' });
    manager.addScore('minesweeper-easy', 'SLO', 30000, 30000);
    manager.addScore('minesweeper-easy', 'FST', 12340, 12340);
    assert.deepEqual(plain(manager.getTopScores('minesweeper-easy').map(r => r.initials)), ['FST', 'SLO']);
    assert.equal(manager.format('minesweeper-easy', 12340), '12.34 s');

    manager.addScore('colorlines-5', 'SLO', 500, 600000);
    manager.addScore('colorlines-5', 'LOW', 400, 1000);
    manager.addScore('colorlines-5', 'FST', 500, 60000);
    assert.deepEqual(plain(manager.getTopScores('colorlines-5').map(r => r.initials)), ['FST', 'SLO', 'LOW']);
});

test('the top-10 check follows each game direction', () => {
    const { manager } = scores({ nova_scores_rules: '2' });
    for (let i = 1; i <= 10; i++) manager.addScore('minesweeper-hard', 'T' + i, i * 10000, i * 10000);
    assert.equal(manager.isHighScore('minesweeper-hard', 99000, 99000), true);
    assert.equal(manager.isHighScore('minesweeper-hard', 150000, 150000), false);
    for (let i = 1; i <= 10; i++) manager.addScore('game2048', 'P' + i, i * 100, 1000);
    assert.equal(manager.isHighScore('game2048', 100, 500), true);   // ties the 10th, but faster
    assert.equal(manager.isHighScore('game2048', 100, 5000), false);
    assert.equal(manager.isHighScore('game2048', 96, 1), false);
});
