Apps.register({
  id: 'columns',
  name: 'Columns',
  iconId: 'columns',
  category: 'games',
  keepInDock: true,
  launch: () => {
    const winId = 'columns-' + Date.now();

    const style = `
      .co-shell { display: flex; height: 100%; padding: 16px; flex-direction: column; color: var(--text); font-family: var(--font-sans); }
      .co-game { display: flex; min-height: 0; flex: 1; align-items: flex-start; justify-content: center; gap: 12px; }
      .co-board-wrap { position: relative; flex: 0 0 auto; overflow: hidden; border: 1px solid var(--line-strong); border-radius: var(--radius-md); outline: none; background: var(--surface-sunk); box-shadow: var(--glass-edge); touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
      .co-board-wrap:focus-visible { border-color: var(--accent); box-shadow: var(--glass-edge), 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent); }
      .co-board { --co-cell-size: 28px; display: grid; grid-template-columns: repeat(6, var(--co-cell-size)); gap: 2px; padding: 8px; }
      .co-cell { position: relative; width: var(--co-cell-size); height: var(--co-cell-size); overflow: hidden; border-radius: var(--radius-xs); background: color-mix(in srgb, var(--surface-sunk) 80%, var(--glass-hover)); }
      .co-gem { --gem: #64748b; position: absolute; inset: 2px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--gem) 66%, var(--line-strong)); border-radius: 30% 30% 38% 38%; background: linear-gradient(145deg, color-mix(in srgb, var(--gem) 42%, white) 0 18%, var(--gem) 46%, color-mix(in srgb, var(--gem) 72%, black)); box-shadow: inset 2px 2px 3px rgba(255, 255, 255, 0.42), inset -3px -4px 5px rgba(15, 23, 42, 0.34), 0 2px 4px rgba(15, 23, 42, 0.2); }
      .co-gem::before { position: absolute; inset: 18% 22% 34%; border: 1px solid rgba(255, 255, 255, 0.44); border-width: 1px 0 0 1px; border-radius: 30%; content: ''; transform: skewX(-12deg); }
      .co-gem--0 { --gem: #ef4444; }
      .co-gem--1 { --gem: #3b82f6; }
      .co-gem--2 { --gem: #10b981; }
      .co-gem--3 { --gem: #f59e0b; }
      .co-gem--4 { --gem: #8b5cf6; }
      .co-gem--5 { --gem: #ec4899; }
      .co-gem--magic { --gem: #f8fafc; animation: coMagic 700ms steps(3, end) infinite; background: conic-gradient(from 45deg, #06b6d4, #8b5cf6, #ec4899, #f59e0b, #10b981, #06b6d4); }
      .co-gem.is-clearing { animation: coClear 170ms var(--ease-out) forwards; }
      .co-side { display: flex; width: 76px; flex: 0 0 76px; flex-direction: column; gap: 10px; }
      .co-next, .co-chain { padding: 8px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-sunk); box-shadow: var(--glass-edge); }
      .co-side-label { margin-bottom: 6px; color: var(--text-muted); font-size: 8px; font-weight: 600; letter-spacing: 0.07em; text-align: center; text-transform: uppercase; }
      .co-next-stack { display: flex; align-items: center; flex-direction: column; gap: 3px; }
      .co-next-cell { position: relative; width: 28px; height: 28px; border-radius: var(--radius-xs); background: var(--surface-sunk); }
      .co-chain { color: var(--text-secondary); font-size: 9px; font-weight: 600; line-height: 1.45; text-align: center; text-transform: uppercase; }
      .co-chain strong { display: block; color: var(--accent); font-size: 18px; font-variant-numeric: tabular-nums; }
      .co-status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; background: color-mix(in srgb, var(--bg) 72%, transparent); color: var(--text); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-align: center; text-transform: uppercase; pointer-events: none; }
      .co-status.hidden { display: none; }
      .co-caption { display: flex; min-height: 28px; align-items: flex-end; justify-content: center; color: var(--text-muted); font-size: 9px; font-weight: 500; letter-spacing: 0.05em; text-align: center; text-transform: uppercase; }
      .co-caption-mobile { display: none; }
      @keyframes coClear { to { opacity: 0; transform: scale(1.35) rotate(8deg); } }
      @keyframes coMagic { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(120deg); } }
      @media (max-width: 640px) {
        .co-shell { padding: 8px; }
        .co-game { gap: 8px; }
        .co-side { width: 66px; flex-basis: 66px; gap: 8px; }
        .co-next, .co-chain { padding: 6px; }
        .co-caption { min-height: 34px; }
        .co-caption-desktop { display: none; }
        .co-caption-mobile { display: inline; }
      }
    `;

    const html = `
      <div class="co-shell" id="co-shell-${winId}">
        <div class="game-toolbar">
          <div class="game-toolbar__group">
            <button class="game-icon-btn game-icon-btn--restart" id="co-restart-${winId}" type="button" title="Restart" aria-label="Restart"></button>
          </div>
          <div class="game-toolbar__spacer"></div>
          <div class="game-stat-group">
            <div class="game-stat">
              <div class="game-stat__label">Score</div>
              <div class="game-stat__value" id="co-score-${winId}">0</div>
            </div>
            <div class="game-stat">
              <div class="game-stat__label">Level</div>
              <div class="game-stat__value" id="co-level-${winId}">1</div>
            </div>
            <div class="game-stat">
              <div class="game-stat__label">Best</div>
              <div class="game-stat__value" id="co-best-${winId}">0</div>
            </div>
          </div>
        </div>
        <div class="co-game">
          <div class="co-board-wrap" id="co-board-wrap-${winId}" role="application" tabindex="0" aria-label="Columns game board. Swipe left or right to move, up to cycle colours, and down to drop.">
            <div class="co-board" id="co-board-${winId}"></div>
            <div class="co-status" id="co-status-${winId}">Arrows or swipe to begin</div>
          </div>
          <aside class="co-side" aria-label="Next column and current chain">
            <div class="co-next">
              <div class="co-side-label">Next</div>
              <div class="co-next-stack" id="co-next-${winId}"></div>
            </div>
            <div class="co-chain">
              Chain
              <strong id="co-chain-${winId}">×1</strong>
            </div>
          </aside>
        </div>
        <div class="co-caption">
          <span class="co-caption-desktop">← → move · ↑ cycle colours · ↓ drop</span>
          <span class="co-caption-mobile">Swipe ← → move · ↑ cycle · ↓ drop</span>
        </div>
      </div>
      <style>${style}</style>
    `;

    WindowManager.create({
      id: winId,
      appId: 'columns',
      title: 'Columns',
      width: 430,
      height: 610,
      content: html
    });

    const ROWS = 13;
    const COLS = 6;
    const COLOR_COUNT = 6;
    const MAGIC = -2;
    const GAME_ID = 'columns-classic';
    const shell = document.getElementById(`co-shell-${winId}`);
    const boardNode = document.getElementById(`co-board-${winId}`);
    const boardWrap = document.getElementById(`co-board-wrap-${winId}`);
    const scoreNode = document.getElementById(`co-score-${winId}`);
    const levelNode = document.getElementById(`co-level-${winId}`);
    const bestNode = document.getElementById(`co-best-${winId}`);
    const nextNode = document.getElementById(`co-next-${winId}`);
    const chainNode = document.getElementById(`co-chain-${winId}`);
    const statusNode = document.getElementById(`co-status-${winId}`);

    let board = [];
    let cells = [];
    let active = null;
    let nextPiece = null;
    let state = 'ready';
    let score = 0;
    let level = 1;
    let clearedJewels = 0;
    let best = 0;
    let piecesUntilMagic = 12;
    let dropAccumulator = 0;
    let lastFrame = performance.now();
    let animationFrame = 0;
    let roundToken = 0;
    let destroyed = false;
    let clearingCells = new Set();
    let pointerStart = null;
    let resizeObserver = null;

    const wait = duration => new Promise(resolve => setTimeout(resolve, duration));
    const randomColor = () => Math.floor(Math.random() * COLOR_COUNT);
    const playSound = type => {
      if (window.AudioMng) {
        window.AudioMng.play(type);
      }
    };

    const updateBest = () => {
      const topScore = window.Scores && window.Scores.getTopScores(GAME_ID)[0];
      best = Math.max(score, topScore ? topScore.score : 0);
      bestNode.textContent = best;
    };

    const updateStats = () => {
      scoreNode.textContent = Math.floor(score);
      levelNode.textContent = level;
      updateBest();
    };

    const createGem = value => {
      const gem = document.createElement('div');
      gem.className = value === MAGIC ? 'co-gem co-gem--magic' : `co-gem co-gem--${value}`;
      return gem;
    };

    const renderNext = () => {
      nextNode.innerHTML = '';
      if (!nextPiece) {
        return;
      }
      nextPiece.colors.forEach(value => {
        const cell = document.createElement('div');
        cell.className = 'co-next-cell';
        cell.appendChild(createGem(value));
        nextNode.appendChild(cell);
      });
    };

    const renderStatus = () => {
      if (state === 'ready') {
        statusNode.textContent = 'Arrows or swipe to begin';
        statusNode.classList.remove('hidden');
      } else if (state === 'gameover') {
        statusNode.textContent = `Stack sealed · ${Math.floor(score)}`;
        statusNode.classList.remove('hidden');
      } else {
        statusNode.classList.add('hidden');
      }
    };

    const render = () => {
      cells.forEach((cell, index) => {
        cell.innerHTML = '';
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        const value = board[row][col];
        if (value !== -1) {
          const gem = createGem(value);
          if (clearingCells.has(`${row}:${col}`)) {
            gem.classList.add('is-clearing');
          }
          cell.appendChild(gem);
        }
      });

      if (active) {
        active.colors.forEach((value, offset) => {
          const row = active.row + offset;
          if (row >= 0 && row < ROWS) {
            cells[row * COLS + active.col].appendChild(createGem(value));
          }
        });
      }

      renderNext();
      renderStatus();
      updateStats();
    };

    const updateLayout = () => {
      const mobile = window.matchMedia('(max-width: 640px)').matches;
      const widthAvailable = Math.max(150, shell.clientWidth - (mobile ? 82 : 104));
      const heightAvailable = Math.max(280, shell.clientHeight - (mobile ? 90 : 104));
      const widthSize = Math.floor((widthAvailable - 26) / COLS);
      const heightSize = Math.floor((heightAvailable - 40) / ROWS);
      const cellSize = Math.max(18, Math.min(30, widthSize, heightSize));
      boardNode.style.setProperty('--co-cell-size', `${cellSize}px`);
    };

    const createPiece = () => {
      if (level >= 5 && piecesUntilMagic <= 0) {
        piecesUntilMagic = 12 + Math.floor(Math.random() * 7);
        return { colors: [MAGIC, MAGIC, MAGIC], magic: true };
      }
      piecesUntilMagic -= 1;
      return { colors: [randomColor(), randomColor(), randomColor()], magic: false };
    };

    const canPlace = (piece, row = piece.row, col = piece.col) => {
      if (col < 0 || col >= COLS) {
        return false;
      }
      return piece.colors.every((value, offset) => {
        const targetRow = row + offset;
        if (targetRow >= ROWS) {
          return false;
        }
        return targetRow < 0 || board[targetRow][col] === -1;
      });
    };

    const spawnPiece = () => {
      active = {
        row: 0,
        col: 2,
        colors: [...nextPiece.colors],
        magic: nextPiece.magic
      };
      nextPiece = createPiece();
      dropAccumulator = 0;
      if (!canPlace(active)) {
        endGame();
        return false;
      }
      render();
      return true;
    };

    const begin = () => {
      if (state === 'ready') {
        state = 'playing';
        lastFrame = performance.now();
        renderStatus();
      }
    };

    const move = direction => {
      if (state === 'gameover' || state === 'resolving') {
        return;
      }
      begin();
      if (active && canPlace(active, active.row, active.col + direction)) {
        active.col += direction;
        playSound('click');
        render();
      }
    };

    const cycleColours = () => {
      if (state === 'gameover' || state === 'resolving') {
        return;
      }
      begin();
      if (active && !active.magic) {
        active.colors = [active.colors[1], active.colors[2], active.colors[0]];
        playSound('click');
        render();
      }
    };

    const findMatches = () => {
      const matches = new Set();
      const directions = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1]
      ];

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const value = board[row][col];
          if (value < 0) {
            continue;
          }
          directions.forEach(([rowStep, colStep]) => {
            const beforeRow = row - rowStep;
            const beforeCol = col - colStep;
            if (
              beforeRow >= 0 &&
              beforeRow < ROWS &&
              beforeCol >= 0 &&
              beforeCol < COLS &&
              board[beforeRow][beforeCol] === value
            ) {
              return;
            }
            const run = [];
            let scanRow = row;
            let scanCol = col;
            while (
              scanRow >= 0 &&
              scanRow < ROWS &&
              scanCol >= 0 &&
              scanCol < COLS &&
              board[scanRow][scanCol] === value
            ) {
              run.push(`${scanRow}:${scanCol}`);
              scanRow += rowStep;
              scanCol += colStep;
            }
            if (run.length >= 3) {
              run.forEach(key => matches.add(key));
            }
          });
        }
      }
      return matches;
    };

    const applyGravity = () => {
      for (let col = 0; col < COLS; col += 1) {
        let targetRow = ROWS - 1;
        for (let row = ROWS - 1; row >= 0; row -= 1) {
          if (board[row][col] !== -1) {
            board[targetRow][col] = board[row][col];
            if (targetRow !== row) {
              board[row][col] = -1;
            }
            targetRow -= 1;
          }
        }
        while (targetRow >= 0) {
          board[targetRow][col] = -1;
          targetRow -= 1;
        }
      }
    };

    const resolveMatches = async token => {
      let chain = 0;
      while (token === roundToken && !destroyed) {
        const matches = findMatches();
        if (!matches.size) {
          break;
        }
        chain += 1;
        chainNode.textContent = `×${chain}`;
        clearingCells = matches;
        render();
        playSound(chain > 1 ? 'win' : 'collapse');
        await wait(180);
        if (token !== roundToken || destroyed) {
          return;
        }
        matches.forEach(key => {
          const [row, col] = key.split(':').map(Number);
          board[row][col] = -1;
        });
        const removed = matches.size;
        clearedJewels += removed;
        score += removed * 10 * level * 2 ** (chain - 1);
        level = 1 + Math.floor(clearedJewels / 30);
        clearingCells = new Set();
        applyGravity();
        render();
        await wait(110);
      }
      chainNode.textContent = chain > 1 ? `×${chain}` : '×1';
    };

    const resolveMagic = async token => {
      const belowRow = active.row + active.colors.length;
      const targetColor = belowRow >= 0 && belowRow < ROWS ? board[belowRow][active.col] : -1;
      const magicCells = [];
      active.colors.forEach((value, offset) => {
        const row = active.row + offset;
        if (row >= 0 && row < ROWS) {
          board[row][active.col] = MAGIC;
          magicCells.push(`${row}:${active.col}`);
        }
      });
      active = null;
      clearingCells = new Set(magicCells);
      render();
      playSound('win');
      await wait(220);
      if (token !== roundToken || destroyed) {
        return;
      }
      magicCells.forEach(key => {
        const [row, col] = key.split(':').map(Number);
        board[row][col] = -1;
      });
      let removed = 0;
      if (targetColor >= 0) {
        for (let row = 0; row < ROWS; row += 1) {
          for (let col = 0; col < COLS; col += 1) {
            if (board[row][col] === targetColor) {
              board[row][col] = -1;
              removed += 1;
            }
          }
        }
      }
      clearingCells = new Set();
      clearedJewels += removed;
      score += removed * 25 * level;
      level = 1 + Math.floor(clearedJewels / 30);
      applyGravity();
      render();
    };

    const lockActive = async () => {
      if (!active || state === 'resolving' || state === 'gameover') {
        return;
      }
      state = 'resolving';
      const token = roundToken;
      const pieceWasMagic = active.magic;
      if (active.colors.some((value, offset) => active.row + offset < 0)) {
        endGame();
        return;
      }

      if (pieceWasMagic) {
        await resolveMagic(token);
      } else {
        active.colors.forEach((value, offset) => {
          board[active.row + offset][active.col] = value;
        });
        active = null;
        render();
      }

      if (token !== roundToken || destroyed) {
        return;
      }
      await resolveMatches(token);
      if (token !== roundToken || destroyed) {
        return;
      }
      state = 'playing';
      spawnPiece();
    };

    const stepDown = () => {
      if (state !== 'playing' || !active) {
        return;
      }
      if (canPlace(active, active.row + 1, active.col)) {
        active.row += 1;
        render();
      } else {
        void lockActive();
      }
    };

    const hardDrop = () => {
      if (state === 'gameover' || state === 'resolving') {
        return;
      }
      begin();
      if (!active) {
        return;
      }
      let distance = 0;
      while (canPlace(active, active.row + 1, active.col)) {
        active.row += 1;
        distance += 1;
      }
      score += distance * level;
      playSound('collapse');
      render();
      void lockActive();
    };

    const endGame = () => {
      if (state === 'gameover') {
        return;
      }
      state = 'gameover';
      active = null;
      render();
      playSound('lose');
      if (window.Scores && score > 0) {
        window.Scores.showScorePrompt(GAME_ID, Math.floor(score), false, null, winId);
      }
    };

    const reset = () => {
      roundToken += 1;
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
      score = 0;
      level = 1;
      clearedJewels = 0;
      piecesUntilMagic = 12 + Math.floor(Math.random() * 7);
      clearingCells = new Set();
      dropAccumulator = 0;
      state = 'ready';
      chainNode.textContent = '×1';
      nextPiece = createPiece();
      spawnPiece();
      state = 'ready';
      render();
      boardWrap.focus({ preventScroll: true });
    };

    const dropInterval = () => Math.max(110, Math.round(820 * 0.86 ** (level - 1)));
    const frame = now => {
      const delta = Math.min(50, now - lastFrame);
      lastFrame = now;
      if (state === 'playing') {
        dropAccumulator += delta;
        if (dropAccumulator >= dropInterval()) {
          dropAccumulator %= dropInterval();
          stepDown();
        }
      }
      animationFrame = requestAnimationFrame(frame);
    };

    const onKeyDown = event => {
      if (WindowManager.activeWindowId !== winId) {
        return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        return;
      }
      event.preventDefault();
      if (event.code === 'ArrowLeft') {
        move(-1);
      } else if (event.code === 'ArrowRight') {
        move(1);
      } else if (event.code === 'ArrowUp') {
        if (!event.repeat) {
          cycleColours();
        }
      } else if (event.code === 'ArrowDown' && !event.repeat) {
        hardDrop();
      }
    };

    const onPointerDown = event => {
      if (!event.isPrimary || event.button > 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      boardWrap.setPointerCapture(event.pointerId);
      pointerStart = { x: event.clientX, y: event.clientY };
      boardWrap.focus({ preventScroll: true });
    };

    const finishSwipe = event => {
      event.preventDefault();
      event.stopPropagation();
      if (!pointerStart) {
        return;
      }
      const deltaX = event.clientX - pointerStart.x;
      const deltaY = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 22) {
        return;
      }
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        move(deltaX < 0 ? -1 : 1);
      } else if (deltaY < 0) {
        cycleColours();
      } else {
        hardDrop();
      }
    };

    const cancelSwipe = event => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      pointerStart = null;
    };

    const preventRepeatedTapGesture = event => {
      event.preventDefault();
      event.stopPropagation();
    };

    cells = Array.from({ length: ROWS * COLS }, () => {
      const cell = document.createElement('div');
      cell.className = 'co-cell';
      boardNode.appendChild(cell);
      return cell;
    });

    document.getElementById(`co-restart-${winId}`).addEventListener('click', reset);
    document.addEventListener('keydown', onKeyDown);
    boardWrap.addEventListener('pointerdown', onPointerDown);
    boardWrap.addEventListener('pointerup', finishSwipe);
    boardWrap.addEventListener('pointercancel', cancelSwipe);
    boardWrap.addEventListener('lostpointercapture', cancelSwipe);
    boardWrap.addEventListener('dblclick', preventRepeatedTapGesture);
    window.addEventListener('resize', updateLayout);

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(updateLayout);
      resizeObserver.observe(shell);
    }

    updateLayout();
    requestAnimationFrame(updateLayout);
    reset();
    animationFrame = requestAnimationFrame(frame);

    const winObj = WindowManager.windows.get(winId);
    if (winObj) {
      const originalCleanup = winObj.cleanup;
      winObj.cleanup = () => {
        if (originalCleanup) {
          originalCleanup();
        }
        destroyed = true;
        roundToken += 1;
        cancelAnimationFrame(animationFrame);
        document.removeEventListener('keydown', onKeyDown);
        boardWrap.removeEventListener('pointerdown', onPointerDown);
        boardWrap.removeEventListener('pointerup', finishSwipe);
        boardWrap.removeEventListener('pointercancel', cancelSwipe);
        boardWrap.removeEventListener('lostpointercapture', cancelSwipe);
        boardWrap.removeEventListener('dblclick', preventRepeatedTapGesture);
        window.removeEventListener('resize', updateLayout);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    }
  }
});
