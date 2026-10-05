// No local score is a credential. Only an in-memory receipt from a new run can uplink.
(() => {
    'use strict';
    const preferenceKey = 'nova_score_uplink_v1';
    const explorerKey = 'nova_explorer_v1';
    const receipts = new WeakSet();
    const pending = new Map();
    const endpoint = window.NOVA_SCORE_API || 'https://novascore.gramof.us';
    let generation = 0;
    let consentDialog = null;
    const boundGames = new Set();
    const read = key => {
        try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_e) { return null; }
    };
    const write = (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (_e) { /* Session still works without storage. */ }
    };
    let preference = read(preferenceKey) || { asked: false, enabled: false };
    let explorer = read(explorerKey);
    const changed = () => window.dispatchEvent(new CustomEvent('uplinkUpdated'));
    const normalize = value => String(value || '???').toUpperCase().replace(/[^A-Z0-9?]/g, '').slice(0, 3) || '???';

    async function request(path, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        try {
            const response = await fetch(endpoint + path, {
                method: body ? 'POST' : 'GET',
                headers: body ? { 'Content-Type': 'application/json' } : {},
                body: body ? JSON.stringify(body) : undefined,
                credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal
            });
            const data = await response.json();
            if (!response.ok) {
                const error = new Error(data.error || 'Uplink unavailable');
                error.status = response.status;
                error.data = data;
                throw error;
            }
            return data;
        } finally { clearTimeout(timeout); }
    }

    async function ticket(game) {
        const data = await request('/v1/challenges', { game });
        if (!/^[a-f0-9]{48}$/.test(data.ticket) || !Number.isInteger(data.difficulty) || data.difficulty < 1 || data.difficulty > 4 ||
            !Number.isInteger(data.waitMs) || data.waitMs < 0 || data.waitMs > 5000 ||
            !Number.isInteger(data.expiresIn) || data.expiresIn < 60 || data.expiresIn > 86400) {
            throw new Error('Invalid uplink response');
        }
        return { ...data, received: Date.now() };
    }

    async function proof(challenge, initials, score, epoch) {
        const encoder = new TextEncoder();
        const prefix = '0'.repeat(challenge.difficulty);
        const deadline = Date.now() + 15000;
        for (let nonce = 0; nonce < 1000000; nonce++) {
            if (!preference.enabled || generation !== epoch) throw new Error('Uplink disabled');
            const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${challenge.ticket}:${initials}:${score}:${nonce}`));
            const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
            if (hex.startsWith(prefix)) return String(nonce);
            if (nonce % 128 === 0) {
                if (Date.now() > deadline) throw new Error('Uplink busy');
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        throw new Error('Uplink busy');
    }

    function setEnabled(enabled) {
        preference = { asked: true, enabled: !!enabled };
        generation++;
        write(preferenceKey, preference);
        if (!enabled) pending.clear();
        changed();
    }

    function consent() {
        if (preference.asked) return Promise.resolve(preference.enabled);
        if (consentDialog) return consentDialog;
        consentDialog = new Promise(resolve => {
            const id = 'uplink-consent-' + Date.now();
            WindowManager.create({ id, appId: 'scores', title: 'Galactic uplink', width: 360, height: 320,
                content: `<div class="uplink-dialog"><h3>Compete across the galaxy?</h3><p>Share your achievements with the galaxy. Only your score, initials and the date are shared — just a little friendly competition.</p><button class="btn btn--primary" data-uplink="yes">Enable uplink</button><button class="btn btn--ghost" data-uplink="no">Keep it local</button></div>` });
            const win = WindowManager.windows.get(id);
            let settled = false;
            const finish = enabled => {
                if (settled) return;
                settled = true;
                setEnabled(enabled);
                consentDialog = null;
                resolve(enabled);
            };
            win.content.querySelector('[data-uplink="yes"]').onclick = () => { finish(true); WindowManager.close(id); };
            win.content.querySelector('[data-uplink="no"]').onclick = () => { finish(false); WindowManager.close(id); };
            const cleanup = win.cleanup;
            win.cleanup = () => { finish(false); if (cleanup) cleanup(); };
        });
        return consentDialog;
    }

    // The returned reporter stays in the game's closure; the persisted leaderboard is never read here.
    function startRun(game, targetWinId) {
        let reported = false;
        const run = { game, challenge: null, epoch: generation };
        if (preference.enabled) run.challenge = ticket(game).catch(() => null);
        return (score, isWin, onComplete) => {
            if (reported) return;
            reported = true;
            const receipt = Object.freeze({ game, score: Math.floor(score), run });
            receipts.add(receipt);
            Scores.showScorePrompt(game, receipt.score, isWin, onComplete, targetWinId, receipt);
        };
    }

    // Bind each game while its original script is loading. There is no public run/report
    // method left to call from the console after startup; factories live in game closures.
    function bindGame(app) {
        const sources = {
            game2048: '/js/apps/game2048.js', minesweeper: '/js/apps/minesweeper.js',
            wordl: '/js/apps/wordl.js', colorlines: '/js/apps/colorlines.js',
            columns: '/js/apps/columns.js', novarun: '/js/apps/novarun.js', asteroids: '/js/core/asteroids.js'
        };
        const src = document.currentScript?.src;
        if (document.readyState !== 'loading' || !sources[app] || !src ||
            !new URL(src).pathname.endsWith(sources[app]) || boundGames.has(app)) {
            throw new Error('Score reporter registration is closed');
        }
        boundGames.add(app);
        return (game, targetWinId) => {
            if (game.split('-')[0] !== app) throw new Error('Wrong score reporter');
            return startRun(game, targetWinId);
        };
    }

    async function submit(receipt, initials) {
        if (!receipts.has(receipt) || !preference.enabled) return;
        const epoch = generation;
        let challenge = await receipt.run.challenge;
        if (!challenge || Date.now() - challenge.received > (challenge.expiresIn - 10) * 1000 || receipt.run.epoch !== epoch) {
            challenge = await ticket(receipt.game);
            receipt.run.challenge = Promise.resolve(challenge);
            receipt.run.epoch = epoch;
        }
        const safeInitials = normalize(initials);
        const nonce = await proof(challenge, safeInitials, receipt.score, epoch);
        const wait = challenge.received + challenge.waitMs - Date.now();
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        if (!preference.enabled || generation !== epoch) throw new Error('Uplink disabled');
        return request('/v1/results', { ticket: challenge.ticket, nonce, initials: safeInitials, score: receipt.score });
    }

    async function publish(receipt, initials) {
        if (!receipts.has(receipt)) return 'local';
        if (!await consent()) return 'local';
        try {
            await submit(receipt, initials);
            pending.delete(receipt);
            changed();
            return 'sent';
        } catch (error) {
            if (error.status === 410) receipt.run.challenge = null;
            if (preference.enabled) {
                if (pending.size >= 50) pending.delete(pending.keys().next().value);
                pending.set(receipt, normalize(initials));
            }
            changed();
            return 'offline';
        }
    }

    async function retry() {
        if (!preference.enabled) return;
        for (const [receipt, initials] of [...pending]) {
            try { await submit(receipt, initials); pending.delete(receipt); } catch (error) {
                if (error.status === 410) receipt.run.challenge = null;
            }
        }
        changed();
    }

    async function board(game) {
        const entries = [];
        let after = 0;
        do {
            const page = await request(`/v1/boards/${encodeURIComponent(game)}${after ? '?after=' + after : ''}`);
            if (!Array.isArray(page.entries)) throw new Error('Invalid uplink response');
            entries.push(...page.entries);
            if (page.next != null && (!Number.isSafeInteger(page.next) || page.next <= after)) throw new Error('Invalid page cursor');
            after = page.next || 0;
        } while (after);
        return entries;
    }

    function explorerReceipt() {
        const receipt = Object.freeze({ game: 'explorers', score: 0, run: { game: 'explorers', epoch: generation, challenge: null } });
        receipts.add(receipt);
        return receipt;
    }

    function discovered() {
        if (explorer) return;
        explorer = { offered: true, date: Date.now() };
        write(explorerKey, explorer); // Includes dismissal/offline paths; another fall never prompts again.
        changed();
        const receipt = explorerReceipt();
        const id = 'explorer-' + Date.now();
        WindowManager.create({ id, appId: 'scores', title: 'Explorer', width: 360, height: 380,
            content: `<div class="uplink-dialog"><h3>You reached the other side.</h3><p>Leave your initials in the Explorers log?</p><input class="score-prompt-input" aria-label="Initials" maxlength="3" placeholder="???"><p class="explorer-status" role="status"></p><button class="btn btn--primary explorer-save">Register initials</button><button class="btn btn--ghost explorer-ack">Acknowledge</button></div>` });
        const win = WindowManager.windows.get(id);
        const input = win.content.querySelector('input');
        const status = win.content.querySelector('.explorer-status');
        const save = win.content.querySelector('.explorer-save');
        win.content.querySelector('.explorer-ack').onclick = () => WindowManager.close(id);
        save.onclick = async () => {
            save.disabled = true;
            const initials = normalize(input.value);
            input.value = initials;
            if (!await consent()) {
                explorer = { ...explorer, initials };
                write(explorerKey, explorer);
                changed();
                WindowManager.close(id);
                return;
            }
            status.textContent = 'Connecting to NovaScore…';
            try {
                const result = await submit(receipt, initials);
                explorer = { offered: true, initials: result.initials, date: result.date, published: true };
                write(explorerKey, explorer);
                changed();
                WindowManager.close(id);
            } catch (error) {
                if (error.status === 409 && error.data.existing) {
                    const previous = error.data.existing;
                    status.textContent = `${previous.initials} already arrived on ${new Date(previous.date).toLocaleDateString()}. Try other initials or Acknowledge.`;
                    receipt.run.challenge = null;
                    input.focus();
                    input.select();
                } else {
                    if (error.status === 410) receipt.run.challenge = null;
                    status.textContent = 'Uplink unavailable. You can retry here or Acknowledge.';
                }
                save.disabled = false;
            }
        };
        input.onkeydown = event => { if (event.key === 'Enter' && !save.disabled) save.click(); };
        input.focus();
    }

    window.NovaUplink = Object.freeze({
        bindGame, publish, board, retry, discovered, normalize, setEnabled,
        get enabled() { return !!preference.enabled; },
        get pendingCount() { return pending.size; },
        get explorer() { return explorer ? { ...explorer } : null; },
        reset() {
            generation++;
            preference = { asked: false, enabled: false };
            explorer = null;
            pending.clear();
            localStorage.removeItem(preferenceKey);
            localStorage.removeItem(explorerKey);
            changed();
        }
    });
})();
