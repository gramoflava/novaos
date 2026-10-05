class ScoreManager {
    constructor() {
        this.storageKey = 'nova_scores';
        this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            this.scores = data ? JSON.parse(data) : {};

            if (!this.scores || typeof this.scores !== 'object' || Array.isArray(this.scores)) this.scores = {};
            Object.keys(this.scores).forEach(game => {
                this.scores[game] = Array.isArray(this.scores[game]) ? this.scores[game]
                    .filter(row => row && Number.isSafeInteger(row.score) && row.score > 0)
                    .map(row => ({ initials: NovaUplink.normalize(row.initials), score: row.score, date: Number(row.date) || 0 }))
                    .sort((a, b) => b.score - a.score).slice(0, 10) : [];
            });

            // Migration for Minesweeper level-specific scores
            if (this.scores.minesweeper && !this.scores['minesweeper-easy']) {
                this.scores['minesweeper-easy'] = this.scores.minesweeper;
                delete this.scores.minesweeper;
                this.save();
            }
        } catch(e) {
            this.scores = {};
        }
    }

    save() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.scores)); } catch (_e) { /* Keep scores in memory if storage is full or blocked. */ }
    }

    addScore(gameId, initials, score) {
        if (!Number.isSafeInteger(score) || score <= 0) return;
        if (!this.scores[gameId]) this.scores[gameId] = [];
        this.scores[gameId].push({
            initials: NovaUplink.normalize(initials),
            score: score,
            date: Date.now()
        });
        this.scores[gameId].sort((a, b) => b.score - a.score);
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

    isHighScore(gameId, score) {
        if (score <= 0) return false;
        const topScores = this.getTopScores(gameId);
        if (topScores.length < 10) return true;
        return score > topScores[topScores.length - 1].score;
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

        const topScores = this.getTopScores(gameId);
        if (!receipt && topScores.length >= 10 && score <= topScores[9].score) {
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
                <div class="score-prompt-score">${score}</div>
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
            input.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') btn.click();
            });
        }

        let dismissed = false;
        const dismiss = save => {
            if (dismissed) return;
            dismissed = true;
            const initials = NovaUplink.normalize(input.value);
            if (save) this.addScore(gameId, initials, score);

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
            minesweeper: [['minesweeper-easy', 'Easy'], ['minesweeper-medium', 'Med'], ['minesweeper-hard', 'Hard']],
            wordl: [4, 5, 6, 7].map(n => [`wordl-${n}`, `${n} letters`]),
            colorlines: [['colorlines-5', 'Classic (5)'], ['colorlines-4', 'Quick (4)']],
            novarun: [['novarun-lunar', 'Lunar'], ['novarun-classic', 'Dino']]
        };
        let game = initialGame;
        let galactic = NovaUplink.enabled;
        let version = 0;
        let disposed = false;
        const render = async () => {
            const revision = ++version;
            const selectedGame = game;
            const remote = galactic && NovaUplink.enabled;
            container.innerHTML = `<div class="score-view">
                <div class="uplink-controls">
                    <label class="uplink-toggle"><input type="checkbox" ${NovaUplink.enabled ? 'checked' : ''}> Uplink to the galactic scoreboard</label>
                    <button class="btn btn--ghost uplink-refresh" type="button">Refresh / Retry</button>
                </div>
                <div class="score-variants score-sources"><button class="btn ${!remote ? 'btn--primary' : 'btn--ghost'}" data-source="local">This browser</button><button class="btn ${remote ? 'btn--primary' : 'btn--ghost'}" data-source="galactic" ${!NovaUplink.enabled ? 'disabled' : ''}>Galaxy</button></div>
                <div class="score-variants">${(variants[game.split('-')[0]] || []).map(([id, label]) => `<button class="btn ${id === game ? 'btn--primary' : 'btn--ghost'}" data-game="${id}">${label}</button>`).join('')}</div>
                <p class="uplink-status" role="status"></p><div class="score-view__list"></div>
                ${!remote && game !== 'explorers' ? '<button class="btn btn--ghost scores-reset-btn">Clear local scores</button>' : ''}
            </div>`;
            const status = container.querySelector('.uplink-status');
            const list = container.querySelector('.score-view__list');
            container.querySelector('input').onchange = event => {
                galactic = event.target.checked;
                NovaUplink.setEnabled(galactic);
            };
            container.querySelector('.uplink-refresh').onclick = async () => {
                status.textContent = 'Retrying uplink…';
                await NovaUplink.retry();
                if (!disposed) void render();
            };
            container.querySelectorAll('[data-source]').forEach(button => {
                button.onclick = () => { galactic = button.dataset.source === 'galactic'; void render(); };
            });
            container.querySelectorAll('[data-game]').forEach(button => {
                button.onclick = () => { game = button.dataset.game; void render(); };
            });
            const clear = container.querySelector('.scores-reset-btn');
            if (clear) clear.onclick = () => this.clearScores(game);
            const show = entries => {
                list.replaceChildren();
                if (!entries.length) {
                    const empty = document.createElement('p');
                    empty.className = 'score-empty';
                    empty.textContent = selectedGame === 'explorers' ? 'No explorers registered yet.' : 'No scores yet!';
                    list.appendChild(empty);
                }
                entries.forEach((entry, index) => {
                    const row = document.createElement('div');
                    row.className = 'score-row';
                    const rank = document.createElement('span');
                    rank.className = 'score-row__rank';
                    rank.textContent = `#${index + 1}`;
                    const initials = document.createElement('span');
                    initials.className = 'score-row__initials';
                    initials.textContent = NovaUplink.normalize(entry.initials);
                    const value = document.createElement('span');
                    value.className = 'score-row__value';
                    value.textContent = selectedGame === 'explorers' ? new Date(entry.date).toLocaleDateString() : entry.score;
                    row.append(rank, initials, value);
                    list.appendChild(row);
                });
            };
            const local = selectedGame === 'explorers'
                ? (NovaUplink.explorer?.initials ? [NovaUplink.explorer] : []) : this.getTopScores(selectedGame);
            if (!remote) {
                status.textContent = NovaUplink.enabled ? 'Local scores · uplink enabled for new results.' : 'Uplink off · scores stay in this browser.';
                show(local);
                return;
            }
            status.textContent = 'Connecting to NovaScore…';
            try {
                const entries = await NovaUplink.board(selectedGame);
                if (disposed || revision !== version) return;
                status.textContent = NovaUplink.pendingCount ? `Uplink connected · ${NovaUplink.pendingCount} result(s) waiting. Retry to send.` : 'Uplink connected · galactic scoreboard.';
                show(entries);
            } catch (_e) {
                if (disposed || revision !== version) return;
                status.textContent = 'Uplink unavailable · showing this browser’s records. Refresh to retry.';
                show(local);
            }
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
            content: '<div class="score-board-mount" style="height:100%;padding:24px"></div>' });
        const win = WindowManager.windows.get(id);
        const view = this.mountLeaderboard(win.content.firstElementChild, gameId);
        const cleanup = win.cleanup;
        win.cleanup = () => { view.dispose(); if (cleanup) cleanup(); };
    }
}

window.Scores = new ScoreManager();
