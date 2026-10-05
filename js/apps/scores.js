Apps.register({
    id: 'scores',
    name: 'Scores',
    iconId: 'scores',
    category: 'utilities',
    keepInDock: true,
    launch: () => {
        const id = 'scoresapp-' + Date.now();
        WindowManager.create({ id, appId: 'scores', title: 'Scores', width: 600, height: 560,
            content: `<div class="scores-container">
                <nav class="scores-sidebar" aria-label="Games"></nav>
                <div class="scores-content"></div>
            </div><style>
                .scores-container { display:flex; height:100%; color:var(--text); }
                .scores-sidebar { width:140px; flex:none; border-right:1px solid var(--line); padding:12px; overflow-y:auto; }
                .scores-sidebar button { display:block; width:100%; margin-bottom:4px; text-align:left; }
                .scores-content { flex:1; min-width:0; padding:20px; }
                @media(max-width:600px) { .scores-container { flex-direction:column; } .scores-sidebar { display:flex; width:auto; border-right:0; border-bottom:1px solid var(--line); gap:4px; flex-wrap:wrap; } .scores-sidebar button { width:auto; font-size:var(--text-xs); } }
            </style>` });
        const win = WindowManager.windows.get(id);
        const sidebar = win.content.querySelector('nav');
        const view = Scores.mountLeaderboard(win.content.querySelector('.scores-content'), 'minesweeper-easy');
        let selected = 'minesweeper-easy';
        const menu = () => {
            const games = [['minesweeper-easy', 'Minesweeper'], ['game2048', '2048'], ['colorlines-5', 'Color Lines'],
                ['columns-classic', 'Columns'], ['wordl-5', 'Wordl'], ['novarun-lunar', 'Nova Run']];
            if (Scores.getTopScores('asteroids').length || NovaUplink.explorer || localStorage.getItem('novaos_asteroids_seen')) games.push(['asteroids', 'Asteroids']);
            if (NovaUplink.explorer) games.push(['explorers', 'Explorers']);
            sidebar.replaceChildren();
            games.forEach(([game, label]) => {
                const button = document.createElement('button');
                button.className = `btn ${selected === game ? 'btn--primary' : 'btn--ghost'}`;
                button.textContent = label;
                button.onclick = () => { selected = game; view.select(game); menu(); };
                sidebar.appendChild(button);
            });
        };
        menu();
        window.addEventListener('scoresUpdated', menu);
        window.addEventListener('uplinkUpdated', menu);
        const cleanup = win.cleanup;
        win.cleanup = () => {
            view.dispose();
            window.removeEventListener('scoresUpdated', menu);
            window.removeEventListener('uplinkUpdated', menu);
            if (cleanup) cleanup();
        };
    }
});
