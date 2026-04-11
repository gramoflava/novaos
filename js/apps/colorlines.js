Apps.register({
    id: 'colorlines',
    name: 'Color Lines',
    iconId: 'colorlines',
    category: 'games',
    keepInDock: true,
    launch: () => {
        const winId = 'colorlines-' + Date.now();
        
        const style = `
            .cl-container { padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; font-family: var(--font-sans); color: var(--text-primary); }
            .cl-header { display:flex; justify-content: space-between; align-items: flex-end; width: 100%; max-width: 320px; margin-bottom: 24px; }
            .cl-btn { background: rgba(128,128,128,0.1); border: 1px solid var(--border-glass); color: var(--text-primary); padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.2s; }
            .cl-btn:hover { background: rgba(128,128,128,0.2); }
            .cl-grid { display: grid; gap: 2px; padding: 8px; background: rgba(128,128,128,0.05); border-radius: 12px; border: 1px solid var(--border-glass-strong); box-shadow: var(--shadow-inset); user-select: none; position: relative; }
            .cl-cell { width: 32px; height: 32px; background: rgba(128,128,128,0.08); border-radius: 6px; position: relative; cursor: pointer; transition: background 0.2s; }
            .cl-cell:hover { background: rgba(128,128,128,0.15); }
            .cl-cell.selected { background: rgba(128,128,128,0.25); box-shadow: inset 0 0 10px rgba(128,128,128,0.5); }
            .cl-cell.traced::after { content: ''; position: absolute; top: 12px; left: 12px; width: 8px; height: 8px; border-radius: 50%; background: var(--text-primary); opacity: 0.3; pointer-events: none; }
            .cl-ball { position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; box-shadow: inset -4px -4px 8px rgba(0,0,0,0.5), 0 0 10px currentColor; pointer-events: none; transition: transform 0.2s; z-index: 10; }
            .cl-cell.selected .cl-ball { transform: scale(1.15); animation: pulseBall 1s infinite alternate; }
            .color-0 { color: #EF4444; background: #EF4444; }
            .color-1 { color: #3B82F6; background: #3B82F6; }
            .color-2 { color: #10B981; background: #10B981; }
            .color-3 { color: #F59E0B; background: #F59E0B; }
            .color-4 { color: #8B5CF6; background: #8B5CF6; }
            .color-5 { color: #EC4899; background: #EC4899; }
            .color-6 { color: #06B6D4; background: #06B6D4; }
            @keyframes pulseBall { from { transform: scale(1.1); filter: brightness(1.2); } to { transform: scale(1.2); filter: brightness(1.5); } }
            .cl-preview-group { display: flex; align-items: center; background: rgba(128,128,128,0.05); border: 1px solid var(--border-glass); border-radius: 6px; padding: 2px 4px; gap: 4px; transition: background 0.2s; }
            .cl-preview-btn { background: transparent; border: none; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; opacity: 0.6; transition: opacity 0.2s; }
            .cl-preview-btn:hover { opacity: 1; }
            .cl-preview-wrap { overflow: hidden; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; width: 94px; opacity: 1; display: flex; gap: 4px; align-items: center; }
            .cl-preview-wrap.collapsed { width: 0; opacity: 0; pointer-events: none; }
            .cl-preview-cell { flex-shrink: 0; width: 26px; height: 26px; background: rgba(128,128,128,0.05); border-radius: 4px; position: relative; border: 1px solid rgba(128,128,128,0.1); }
            .cl-preview-cell .cl-ball { top: 3px; left: 3px; width: 18px; height: 18px; box-shadow: inset -2px -2px 4px rgba(0,0,0,0.5), 0 0 6px currentColor; }
        `;

        const html = `
            <div class="cl-container" id="cl-container-${winId}">
                <div class="cl-header">
                    <div>
                        <div style="font-size: 24px; font-weight: 700; color: var(--text-primary);">Lines</div>
                        <div style="display:flex; gap: 8px; margin-top: 8px; align-items: center;">
                            <button class="cl-btn" id="cl-restart-${winId}">Restart</button>
                            <div class="cl-preview-group">
                                <button class="cl-preview-btn" id="cl-toggle-preview-${winId}" title="Toggle Preview">
                                    <!-- SVG handled dynamically by JS -->
                                </button>
                                <div class="cl-preview-wrap ${localStorage.getItem('novaos_colorlines_preview') === 'false' ? 'collapsed' : ''}" id="cl-preview-${winId}"></div>
                            </div>
                        </div>
                    </div>
                    <div style="background: rgba(128,128,128,0.1); padding: 4px 12px; border-radius: 6px; font-variant-numeric: tabular-nums; text-align: right;">
                        <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase;">Score</div>
                        <div id="cl-score-${winId}" style="font-weight: 600; font-size: 16px; color: var(--text-primary);">0</div>
                    </div>
                </div>
                <div class="cl-grid" id="cl-grid-${winId}"></div>
            </div>
            <style>${style}</style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'colorlines',
            title: 'Color Lines',
            width: 380,
            height: 480,
            content: html
        });

        const size = 9;
        const colors = 7;
        let board = Array(size*size).fill(-1);
        let score = 0;
        let selectedIdx = -1;
        let isGameOver = false;
        let isAnimating = false;
        let nextBalls = [];
        let isPreviewVisible = localStorage.getItem('novaos_colorlines_preview') !== 'false';

        const svgEyeOpen = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const svgEyeClosed = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

        const toggleBtn = document.getElementById(`cl-toggle-preview-${winId}`);
        toggleBtn.innerHTML = isPreviewVisible ? svgEyeOpen : svgEyeClosed;

        toggleBtn.onclick = () => {
            isPreviewVisible = !isPreviewVisible;
            localStorage.setItem('novaos_colorlines_preview', isPreviewVisible);
            
            toggleBtn.innerHTML = isPreviewVisible ? svgEyeOpen : svgEyeClosed;
            
            const wrap = document.getElementById(`cl-preview-${winId}`);
            if (isPreviewVisible) {
                wrap.classList.remove('collapsed');
            } else {
                wrap.classList.add('collapsed');
            }
        };

        const renderPreview = () => {
            const wrap = document.getElementById(`cl-preview-${winId}`);
            wrap.innerHTML = '';
            nextBalls.forEach(col => {
                const cell = document.createElement('div');
                cell.className = 'cl-preview-cell';
                const ball = document.createElement('div');
                ball.className = `cl-ball color-${col}`;
                cell.appendChild(ball);
                wrap.appendChild(cell);
            });
        };

        const uiGrid = document.getElementById(`cl-grid-${winId}`);
        const uiScore = document.getElementById(`cl-score-${winId}`);
        uiGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

        // Setup generic empty grid items
        for(let i=0; i<size*size; i++) {
            const cell = document.createElement('div');
            cell.className = 'cl-cell';
            uiGrid.appendChild(cell);
        }

        const clearTrace = () => {
            Array.from(uiGrid.children).forEach(c => c.classList.remove('traced'));
        };

        const render = () => {
            for(let i=0; i<size*size; i++) {
                const cell = uiGrid.children[i];
                cell.className = 'cl-cell' + (selectedIdx === i ? ' selected' : '');
                
                // Clear out existing balls
                cell.innerHTML = '';
                
                if(board[i] !== -1) {
                    const ball = document.createElement('div');
                    ball.className = `cl-ball color-${board[i]}`;
                    cell.appendChild(ball);
                }

                // Event Listeners for interaction & hover
                cell.onclick = () => handleClick(i);
                cell.onmouseenter = () => {
                    if(selectedIdx !== -1 && !isAnimating && board[i] === -1) {
                        clearTrace();
                        let path = getPath(selectedIdx, i);
                        if(path) {
                            path.forEach(p => uiGrid.children[p].classList.add('traced'));
                        }
                    }
                };
                cell.onmouseleave = clearTrace;
            }
            uiScore.textContent = score;
        };

        const getEmpty = () => {
            let empty = [];
            for(let i=0; i<size*size; i++) if(board[i]===-1) empty.push(i);
            return empty;
        };

        const spawnBalls = async (num) => {
            let empty = getEmpty();
            if(empty.length === 0) return false;
            
            for(let k=0; k<num; k++) {
                if(empty.length === 0) break;
                const rIdx = Math.floor(Math.random() * empty.length);
                const pos = empty.splice(rIdx, 1)[0];
                
                let col;
                if (nextBalls.length > 0) {
                    col = nextBalls.shift();
                } else {
                    col = Math.floor(Math.random() * colors);
                }
                board[pos] = col;
                
                // Entrance animation
                render();
                const cell = uiGrid.children[pos];
                if(cell && cell.firstChild) {
                    await cell.firstChild.animate([{transform:'scale(0)'}, {transform:'scale(1)'}], {duration: 300, easing:'ease-out'}).finished;
                }
            }
            
            while(nextBalls.length < 3) {
                nextBalls.push(Math.floor(Math.random() * colors));
            }
            renderPreview();
            
            return await checkLines();
        };

        // Breadth First Search to find shortest path array
        const getPath = (start, end) => {
            if(start === end) return [start];
            let queue = [start];
            let cameFrom = { [start]: null };
            
            while(queue.length > 0) {
                let curr = queue.shift();
                if(curr === end) break;
                
                let r = Math.floor(curr / size);
                let c = curr % size;
                let neighbors = [];
                if(r > 0) neighbors.push(curr - size); // up
                if(r < size-1) neighbors.push(curr + size); // down
                if(c > 0) neighbors.push(curr - 1); // left
                if(c < size-1) neighbors.push(curr + 1); // right
                
                for(let n of neighbors) {
                    if(!(n in cameFrom) && board[n] === -1) {
                        cameFrom[n] = curr;
                        queue.push(n);
                    }
                }
            }

            if(!(end in cameFrom)) return null; // No path found

            // Reconstruct path
            let current = end;
            let path = [];
            while(current !== null) {
                path.push(current);
                current = cameFrom[current];
            }
            return path.reverse();
        };

        const checkLines = async () => {
            let toRemove = new Set();
            
            const trace = (startR, startC, dR, dC) => {
                let col = board[startR * size + startC];
                if(col === -1) return;
                let line = [[startR, startC]];
                let r = startR + dR, c = startC + dC;
                while(r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === col) {
                    line.push([r, c]);
                    r += dR; c += dC;
                }
                if(line.length >= 5) {
                    line.forEach(([lr, lc]) => toRemove.add(lr * size + lc));
                }
            };

            for(let r=0; r<size; r++) {
                for(let c=0; c<size; c++) {
                    trace(r, c, 0, 1);
                    trace(r, c, 1, 0);
                    trace(r, c, 1, 1);
                    trace(r, c, 1, -1);
                }
            }

            if(toRemove.size > 0) {
                isAnimating = true;
                if (window.AudioMng) AudioMng.play('win');
                score += (toRemove.size * 2) + ((toRemove.size - 5) * 5);
                
                const promises = Array.from(toRemove).map(idx => {
                    const cell = uiGrid.children[idx];
                    if(cell && cell.firstChild) {
                        return cell.firstChild.animate([{transform:'scale(1)'}, {transform:'scale(1.5)', opacity:0}], {duration: 250, easing:'ease-in'}).finished;
                    }
                    return Promise.resolve();
                });
                
                await Promise.all(promises);
                
                toRemove.forEach(idx => board[idx] = -1);
                render();
                isAnimating = false;
                return true;
            }
            return false;
        };

        const handleClick = async (idx) => {
            if(isGameOver || isAnimating) return;
            if(window.AudioMng) AudioMng.play('click');

            if(board[idx] !== -1) {
                // Select ball
                selectedIdx = idx;
                render();
            } else if(selectedIdx !== -1) {
                let path = getPath(selectedIdx, idx);
                if(path) {
                    isAnimating = true;
                    clearTrace();
                    
                    const startColorIdx = board[selectedIdx];
                    board[selectedIdx] = -1;
                    selectedIdx = -1;
                    render(); // Remove ball from original slot visually
                    
                    // Create floating animated ball
                    const animBall = document.createElement('div');
                    animBall.className = `cl-ball color-${startColorIdx}`;
                    uiGrid.appendChild(animBall);
                    
                    // Map path indices to physical offsets
                    const keyframes = path.map(p => {
                        const cell = uiGrid.children[p];
                        return { left: cell.offsetLeft + 4 + 'px', top: cell.offsetTop + 4 + 'px' };
                    });

                    const timing = { duration: path.length * 35, easing: 'linear' };
                    await animBall.animate(keyframes, timing).finished;
                    
                    animBall.remove();
                    board[idx] = startColorIdx;
                    render();
                    
                    if(!(await checkLines())) {
                        await spawnBalls(3);
                        if(getEmpty().length === 0) gameOver();
                    }
                    isAnimating = false;
                }
            }
        };

        const gameOver = () => {
            isGameOver = true;
            const isHighScore = Scores.isHighScore('colorlines', score);
            if (window.AudioMng) AudioMng.play(isHighScore ? 'win' : 'lose');
            Scores.showScorePrompt('colorlines', score, isHighScore, null, winId);
        };

        const initBoard = async () => {
            board = Array(size*size).fill(-1);
            score = 0;
            selectedIdx = -1;
            isGameOver = false;
            isAnimating = false;
            nextBalls = [];
            while(nextBalls.length < 3) {
                nextBalls.push(Math.floor(Math.random() * colors));
            }
            renderPreview();
            render();
            await spawnBalls(5);
        };

        document.getElementById(`cl-restart-${winId}`).onclick = initBoard;

        initBoard();
    }
});
