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

        const winId = 'score-' + Date.now();
        const html = `
            <div id="${winId}-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                <h2 style="color: ${isWin ? 'var(--accent-tertiary)' : 'var(--accent-secondary)'}; margin-bottom: 8px;">
                    ${isWin ? 'Board Cleared!' : 'Game Over'}
                </h2>
                <div style="font-size: 48px; font-weight: 300; margin-bottom: 24px; color: var(--text-primary); text-shadow: 0 0 20px rgba(255,255,255,0.2);">${score}</div>
                <div style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">Enter 3 initials for the leaderboard:</div>
                <input type="text" id="initials-${winId}" maxlength="3" style="width: 100px; text-align: center; font-size: 24px; letter-spacing: 4px; text-transform: uppercase; background: rgba(255,255,255,0.1); border: 1px solid var(--border-glass-strong); color: var(--text-primary); padding: 8px; border-radius: 8px; margin-bottom: 24px; outline: none; box-shadow: var(--shadow-inset);">
                <button id="save-btn-${winId}" style="background: var(--accent-primary); color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; transition: all 0.2s; font-weight: 500;">Save Score</button>
            </div>
            <style>
                #save-btn-${winId}:hover { filter: brightness(1.1); transform: translateY(-1px); }
                #save-btn-${winId}:active { transform: translateY(1px); }
                #initials-${winId}:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 2px var(--accent-glow); }
            </style>
        `;
        
        let container = document.body;
        if (targetWinId) {
            const targetWinObj = WindowManager.windows.get(targetWinId);
            if (targetWinObj) container = targetWinObj.content;
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const overlayNode = wrapper.firstElementChild;
        container.appendChild(overlayNode);
        container.appendChild(wrapper.lastElementChild); // style tag

        // Global Celebration
        if (isWin) {
            let burstX = window.innerWidth / 2;
            let burstY = window.innerHeight / 2;

            if (targetWinId && window.WindowManager) {
                const win = WindowManager.windows.get(targetWinId);
                if (win) {
                    // Calculate window center in global canvas space
                    const wx = parseFloat(win.el.dataset.x);
                    const wy = parseFloat(win.el.dataset.y);
                    const ww = parseFloat(win.el.dataset.w);
                    const wh = parseFloat(win.el.dataset.h);
                    burstX = wx + ww / 2;
                    burstY = wy + wh / 2;
                }
            }

            // Trigger global burst (moves with canvas)
            if (window.NovaEffects) {
                const gameColors = {
                    'minesweeper': ['#EF4444', '#3B82F6', '#fff'],
                    'game2048': ['#8B5CF6', '#EC4899', '#fff'],
                    'colorlines': ['#10B981', '#F59E0B', '#fff'],
                    'wordl': ['#22C55E', '#EAB308', '#fff']
                };
                const colors = gameColors[gameId.split('-')[0]] || ['var(--accent-primary)', '#fff'];
                
                NovaEffects.burst(burstX, burstY, {
                    colors: colors,
                    flash: true,
                    flashColor: 'rgba(255, 255, 255, 0.15)'
                });
            }
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
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
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
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-glass);">
                            <span style="font-weight: 600; color: var(--text-secondary); width: 30px;">#${i+1}</span>
                            <span style="font-weight: bold; color: var(--text-primary); flex: 1; text-align: left;">${s.initials}</span>
                            <span style="color: var(--accent-primary); font-variant-numeric: tabular-nums;">${s.score}</span>
                        </div>
                    `;
                });
            }
            return listHtml;
        };

        const selectorHtml = isMines ? `
            <div class="lb-selector" style="display: flex; background: rgba(128,128,128,0.1); padding: 4px; border-radius: 8px; margin-bottom: 16px;">
                <div class="lb-opt ${gameId === 'minesweeper-easy' ? 'active' : ''}" data-id="minesweeper-easy" style="flex: 1; text-align: center; font-size: 11px; padding: 6px; border-radius: 6px; cursor: pointer;">Easy</div>
                <div class="lb-opt ${gameId === 'minesweeper-medium' ? 'active' : ''}" data-id="minesweeper-medium" style="flex: 1; text-align: center; font-size: 11px; padding: 6px; border-radius: 6px; cursor: pointer;">Med</div>
                <div class="lb-opt ${gameId === 'minesweeper-hard' ? 'active' : ''}" data-id="minesweeper-hard" style="flex: 1; text-align: center; font-size: 11px; padding: 6px; border-radius: 6px; cursor: pointer;">Hard</div>
            </div>
        ` : '';

        const html = `
            <div style="padding: 24px; display: flex; flex-direction: column; height: 100%; background: var(--surface-base);">
                <h3 style="color: var(--text-primary); margin-bottom: 16px; text-align: center;">${gameName} Leaderboard</h3>
                ${selectorHtml}
                <div id="lb-list-${winId}" style="flex: 1; overflow-y: auto; padding-right: 8px;">
                    ${renderList(gameId)}
                </div>
                <button id="lb-close-${winId}" style="margin-top: 16px; background: rgba(128,128,128,0.1); color: var(--text-primary); border: 1px solid var(--border-glass); padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: background 0.2s;">Close</button>
            </div>
            <style>
                #lb-close-${winId}:hover { background: rgba(128,128,128,0.2); }
                .lb-opt { transition: all 0.2s; color: var(--text-secondary); }
                .lb-opt:hover { background: rgba(128,128,128,0.1); color: var(--text-primary); }
                .lb-opt.active { background: var(--accent-primary); color: #fff; box-shadow: 0 4px 12px var(--accent-glow); }
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

