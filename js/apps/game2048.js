Apps.register({
    id: 'game2048',
    name: '2048',
    iconId: 'game2048',
    category: 'games',
    keepInDock: true,
    launch: () => {
        const winId = 'game2048-' + Date.now();
        
        const style = `
            .game-container { padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #0A0A0C; font-family: var(--font-sans); }
            .grid-2048 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border: 1px solid var(--border-glass-strong); box-shadow: var(--shadow-inset); }
            .tile { width: 64px; height: 64px; background: rgba(255,255,255,0.03); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600; color: #fff; transition: all 0.15s ease-in-out; }
            .tile-2 { background: #3730A3; }
            .tile-4 { background: #4F46E5; }
            .tile-8 { background: #6366F1; }
            .tile-16 { background: #818CF8; }
            .tile-32 { background: #C026D3; }
            .tile-64 { background: #D946EF; }
            .tile-128 { background: #E879F9; box-shadow: 0 0 10px #D946EF; }
            .tile-256 { background: #BE185D; }
            .tile-512 { background: #E11D48; }
            .tile-1024 { background: #F43F5E; box-shadow: 0 0 15px #E11D48; }
            .tile-2048 { background: #FACC15; color: #000; box-shadow: 0 0 20px #FACC15; }
        `;

        const html = `
            <div class="game-container" id="game-container-${winId}">
                <div style="display:flex; justify-content: space-between; width: 100%; max-width: 320px; margin-bottom: 24px;">
                    <div style="font-size: 24px; font-weight: 700; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5);">2048</div>
                    <div style="background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 6px; font-variant-numeric: tabular-nums;">
                        <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase;">Score</div>
                        <div id="score-${winId}" style="font-weight: 600; font-size: 16px;">0</div>
                    </div>
                </div>
                <div class="grid-2048" id="grid-${winId}">
                    <!-- 16 empty slots -->
                </div>
            </div>
            <style>${style}</style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'game2048',
            title: '2048',
            width: 380,
            height: 480,
            content: html
        });

        // Basic 2048 Logic
        let grid = Array(16).fill(0);
        let score = 0;
        
        const render = () => {
            const gridEl = document.getElementById(`grid-${winId}`);
            if(!gridEl) return;
            gridEl.innerHTML = '';
            for(let i=0; i<16; i++) {
                const val = grid[i];
                const div = document.createElement('div');
                div.className = \`tile \${val > 0 ? 'tile-'+val : ''}\`;
                div.textContent = val > 0 ? val : '';
                gridEl.appendChild(div);
            }
            document.getElementById(\`score-\${winId}\`).textContent = score;
        };

        const addRandom = () => {
            let empty = [];
            for(let i=0; i<16; i++) if(grid[i]===0) empty.push(i);
            if(empty.length > 0) {
                const idx = empty[Math.floor(Math.random() * empty.length)];
                grid[idx] = Math.random() < 0.9 ? 2 : 4;
            }
        };

        const move = (dir) => {
            // Simplified movement logic for demo
            let moved = false;
            // A genuine 2048 implementation requires processing rows/columns. 
            // For brevity, we implement basic state shift here (could be fleshed out)
            // Just shifting left as an example:
            if(dir === 'ArrowLeft') {
                for(let r=0; r<4; r++) {
                    let row = [grid[r*4], grid[r*4+1], grid[r*4+2], grid[r*4+3]].filter(x => x>0);
                    for(let i=0; i<row.length-1; i++) {
                        if(row[i] === row[i+1]) { row[i]*=2; score+=row[i]; row.splice(i+1, 1); }
                    }
                    while(row.length < 4) row.push(0);
                    for(let i=0; i<4; i++) {
                        if(grid[r*4+i] !== row[i]) moved = true;
                        grid[r*4+i] = row[i];
                    }
                }
            } else if(dir === 'ArrowRight') {
                for(let r=0; r<4; r++) {
                    let row = [grid[r*4], grid[r*4+1], grid[r*4+2], grid[r*4+3]].filter(x => x>0);
                    for(let i=row.length-1; i>0; i--) {
                        if(row[i] === row[i-1]) { row[i]*=2; score+=row[i]; row.splice(i-1, 1); i--; }
                    }
                    let newRow = Array(4 - row.length).fill(0).concat(row);
                    for(let i=0; i<4; i++) {
                        if(grid[r*4+i] !== newRow[i]) moved = true;
                        grid[r*4+i] = newRow[i];
                    }
                }
            } else if(dir === 'ArrowUp') {
                 // Up logic
                 for(let c=0; c<4; c++) {
                    let col = [grid[c], grid[c+4], grid[c+8], grid[c+12]].filter(x => x>0);
                    for(let i=0; i<col.length-1; i++) {
                        if(col[i] === col[i+1]) { col[i]*=2; score+=col[i]; col.splice(i+1, 1); }
                    }
                    while(col.length < 4) col.push(0);
                    for(let i=0; i<4; i++) {
                        if(grid[c+i*4] !== col[i]) moved = true;
                        grid[c+i*4] = col[i];
                    }
                }
            } else if(dir === 'ArrowDown') {
                 // Down logic
                 for(let c=0; c<4; c++) {
                    let col = [grid[c], grid[c+4], grid[c+8], grid[c+12]].filter(x => x>0);
                    for(let i=col.length-1; i>0; i--) {
                        if(col[i] === col[i-1]) { col[i]*=2; score+=col[i]; col.splice(i-1, 1); i--; }
                    }
                    let newCol = Array(4 - col.length).fill(0).concat(col);
                    for(let i=0; i<4; i++) {
                        if(grid[c+i*4] !== newCol[i]) moved = true;
                        grid[c+i*4] = newCol[i];
                    }
                }
            }
            if(moved) {
                addRandom();
                render();
            }
        };

        const keyHandler = (e) => {
            if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if(WindowManager.activeWindowId === winId) {
                    e.preventDefault();
                    move(e.key);
                }
            }
        };

        document.addEventListener('keydown', keyHandler);
        
        // Clean up when window closes
        const winObj = WindowManager.windows.get(winId);
        if(winObj) {
            const oldCleanup = winObj.cleanup;
            winObj.cleanup = () => {
                if(oldCleanup) oldCleanup();
                document.removeEventListener('keydown', keyHandler);
            };
        }

        addRandom();
        addRandom();
        render();
    }
});
