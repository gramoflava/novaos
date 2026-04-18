Apps.register({
    id: 'scores',
    name: 'Scores',
    iconId: 'scores',
    category: 'utilities',
    keepInDock: true,
    launch: () => {
        const winId = 'scoresapp-' + Date.now();
        const style = `
            .scores-container { display: flex; height: 100%; color: var(--text-primary); }
            .scores-sidebar { width: 120px; border-right: 1px solid var(--border-glass); padding: 12px; }
            .scores-menu-item { padding: 8px 12px; margin-bottom: 4px; border-radius: 6px; cursor: pointer; transition: background 0.2s; font-size: 14px; }
            .scores-menu-item:hover { background: rgba(128,128,128,0.1); }
            .scores-menu-item.active { background: var(--accent-primary); color: white; }
            .scores-content { flex: 1; padding: 24px; overflow-y: auto; }
            .score-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-glass); }
        `;
        
        const html = `
            <div class="scores-container" id="scores-container-${winId}">
                <div class="scores-sidebar" id="scores-sidebar-${winId}">
                    <div class="scores-menu-item active" data-game="minesweeper-easy">Mines</div>
                    <div class="scores-menu-item" data-game="game2048">2048</div>
                    <div class="scores-menu-item" data-game="colorlines-5">Lines</div>
                    <div class="scores-menu-item" data-game="wordl-5">Wordl</div>
                </div>
                <div class="scores-content" id="scores-content-${winId}">
                    <!-- Scores injected here -->
                </div>
            </div>
            <style>${style}</style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'scores',
            title: 'Scores',
            width: 400,
            height: 500,
            content: html
        });

        const sidebar = document.getElementById(`scores-sidebar-${winId}`);
        const content = document.getElementById(`scores-content-${winId}`);
        const games = {
            'minesweeper': 'Minesweeper',
            'game2048': '2048',
            'colorlines': 'Color Lines',
            'wordl': 'Wordl'
        };

        const renderScores = (gameId) => {
            const baseGame = gameId.split('-')[0];
            const scoresList = window.Scores && window.Scores.getTopScores(gameId) || [];
            let listHtml = '';
            if (scoresList.length === 0) {
                listHtml = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">No scores yet!</div>';
            } else {
                scoresList.forEach((s, i) => {
                    listHtml += `
                        <div class="score-row">
                            <span style="font-weight: 600; color: var(--text-secondary); width: 30px;">#${i+1}</span>
                            <span style="font-weight: bold; color: var(--text-primary); flex: 1; text-align: left;">${s.initials}</span>
                            <span style="color: var(--accent-primary); font-variant-numeric: tabular-nums;">${s.score}</span>
                        </div>
                    `;
                });
            }

            let selectorHtml = '';
            if (baseGame === 'minesweeper') {
                selectorHtml = `
                    <div style="display: flex; background: rgba(128,128,128,0.1); padding: 4px; border-radius: 8px; margin-bottom: 16px;">
                        <div class="lb-level-opt ${gameId === 'minesweeper-easy' ? 'active' : ''}" data-id="minesweeper-easy">Easy</div>
                        <div class="lb-level-opt ${gameId === 'minesweeper-medium' ? 'active' : ''}" data-id="minesweeper-medium">Med</div>
                        <div class="lb-level-opt ${gameId === 'minesweeper-hard' ? 'active' : ''}" data-id="minesweeper-hard">Hard</div>
                    </div>
                `;
            } else if (baseGame === 'wordl') {
                selectorHtml = `
                    <div style="display: flex; background: rgba(128,128,128,0.1); padding: 4px; border-radius: 8px; margin-bottom: 16px;">
                        <div class="lb-level-opt ${gameId === 'wordl-4' ? 'active' : ''}" data-id="wordl-4">4 Letters</div>
                        <div class="lb-level-opt ${gameId === 'wordl-5' ? 'active' : ''}" data-id="wordl-5">5 Letters</div>
                        <div class="lb-level-opt ${gameId === 'wordl-6' ? 'active' : ''}" data-id="wordl-6">6 Letters</div>
                        <div class="lb-level-opt ${gameId === 'wordl-7' ? 'active' : ''}" data-id="wordl-7">7 Letters</div>
                    </div>
                `;
            } else if (baseGame === 'colorlines') {
                selectorHtml = `
                    <div style="display: flex; background: rgba(128,128,128,0.1); padding: 4px; border-radius: 8px; margin-bottom: 16px;">
                        <div class="lb-level-opt ${gameId === 'colorlines-5' ? 'active' : ''}" data-id="colorlines-5">Classic (5)</div>
                        <div class="lb-level-opt ${gameId === 'colorlines-4' ? 'active' : ''}" data-id="colorlines-4">Quick (4)</div>
                    </div>
                `;
            }

            content.innerHTML = `
                <style>
                    .lb-level-opt { flex: 1; text-align: center; font-size: 11px; padding: 6px; border-radius: 6px; cursor: pointer; transition: all 0.2s; color: var(--text-secondary); }
                    .lb-level-opt:hover { background: rgba(128,128,128,0.1); color: var(--text-primary); }
                    .lb-level-opt.active { background: var(--accent-primary); color: #fff; box-shadow: 0 4px 12px var(--accent-glow); }
                </style>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0;">${games[baseGame]} Leaderboard</h3>
                    <button class="scores-reset-btn" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #EF4444; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;">Reset</button>
                </div>
                ${selectorHtml}
                ${listHtml}
            `;
            
            content.querySelectorAll('.lb-level-opt').forEach(opt => {
                opt.onclick = () => renderScores(opt.dataset.id);
            });

            const resetBtn = content.querySelector('.scores-reset-btn');
            if (resetBtn) {
                resetBtn.addEventListener('mouseenter', () => resetBtn.style.background = 'rgba(239,68,68,0.2)');
                resetBtn.addEventListener('mouseleave', () => resetBtn.style.background = 'rgba(239,68,68,0.1)');
                resetBtn.onclick = () => {
                    if (window.Scores) {
                        window.Scores.clearScores(gameId);
                        renderScores(gameId);
                    }
                };
            }
        };

        sidebar.querySelectorAll('.scores-menu-item').forEach(item => {
            item.onclick = () => {
                sidebar.querySelectorAll('.scores-menu-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                renderScores(item.dataset.game);
            };
        });

        // Listen for new scores being broadcast globally
        window.addEventListener('scoresUpdated', (e) => {
            const active = sidebar.querySelector('.scores-menu-item.active');
            if (active && active.dataset.game.split('-')[0] === e.detail.gameId.split('-')[0]) {
                // If they are on the same base game, update if the exact gameId matches or it's currently selected
                renderScores(e.detail.gameId);
                // Also update the sidebar data-game to track what was last played
                active.dataset.game = e.detail.gameId;
            }
        });

        renderScores('minesweeper-easy');
    }
});
