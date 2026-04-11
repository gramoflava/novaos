Apps.register({
    id: 'codex',
    name: 'Codex',
    iconId: 'codex',
    category: 'utilities',
    keepInDock: true,
    launch: () => {
        const winId = 'cx-' + Math.random().toString(36).substr(2, 9);
        
        const style = `
            .cx-wrap { display: flex; flex: 1; color: var(--text-primary); font-family: var(--font-sans); min-height: 0; }
            .cx-sidebar { width: 220px; flex-shrink: 0; background: rgba(0,0,0,0.15); border-right: 1px solid var(--border-glass); display: flex; flex-direction: column; overflow-y: auto; padding: 16px 0; min-height: 0; }
            .cx-nav-item { 
                padding: 10px 24px; 
                cursor: pointer; 
                transition: background 0.2s, opacity 0.2s; 
                font-weight: 500; 
                font-size: 14px; 
                opacity: 0.7; 
                transform: translateZ(0); /* Force layer for crisp rendering */
            }
            .cx-nav-item:hover { opacity: 1; background: rgba(128,128,128,0.1); }
            .cx-nav-item.active { 
                opacity: 1; 
                background: rgba(128,128,128,0.15); 
                border-left: 3px solid var(--accent-primary); 
            }
            
            .cx-content { 
                flex-grow: 1; 
                padding: 32px 40px; 
                overflow-y: auto; 
                line-height: 1.6; 
                min-height: 0; /* Critical for flex scrolling */
            }
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
                    <p>A totally reimagined web desktop experience engineered with deep glassmorphism and an infinite panning canvas mechanics. Nova OS is built to feel alive, with windows that obey cosmic physics and a workspace that never ends.</p>
                    
                    <h2>Navigation</h2>
                    <p>Nova OS leverages a unique <b>Infinite Canvas</b> system. You are moving a camera over a vast field of applications rather than interacting with a static screen.</p>
                    
                    <h3>For Mac & Trackpad Users</h3>
                    <ul>
                        <li><b>Panning:</b> Use a two-finger swipe in any direction to move the camera.</li>
                        <li><b>Zooming:</b> Use the pinch gesture to zoom in and out of the workspace.</li>
                        <li><b>Momentum:</b> The camera retains inertia, allowing you to "flick" across the desktop.</li>
                    </ul>

                    <h3>For Mouse Users</h3>
                    <ul>
                        <li><b>Panning:</b> Click and drag any empty area of the desktop background.</li>
                        <li><b>Zooming:</b> Hold <code>Ctrl</code> (or <code>Cmd</code>) and use the scroll wheel.</li>
                        <li><b>Precision:</b> You can also use the scroll wheel alone to pan vertically or horizontally.</li>
                    </ul>

                    <h2>Multitasking & Physics</h2>
                    <p>Windows in Nova OS are more than static boxes; they are physical entities in a zero-gravity environment.</p>
                    <ul>
                        <li><b>Collision Engine:</b> Moving or resizing a window will automatically "push" neighboring windows out of the way to prevent overlap.</li>
                        <li><b>Attraction:</b> When you close or minimize a window, a local "vacuum" is created, pulling nearby windows in to fill the void.</li>
                        <li><b>Remnants:</b> Closing a window leaves a "Remnant" (a colored nebula) at its coordinates. Minimizing a window creates a **Black Hole**, which you can hover over to see a preview of the app within.</li>
                    </ul>
                `
            },
            'wordl': {
                title: 'Wordl',
                html: `
                    <h1>Wordl</h1>
                    <p>Test your vocabulary in this high-fidelity adaptation of the classic word-guessing game. Nova's Wordl features an extensive 370,000+ word dictionary.</p>
                    
                    <h2>How to Play</h2>
                    <ul>
                        <li>Guess the hidden word in 6 tries.</li>
                        <li><b>Green:</b> Letter is correct and in the right spot.</li>
                        <li><b>Yellow:</b> Letter is in the word but in the wrong spot.</li>
                        <li><b>Grey:</b> Letter is not in the word.</li>
                    </ul>
                    
                    <h2>Game Modes</h2>
                    <p>Use the selector at the top to change the word length between <b>4 and 7 letters</b>. Longer words provide significantly higher scoring potential.</p>
                    
                    <h2>Scoring & Leaderboards</h2>
                    <ul>
                        <li><b>Accuracy:</b> Points are awarded based on how many guesses remain.</li>
                        <li><b>Dictionary:</b> Obscure words and even "forbidden" vocabulary are supported for validation.</li>
                        <li><b>Genius Bonus:</b> Solving the word in 1 or 2 tries triggers a special system-wide celebration.</li>
                    </ul>
                `
            },
            'colorlines': {
                title: 'Color Lines',
                html: `
                    <h1>Color Lines</h1>
                    <p>A strategic puzzle game focusing on spatial awareness and planning.</p>
                    
                    <h2>Core Rules</h2>
                    <ul>
                        <li>Align <b>5 or more</b> balls of the same color in a straight line (Horizontal, Vertical, or Diagonal).</li>
                        <li>A ball can move to any empty cell if there is a clear path of empty squares.</li>
                        <li>Every move that doesn't clear a line spawns <b>3 new balls</b>.</li>
                    </ul>
                    
                    <h2>Strategy</h2>
                    <ul>
                        <li><b>Path Tracing:</b> Hover over empty squares while a ball is selected to see the path it will take.</li>
                        <li><b>Preview:</b> Check the icon in the header to see the colors of the next 3 balls to spawn.</li>
                        <li><b>Combos:</b> Clearing multiple lines in a single move or consecutively provides massive score multipliers.</li>
                    </ul>
                `
            },
            'game2048': {
                title: '2048',
                html: `
                    <h1>2048</h1>
                    <p>A high-speed mathematical puzzle set in a vibrant, glowing grid.</p>
                    
                    <h2>Controls</h2>
                    <ul>
                        <li>Use the **Arrow Keys** to slide all tiles simultaneously.</li>
                        <li>Tiles merge into their sum when two identical numbers collide.</li>
                    </ul>
                    
                    <h2>Advanced Mechanics</h2>
                    <p>Unlike standard versions, Nova's 2048 uses the <b>Push/Pull Engine</b>. If you play 2048 while another window is nearby, you might see them react to the tile movements.</p>
                    
                    <h2>Winning</h2>
                    <p>The goal is to reach the 2048 tile, but the game continues as long as moves are possible. High scores are automatically synced to the Global Leaderboard.</p>
                `
            },
            'game-mines': {
                title: 'Minesweeper',
                html: `
                    <h1>Minesweeper</h1>
                    <p>The classic logic puzzle, enhanced with Nova's glassmorphic aesthetics.</p>
                    
                    <h2>Rules</h2>
                    <ul>
                        <li><b>Left Click:</b> Reveal a tile. Numbers show how many mines are adjacent.</li>
                        <li><b>Right Click:</b> Place a flag on a suspected mine.</li>
                        <li><b>Chording:</b> Clicking a number when the required flags are placed will reveal all surrounding non-flagged tiles.</li>
                    </ul>
                    
                    <h2>Difficulty Levels</h2>
                    <ul>
                        <li><b>Beginner:</b> 9x9 grid, 10 mines.</li>
                        <li><b>Intermediate:</b> 16x16 grid, 40 mines.</li>
                        <li><b>Expert:</b> 30x16 grid, 99 mines.</li>
                    </ul>
                    <p>Expert mode completion is the highest honor in the Nova OS gaming community.</p>
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
                    <div class="cx-nav-item" data-page="game-mines">Minesweeper</div>
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
        const winEl = document.getElementById(winId);
        const navItems = winEl.querySelectorAll('.cx-nav-item');
        const contentBox = winEl.querySelector('.cx-content');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.currentTarget;
                navItems.forEach(n => n.classList.remove('active'));
                target.classList.add('active');
                
                const pageId = target.dataset.page;
                contentBox.innerHTML = pages[pageId].html;
                contentBox.scrollTop = 0;
            });
        });
    }
});
