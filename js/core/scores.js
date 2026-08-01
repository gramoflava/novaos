class ScoreManager {
    constructor() {
        this.storageKey = 'nova_scores';
        this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            this.scores = data ? JSON.parse(data) : {};

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
        localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
    }

    addScore(gameId, initials, score) {
        if (!this.scores[gameId]) this.scores[gameId] = [];
        this.scores[gameId].push({
            initials: (initials || '???').toUpperCase().substring(0,3),
            score: score,
            date: Date.now()
        });
        this.scores[gameId].sort((a, b) => b.score - a.score);
        this.scores[gameId] = this.scores[gameId].slice(0, 10); // Top 10 max
        this.save();
        window.dispatchEvent(new CustomEvent('scoresUpdated', { detail: { gameId } }));
    }

    getTopScores(gameId) {
        return this.scores[gameId] || [];
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

    showScorePrompt(gameId, score, isWin, onComplete, targetWinId) {
        if (!this.scores[gameId]) {
            this.scores[gameId] = [];
        }

        // Limit to top 10 places and ignore 0 scores
        if (score <= 0) {
            if (onComplete) onComplete();
            return;
        }

        const topScores = this.getTopScores(gameId);
        if (topScores.length >= 10 && score <= topScores[9].score) {
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
                <input class="score-prompt-input" type="text" id="initials-${winId}" maxlength="3">
                <button class="btn btn--primary score-prompt-save" id="save-btn-${winId}">Save Score</button>
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

        btn.onclick = () => {
            const initials = input.value || '???';
            this.addScore(gameId, initials, score);

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
        };
    }

    showLeaderboard(gameName, gameId) {
        const winId = 'leaderboard-' + gameId + '-' + Date.now();
        let currentSubId = gameId;

        const isMines = gameId.startsWith('minesweeper');

        const renderList = (id) => {
            const scores = this.getTopScores(id);
            let listHtml = '';
            if(scores.length === 0) {
                listHtml = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">No scores yet!</div>';
            } else {
                scores.forEach((s, i) => {
                    listHtml += `
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--line);">
                            <span style="font-weight: 600; color: var(--text-secondary); width: 30px;">#${i+1}</span>
                            <span style="font-weight: bold; color: var(--text); flex: 1; text-align: left;">${s.initials}</span>
                            <span style="color: var(--accent); font-variant-numeric: tabular-nums;">${s.score}</span>
                        </div>
                    `;
                });
            }
            return listHtml;
        };

        const selectorHtml = isMines ? `
            <div class="lb-selector" style="display: flex; background: var(--surface-sunk); padding: 4px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <div class="lb-opt ${gameId === 'minesweeper-easy' ? 'active' : ''}" data-id="minesweeper-easy" style="flex: 1; text-align: center; font-size: 11px; padding: 6px; border-radius: var(--radius-sm); cursor: pointer;">Easy</div>
                <div class="lb-opt ${gameId === 'minesweeper-medium' ? 'active' : ''}" data-id="minesweeper-medium" style="flex: 1; text-align: center; font-size: 11px; padding: 6px; border-radius: var(--radius-sm); cursor: pointer;">Med</div>
                <div class="lb-opt ${gameId === 'minesweeper-hard' ? 'active' : ''}" data-id="minesweeper-hard" style="flex: 1; text-align: center; font-size: 11px; padding: 6px; border-radius: var(--radius-sm); cursor: pointer;">Hard</div>
            </div>
        ` : '';

        const html = `
            <div style="padding: 24px; display: flex; flex-direction: column; height: 100%; background: var(--bg);">
                <h3 style="color: var(--text); margin-bottom: 16px; text-align: center;">${gameName} Leaderboard</h3>
                ${selectorHtml}
                <div id="lb-list-${winId}" style="flex: 1; overflow-y: auto; padding-right: 8px;">
                    ${renderList(gameId)}
                </div>
                <button id="lb-close-${winId}" style="margin-top: 16px; background: var(--surface-sunk); color: var(--text); border: 1px solid var(--line); padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; transition: background 0.2s;">Close</button>
            </div>
            <style>
                #lb-close-${winId}:hover { background: var(--glass-hover); }
                .lb-opt { transition: all 0.2s; color: var(--text-secondary); }
                .lb-opt:hover { background: var(--surface-sunk); color: var(--text); }
                .lb-opt.active { background: var(--accent); color: var(--text-on-accent); box-shadow: var(--shadow-md); }
            </style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'scores',
            title: 'Scores',
            width: 300,
            height: 500,
            content: html
        });

        const winEl = WindowManager.windows.get(winId).el;
        if (isMines) {
            winEl.querySelectorAll('.lb-opt').forEach(opt => {
                opt.onclick = () => {
                    winEl.querySelectorAll('.lb-opt').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    const list = winEl.querySelector(`#lb-list-${winId}`);
                    list.innerHTML = renderList(opt.dataset.id);
                };
            });
        }

        document.getElementById(`lb-close-${winId}`).onclick = () => {
            WindowManager.close(winId);
        };
    }
}

window.Scores = new ScoreManager();
