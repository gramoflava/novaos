// Minesweeper's score is the solve time in ms: lower is better. Everywhere
// else more points win, and an equal score goes to the shorter run.
const lowerIsBetter = gameId => String(gameId).startsWith('minesweeper');
const rankScores = gameId => (a, b) =>
    (lowerIsBetter(gameId) ? a.score - b.score : b.score - a.score) ||
    ((a.duration ?? Infinity) - (b.duration ?? Infinity)) ||
    ((a.date || 0) - (b.date || 0));
const RULES_VERSION = 2;

class ScoreManager {
    constructor() {
        this.storageKey = 'nova_scores';
        this.rulesKey = 'nova_scores_rules';
        this.load();
    }

    lowerIsBetter(gameId) { return lowerIsBetter(gameId); }

    // How a score reads: Minesweeper as seconds with hundredths, the rest as points.
    format(gameId, score) {
        return lowerIsBetter(gameId) ? `${(score / 1000).toFixed(2)} s` : Number(score).toLocaleString();
    }

    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            this.scores = data ? JSON.parse(data) : {};

            if (!this.scores || typeof this.scores !== 'object' || Array.isArray(this.scores)) this.scores = {};
            // Oldest format: one Minesweeper board before levels existed.
            if (this.scores.minesweeper && !this.scores['minesweeper-easy']) {
                this.scores['minesweeper-easy'] = this.scores.minesweeper;
            }
            delete this.scores.minesweeper;
            let rules = 1;
            try { rules = Number(localStorage.getItem(this.rulesKey)) || 1; } catch (_e) { /* treat as old */ }
            Object.keys(this.scores).forEach(game => {
                let rows = Array.isArray(this.scores[game]) ? this.scores[game]
                    .filter(row => row && Number.isSafeInteger(row.score) && row.score > 0)
                    .map(row => ({ initials: NovaUplink.normalize(row.initials), score: row.score, date: Number(row.date) || 0,
                        duration: Number.isSafeInteger(row.duration) ? row.duration : null })) : [];
                if (rules < 2) {
                    // Minesweeper stored 9999 − 10 × seconds; now the time itself, in ms.
                    if (lowerIsBetter(game)) rows = rows.filter(row => row.score <= 9999 && row.score % 10 === 9 && row.score < 9999)
                        .map(row => ({ ...row, score: (9999 - row.score) * 100, duration: (9999 - row.score) * 100 }));
                    // Wordl's totals included a time bonus that no longer exists.
                    if (game.startsWith('wordl') || game === 'colorlines-4') rows = [];
                }
                this.scores[game] = rows.sort(rankScores(game)).slice(0, 10);
            });

