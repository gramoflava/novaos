Apps.register({
  id: 'novarun',
  name: 'Nova Run',
  iconId: 'novarun',
  category: 'games',
  keepInDock: true,
  launch: () => {
    const winId = 'novarun-' + Date.now();
    const storedTheme = localStorage.getItem('novaos_novarun_theme');
    const initialTheme = storedTheme === 'classic' ? 'classic' : 'lunar';

    const style = `
      .nr-shell { display: flex; height: 100%; padding: 16px; flex-direction: column; color: var(--text); font-family: var(--font-sans); }
      .nr-stage { position: relative; display: flex; flex: 1; min-height: 0; overflow: hidden; border: 1px solid var(--line-strong); border-radius: var(--radius-md); background: var(--surface-sunk); box-shadow: var(--glass-edge); }
      .nr-canvas { width: 100%; height: 100%; min-height: 250px; outline: none; touch-action: manipulation; cursor: pointer; }
      .nr-canvas:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
      .nr-caption { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 30px; color: var(--text-muted); font-size: 10px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }
      .nr-caption__route { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .nr-caption__keys { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
      @media (max-width: 640px) {
        .nr-shell { padding: 12px; }
        .nr-canvas { min-height: 210px; }
        .nr-caption__keys { display: none; }
      }
    `;

    const html = `
      <div class="nr-shell" id="nr-shell-${winId}">
        <div class="game-toolbar">
          <div class="game-toolbar__group">
            <select class="game-select" id="nr-theme-${winId}" aria-label="Runner theme">
              <option value="lunar" ${initialTheme === 'lunar' ? 'selected' : ''}>Lunar</option>
              <option value="classic" ${initialTheme === 'classic' ? 'selected' : ''}>Dino</option>
            </select>
            <button class="game-icon-btn game-icon-btn--restart" id="nr-restart-${winId}" type="button" title="Restart" aria-label="Restart"></button>
          </div>
          <div class="game-toolbar__spacer"></div>
          <div class="game-stat-group">
            <div class="game-stat">
              <div class="game-stat__label">Score</div>
              <div class="game-stat__value" id="nr-score-${winId}">0</div>
            </div>
            <div class="game-stat">
              <div class="game-stat__label">Best</div>
              <div class="game-stat__value" id="nr-best-${winId}">0</div>
            </div>
          </div>
        </div>
        <div class="nr-stage">
          <canvas class="nr-canvas" id="nr-canvas-${winId}" width="640" height="280" tabindex="0" aria-label="Nova Run. Press Space or tap to jump. Press Down to duck."></canvas>
        </div>
        <div class="nr-caption">
          <span class="nr-caption__route" id="nr-route-${winId}">${initialTheme === 'lunar' ? 'Lunar route 07 · jump craters · duck saucers' : 'Offline classic · jump cacti · duck birds'}</span>
          <span class="nr-caption__keys">Space / ↑ jump · ↓ duck</span>
        </div>
      </div>
      <style>${style}</style>
    `;

    WindowManager.create({
      id: winId,
      appId: 'novarun',
      title: 'Nova Run',
      width: 680,
      height: 470,
      content: html
    });

    const WIDTH = 640;
    const HEIGHT = 280;
    const GROUND = 224;
    const PLAYER_X = 72;
    const canvas = document.getElementById(`nr-canvas-${winId}`);
    const ctx = canvas.getContext('2d');
    const themeSelect = document.getElementById(`nr-theme-${winId}`);
    const scoreNode = document.getElementById(`nr-score-${winId}`);
    const bestNode = document.getElementById(`nr-best-${winId}`);
    const routeNode = document.getElementById(`nr-route-${winId}`);

    let theme = initialTheme;
    let state = 'ready';
    let score = 0;
    let scoreFloat = 0;
    let best = 0;
    let speed = 0.31;
    let spawnIn = 1100;
    let lastFrame = performance.now();
    let animationFrame = 0;
    let worldTime = 0;
    let obstacles = [];
    let palette = {};
    let downPressed = false;
    const player = { y: GROUND - 48, vy: 0, grounded: true, ducking: false };

    const stars = Array.from({ length: 34 }, (_, index) => ({
      x: (index * 83 + 31) % WIDTH,
      y: 18 + ((index * 47) % 118),
      size: index % 5 === 0 ? 2 : 1
    }));

    const astronautRunSprites = [
      [
        '......OOOOO.......',
        '....OOWWWWOO......',
        '...OWWVVVVVOO.....',
        '...OWHVVVVVVO.....',
        '...OWVVVVVVVO.....',
        '....OOWWWWOO......',
        '..PPPOOWWOO.......',
        '.PPPOWWWWWWO......',
        '.PPCOWAACCWOOO....',
        '.PPPOWWWWWW..OO...',
        '..P.OOWWWWO.......',
        '.....OW..WO.......',
        '....OWO...WO......',
        '...OWO....OWO.....',
        '...OO......OW.....',
        '..OO........OO....'
      ],
      [
        '......OOOOO.......',
        '....OOWWWWOO......',
        '...OWWVVVVVOO.....',
        '...OWHVVVVVVO.....',
        '...OWVVVVVVVO.....',
        '....OOWWWWOO......',
        '..PPPOOWWOO.......',
        '.PPPOWWWWWWO......',
        '.PPCOWAACCWOOO....',
        '.PPPOWWWWWW..OO...',
        '..P.OOWWWWO.......',
        '.....OW..WO.......',
        '.....WO.OWO.......',
        '....OW...OWO......',
        '...OW.....OO......',
        '...OO......OOO....'
      ]
    ];

    const astronautDuckSprite = [
      '........OOOOO.......',
      '......OOWWWWOO......',
      '..PP.OWWVVVVVOO.....',
      '.PPPOWHVVVVVVO......',
      '.PPCOWVVVVVVVO......',
      '.PPPOOWWWWWWOO......',
      '..P.OOWAACCWWOOO....',
      '....OWWWWWWW...OO...',
      '...OOO....OOOO......',
      '..OO........OO......'
    ];

    const dinoRunSprites = [
      [
        '............OOOOOO..',
        '..........OOOOOOOOOO',
        '..........OOOO.OOOOO',
        '..........OOOOOOOOOO',
        '..........OOOOOO....',
        '..........OOOOOOOOO.',
        '...OO....OOOOO......',
        '...OO...OOOOOO......',
        '...OOOOOOOOOOO......',
        '..OOOOOOOOOO........',
        '.OOOOOOOOOOO........',
        'OOOOOOOOOOO.........',
        '....OOOOOO..........',
        '....OO...OO.........',
        '....OO....OO........',
        '...OOO....OOO.......'
      ],
      [
        '............OOOOOO..',
        '..........OOOOOOOOOO',
        '..........OOOO.OOOOO',
        '..........OOOOOOOOOO',
        '..........OOOOOO....',
        '..........OOOOOOOOO.',
        '...OO....OOOOO......',
        '...OO...OOOOOO......',
        '...OOOOOOOOOOO......',
        '..OOOOOOOOOO........',
        '.OOOOOOOOOOO........',
        'OOOOOOOOOOO.........',
        '....OOOOOO..........',
        '....OO..OO..........',
        '...OOO...OO.........',
        '.........OOO........'
      ]
    ];

    const dinoDuckSprites = [
      [
        '..............OOOOOO..',
        '............OOOOOOOOOO',
        '............OOOO.OOOOO',
        '....OOOOOOOOOOOOOOOOOO',
        '..OOOOOOOOOOOOOOOO....',
        'OOOOOOOOOOOOOO........',
        '....OOOOOOOO..........',
        '....OO......OO........',
        '...OOO......OOO.......'
      ],
      [
        '..............OOOOOO..',
        '............OOOOOOOOOO',
        '............OOOO.OOOOO',
        '....OOOOOOOOOOOOOOOOOO',
        '..OOOOOOOOOOOOOOOO....',
        'OOOOOOOOOOOOOO........',
        '....OOOOOOOO..........',
        '....OO.....OO.........',
        '...OOO.....OOO........'
      ]
    ];

    const getGameId = () => `novarun-${theme}`;

    const readPalette = () => {
      const styles = getComputedStyle(document.documentElement);
      palette = {
        text: styles.getPropertyValue('--text').trim(),
        muted: styles.getPropertyValue('--text-muted').trim(),
        line: styles.getPropertyValue('--line-strong').trim(),
        accent: styles.getPropertyValue('--accent').trim(),
        pink: styles.getPropertyValue('--nova-accent-alt').trim(),
        cyan: '#06b6d4',
        violet: '#8b5cf6',
        amber: '#f59e0b',
        danger: '#ef4444',
        dark: styles.colorScheme.includes('dark')
      };
    };

    const resizeCanvas = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = WIDTH * ratio;
      canvas.height = HEIGHT * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };

    const updateBest = () => {
      const topScore = window.Scores && window.Scores.getTopScores(getGameId())[0];
      best = Math.max(score, topScore ? topScore.score : 0);
      bestNode.textContent = best;
    };

    const reset = () => {
      state = 'ready';
      score = 0;
      scoreFloat = 0;
      speed = 0.31;
      spawnIn = 900;
      obstacles = [];
      downPressed = false;
      player.y = GROUND - 48;
      player.vy = 0;
      player.grounded = true;
      player.ducking = false;
      scoreNode.textContent = '0';
      updateBest();
      canvas.focus({ preventScroll: true });
    };

    const begin = () => {
      if (state === 'ready') {
        state = 'playing';
        lastFrame = performance.now();
      }
    };

    const jump = () => {
      if (state === 'gameover') {
        reset();
        begin();
        return;
      }
      begin();
      if (player.grounded) {
        player.ducking = false;
        player.grounded = false;
        player.vy = -0.72;
        if (window.AudioMng) {
          window.AudioMng.play('click');
        }
      }
    };

    const setDuck = value => {
      downPressed = value;
      player.ducking = value && player.grounded && state === 'playing';
    };

    const spawnObstacle = () => {
      const chance = Math.random();
      let obstacle;

      if (theme === 'lunar') {
        if (chance < 0.46) {
          obstacle = { type: 'crater', x: WIDTH + 24, y: GROUND - 10, w: 48, h: 12 };
        } else if (chance < 0.72) {
          obstacle = { type: 'moonrock', x: WIDTH + 24, y: GROUND - 30, w: 27, h: 30 };
        } else {
          obstacle = { type: 'saucer', x: WIDTH + 24, y: GROUND - 61, w: 48, h: 23 };
        }
      } else if (chance < 0.68) {
        const wide = Math.random() > 0.58;
        obstacle = {
          type: 'cactus',
          x: WIDTH + 24,
          y: GROUND - 42,
          w: wide ? 30 : 20,
          h: 42
        };
      } else {
        obstacle = { type: 'bird', x: WIDTH + 24, y: GROUND - 61, w: 44, h: 22 };
      }

      obstacles.push(obstacle);
      const difficulty = Math.max(0.66, 1 - score / 3200);
      spawnIn = (1050 + Math.random() * 820) * difficulty;
    };

    const collisionBox = obstacle => {
      if (obstacle.type === 'crater') {
        return { x: obstacle.x + 5, y: obstacle.y + 1, w: obstacle.w - 10, h: 11 };
      }
      if (obstacle.type === 'saucer' || obstacle.type === 'bird') {
        return { x: obstacle.x + 4, y: obstacle.y + 3, w: obstacle.w - 8, h: obstacle.h - 6 };
      }
      return { x: obstacle.x + 3, y: obstacle.y + 2, w: obstacle.w - 6, h: obstacle.h - 2 };
    };

    const intersects = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    const endGame = () => {
      if (state !== 'playing') {
        return;
      }
      state = 'gameover';
      const finalScore = Math.floor(score);
      score = finalScore;
      scoreNode.textContent = finalScore;
      updateBest();
      if (window.AudioMng) {
        window.AudioMng.play('lose');
      }
      if (window.Scores) {
        window.Scores.showScorePrompt(getGameId(), finalScore, false, null, winId);
      }
    };

    const update = delta => {
      if (state !== 'playing') {
        return;
      }

      worldTime += delta;
      scoreFloat += delta * 0.011;
      score = Math.floor(scoreFloat);
      speed = 0.31 + Math.min(0.23, score * 0.00018);
      scoreNode.textContent = score;

      if (!player.grounded) {
        player.vy += (downPressed ? 0.0031 : 0.00225) * delta;
        player.y += player.vy * delta;
        if (player.y >= GROUND - 48) {
          player.y = GROUND - 48;
          player.vy = 0;
          player.grounded = true;
          player.ducking = downPressed;
        }
      } else {
        player.ducking = downPressed;
      }

      spawnIn -= delta;
      if (spawnIn <= 0) {
        spawnObstacle();
      }

      obstacles.forEach(obstacle => {
        obstacle.x -= speed * delta;
      });
      obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.w > -12);

      const playerBox = player.ducking
        ? { x: PLAYER_X + 5, y: GROUND - 28, w: 42, h: 27 }
        : { x: PLAYER_X + 7, y: player.y + 3, w: 31, h: 44 };

      if (obstacles.some(obstacle => intersects(playerBox, collisionBox(obstacle)))) {
        endGame();
      }
    };

    const drawLunarBackground = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      if (palette.dark) {
        sky.addColorStop(0, '#0a1020');
        sky.addColorStop(1, '#21162f');
      } else {
        sky.addColorStop(0, '#dcecff');
        sky.addColorStop(1, '#f4efff');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      stars.forEach(star => {
        const offset = (worldTime * speed * 0.015) % WIDTH;
        const x = (star.x - offset + WIDTH) % WIDTH;
        ctx.globalAlpha = palette.dark ? 0.72 : 0.48;
        ctx.fillStyle = star.size === 2 ? palette.cyan : palette.text;
        ctx.fillRect(x, star.y, star.size, star.size);
      });
      ctx.globalAlpha = 1;

      const ridge = [24, 32, 44, 56, 72, 64, 52, 42, 34, 48, 62, 78, 90, 74, 58, 46, 38, 50, 66, 82, 70, 56, 44, 36];
      const ridgeOffset = Math.floor((worldTime * speed * 0.02) / 8) * 8;
      ctx.fillStyle = palette.dark ? 'rgba(139, 92, 246, 0.17)' : 'rgba(139, 92, 246, 0.10)';
      for (let x = -16; x < WIDTH + 16; x += 16) {
        const ridgeIndex = Math.floor((x + ridgeOffset + WIDTH * 4) / 16) % ridge.length;
        const ridgeHeight = ridge[ridgeIndex];
        ctx.fillRect(x, GROUND - ridgeHeight, 17, ridgeHeight);
      }

      ctx.fillStyle = palette.dark ? '#22263a' : '#d8dbe5';
      ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
      ctx.strokeStyle = palette.dark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(WIDTH, GROUND);
      ctx.stroke();

      ctx.strokeStyle = palette.dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)';
      ctx.lineWidth = 1;
      const groundOffset = (worldTime * speed * 0.34) % 54;
      for (let x = -groundOffset; x < WIDTH; x += 54) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND + 22);
        ctx.lineTo(x + 18, GROUND + 20);
        ctx.stroke();
      }
    };

    const drawClassicBackground = () => {
      ctx.fillStyle = palette.dark ? '#111318' : '#f7f7f5';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = palette.text;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(WIDTH, GROUND);
      ctx.stroke();

      const offset = (worldTime * speed) % 34;
      for (let x = -offset; x < WIDTH; x += 34) {
        ctx.fillRect(x, GROUND + 8 + ((x / 34) % 2) * 4, 3, 1);
        ctx.fillRect(x + 12, GROUND + 15, 6, 1);
      }
      ctx.globalAlpha = 1;
    };

    const drawPixelSprite = (sprite, colors, x, y, pixelSize = 3) => {
      sprite.forEach((row, rowIndex) => {
        Array.from(row).forEach((colorKey, columnIndex) => {
          if (colorKey === '.') {
            return;
          }
          ctx.fillStyle = colors[colorKey];
          ctx.fillRect(
            Math.round(x + columnIndex * pixelSize),
            Math.round(y + rowIndex * pixelSize),
            pixelSize,
            pixelSize
          );
        });
      });
    };

    const drawAstronaut = now => {
      const running = state === 'playing' && player.grounded;
      const frame = running ? Math.floor(now / 120) % 2 : 0;
      const bob = running ? frame * 2 : 0;
      const sprite = player.ducking ? astronautDuckSprite : astronautRunSprites[frame];
      const y = player.ducking ? GROUND - sprite.length * 3 : player.y - bob;
      const suit = palette.dark ? '#e7eefc' : '#f8fafc';
      const outline = palette.dark ? '#7f8ba5' : '#526078';

      ctx.fillStyle = palette.dark ? 'rgba(6, 182, 212, 0.18)' : 'rgba(82, 96, 120, 0.16)';
      ctx.fillRect(PLAYER_X + 4, GROUND + 3, 44, 3);
      drawPixelSprite(
        sprite,
        {
          O: outline,
          W: suit,
          V: palette.amber,
          H: '#fff7d6',
          P: palette.violet,
          C: palette.cyan,
          A: palette.dark ? '#334155' : '#64748b'
        },
        PLAYER_X - 2,
        y
      );
    };

    const drawDino = now => {
      const running = state === 'playing' && player.grounded;
      const frame = running ? Math.floor(now / 105) % 2 : 0;
      const sprite = player.ducking ? dinoDuckSprites[frame] : dinoRunSprites[frame];
      const y = player.ducking ? GROUND - sprite.length * 3 : player.y;

      ctx.fillStyle = palette.dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.14)';
      ctx.fillRect(PLAYER_X + 2, GROUND + 3, 52, 3);
      drawPixelSprite(sprite, { O: palette.text }, PLAYER_X - 6, y);
    };

    const drawObstacle = (obstacle, now) => {
      ctx.save();
      ctx.translate(obstacle.x, obstacle.y);

      if (obstacle.type === 'crater') {
        ctx.fillStyle = palette.dark ? '#7f8ba5' : '#8f99aa';
        ctx.fillRect(6, 0, obstacle.w - 12, 3);
        ctx.fillRect(3, 3, obstacle.w - 6, 3);
        ctx.fillStyle = palette.dark ? '#080b14' : '#697386';
        ctx.fillRect(0, 6, obstacle.w, 3);
        ctx.fillRect(6, 9, obstacle.w - 12, 3);
        ctx.fillStyle = palette.dark ? '#343b4e' : '#bcc3ce';
        ctx.fillRect(9, 3, obstacle.w - 18, 3);
      } else if (obstacle.type === 'moonrock') {
        ctx.fillStyle = palette.dark ? '#6b7280' : '#8f99aa';
        ctx.fillRect(3, 12, obstacle.w - 3, obstacle.h - 12);
        ctx.fillRect(6, 6, obstacle.w - 9, obstacle.h - 6);
        ctx.fillRect(12, 0, 9, obstacle.h);
        ctx.fillStyle = palette.dark ? '#4b5563' : '#c2c8d2';
        ctx.fillRect(12, 6, 6, 6);
        ctx.fillRect(6, 18, 6, 6);
      } else if (obstacle.type === 'saucer') {
        drawPixelSprite(
          [
            '......CCCC......',
            '.....CVVVVC.....',
            '...CCVVVVVVCC...',
            '..OOOOOOOOOOOO..',
            'OOOOOOOOOOOOOOOO',
            '..A...A..A...A..',
            '....C......C....'
          ],
          {
            O: palette.dark ? '#d7e4ff' : '#526078',
            V: palette.violet,
            C: palette.cyan,
            A: Math.floor(now / 110) % 2 ? palette.amber : palette.cyan
          },
          0,
          0
        );
      } else if (obstacle.type === 'cactus') {
        ctx.fillStyle = palette.text;
        const stems = obstacle.w > 20 ? 2 : 1;
        ctx.fillRect(7, 0, 8, obstacle.h);
        ctx.fillRect(0, 15, 8, 7);
        ctx.fillRect(0, 10, 5, 12);
        if (stems === 2) {
          ctx.fillRect(19, 7, 8, obstacle.h - 7);
          ctx.fillRect(14, 20, 8, 7);
        }
      } else if (obstacle.type === 'bird') {
        ctx.fillStyle = palette.text;
        const flap = Math.floor(now / 100) % 2;
        ctx.fillRect(13, 7, 22, 11);
        ctx.fillRect(33, 10, 10, 5);
        ctx.fillRect(8, 12, 8, 5);
        if (flap) {
          ctx.fillRect(13, 0, 16, 7);
        } else {
          ctx.fillRect(13, 18, 16, 4);
        }
      }
      ctx.restore();
    };

    const drawOverlay = () => {
      if (state === 'playing') {
        return;
      }

      ctx.fillStyle = palette.dark ? 'rgba(5, 8, 18, 0.54)' : 'rgba(247, 249, 255, 0.62)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.text;
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText(state === 'gameover' ? 'MISSION INTERRUPTED' : theme === 'lunar' ? 'LUNAR ROUTE 07' : 'OFFLINE CLASSIC', WIDTH / 2, 108);
      ctx.fillStyle = palette.muted;
      ctx.font = '500 12px Inter, sans-serif';
      ctx.fillText(state === 'gameover' ? `Score ${score} · Space or tap to retry` : 'Space or tap to run', WIDTH / 2, 134);
    };

    const draw = now => {
      if (theme === 'lunar') {
        drawLunarBackground();
        drawAstronaut(now);
      } else {
        drawClassicBackground();
        drawDino(now);
      }
      obstacles.forEach(obstacle => drawObstacle(obstacle, now));
      drawOverlay();
    };

    const frame = now => {
      const delta = Math.min(now - lastFrame, 34);
      lastFrame = now;
      update(delta);
      draw(now);
      animationFrame = requestAnimationFrame(frame);
    };

    const onKeyDown = event => {
      if (WindowManager.activeWindowId !== winId) {
        return;
      }
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        if (!event.repeat) {
          jump();
        }
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        setDuck(true);
      }
    };

    const onKeyUp = event => {
      if (event.code === 'ArrowDown') {
        setDuck(false);
      }
    };

    const onPointerDown = event => {
      event.preventDefault();
      jump();
      canvas.focus({ preventScroll: true });
    };

    themeSelect.addEventListener('change', () => {
      theme = themeSelect.value === 'classic' ? 'classic' : 'lunar';
      localStorage.setItem('novaos_novarun_theme', theme);
      routeNode.textContent =
        theme === 'lunar'
          ? 'Lunar route 07 · jump craters · duck saucers'
          : 'Offline classic · jump cacti · duck birds';
      reset();
    });

    document.getElementById(`nr-restart-${winId}`).addEventListener('click', reset);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);

    const themeObserver = new MutationObserver(() => readPalette());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    resizeCanvas();
    readPalette();
    reset();
    animationFrame = requestAnimationFrame(frame);

    const winObj = WindowManager.windows.get(winId);
    if (winObj) {
      const originalCleanup = winObj.cleanup;
      winObj.cleanup = () => {
        if (originalCleanup) {
          originalCleanup();
        }
        cancelAnimationFrame(animationFrame);
        themeObserver.disconnect();
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('pointerdown', onPointerDown);
      };
    }
  }
});
