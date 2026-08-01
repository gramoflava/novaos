Apps.register({
    id: 'minesweeper',
    name: 'Minesweeper',
    iconId: 'minesweeper',
    category: 'games',
    keepInDock: true,
    launch: () => {
        const winId = 'minesweeper-' + Date.now();

        const style = `
            .ms-container { padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; height: 100%; overflow: auto; font-family: var(--font-sans); color: var(--text); }
            .ms-grid { --ms-cell-size: 32px; display: grid; flex: none; gap: 2px; padding: 12px; background: var(--surface-sunk); border-radius: var(--radius-md); border: 1px solid var(--line-strong); box-shadow: var(--glass-edge); user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
            .ms-cell { width: var(--ms-cell-size); height: var(--ms-cell-size); background: var(--surface-sunk); border-radius: var(--radius-xs); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: clamp(12px, calc(var(--ms-cell-size) * 0.5), 16px); cursor: pointer; touch-action: manipulation; transition: background 0.1s, transform 0.1s; color: var(--text); -webkit-tap-highlight-color: transparent; }
            .ms-cell.is-pressing { background: var(--glass-hover); transform: scale(0.96); }
            @media (hover: hover) and (pointer: fine) {
                .ms-cell:hover { background: var(--glass-hover); }
            }
            .ms-cell.revealed { background: var(--glass-active); border: 1px solid var(--surface-sunk); cursor: default; }
            .ms-cell.mine { background: #EF4444; color: #fff;}
            .ms-cell.flagged { color: #F59E0B; }
            .c-1 { color: #3B82F6; } .c-2 { color: #10B981; } .c-3 { color: #EF4444; }
            .c-4 { color: #8B5CF6; } .c-5 { color: #F59E0B; } .c-6 { color: #06B6D4; }
            .c-7 { color: #111827; } .c-8 { color: #6B7280; }
            @media (max-width: 640px) {
                .ms-container { padding: 8px; align-items: flex-start; }
                .ms-container .game-toolbar { flex: none; }
                .ms-grid { margin: 0 auto; }
            }
        `;

        const html = `
            <div class="ms-container" id="ms-container-${winId}">
                <div class="game-toolbar">
                    <div class="game-toolbar__group">
                        <select id="ms-level-${winId}" class="game-select" aria-label="Difficulty">
                            <option value="easy">Beginner</option>
                            <option value="medium">Intermed.</option>
                            <option value="hard">Expert</option>
                        </select>
                        <button class="game-icon-btn game-icon-btn--restart" id="ms-restart-${winId}" type="button" title="Restart" aria-label="Restart"></button>
                        <button class="game-icon-btn game-icon-btn--flag" id="ms-flag-${winId}" type="button" title="Flag mode (or long press a cell)" aria-label="Flag mode" aria-pressed="false"></button>
                    </div>
                    <div class="game-toolbar__spacer"></div>
                    <div class="game-stat-group">
                        <div class="game-stat">
                            <div class="game-stat__label">Mines</div>
                            <div class="game-stat__value" id="ms-mines-${winId}">10</div>
                        </div>
                        <div class="game-stat">
                            <div class="game-stat__label">Time</div>
                            <div class="game-stat__value" id="ms-time-${winId}">0</div>
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
        let flagMode = false;

        const uiGrid = document.getElementById(`ms-grid-${winId}`);
        const uiTime = document.getElementById(`ms-time-${winId}`);
        const uiMines = document.getElementById(`ms-mines-${winId}`);
        const uiFlagMode = document.getElementById(`ms-flag-${winId}`);

        const updateGridCellSize = () => {
            const isMobile = window.matchMedia('(max-width: 640px)').matches;
            const horizontalPadding = isMobile ? 16 : 32;
            const contentWidth = Math.max(0, uiGrid.parentElement.clientWidth - horizontalPadding);
            const chromeWidth = 26 + Math.max(0, cols - 1) * 2;
            const fittedSize = Math.floor((contentWidth - chromeWidth) / cols);
            const cellSize = isMobile ? Math.max(26, Math.min(32, fittedSize)) : 32;
            uiGrid.style.setProperty('--ms-cell-size', `${cellSize}px`);
            uiGrid.style.gridTemplateColumns = `repeat(${cols}, var(--ms-cell-size))`;
        };

        const setFlagMode = value => {
            flagMode = value;
            uiFlagMode.setAttribute('aria-pressed', String(flagMode));
            uiFlagMode.title = flagMode ? 'Flag mode on' : 'Flag mode (or long press a cell)';
        };

        const bindCellInteractions = (div, r, c) => {
            let longPressTimer = null;
            let startX = 0;
            let startY = 0;
            let suppressNativeActionUntil = 0;

            const cancelLongPress = () => {
                if (longPressTimer !== null) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };

            const finishPress = () => {
                cancelLongPress();
                div.classList.remove('is-pressing');
            };

            div.addEventListener('pointerdown', event => {
                if (event.pointerType === 'mouse') return;
                event.stopPropagation();
                if (div.setPointerCapture) div.setPointerCapture(event.pointerId);
                startX = event.clientX;
                startY = event.clientY;
                cancelLongPress();
                div.classList.add('is-pressing');
                longPressTimer = setTimeout(() => {
                    longPressTimer = null;
                    suppressNativeActionUntil = Date.now() + 1000;
                    handleRightClick(r, c);
                    div.classList.remove('is-pressing');
                    if (navigator.vibrate) navigator.vibrate(12);
                }, 450);
            });

            div.addEventListener('pointermove', event => {
                if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) {
                    finishPress();
                }
            });
            div.addEventListener('pointerup', finishPress);
            div.addEventListener('pointercancel', finishPress);
            div.addEventListener('lostpointercapture', finishPress);

            div.addEventListener('click', event => {
                event.preventDefault();
                if (Date.now() < suppressNativeActionUntil) return;
                if (flagMode) handleRightClick(r, c);
                else handleLeftClick(r, c);
            });
            div.addEventListener('contextmenu', event => {
                event.preventDefault();
                if (Date.now() < suppressNativeActionUntil) return;
                handleRightClick(r, c);
            });
        };

        const initBoard = () => {
            updateGridCellSize();
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
                    bindCellInteractions(div, r, c);
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
                    div.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="14" r="7"></circle><path d="M9.15 9.15l-1.15 -1.15M9 4l1 2M13 4l-1 2M17 4l-1 2M18 8l2 -1M21 11l-2 1"></path></svg>';
                } else if (cell.neighborMines > 0) {
                    div.textContent = cell.neighborMines;
                    div.classList.add('c-'+cell.neighborMines);
                }
            } else if (cell.isFlagged) {
                div.classList.add('flagged');
                div.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9M5 21v-7"></path></svg>';
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
        uiFlagMode.addEventListener('click', () => setFlagMode(!flagMode));
        window.addEventListener('resize', updateGridCellSize);

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
                window.removeEventListener('resize', updateGridCellSize);
            };
        }

        initBoard();
    }
});