            if (rules < RULES_VERSION) {
                this.save();
                try { localStorage.setItem(this.rulesKey, String(RULES_VERSION)); } catch (_e) { /* retried next load */ }
            }
        } catch(e) {
            this.scores = {};
        }
    }

    save() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.scores)); } catch (_e) { /* Keep scores in memory if storage is full or blocked. */ }
    }

    addScore(gameId, initials, score, duration = null) {
        if (!Number.isSafeInteger(score) || score <= 0) return;
        if (!this.scores[gameId]) this.scores[gameId] = [];
        this.scores[gameId].push({
            initials: NovaUplink.normalize(initials),
            score: score,
            date: Date.now(),
            duration: Number.isSafeInteger(duration) ? duration : null
        });
        this.scores[gameId].sort(rankScores(gameId));
        this.scores[gameId] = this.scores[gameId].slice(0, 10); // Top 10 max
        this.save();
        window.dispatchEvent(new CustomEvent('scoresUpdated', { detail: { gameId } }));
    }

    getTopScores(gameId) {
        return (this.scores[gameId] || []).map(row => ({ ...row }));
    }

    clearScores(gameId) {
        this.scores[gameId] = [];
        this.save();
        window.dispatchEvent(new CustomEvent('scoresUpdated', { detail: { gameId } }));
    }

    // Would this result enter the local top 10?
    isHighScore(gameId, score, duration = null) {
        if (score <= 0) return false;
        const topScores = this.getTopScores(gameId);
        if (topScores.length < 10) return true;
        return rankScores(gameId)({ score, duration, date: Infinity }, topScores[topScores.length - 1]) < 0;
    }

    showScorePrompt(gameId, score, isWin, onComplete, targetWinId, receipt) {
        if (!this.scores[gameId]) {
            this.scores[gameId] = [];
        }

        // Limit to top 10 places and ignore 0 scores
        if (score <= 0) {
            if (onComplete) onComplete();
            return;
        }

        const duration = receipt ? receipt.duration : null;
        if (!receipt && !this.isHighScore(gameId, score, duration)) {
            if (onComplete) onComplete();
            return;
        }

        let container = document.body;
        if (targetWinId) {
            const targetWinObj = WindowManager.windows.get(targetWinId);
            if (targetWinObj) container = targetWinObj.content;
        }

        // A game window may only own one pending result at a time. Besides
        // preventing visual duplicates, this keeps repeated end-game signals
        // from registering the same run twice.
        if (container.querySelector('.score-prompt-overlay')) {
            return;
        }

        const winId = 'score-' + Date.now();
        const html = `
            <div id="${winId}-overlay" class="score-prompt-overlay">
                <h2 class="${isWin ? 'score-prompt-result--win' : 'score-prompt-result--loss'}">
                    ${isWin ? 'Board Cleared!' : 'Game Over'}
                </h2>
                <div class="score-prompt-score">${this.format(gameId, score)}</div>
                <div class="score-prompt-copy">Enter 3 initials for the leaderboard:</div>
                <input class="score-prompt-input" type="text" aria-label="Initials" id="initials-${winId}" maxlength="3">
                <button class="btn btn--primary score-prompt-save" id="save-btn-${winId}">Save Score</button>
                <button class="btn btn--ghost" id="skip-btn-${winId}" style="margin-top:12px">Skip</button>
            </div>
            <style id="style-${winId}">
                .score-prompt-overlay { position: absolute; inset: 0; z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(var(--blur-panel)); opacity: 0; pointer-events: auto; animation: scoreFadeIn var(--dur-slow) var(--ease-smooth) forwards; transition: opacity var(--dur-slow) var(--ease-smooth); }
                .score-prompt-result--win, .score-prompt-result--loss { margin-bottom: 8px; }
                .score-prompt-result--win { color: var(--success); }
                .score-prompt-result--loss { color: var(--danger); }
                .score-prompt-score { margin-bottom: 24px; color: var(--text); font-size: 48px; font-weight: 300; text-shadow: var(--shadow-sm); }
                .score-prompt-copy { margin-bottom: 16px; color: var(--text-secondary); font-size: 14px; }
                .score-prompt-input { width: 100px; margin-bottom: 24px; padding: 8px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); outline: none; background: var(--glass-hover); box-shadow: var(--glass-edge); color: var(--text); text-align: center; text-transform: uppercase; font-size: 24px; letter-spacing: 4px; }
                .score-prompt-save { padding: 12px 24px; font-size: 16px; }
                @keyframes scoreFadeIn { from { opacity: 0; transform: scale(1.1); } to { opacity: 1; transform: scale(1); } }
                #save-btn-${winId}:hover { filter: brightness(1.1); transform: translateY(-1px); }
                #save-btn-${winId}:active { transform: translateY(1px); }
                #initials-${winId}:focus { border-color: var(--accent); box-shadow: var(--shadow-sm); }
            </style>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const overlayNode = wrapper.firstElementChild;
        const styleNode = wrapper.lastElementChild;
        styleNode.id = `style-${winId}`;
        container.appendChild(overlayNode);
        container.appendChild(styleNode);

        // Global Celebration
        if (isWin && window.NovaEffects) {
            let burstX = window.innerWidth / 2;
            let burstY = window.innerHeight / 2;

            if (targetWinId && window.WindowManager) {
                const win = WindowManager.windows.get(targetWinId);
                if (win) {
                    const wx = parseFloat(win.el.dataset.x);
                    const wy = parseFloat(win.el.dataset.y);
                    const ww = parseFloat(win.el.dataset.w);
                    const wh = parseFloat(win.el.dataset.h);
                    burstX = wx + ww / 2;
                    burstY = wy + wh / 2;
                }
            }

            const gameColors = {
                'minesweeper': ['#EF4444', '#3B82F6', '#fff'],
                'game2048': ['#8B5CF6', '#EC4899', '#fff'],
                'colorlines': ['#10B981', '#F59E0B', '#fff'],
                'wordl': ['#22C55E', '#EAB308', '#fff'],
                'novarun': ['#06B6D4', '#8B5CF6', '#fff']
            };
            const colors = gameColors[gameId.split('-')[0]] || ['var(--accent)', '#fff'];

            // Unified Celebration: Start persistent effect if winning
            NovaEffects.startCelebration(burstX, burstY, {
                colors: colors,
                flash: true,
                flashColor: 'rgba(255, 255, 255, 0.15)'
            });
        }

        const btn = document.getElementById(`save-btn-${winId}`);
        const input = document.getElementById(`initials-${winId}`);
        if(input) {
            input.focus();
            input.addEventListener('keydown', (e) => NovaUplink.latinKey(e, input));
            input.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') btn.click();
            });
        }

        let dismissed = false;
        const dismiss = save => {
            if (dismissed) return;
            dismissed = true;
            const initials = NovaUplink.normalize(input.value);
            if (save) this.addScore(gameId, initials, score, duration);

            const overlay = document.getElementById(`${winId}-overlay`);
            if (overlay) {
                // Fade out overlay
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';

                setTimeout(() => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    const styleTag = document.getElementById(`style-${winId}`);
                    if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);

                    // Stop celebration after overlay is gone + some delay
                    setTimeout(() => {
                        if (window.NovaEffects) NovaEffects.stopCelebration();
                    }, 1000);
                }, 500);
            }

            if (onComplete) onComplete();
            if (save && receipt) void NovaUplink.publish(receipt, initials);
        };
        btn.onclick = () => dismiss(true);
        document.getElementById(`skip-btn-${winId}`).onclick = () => dismiss(false);
    }

    mountLeaderboard(container, initialGame) {
        const variants = {
            minesweeper: [['minesweeper-easy', 'Beginner'], ['minesweeper-medium', 'Intermediate'], ['minesweeper-hard', 'Expert']],
            wordl: [4, 5, 6, 7].map(n => [`wordl-${n}`, `${n} letters`]),
            novarun: [['novarun-lunar', 'Lunar'], ['novarun-classic', 'Dino']]
        };
        const select = (role, label, items, current) => `<select class="game-select" data-role="${role}" aria-label="${label}">${items.map(([value, text]) =>
            `<option value="${value}" ${value === current ? 'selected' : ''}>${text}</option>`).join('')}</select>`;
        const formatDate = timestamp => {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const sameYear = date.getFullYear() === new Date().getFullYear();
            return date.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
        };
        let game = initialGame;
        let galactic = NovaUplink.enabled;
        let version = 0;
        let disposed = false;
        const render = async () => {
            const revision = ++version;
            const selectedGame = game;
            const explorers = selectedGame === 'explorers';
            const remote = galactic && NovaUplink.enabled;
            const local = explorers
                ? (NovaUplink.explorer?.initials ? [NovaUplink.explorer] : []) : this.getTopScores(selectedGame);
            const gameVariants = variants[selectedGame.split('-')[0]] || [];
            container.innerHTML = `<div class="score-view">
                <div class="game-toolbar">
                    <div class="game-toolbar__group">
                        ${select('source', 'Scoreboard', [['local', 'Local'], ['galactic', 'Galaxy']], galactic ? 'galactic' : 'local')}
                        ${gameVariants.length > 1 ? select('mode', 'Mode', gameVariants, selectedGame) : ''}
                        <button class="game-icon-btn game-icon-btn--restart uplink-refresh" type="button" title="Refresh" aria-label="Refresh scoreboard"></button>
                    </div>
                    <div class="game-toolbar__spacer"></div>
                    ${!galactic && !explorers && local.length ? '<button type="button" class="btn btn--danger scores-reset-btn">Clear local</button>' : ''}
                </div>
                <ol class="score-view__list" aria-label="Leaderboard"></ol>
                <div class="score-footer">
                    <label class="switch">
                        <input type="checkbox" class="uplink-switch" ${NovaUplink.enabled ? 'checked' : ''}>
                        <span class="switch__track"></span>
                        <span class="score-footer__label">Send new results to the galaxy</span>
                    </label>
                    <span class="game-toolbar__spacer"></span>
                    <div class="game-stat score-stat--uplink" title=""><div class="game-stat__label">Uplink</div><div class="game-stat__value score-status" role="status">—</div></div>
                </div>
            </div>`;
            const statusBox = container.querySelector('.score-stat--uplink');
            const status = container.querySelector('.score-status');
            const refresh = container.querySelector('.uplink-refresh');
            const list = container.querySelector('.score-view__list');
            const setStatus = (kind, text, detail) => {
                status.dataset.kind = kind;
                status.textContent = text;
                statusBox.title = detail || text;
            };
            container.querySelector('.uplink-switch').onchange = event => {
                galactic = event.target.checked;
                NovaUplink.setEnabled(galactic);
            };
            refresh.onclick = async () => {
                refresh.disabled = true;
                refresh.classList.add('is-spinning');
                setStatus('busy', 'Sync', 'Retrying uplink…');
                await NovaUplink.retry();
                if (!disposed) void render();
            };
            container.querySelector('[data-role="source"]').onchange = event => { galactic = event.target.value === 'galactic'; void render(); };
            const mode = container.querySelector('[data-role="mode"]');
            if (mode) mode.onchange = event => { game = event.target.value; void render(); };
            const clear = container.querySelector('.scores-reset-btn');
            if (clear) clear.onclick = () => this.clearScores(selectedGame);

            const empty = (title, hint, action) => {
                const box = document.createElement('li');
                box.className = 'score-empty';
                const heading = document.createElement('div');
                heading.className = 'settings-label';
                heading.textContent = title;
                box.appendChild(heading);
                if (hint) {
                    const copy = document.createElement('div');
                    copy.className = 'hint';
                    copy.textContent = hint;
                    box.appendChild(copy);
                }
                if (action) box.appendChild(action);
                list.replaceChildren(box);
            };
            const show = entries => {
                list.replaceChildren();
                if (!entries.length) {
                    if (explorers) return empty('No explorers yet', 'Reach the other side to sign the log.');
                    return empty('No scores yet', remote ? 'Be the first in the galaxy.' : 'Play a round to set the first record.');
                }
                entries.forEach((entry, index) => {
                    const row = document.createElement('li');
                    row.className = 'score-row';
                    if (index < 3) row.dataset.podium = String(index + 1);
                    const rank = document.createElement('span');
                    rank.className = 'score-row__rank';
                    rank.textContent = String(index + 1);
                    const initials = document.createElement('span');
                    initials.className = 'score-row__initials';
                    initials.textContent = NovaUplink.normalize(entry.initials);
                    const value = document.createElement('span');
                    value.className = 'score-row__value';
                    const date = document.createElement('span');
                    date.className = 'score-row__date';
                    if (explorers) {
                        value.textContent = formatDate(entry.date);
                    } else {
                        value.textContent = this.format(selectedGame, entry.score);
                        date.textContent = formatDate(entry.date);
                        if (!lowerIsBetter(selectedGame) && Number.isFinite(entry.duration)) {
                            const seconds = Math.round(entry.duration / 1000);
                            row.title = `in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
                        }
                    }
                    row.append(rank, initials, value, date);
                    list.appendChild(row);
                });
            };

            const waiting = NovaUplink.enabled ? NovaUplink.pendingCount : 0;
            if (!remote) {
                refresh.disabled = !waiting;
                if (!NovaUplink.enabled) setStatus('off', 'Off', 'Uplink off · scores stay in this browser.');
                else if (waiting) setStatus('warn', `${waiting} queued`, `${waiting} result(s) waiting. Refresh to send.`);
                else setStatus('ok', 'On', 'Uplink enabled for new results.');
                if (galactic) {
                    const enable = document.createElement('button');
                    enable.type = 'button';
                    enable.className = 'btn btn--primary';
                    enable.textContent = 'Turn on uplink';
                    enable.onclick = () => NovaUplink.setEnabled(true);
                    return empty('Uplink is off', 'Turn it on to see the galactic scoreboard.', enable);
                }
                show(local);
                return;
            }
            setStatus('busy', 'Sync', 'Connecting to NovaScore…');
            list.setAttribute('aria-busy', 'true');
            // Only the request sits in try: a rendering bug must not pose as "Offline".
            let entries;
            try {
                entries = await NovaUplink.board(selectedGame);
            } catch (error) {
                if (disposed || revision !== version) return;
                list.removeAttribute('aria-busy');
                const reason = error.status ? `NovaScore answered ${error.status}` : 'NovaScore could not be reached from this page';
                setStatus('error', 'Offline', `${reason} · showing this browser’s records. Refresh to retry.`);
                show(local);
                const note = document.createElement('li');
                note.className = 'score-note hint';
                note.textContent = `Galaxy unavailable (${error.status || 'no response'}) — showing this browser’s records.`;
                list.prepend(note);
                return;
            }
            if (disposed || revision !== version) return;
            list.removeAttribute('aria-busy');
            if (waiting) setStatus('warn', `${waiting} queued`, `Connected · ${waiting} result(s) waiting. Refresh to send.`);
            else setStatus('ok', 'Online', 'Connected to the galactic scoreboard.');
            show(entries);
        };
        const update = () => { if (!disposed) void render(); };
        window.addEventListener('scoresUpdated', update);
        window.addEventListener('uplinkUpdated', update);
        void render();
        return {
            select(id) { game = id; update(); },
            dispose() {
                disposed = true;
                version++;
                window.removeEventListener('scoresUpdated', update);
                window.removeEventListener('uplinkUpdated', update);
            }
        };
    }

    showLeaderboard(_gameName, gameId) {
        const id = 'leaderboard-' + gameId + '-' + Date.now();
        WindowManager.create({ id, appId: 'scores', title: 'Scores', width: 370, height: 520,
            content: '<div class="score-board-mount" style="height:100%;padding:var(--space-5)"></div>' });
        const win = WindowManager.windows.get(id);
        const view = this.mountLeaderboard(win.content.firstElementChild, gameId);
        const cleanup = win.cleanup;
        win.cleanup = () => { view.dispose(); if (cleanup) cleanup(); };
    }
}

window.Scores = new ScoreManager();
