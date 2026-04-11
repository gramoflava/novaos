Apps.register({
    id: 'codex',
    name: 'Codex',
    iconId: 'codex',
    category: 'utilities',
    keepInDock: true,
    launch: () => {
        const winId = 'codex-' + Date.now();
        
        const style = `
            .cx-wrap { display: flex; height: 100%; color: var(--text-primary); font-family: var(--font-sans); }
            .cx-sidebar { width: 220px; flex-shrink: 0; background: rgba(0,0,0,0.15); border-right: 1px solid var(--border-glass); display: flex; flex-direction: column; overflow-y: auto; padding: 16px 0; }
            .cx-nav-item { padding: 10px 24px; cursor: pointer; transition: all 0.2s; font-weight: 500; font-size: 14px; opacity: 0.7; }
            .cx-nav-item:hover { opacity: 1; background: rgba(128,128,128,0.1); }
            .cx-nav-item.active { opacity: 1; background: rgba(128,128,128,0.15); border-left: 3px solid var(--accent-primary); }
            
            .cx-content { flex-grow: 1; padding: 32px 40px; overflow-y: auto; line-height: 1.6; }
            .cx-content h1 { font-size: 28px; margin-bottom: 8px; font-weight: 700; }
            .cx-content h2 { font-size: 20px; margin-top: 24px; margin-bottom: 12px; color: var(--accent-primary); font-weight: 600; }
            .cx-content p { font-size: 15px; margin-bottom: 16px; opacity: 0.9; }
            .cx-content ul { padding-left: 20px; margin-bottom: 16px; opacity: 0.9; }
            .cx-content li { margin-bottom: 8px; font-size: 15px; }
            .cx-content code { background: rgba(128,128,128,0.2); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
        `;

        const pages = {
            'novaos': {
                title: 'NovaOS',
                html: `
                    <h1>Welcome to NovaOS</h1>
                    <p>A totally reimagined web desktop experience engineered with deep glassmorphism and an infinite panning canvas mechanics.</p>
                    <h2>Navigation</h2>
                    <ul>
                        <li><b>Pan:</b> Use trackpad two-finger swipe or click-and-drag the empty desktop background.</li>
                        <li><b>Zoom:</b> Hold <code>Ctrl</code> and scroll to zoom in and out.</li>
                        <li><b>Multitasking:</b> Grab windows by the top bar to move them. They retain cosmic physics and momentum upon release.</li>
                    </ul>
                    <h2>Ecosystem</h2>
                    <p>Nova OS ships with several integrated applications designed to be highly responsive and lightweight. Use the sidebar to explore rulebooks for integrated minigames.</p>
                `
            },
            'wordl': {
                title: 'Wordl',
                html: `
                    <h1>Wordl</h1>
                    <p>Guess the hidden word in a limited number of tries.</p>
                    <h2>Rules</h2>
                    <ul>
                        <li>Green box means the letter is correct and in the correct spot.</li>
                        <li>Yellow box means the letter is correct but in the wrong spot.</li>
                        <li>Grey box means the letter is not in the word.</li>
                        <li>You can choose the length of the word (4 to 7 letters) from the top menu.</li>
                    </ul>
                    <h2>Scoring</h2>
                    <p>Your score is based on the word length and how many guesses you took.</p>
                    <ul>
                        <li><b>Base Points:</b> Word Length &times; 100</li>
                        <li><b>Accuracy Bonus:</b> (Max Guesses &minus; Guesses Taken) &times; Base</li>
                        <li><b>Speed Bonus:</b> Quick solves reward extra points.</li>
                    </ul>
                `
            },
            'colorlines': {
                title: 'Color Lines',
                html: `
                    <h1>Color Lines</h1>
                    <p>A classic strategic puzzle where you match lines of colored balls.</p>
                    <h2>Rules</h2>
                    <ul>
                        <li>Move balls around the board to create straight lines of 5 or more balls of the same color.</li>
                        <li>Lines can be horizontal, vertical, or diagonal.</li>
                        <li>Each turn you move, 3 new balls will spawn unless you clear a line.</li>
                        <li>The game ends when the board is completely filled.</li>
                    </ul>
                    <h2>Scoring</h2>
                    <p>Clearing more balls in a single turn yields exponentially higher scores!</p>
                `
            },
            'game2048': {
                title: '2048',
                html: `
                    <h1>2048</h1>
                    <p>Slide matching tiles together to reach the legendary 2048 tile.</p>
                    <h2>Rules</h2>
                    <ul>
                        <li>Use arrow keys to slide all tiles in that direction.</li>
                        <li>When two tiles of the same number touch, they merge into one with double the value!</li>
                        <li>New tiles (2 or 4) spawn after every move.</li>
                    </ul>
                    <h2>Winning Conditions</h2>
                    <p>You achieve victory upon creating a 2048 tile, but you can continue playing infinitely for high scores.</p>
                `
            },
            'minesweeper': {
                title: 'Minesweeper',
                html: `
                    <h1>Minesweeper</h1>
                    <p>Clear the board without detonating any hidden mines.</p>
                    <h2>Rules</h2>
                    <ul>
                        <li>Left click to reveal a tile. If it's a mine, you lose!</li>
                        <li>If a tile contains a number, it indicates how many mines are adjacent to it.</li>
                        <li>Right click to flag suspicious tiles.</li>
                    </ul>
                    <p>Clearing the sweeping area quickly nets higher points, and completing higher difficulties gives massive point multipliers.</p>
                `
            }
        };

        const html = `
            <div class="cx-wrap" id="cx-wrap-${winId}">
                <div class="cx-sidebar" id="cx-nav-${winId}">
                    <div class="cx-nav-item active" data-page="novaos">NovaOS</div>
                    <div class="cx-nav-item" data-page="wordl">Wordl</div>
                    <div class="cx-nav-item" data-page="colorlines">Color Lines</div>
                    <div class="cx-nav-item" data-page="game2048">2048</div>
                    <div class="cx-nav-item" data-page="minesweeper">Minesweeper</div>
                </div>
                <div class="cx-content" id="cx-content-${winId}">
                    ${pages['novaos'].html}
                </div>
            </div>
            <style>${style}</style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'codex',
            title: 'Codex Reference',
            width: 720,
            height: 500,
            content: html
        });

        // Navigation bindings
        const navItems = document.querySelectorAll(`#cx-nav-${winId} .cx-nav-item`);
        const contentBox = document.getElementById(`cx-content-${winId}`);

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                navItems.forEach(n => n.classList.remove('active'));
                e.target.classList.add('active');
                
                const pageId = e.target.dataset.page;
                contentBox.innerHTML = pages[pageId].html;
                contentBox.scrollTop = 0;
            });
        });
    }
});
