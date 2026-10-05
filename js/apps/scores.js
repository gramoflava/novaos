Apps.register({
    id: 'scores',
    name: 'Scores',
    iconId: 'scores',
    category: 'utilities',
    keepInDock: true,
    launch: () => {
        const id = 'scoresapp-' + Date.now();
        WindowManager.create({ id, appId: 'scores', title: 'Scores', width: 620, height: 560,
            content: `<div class="scores-container">
                <nav class="scores-sidebar" aria-label="Games"></nav>
                <div class="scores-content"></div>
            </div>` });
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
                button.type = 'button';
                button.className = 'scores-nav__item';
                if (selected === game) button.setAttribute('aria-current', 'page');
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
