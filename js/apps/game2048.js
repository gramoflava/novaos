Apps.register({
    id: 'game2048',
    name: '2048',
    iconId: 'game2048',
    category: 'games',
    keepInDock: true,
    launch: () => {
        const winId = 'game2048-' + Date.now();
        
        const style = `
            .game-container { padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; font-family: var(--font-sans); color: var(--text-primary); }
            .grid-2048 { position: relative; width: 316px; height: 316px; background: rgba(128,128,128,0.05); border-radius: 12px; border: 1px solid var(--border-glass-strong); box-shadow: var(--shadow-inset); overflow: hidden; }
            .grid-bg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 12px; width: 100%; height: 100%; position: absolute; top:0; left:0; }
            .tile-bg { background: rgba(128,128,128,0.1); border-radius: 8px; width: 64px; height: 64px; }
            .tile { width: 64px; height: 64px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600; color: #fff; position: absolute; transition: left 0.075s ease-in-out, top 0.075s ease-in-out, background 0.075s ease-in-out; z-index: 10; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
            .tile-2 { background: #3730A3; box-shadow: 0 0 8px rgba(55,48,163,0.5); }
            .tile-4 { background: #4F46E5; box-shadow: 0 0 10px rgba(79,70,229,0.5); }
            .tile-8 { background: #6366F1; box-shadow: 0 0 12px rgba(99,102,241,0.5); }
            .tile-16 { background: #818CF8; box-shadow: 0 0 14px rgba(129,140,248,0.5); }
            .tile-32 { background: #C026D3; box-shadow: 0 0 16px rgba(192,38,211,0.5); }
            .tile-64 { background: #D946EF; box-shadow: 0 0 18px rgba(217,70,239,0.5); }
            .tile-128 { background: rgba(232,121,249,0.9); box-shadow: 0 0 20px rgba(217,70,239,0.7); }
            .tile-256 { background: #BE185D; box-shadow: 0 0 22px rgba(190,24,93,0.5); }
            .tile-512 { background: #E11D48; box-shadow: 0 0 24px rgba(225,29,72,0.5); }
            .tile-1024 { background: rgba(244,63,94,0.9); box-shadow: 0 0 26px rgba(225,29,72,0.7); }
            .tile-2048 { background: rgba(250,204,21,0.9); color: #000; box-shadow: 0 0 30px rgba(250,204,21,0.8); text-shadow: none; }
            .leaderboard-btn { background: rgba(128,128,128,0.1); border: 1px solid var(--border-glass); color: var(--text-primary); padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.2s; }
            .leaderboard-btn:hover { background: rgba(128,128,128,0.2); }
        `;

        const bgGrid = Array(16).fill('<div class="tile-bg"></div>').join('');
        
        const html = `
            <div class="game-container" id="game-container-${winId}">
                <div style="display:flex; justify-content: space-between; align-items: flex-end; width: 100%; max-width: 320px; margin-bottom: 24px;">
                    <div>
                        <div style="font-size: 24px; font-weight: 700; color: var(--text-primary);">2048</div>
                    </div>
                    <div style="background: rgba(128,128,128,0.1); padding: 4px 12px; border-radius: 6px; font-variant-numeric: tabular-nums; text-align: right;">
                        <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase;">Score</div>
                        <div id="score-${winId}" style="font-weight: 600; font-size: 16px; color: var(--text-primary);">0</div>
                    </div>
                </div>
                <div class="grid-2048" id="grid-${winId}">
                    <div class="grid-bg">${bgGrid}</div>
                    <div id="tiles-${winId}"></div>
                </div>
            </div>
            <style>${style}</style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'game2048',
            title: '2048',
            width: 380,
            height: 520,
            content: html
        });

        let activeTiles = [];
        let nextId = 0;
        let score = 0;
        let isGameOver = false;
        let hasWon = false;
        
        const uiScore = document.getElementById(`score-${winId}`);
        const uiTiles = document.getElementById(`tiles-${winId}`);

        const render = () => {
            uiScore.textContent = score;
            activeTiles.forEach((t) => {
                if(!t.el) {
                    t.el = document.createElement('div');
                    uiTiles.appendChild(t.el);
                    t.el.animate([{transform:'scale(0)'}, {transform:'scale(1)'}], {duration:75, easing:'ease-out'});
                }
                t.el.className = `tile ${t.val > 0 ? 'tile-'+(t.val > 2048 ? 2048 : t.val) : ''}`;
                t.el.textContent = t.val;
                t.el.style.left = `${12 + t.c * 76}px`;
                t.el.style.top = `${12 + t.r * 76}px`;
                
                if(t.mergedThisTurn) {
                    t.el.animate([{transform:'scale(1)'}, {transform:'scale(1.15)'}, {transform:'scale(1)'}], {duration:100});
                }
                if(t.deleted) {
                    t.el.style.zIndex = 1;
                    setTimeout(() => { if(t.el && t.el.parentNode) t.el.remove(); }, 75);
                } else {
                    t.el.style.zIndex = 10;
                }
            });
            activeTiles = activeTiles.filter(t => !t.deleted);
        };

        const getEmpty = () => {
            let empty = [];
            for(let r=0; r<4; r++) {
                for(let c=0; c<4; c++) {
                    if(!activeTiles.some(t => !t.deleted && t.r === r && t.c === c)) {
                        empty.push({r, c});
                    }
                }
            }
            return empty;
        };

        const addRandom = () => {
            let empty = getEmpty();
            if(empty.length > 0) {
                const spot = empty[Math.floor(Math.random() * empty.length)];
                activeTiles.push({
                    id: nextId++,
                    val: Math.random() < 0.9 ? 2 : 4,
                    r: spot.r,
                    c: spot.c,
                    mergedThisTurn: false,
                    deleted: false
                });
            }
        };

        const checkState = () => {
             if(!hasWon && activeTiles.some(t => !t.deleted && t.val === 2048)) {
                 hasWon = true;
                 isGameOver = true;
                 if (window.AudioMng) AudioMng.play('win');
                 Scores.showScorePrompt('game2048', score, true, null, winId);
                 return;
             }
             if(getEmpty().length > 0) return;
             
             // Check adjacent merges
             for(let r=0; r<4; r++) {
                 for(let c=0; c<4; c++) {
                     let val = activeTiles.find(t=>!t.deleted && t.r===r && t.c===c).val;
                     if(c<3 && val === activeTiles.find(t=>!t.deleted && t.r===r && t.c===c+1).val) return;
                     if(r<3 && val === activeTiles.find(t=>!t.deleted && t.r===r+1 && t.c===c).val) return;
                 }
             }
 
             // Game over
             isGameOver = true;
             const isHighScore = Scores.isHighScore('game2048', score);
             if (window.AudioMng) AudioMng.play(isHighScore ? 'win' : 'lose');
             Scores.showScorePrompt('game2048', score, isHighScore, null, winId);
        };

        const getLine = (i, dir) => {
            let tiles = activeTiles.filter(t => !t.deleted);
            if(dir === 'ArrowUp')   return tiles.filter(t => t.c === i).sort((a,b)=>a.r - b.r);
            if(dir === 'ArrowDown') return tiles.filter(t => t.c === i).sort((a,b)=>b.r - a.r);
            if(dir === 'ArrowLeft') return tiles.filter(t => t.r === i).sort((a,b)=>a.c - b.c);
            if(dir === 'ArrowRight')return tiles.filter(t => t.r === i).sort((a,b)=>b.c - a.c);
        };

        const getRC = (lineIdx, posInLine, dir) => {
            if(dir === 'ArrowUp')   return {r: posInLine, c: lineIdx};
            if(dir === 'ArrowDown') return {r: 3 - posInLine, c: lineIdx};
            if(dir === 'ArrowLeft') return {r: lineIdx, c: posInLine};
            if(dir === 'ArrowRight')return {r: lineIdx, c: 3 - posInLine};
        };

        const move = (dir) => {
            if(isGameOver) return;
            if (window.AudioMng) AudioMng.play('click');
            let moved = false;
            activeTiles.forEach(t => t.mergedThisTurn = false);
            
            for(let i=0; i<4; i++) {
                let line = getLine(i, dir); 
                let targetPos = 0;
                for(let j=0; j<line.length; j++) {
                    let t = line[j];
                    if(j < line.length - 1 && t.val === line[j+1].val && !line[j+1].mergedThisTurn) {
                        let popTile = t;
                        let deadTile = line[j+1]; 
                        let tr = getRC(i, targetPos, dir).r;
                        let tc = getRC(i, targetPos, dir).c;
                        
                        if(deadTile.r !== tr || deadTile.c !== tc) moved = true;
                        if(popTile.r !== tr || popTile.c !== tc) moved = true;

                        deadTile.r = tr; deadTile.c = tc; deadTile.deleted = true;
                        popTile.r = tr; popTile.c = tc;
                        popTile.val *= 2; score += popTile.val;
                        popTile.mergedThisTurn = true;
                        
                        targetPos++; j++;
                    } else {
                        let tr = getRC(i, targetPos, dir).r;
                        let tc = getRC(i, targetPos, dir).c;
                        if(t.r !== tr || t.c !== tc) moved = true;
                        t.r = tr; t.c = tc;
                        targetPos++;
                    }
                }
            }
            if(moved) {
                render();
                // Delay new tile spawn very slightly so it feels attached to the end of the slide
                setTimeout(() => {
                    addRandom();
                    render();
                    checkState();
                }, 50);
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
        
        const winObj = WindowManager.windows.get(winId);
        if(winObj) {
            winObj.cleanup = () => {
                document.removeEventListener('keydown', keyHandler);
            };
        }

        addRandom();
        addRandom();
        render();
    }
});
