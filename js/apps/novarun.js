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
      .nr-caption { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 30px; color: var(--text-secondary); font-size: 10px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }
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
          <span class="nr-caption__route" id="nr-route-${winId}">${initialTheme === 'lunar' ? 'Lunar route 07 · clear terrain · read saucer altitude' : 'Offline classic · clear cacti · read bird altitude'}</span>
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
    const RUNNER_CONFIG = {
      startSpeed: 0.36,
      maxSpeed: 0.78,
      acceleration: 0.0000036,
      scoreCoefficient: 0.025,
      flyerMinSpeed: 0.51,
      flyerSpeedOffset: 0.048,
      gapCoefficient: 0.6,
      maxGapCoefficient: 1.5,
      gravity: 0.0024,
      fastFallGravity: 0.0034,
      minJumpRise: 32,
      jumpVelocityMin: -0.66,
      jumpVelocityMax: -0.705,
      releasedJumpVelocity: -0.34
    };
    const canvas = document.getElementById(`nr-canvas-${winId}`);
    const ctx = canvas.getContext('2d');
    const themeSelect = document.getElementById(`nr-theme-${winId}`);
    const scoreNode = document.getElementById(`nr-score-${winId}`);
    const bestNode = document.getElementById(`nr-best-${winId}`);
    const routeNode = document.getElementById(`nr-route-${winId}`);

    let theme = initialTheme;
    let state = 'ready';
    let score = 0;
    let distanceRan = 0;
    let best = 0;
    let speed = RUNNER_CONFIG.startSpeed;
    let distanceUntilSpawn = 320;
    let lastFrame = performance.now();
    let animationFrame = 0;
    let worldTime = 0;
    let obstacles = [];
    let recentObstacleKinds = [];
    let palette = {};
    let downPressed = false;
    let jumpHeld = false;
    const player = {
      y: GROUND - 48,
      vy: 0,
      grounded: true,
      ducking: false,
      fastFalling: false
    };

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
      distanceRan = 0;
      speed = RUNNER_CONFIG.startSpeed;
      distanceUntilSpawn = 320;
      obstacles = [];
      recentObstacleKinds = [];
      downPressed = false;
      jumpHeld = false;
      player.y = GROUND - 48;
      player.vy = 0;
      player.grounded = true;
      player.ducking = false;
      player.fastFalling = false;
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
        player.fastFalling = false;
        const speedProgress =
          (speed - RUNNER_CONFIG.startSpeed) /
          (RUNNER_CONFIG.maxSpeed - RUNNER_CONFIG.startSpeed);
        player.vy =
          RUNNER_CONFIG.jumpVelocityMin +
          (RUNNER_CONFIG.jumpVelocityMax - RUNNER_CONFIG.jumpVelocityMin) * speedProgress;
        if (window.AudioMng) {
          window.AudioMng.play('click');
        }
      }
    };

    const releaseJump = () => {
      jumpHeld = false;
    };

    const setDuck = value => {
      downPressed = value;
      if (value && !player.grounded && state === 'playing') {
        player.fastFalling = true;
        player.vy = Math.max(player.vy, 0.18);
      }
      player.ducking = value && player.grounded && state === 'playing';
    };

    const getObstacleSpecs = () => {
      if (theme === 'lunar') {
        return [
          {
            kind: 'crater',
            type: 'crater',
            family: 'ground',
            unitW: 42,
            h: 12,
            spacing: 4,
            minGap: 128,
            minSpeed: 0,
            multipleMinSpeed: RUNNER_CONFIG.startSpeed,
            maxCount: 2
          },
          {
            kind: 'moonrock',
            type: 'moonrock',
            family: 'ground',
            unitW: 27,
            h: 30,
            spacing: 3,
            minGap: 120,
            minSpeed: 0,
            multipleMinSpeed: 0.42,
            maxCount: 3
          },
          {
            kind: 'saucer',
            type: 'saucer',
            family: 'flyer',
            unitW: 48,
            h: 23,
            spacing: 0,
            minGap: 150,
            minSpeed: RUNNER_CONFIG.flyerMinSpeed,
            maxCount: 1
          }
        ];
      }
      return [
        {
          kind: 'small-cactus',
          type: 'cactus',
          variant: 'small',
          family: 'ground',
          unitW: 17,
          h: 35,
          spacing: 0,
          minGap: 120,
          minSpeed: 0,
          multipleMinSpeed: 0.24,
          maxCount: 3
        },
        {
          kind: 'large-cactus',
          type: 'cactus',
          variant: 'large',
          family: 'ground',
          unitW: 25,
          h: 50,
          spacing: 0,
          minGap: 120,
          minSpeed: 0,
          multipleMinSpeed: 0.42,
          maxCount: 3
        },
        {
          kind: 'bird',
          type: 'bird',
          family: 'flyer',
          unitW: 44,
          h: 22,
          spacing: 0,
          minGap: 150,
          minSpeed: RUNNER_CONFIG.flyerMinSpeed,
          maxCount: 1
        }
      ];
    };

    const chooseObstacleSpec = () => {
      let eligible = getObstacleSpecs().filter(spec => speed >= spec.minSpeed);
      if (
        recentObstacleKinds.length === 2 &&
        recentObstacleKinds[0] === recentObstacleKinds[1]
      ) {
        const alternatives = eligible.filter(spec => spec.kind !== recentObstacleKinds[1]);
        if (alternatives.length) {
          eligible = alternatives;
        }
      }
      return eligible[Math.floor(Math.random() * eligible.length)];
    };

    const spawnObstacle = () => {
      const spec = chooseObstacleSpec();
      const canMultiply =
        spec.family === 'ground' &&
        speed >= (spec.multipleMinSpeed || RUNNER_CONFIG.startSpeed);
      const count = canMultiply ? 1 + Math.floor(Math.random() * spec.maxCount) : 1;
      const w = spec.unitW * count + spec.spacing * (count - 1);
      const flyerBand =
        spec.family === 'flyer' ? ['low', 'middle', 'high'][Math.floor(Math.random() * 3)] : null;
      const flyerOffset = flyerBand === 'low' ? spec.h + 4 : flyerBand === 'middle' ? 62 : 99;
      const obstacle = {
        ...spec,
        x: WIDTH + 24,
        y: spec.family === 'flyer' ? GROUND - flyerOffset : GROUND - spec.h,
        w,
        count,
        flyerBand,
        speedOffset:
          spec.family === 'flyer'
            ? (Math.random() < 0.5 ? -1 : 1) * RUNNER_CONFIG.flyerSpeedOffset
            : 0
      };
      obstacles.push(obstacle);
      recentObstacleKinds = [...recentObstacleKinds, spec.kind].slice(-2);

      const chromeSpeedUnits = speed / 0.06;
      const minGap = Math.round(
        obstacle.w * chromeSpeedUnits + spec.minGap * RUNNER_CONFIG.gapCoefficient
      );
      const maxGap = Math.round(minGap * RUNNER_CONFIG.maxGapCoefficient);
      distanceUntilSpawn =
        obstacle.w + minGap + Math.round(Math.random() * Math.max(0, maxGap - minGap));
    };

    const getObstacleCollisionBoxes = obstacle => {
      const unitOffset = index => index * (obstacle.unitW + obstacle.spacing);
      if (obstacle.type === 'crater') {
        return Array.from({ length: obstacle.count }, (_, index) => ({
          x: obstacle.x + unitOffset(index) + 4,
          y: obstacle.y + 2,
          w: obstacle.unitW - 8,
          h: obstacle.h - 2
        }));
      }
      if (obstacle.type === 'moonrock' || obstacle.type === 'cactus') {
        return Array.from({ length: obstacle.count }, (_, index) => ({
          x: obstacle.x + unitOffset(index) + 3,
          y: obstacle.y + 2,
          w: obstacle.unitW - 6,
          h: obstacle.h - 2
        }));
      }
      return [
        {
          x: obstacle.x + (obstacle.type === 'bird' ? 7 : 3),
          y: obstacle.y + (obstacle.type === 'bird' ? 5 : 6),
          w: obstacle.w - (obstacle.type === 'bird' ? 9 : 6),
          h: obstacle.h - (obstacle.type === 'bird' ? 8 : 9)
        }
      ];
    };

    const getPlayerCollisionBoxes = () => {
      if (theme === 'classic') {
        const drawX = PLAYER_X - 6;
        if (player.ducking) {
          const y = GROUND - dinoDuckSprites[0].length * 3;
          return [
            { x: drawX + 36, y, w: 30, h: 18 },
            { x: drawX + 3, y: y + 9, w: 60, h: 12 },
            { x: drawX + 9, y: y + 18, w: 48, h: 9 }
          ];
        }
        return [
          { x: drawX + 30, y: player.y, w: 30, h: 18 },
          { x: drawX + 6, y: player.y + 18, w: 39, h: 21 },
          { x: drawX + 9, y: player.y + 39, w: 27, h: 9 }
        ];
      }

      const drawX = PLAYER_X - 2;
      if (player.ducking) {
        const y = GROUND - astronautDuckSprite.length * 3;
        return [
          { x: drawX + 9, y, w: 33, h: 18 },
          { x: drawX + 3, y: y + 12, w: 48, h: 12 },
          { x: drawX + 9, y: y + 24, w: 36, h: 6 }
        ];
      }
      return [
        { x: drawX + 9, y: player.y, w: 33, h: 18 },
        { x: drawX + 3, y: player.y + 18, w: 42, h: 21 },
        { x: drawX + 9, y: player.y + 39, w: 30, h: 9 }
      ];
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
      distanceRan += speed * delta;
      score = Math.floor(distanceRan * RUNNER_CONFIG.scoreCoefficient);
      speed = Math.min(
        RUNNER_CONFIG.maxSpeed,
        speed + RUNNER_CONFIG.acceleration * delta
      );
      scoreNode.textContent = score;

      if (!player.grounded) {
        const rise = GROUND - 48 - player.y;
        if (
          !jumpHeld &&
          rise >= RUNNER_CONFIG.minJumpRise &&
          player.vy < RUNNER_CONFIG.releasedJumpVelocity
        ) {
          player.vy = RUNNER_CONFIG.releasedJumpVelocity;
        }
        player.vy +=
          (player.fastFalling ? RUNNER_CONFIG.fastFallGravity : RUNNER_CONFIG.gravity) *
          delta;
        player.y += player.vy * delta;
        if (player.y >= GROUND - 48) {
          player.y = GROUND - 48;
          player.vy = 0;
          player.grounded = true;
          player.ducking = downPressed;
          player.fastFalling = false;
        }
      } else {
        player.ducking = downPressed;
      }

      distanceUntilSpawn -= speed * delta;
      if (distanceUntilSpawn <= 0) {
        spawnObstacle();
      }

      obstacles.forEach(obstacle => {
        obstacle.x -= Math.max(0.18, speed + obstacle.speedOffset) * delta;
      });
      obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.w > -12);

      const playerBoxes = getPlayerCollisionBoxes();
      if (
        obstacles.some(obstacle =>
          getObstacleCollisionBoxes(obstacle).some(obstacleBox =>
            playerBoxes.some(playerBox => intersects(playerBox, obstacleBox))
          )
        )
      ) {
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
        for (let index = 0; index < obstacle.count; index++) {
          const x = index * (obstacle.unitW + obstacle.spacing);
          ctx.fillStyle = palette.dark ? '#94a3b8' : '#7c8799';
          ctx.fillRect(x + 6, 0, obstacle.unitW - 12, 3);
          ctx.fillRect(x + 3, 3, obstacle.unitW - 6, 3);
          ctx.fillStyle = palette.dark ? '#080b14' : '#697386';
          ctx.fillRect(x, 6, obstacle.unitW, 3);
          ctx.fillRect(x + 6, 9, obstacle.unitW - 12, 3);
          ctx.fillStyle = palette.dark ? '#343b4e' : '#c2c8d2';
          ctx.fillRect(x + 9, 3, obstacle.unitW - 18, 3);
        }
      } else if (obstacle.type === 'moonrock') {
        for (let index = 0; index < obstacle.count; index++) {
          const x = index * (obstacle.unitW + obstacle.spacing);
          ctx.fillStyle = palette.dark ? '#7f8ba5' : '#7c8799';
          ctx.fillRect(x + 3, 12, obstacle.unitW - 3, obstacle.h - 12);
          ctx.fillRect(x + 6, 6, obstacle.unitW - 9, obstacle.h - 6);
          ctx.fillRect(x + 12, 0, 9, obstacle.h);
          ctx.fillStyle = palette.dark ? '#4b5563' : '#c2c8d2';
          ctx.fillRect(x + 12, 6, 6, 6);
          ctx.fillRect(x + 6, 18, 6, 6);
        }
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
        for (let index = 0; index < obstacle.count; index++) {
          const x = index * obstacle.unitW;
          const trunkX = obstacle.variant === 'large' ? 9 : 6;
          const trunkW = obstacle.variant === 'large' ? 8 : 7;
          const branchY = obstacle.variant === 'large' ? 18 : 13;
          ctx.fillRect(x + trunkX, 0, trunkW, obstacle.h);
          if (index % 2 === 0) {
            ctx.fillRect(x, branchY, trunkX + 2, 6);
            ctx.fillRect(x, branchY - 8, 4, 14);
          } else {
            const branchX = x + trunkX + trunkW - 1;
            ctx.fillRect(branchX, branchY + 2, obstacle.unitW - trunkX - trunkW + 1, 6);
            ctx.fillRect(x + obstacle.unitW - 4, branchY - 6, 4, 14);
          }
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
          jumpHeld = true;
          jump();
        }
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        setDuck(true);
      }
    };

    const onKeyUp = event => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        releaseJump();
      } else if (event.code === 'ArrowDown') {
        setDuck(false);
      }
    };

    const onPointerDown = event => {
      event.preventDefault();
      jumpHeld = true;
      jump();
      canvas.focus({ preventScroll: true });
    };

    const onPointerUp = () => {
      releaseJump();
    };

    themeSelect.addEventListener('change', () => {
      theme = themeSelect.value === 'classic' ? 'classic' : 'lunar';
      localStorage.setItem('novaos_novarun_theme', theme);
      routeNode.textContent =
        theme === 'lunar'
          ? 'Lunar route 07 · clear terrain · read saucer altitude'
          : 'Offline classic · clear cacti · read bird altitude';
      reset();
    });

    document.getElementById(`nr-restart-${winId}`).addEventListener('click', reset);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

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
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
      };
    }
  }
});
