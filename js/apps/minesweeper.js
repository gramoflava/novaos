Apps.register({
    id: 'minesweeper',
    name: 'Minesweeper',
    iconId: 'minesweeper',
    category: 'games',
    keepInDock: true,
    launch: () => {
        const winId = 'minesweeper-' + Date.now();
        
        const style = `
            .ms-container { padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; height: 100%; font-family: var(--font-sans); color: var(--text-primary); }
            .ms-grid { display: grid; gap: 2px; padding: 12px; background: rgba(128,128,128,0.05); border-radius: 12px; border: 1px solid var(--border-glass-strong); box-shadow: var(--shadow-inset); user-select: none; }
            .ms-cell { width: 32px; height: 32px; background: rgba(128,128,128,0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; cursor: pointer; transition: background 0.1s; color: var(--text-primary); }
            .ms-cell:hover { background: rgba(128,128,128,0.2); }
            .ms-cell.revealed { background: rgba(128,128,128,0.3); border: 1px solid rgba(128,128,128,0.1); cursor: default; }
            .ms-cell.mine { background: #EF4444; color: #fff;}
            .ms-cell.flagged { color: #F59E0B; }
            .c-1 { color: #3B82F6; } .c-2 { color: #10B981; } .c-3 { color: #EF4444; } 
            .c-4 { color: #8B5CF6; } .c-5 { color: #F59E0B; } .c-6 { color: #06B6D4; } 
            .c-7 { color: #111827; } .c-8 { color: #6B7280; }
        `;

        const html = `
            <div class="ms-container" id="ms-container-${winId}">
                <div class="app-header" style="align-items: center; margin-bottom: 16px; width: 100%;">
                    <div class="app-controls" style="margin: 0; display: flex; gap: 8px;">
                        <select id="ms-level-${winId}" class="app-btn" style="text-align: center;">
                            <option value="easy">Beginner</option>
                            <option value="medium">Intermed.</option>
                            <option value="hard">Expert</option>
                        </select>
                        <button class="app-btn" id="ms-restart-${winId}">Restart</button>
                    </div>
                    <div class="app-stats" style="display: flex; gap: 8px;">
                        <div class="app-stat-box" style="margin: 0; padding: 4px 12px;">
                            <div class="app-stat-label">Mines</div>
                            <div class="app-stat-val" id="ms-mines-${winId}">10</div>
                        </div>
                        <div class="app-stat-box" style="margin: 0; padding: 4px 12px;">
                            <div class="app-stat-label">Time</div>
                            <div class="app-stat-val" id="ms-time-${winId}">0</div>
                        </div>
                    </div>
                </div>
                <div class="ms-grid" id="ms-grid-${winId}"></div>
            </div>
            <style>${style}</style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'minesweeper',
            title: 'Minesweeper',
            width: 440,
            height: 500,
            content: html
        });

        let rows = 9;
        let cols = 9;
        let totalMines = 10;
        let board = [];
        let minesLeft = totalMines;
        let time = 0;
        let timer = null;
        let isGameOver = false;
        let isFirstClick = true;
        let revealedCount = 0;
        let lastHoveredCell = {r: -1, c: -1};

        const uiGrid = document.getElementById(`ms-grid-${winId}`);
        const uiTime = document.getElementById(`ms-time-${winId}`);
        const uiMines = document.getElementById(`ms-mines-${winId}`);

        const initBoard = () => {
            uiGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            board = [];
            isGameOver = false;
            isFirstClick = true;
            revealedCount = 0;
            minesLeft = totalMines;
            time = 0;
            uiTime.textContent = time;
            uiMines.textContent = minesLeft;
            if(timer) clearInterval(timer);
            timer = null;

            uiGrid.innerHTML = '';
            for(let r=0; r<rows; r++) {
                let row = [];
                for(let c=0; c<cols; c++) {
                    let cell = { r, c, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 };
                    row.push(cell);
                    
                    const div = document.createElement('div');
                    div.className = 'ms-cell';
                    div.dataset.r = r;
                    div.dataset.c = c;
                    div.addEventListener('click', () => handleLeftClick(r, c));
                    div.addEventListener('contextmenu', (e) => { e.preventDefault(); handleRightClick(r, c); });
                    div.addEventListener('mouseenter', () => { lastHoveredCell = {r, c}; });
                    div.addEventListener('mouseleave', () => { if (lastHoveredCell.r === r && lastHoveredCell.c === c) lastHoveredCell = {r: -1, c: -1}; });
                    uiGrid.appendChild(div);
                }
                board.push(row);
            }
        };

        const placeMines = (firstR, firstC) => {
            let placed = 0;
            while(placed < totalMines) {
                let r = Math.floor(Math.random() * rows);
                let c = Math.floor(Math.random() * cols);
                // Don't place on first click or already a mine
                if(!board[r][c].isMine && (Math.abs(r-firstR)>1 || Math.abs(c-firstC)>1)) {
                    board[r][c].isMine = true;
                    placed++;
                }
            }
            
            // Calc numbers
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    if(!board[r][c].isMine) {
                        let count = 0;
                        for(let rr=r-1; rr<=r+1; rr++) {
                            for(let cc=c-1; cc<=c+1; cc++) {
                                if(rr>=0 && rr<rows && cc>=0 && cc<cols && board[rr][cc].isMine) count++;
                            }
                        }
                        board[r][c].neighborMines = count;
                    }
                }
            }
        };

        const updateCellUI = (r, c) => {
            const cell = board[r][c];
            const div = uiGrid.children[r * cols + c];
            div.className = 'ms-cell';
            div.textContent = '';
            
            if (cell.isRevealed) {
                div.classList.add('revealed');
                if (cell.isMine) {
                    div.classList.add('mine');
                    div.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="6"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
                } else if (cell.neighborMines > 0) {
                    div.textContent = cell.neighborMines;
                    div.classList.add('c-'+cell.neighborMines);
                }
            } else if (cell.isFlagged) {
                div.classList.add('flagged');
                div.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></svg>';
            }
        };

        const reveal = (r, c) => {
            if(r<0 || r>=rows || c<0 || c>=cols || board[r][c].isRevealed || board[r][c].isFlagged) return;
            
            board[r][c].isRevealed = true;
            revealedCount++;
            updateCellUI(r, c);
            if (window.AudioMng && board[r][c].neighborMines > 0) AudioMng.play('click');

            if(board[r][c].neighborMines === 0 && !board[r][c].isMine) {
                if (window.AudioMng) AudioMng.play('click');
                for(let rr=r-1; rr<=r+1; rr++) {
                    for(let cc=c-1; cc<=c+1; cc++) {
                        reveal(rr, cc);
                    }
                }
            }
        };

        const handleLeftClick = (r, c) => {
            if(isGameOver || board[r][c].isFlagged) return;

            if(isFirstClick) {
                isFirstClick = false;
                placeMines(r, c);
                timer = setInterval(() => { time++; uiTime.textContent = time; }, 1000);
            }

            if(board[r][c].isMine) {
                gameOver(false);
                return;
            }

            reveal(r, c);
            checkWin();
        };

        const handleRightClick = (r, c) => {
            if(isGameOver || board[r][c].isRevealed) return;
            
            board[r][c].isFlagged = !board[r][c].isFlagged;
            minesLeft += board[r][c].isFlagged ? -1 : 1;
            uiMines.textContent = minesLeft;
            updateCellUI(r, c);
            if (window.AudioMng) AudioMng.play(board[r][c].isFlagged ? 'flag_on' : 'flag_off');
        };

        const checkWin = () => {
            if(revealedCount === rows * cols - totalMines) {
                gameOver(true);
            }
        };

        const gameOver = (win) => {
            isGameOver = true;
            if(timer) clearInterval(timer);
            
            // Reveal all mines
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    if(board[r][c].isMine) {
                        board[r][c].isRevealed = true;
                        updateCellUI(r, c);
                    }
                }
            }

            const levels = { 'easy': 'Beginner', 'medium': 'Intermediate', 'hard': 'Expert' };
            const levelId = 'minesweeper-' + (document.getElementById(`ms-level-${winId}`).value || 'easy');
            const finalScore = win ? Math.max(0, 9999 - time * 10) : 0;
            
            if(win) {
                if (window.AudioMng) AudioMng.play('win');
                setTimeout(() => Scores.showScorePrompt(levelId, finalScore, true, null, winId), 500);
            } else {
                if (window.AudioMng) AudioMng.play('lose');
            }
        };

        document.getElementById(`ms-restart-${winId}`).onclick = initBoard;

        document.getElementById(`ms-level-${winId}`).onchange = (e) => {
            const val = e.target.value;
            const winEl = WindowManager.windows.get(winId).el;
            if (val === 'easy') { rows=9; cols=9; totalMines=10; winEl.style.width='440px'; winEl.style.height='500px'; }
            if (val === 'medium') { rows=16; cols=16; totalMines=40; winEl.style.width='650px'; winEl.style.height='720px'; }
            if (val === 'hard') { rows=16; cols=30; totalMines=99; winEl.style.width='1100px'; winEl.style.height='720px'; }
            
            winEl.dataset.w = parseFloat(winEl.style.width);
            winEl.dataset.h = parseFloat(winEl.style.height);
            
            if (window.WindowManager) {
                WindowManager.pushWindowsOut(winId, { x: parseFloat(winEl.dataset.x), y: parseFloat(winEl.dataset.y), w: parseFloat(winEl.dataset.w), h: parseFloat(winEl.dataset.h) });
            }
            
            initBoard();
        };
        
        const onGlobalKey = (e) => {
            if (WindowManager.activeWindowId === winId && e.code === 'Space') {
                if (lastHoveredCell.r !== -1 && lastHoveredCell.c !== -1) {
                    e.preventDefault(); // Prevent page scroll
                    handleRightClick(lastHoveredCell.r, lastHoveredCell.c);
                }
            }
        };
        document.addEventListener('keydown', onGlobalKey);

        const winObj = WindowManager.windows.get(winId);
        if(winObj) {
            const originalCleanup = winObj.cleanup;
            winObj.cleanup = () => {
                if (originalCleanup) originalCleanup();
                if(timer) clearInterval(timer);
                document.removeEventListener('keydown', onGlobalKey);
            };
        }

        initBoard();
    }
});
