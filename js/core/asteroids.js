(() => {
    const startScoreRun = NovaUplink.bindGame('asteroids');
    const asteroidRuns = new WeakMap();
// Nova Asteroids — a hidden game played on the desktop itself (desktop only).
//
// The Konami code (↑ ↑ ↓ ↓ ← → ← → B A) starts it; Esc leaves. The ship flies
// over the infinite canvas and the camera follows it. Open windows and black
// holes (minimised windows) pull the ship, its shots and the asteroids with
// their own gravity. Touching a window or a black hole destroys the ship;
// asteroids bounce off windows and fall into black holes. Remnants of closed
// windows are scenery and do nothing.
//
// Numbers are fixed, whatever the zoom. Wave n brings 5 + n rocks: n + 1 large,
// two medium, two small — six in the first wave. They enter from about a
// thousand pixels out and are steered back if they stray past 1700.
//
// Worlds: each game lays out a small system on open desktop. The home world
// sits a short flight from the ship; three more — a small bare one, a ringed
// giant, one with a single moon — lie a few thousand pixels out in different
// directions and are found by flying there. Windows pass over them untouched;
// the game treats them as solid. Each pulls in proportion to its size, its
// moons keep Keplerian orbits, shots stop on it and the ship breaks on it. A
// rock that strikes one burns up there — cover for the pilot — but the third
// strike leaves a planet barren, and the third on a moon shatters it into
// small rocks. Finding a world pays once; clearing a wave with the home world
// still alive pays every time.
class AsteroidsGame {
    constructor() {
        this.code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        this.codePos = 0;
        this.state = 'off'; // off | play | dead | over
        this.keys = new Set();
        this.worlds = [];

        this.onCodeKey = this.onCodeKey.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onResize = this.onResize.bind(this);
        this.frame = this.frame.bind(this);

        window.addEventListener('keydown', this.onCodeKey, true);
    }

    // ── Tuning ───────────────────────────────────────────────────────────────
    static get T() {
        return {
            turn: 4.4,            // rad/s
            thrust: 430,          // px/s²
            drag: 0.35,           // share of speed lost per second
            maxSpeed: 620,
            shipR: 11,
            invulnerable: 2.2,    // s after (re)spawn
            bulletSpeed: 720,
            bulletLife: 1.15,
            fireCooldown: 0.17,
            maxBullets: 7,
            sizes: [46, 27, 15],  // asteroid radii, large → small
            points: [20, 50, 100],
            windowPull: 3,        // × window area / (d² + 80²)
            holePull: 3.6e6,      // / (d² + 40²)
            holeRadius: 24,       // event horizon for the ship
            worldR: 62,           // the home planet
            worldPull: 1.2e6,     // for the home planet, / (d² + 40²); scales with r²; sets the moons' periods
            worldHits: 3,         // rock strikes a planet or a moon survives, less one
            worldBonus: 50,       // per wave cleared with the home planet alive
            findBonus: 100,       // for each world discovered
            rockEntry: 950,       // px from the ship where rocks appear
            rockLeash: 1700,      // px: past this a rock is steered back
            pullCap: 900,
            lives: 3
        };
    }

    // ── Starting and stopping ────────────────────────────────────────────────
    // Letters by physical key, not by character: B A on a Russian layout
    // types «и ф», and W A D «ц ф в». e.code is the same on every layout.
    static keyOf(e) {
        if (e.code && /^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
        if (e.code === 'Space') return ' ';
        return e.key.length === 1 ? e.key.toLowerCase() : e.key;
    }

    onCodeKey(e) {
        if (this.state !== 'off') return;
        if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) {
            this.codePos = 0;
            return;
        }
        const key = AsteroidsGame.keyOf(e);
        if (key === this.code[this.codePos]) {
            this.codePos++;
            if (this.codePos === this.code.length) {
                this.codePos = 0;
                this.start();
            }
        } else {
            this.codePos = key === this.code[0] ? 1 : 0;
        }
    }

    start() {
        if (!window.WindowManager || WindowManager.isMobile()) return;
        const desktop = document.getElementById('desktop');
        if (!desktop || desktop.style.display === 'none') return;

        // The desktop is the playfield now: no window keeps the keyboard, and
        // games that were running pause instead of playing on unattended.
        if (WindowManager.activeWindowId) WindowManager.releaseFocus(WindowManager.activeWindowId);
        if (window.Bus) Bus.emit('asteroids:start');

        const T = AsteroidsGame.T;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'ast-canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        desktop.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.hud = document.createElement('div');
        this.hud.className = 'ast-hud';
        this.hud.setAttribute('role', 'status');
        // Two layers in one pill: the controls show first, then float away to
        // lives · wave · score. Hovering the pill brings the controls back.
        this.hud.innerHTML =
            '<div class="ast-hud__main">' +
                '<span class="ast-hud__lives"></span>' +
                '<span class="ast-hud__wave">Wave 1</span>' +
                '<span class="ast-hud__score">0</span>' +
            '</div>' +
            '<div class="ast-hud__help">← → turn · ↑ thrust · Space fire · Esc leave</div>';
        document.body.appendChild(this.hud);
        this.showHelp(2000);
        this.hud.addEventListener('mouseenter', () => this.showHelp());
        this.hud.addEventListener('mouseleave', () => this.showHelp(500));
        this.banner = document.createElement('div');
        this.banner.className = 'ast-banner';
        document.body.appendChild(this.banner);

        this.onResize();
        this.readColors();

        this.rocks = [];
        this.worlds = [];
        const spot = this.clearSpot();
        this.ship = this.newShip(spot.x, spot.y);
        this.bullets = [];
        this.particles = [];
        this.trail = [];
        this.phantoms = [];
        asteroidRuns.set(this, { score: 0, points: 0, report: startScoreRun('asteroids') });
        this.exploring = false;
        this.worlds = this.makeWorlds();
        try { localStorage.setItem('novaos_asteroids_seen', '1'); } catch (_e) { }
        this.lives = T.lives;
        this.wave = 0;
        this.fireTimer = 0;
        this.colorTimer = 0;
        this.waveBreak = 0;
        this.state = 'play';
        this.keys.clear();
        this.nextWave();
        this.updateHud();

        window.addEventListener('keydown', this.onKeyDown, true);
        window.addEventListener('keyup', this.onKeyUp, true);
        window.addEventListener('resize', this.onResize);
        document.body.classList.add('is-asteroids');
        if (window.AudioMng) AudioMng.play('expand');

        this.last = performance.now();
        this.raf = requestAnimationFrame(this.frame);
    }

    // Show the controls in the HUD; with a delay, hide them again after it.
    showHelp(hideAfter) {
        if (!this.hud) return;
        clearTimeout(this.helpTimer);
        this.hud.classList.add('is-help');
        if (hideAfter) this.helpTimer = setTimeout(() => this.hud && this.hud.classList.remove('is-help'), hideAfter);
    }

    stop() {
        cancelAnimationFrame(this.raf);
        clearTimeout(this.helpTimer);
        window.removeEventListener('keydown', this.onKeyDown, true);
        window.removeEventListener('keyup', this.onKeyUp, true);
        window.removeEventListener('resize', this.onResize);
        document.body.classList.remove('is-asteroids');
        [this.canvas, this.hud, this.banner].forEach(el => el && el.remove());
        this.canvas = this.hud = this.banner = null;
        this.keys.clear();
        this.worlds = [];
        this.state = 'off';
    }

    // ── Input ────────────────────────────────────────────────────────────────
    onKeyDown(e) {
        if (this.state === 'over') return; // let the score prompt take its initials
        if (e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation();
            this.stop();
            return;
        }
        const key = AsteroidsGame.keyOf(e);
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'a', 'd', 'w'].includes(key)) {
            e.preventDefault(); e.stopPropagation();
            this.keys.add(key);
        }
    }

    onKeyUp(e) {
        const key = AsteroidsGame.keyOf(e);
        if (this.keys.has(key)) {
            e.preventDefault(); e.stopPropagation();
            this.keys.delete(key);
        }
    }

    onResize() {
        if (!this.canvas) return;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(window.innerWidth * this.dpr);
        this.canvas.height = Math.round(window.innerHeight * this.dpr);
    }

    readColors() {
        const cs = getComputedStyle(document.documentElement);
        const v = (n, f) => (cs.getPropertyValue(n) || '').trim() || f;
        this.colors = {
            text: v('--text', '#e8eaf0'),
            secondary: v('--text-secondary', '#9ca3af'),
            accent: v('--accent', '#818cf8'),
            alt: v('--nova-accent-alt', '#ec4899'),
            danger: v('--danger', '#ff453a')
        };
    }

    // ── World ────────────────────────────────────────────────────────────────
    newShip(x, y) {
        return { x, y, vx: 0, vy: 0, a: -Math.PI / 2, safe: AsteroidsGame.T.invulnerable, thrusting: false };
    }

    view() {
        const Z = WindowManager.cameraZ;
        return {
            x: -WindowManager.cameraX / Z,
            y: -WindowManager.cameraY / Z,
            w: window.innerWidth / Z,
            h: window.innerHeight / Z
        };
    }

    // Open, settled windows. Windows that are closing or minimised are skipped.
    windowRects() {
        const rects = [];
        WindowManager.windows.forEach(w => {
            const el = w.el;
            if (!el || el.dataset.minimized === 'true' || el.style.pointerEvents === 'none') return;
            // Corner radius as drawn, read once per window: collisions follow
            // the rounded shape, not its bounding box.
            if (el.astRadius === undefined) el.astRadius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
            rects.push({
                x: parseFloat(el.dataset.x), y: parseFloat(el.dataset.y),
                w: parseFloat(el.dataset.w), h: parseFloat(el.dataset.h), r: el.astRadius
            });
        });
        return rects;
    }

    holes() {
        const list = [];
        new Set(WindowManager.activeBlackHoles.values()).forEach(bh => {
            if (bh.style.opacity === '0') return;
            list.push({ x: parseFloat(bh.style.left), y: parseFloat(bh.style.top), hue: parseFloat(bh.dataset.hue) || 0 });
        });
        return list;
    }

    nextWave() {
        this.wave++;
        this.waveSpeed = 1 + (this.wave - 1) * 0.12;
        // n + 1 large, two medium, two small: a first wave of six.
        const sizes = [...Array(this.wave + 1).fill(0), 1, 1, 2, 2];
        sizes.forEach(size => this.spawnRock(size));
        this.showBanner(`Wave ${this.wave} · ${sizes.length} incoming`);
    }

    // All rocks gone: say so, give the player a breath, then the next wave.
    clearWave() {
        this.waveBreak = 2.6;
        const home = this.worlds[0];
        const safe = home && !home.barren;
        if (safe) this.award(AsteroidsGame.T.worldBonus);
        this.showBanner(safe ? `Wave ${this.wave} cleared · home world safe` : `Wave ${this.wave} cleared`);
        if (window.AudioMng) AudioMng.play('win');
    }

    // The system: the home world a short flight from the ship, the others
    // further out in different directions, all on open desktop.
    makeWorlds() {
        const T = AsteroidsGame.T;
        const rects = this.windowRects(), holes = this.holes();
        const s = this.ship;
        const worlds = [];
        const place = (kind, dist, around) => {
            const room = Math.max(kind.r, ...kind.moons.map(m => m[0])) + 40;
            const free = (x, y) => !rects.some(r => this.circleRect(x, y, room, r))
                && !holes.some(h => Math.hypot(h.x - x, h.y - y) < room + 200)
                && !worlds.some(w => Math.hypot(w.x - x, w.y - y) < room + 500);
            for (let ring = 0; ring < 40; ring++) {
                for (let j = 0; j < 12; j++) {
                    // nearest to the wanted heading first, then fanning out
                    const a = around + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * Math.PI / 9, d = dist + ring * 110;
                    const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d;
                    if (!free(x, y)) continue;
                    const gm = T.worldPull * Math.pow(kind.r / T.worldR, 2);
                    const world = {
                        x, y, r: kind.r, name: kind.name, tint: kind.tint, ring: !!kind.ring, gm,
                        hits: 0, barren: false, flash: 0, rot: Math.random() * 6.28, found: false,
                        moons: kind.moons.map(([orbit, r]) => ({ orbit, r, ang: Math.random() * 6.28, w: Math.sqrt(gm / (orbit * orbit * orbit)), hits: 0, x: 0, y: 0 }))
                    };
                    this.placeMoons(world, 0);
                    worlds.push(world);
                    return;
                }
            }
        };
        const K = AsteroidsGame.WORLDS;
        const heading = Math.random() * Math.PI * 2;
        place(K[0], 430, heading);
        if (worlds[0]) worlds[0].found = true;
        // the rest: a third of a turn apart, each further than the last, in random order
        const rest = K.slice(1).sort(() => Math.random() - 0.5);
        rest.forEach((kind, i) => place(kind, 1900 + i * 1000 + Math.random() * 500, heading + Math.PI + (i - 1) * Math.PI * 2 / 3 + (Math.random() - 0.5) * 0.5));
        return worlds;
    }

    placeMoons(world, dt) {
        world.moons.forEach(m => {
            m.ang += m.w * dt;
            m.x = world.x + Math.cos(m.ang) * m.orbit;
            m.y = world.y + Math.sin(m.ang) * m.orbit;
        });
    }

    // Planets and moons as circles, for everything that can hit them.
    worldBodies() {
        const list = [];
        this.worlds.forEach(w => { list.push(w); w.moons.forEach(m => list.push(m)); });
        return list;
    }

    // A rock struck the planet or a moon. The rock is gone either way.
    strike(body, k) {
        const T = AsteroidsGame.T;
        const w = this.worlds.find(o => o === body || o.moons.includes(body));
        const a = Math.atan2(k.y - body.y, k.x - body.x);
        const ix = body.x + Math.cos(a) * body.r, iy = body.y + Math.sin(a) * body.r;
        this.sparks(ix, iy, 12 + k.size * 3, this.colors.danger);
        if (window.AudioMng) AudioMng.play('explode');
        if (body === w) {
            w.flash = 1;
            if (w.barren) return;
            w.scars = w.scars || [];
            w.scars.push({ a: a - w.rot, d: 0.45 + Math.random() * 0.4, r: 5 + (2 - k.size) * 3 });
            if (++w.hits >= T.worldHits) {
                w.barren = true;
                this.sparks(w.x, w.y, 40, this.colors.alt);
                this.showBanner(w === this.worlds[0] ? 'Home world scorched' : `${w.name} scorched`);
            }
            return;
        }
        if (++body.hits >= T.worldHits) {
            w.moons = w.moons.filter(m => m !== body);
            this.sparks(body.x, body.y, 26, this.colors.secondary);
            // What is left of it keeps the moon's orbital motion.
            const vx = -Math.sin(body.ang) * body.w * body.orbit, vy = Math.cos(body.ang) * body.w * body.orbit;
            for (let i = 0; i < 3; i++) {
                const b = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 50;
                this.spawnRock(T.sizes.length - 1, body.x, body.y, vx + Math.cos(b) * sp, vy + Math.sin(b) * sp);
            }
            this.showBanner('Moon shattered');
        }
    }

    // A rock enters from a fixed distance, heading roughly at the ship.
    spawnRock(size, x, y, vx, vy) {
        const T = AsteroidsGame.T;
        const r = T.sizes[size];
        if (x === undefined) {
            const reach = T.rockEntry + Math.random() * 250;
            const ang = Math.random() * Math.PI * 2;
            x = this.ship.x + Math.cos(ang) * reach;
            y = this.ship.y + Math.sin(ang) * reach;
            const aim = Math.atan2(this.ship.y - y, this.ship.x - x) + (Math.random() - 0.5) * 1.2;
            const speed = (45 + Math.random() * 60) * (this.waveSpeed || 1);
            vx = Math.cos(aim) * speed;
            vy = Math.sin(aim) * speed;
        }
        const verts = [];
        const n = 10 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) verts.push(0.74 + Math.random() * 0.36);
        this.rocks.push({ x, y, vx, vy, r, size, verts, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 1.4 });
    }

    // Gravity at a point from windows and black holes, in px/s².
    pull(x, y, rects, holes) {
        const T = AsteroidsGame.T;
        let ax = 0, ay = 0;
        rects.forEach(r => {
            const nx = Math.max(r.x, Math.min(x, r.x + r.w));
            const ny = Math.max(r.y, Math.min(y, r.y + r.h));
            let dx = nx - x, dy = ny - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 1) { dx = r.x + r.w / 2 - x; dy = r.y + r.h / 2 - y; }
            const d = Math.hypot(dx, dy) || 1;
            const a = Math.min(T.pullCap, T.windowPull * r.w * r.h / (d2 + 6400));
            ax += dx / d * a; ay += dy / d * a;
        });
        holes.forEach(h => {
            const dx = h.x - x, dy = h.y - y;
            const d2 = dx * dx + dy * dy;
            const d = Math.sqrt(d2) || 1;
            const a = Math.min(T.pullCap, T.holePull / (d2 + 1600));
            ax += dx / d * a; ay += dy / d * a;
        });
        this.worlds.forEach(w => {
            const dx = w.x - x, dy = w.y - y;
            const d2 = dx * dx + dy * dy;
            const d = Math.sqrt(d2) || 1;
            const a = Math.min(T.pullCap, w.gm / (d2 + 1600));
            ax += dx / d * a; ay += dy / d * a;
        });
        return { ax, ay };
    }

    // ── Loop ─────────────────────────────────────────────────────────────────
    frame(now) {
        if (this.state === 'off') return;
        let dt = (now - this.last) / 1000;
        this.last = now;
        if (document.hidden) dt = 0;
        // Real time, in steps of at most 1/60 s: a slow browser gets no slow
        // motion and no shots passing through rocks. The cap only absorbs stalls.
        dt = Math.min(dt, 0.25);

        for (let left = dt; left > 1e-6 && this.state !== 'over'; left -= 1 / 60) this.update(Math.min(left, 1 / 60));
        this.followCamera(dt);
        this.draw();
        this.raf = requestAnimationFrame(this.frame);
    }

    update(dt) {
        const T = AsteroidsGame.T;
        const rects = this.windowRects();
        const holes = this.holes();
        const s = this.ship;
        const bodies = this.worldBodies();
        const view = this.view();
        this.worlds.forEach(w => {
            this.placeMoons(w, dt);
            w.rot += 0.05 * dt;
            w.flash = Math.max(0, w.flash - dt * 2.5);
            // A world is found once it is properly in view.
            if (!w.found && this.state === 'play'
                && w.x > view.x + w.r && w.x < view.x + view.w - w.r && w.y > view.y + w.r && w.y < view.y + view.h - w.r) {
                w.found = true;
                this.award(T.findBonus);
                this.showBanner(`Discovered ${w.name}`);
                if (window.AudioMng) AudioMng.play('expand');
            }
        });

        if ((this.colorTimer -= dt) <= 0) { this.readColors(); this.colorTimer = 0.5; }

        // Ship
        if (this.state === 'play') {
            const left = this.keys.has('ArrowLeft') || this.keys.has('a');
            const right = this.keys.has('ArrowRight') || this.keys.has('d');
            s.thrusting = this.keys.has('ArrowUp') || this.keys.has('w');
            if (left) s.a -= T.turn * dt;
            if (right) s.a += T.turn * dt;
            if (s.thrusting) {
                s.vx += Math.cos(s.a) * T.thrust * dt;
                s.vy += Math.sin(s.a) * T.thrust * dt;
                if (Math.random() < 0.7) this.puff(s);
            }
            const g = this.pull(s.x, s.y, rects, holes);
            s.vx += g.ax * dt; s.vy += g.ay * dt;
            s.vx *= 1 - T.drag * dt; s.vy *= 1 - T.drag * dt;
            const sp = Math.hypot(s.vx, s.vy);
            if (sp > T.maxSpeed) { s.vx *= T.maxSpeed / sp; s.vy *= T.maxSpeed / sp; }
            s.x += s.vx * dt; s.y += s.vy * dt;
            s.safe = Math.max(0, s.safe - dt);

            this.trail.push({ x: s.x, y: s.y });
            if (this.trail.length > 70) this.trail.shift();

            this.fireTimer -= dt;
            if (this.keys.has(' ') && this.fireTimer <= 0 && this.bullets.length < T.maxBullets) {
                this.fireTimer = T.fireCooldown;
                this.bullets.push({
                    x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14,
                    vx: s.vx + Math.cos(s.a) * T.bulletSpeed, vy: s.vy + Math.sin(s.a) * T.bulletSpeed,
                    life: T.bulletLife
                });
                if (window.AudioMng) AudioMng.play('click');
            }

            // Ship collisions
            if (s.safe <= 0) {
                if (rects.some(r => this.circleRect(s.x, s.y, T.shipR, r))) this.crash('window');
                else if (this.rocks.some(k => Math.hypot(k.x - s.x, k.y - s.y) < k.r * 0.86 + T.shipR)) this.crash('rock');
                else if (bodies.some(o => Math.hypot(o.x - s.x, o.y - s.y) < o.r + T.shipR)) this.crash('world');
                else {
                    const reach = this.phantomsOn() ? this.noReturn() : T.holeRadius;
                    const lost = holes.find(h => Math.hypot(h.x - s.x, h.y - s.y) < reach);
                    if (lost) this.lostToHole(lost);
                }
            }
        } else if (this.trail.length) {
            this.trail.shift();
        }

        // Bullets: bent a little by gravity, stopped by windows and holes.
        this.bullets = this.bullets.filter(b => {
            const g = this.pull(b.x, b.y, rects, holes);
            b.vx += g.ax * dt * 0.35; b.vy += g.ay * dt * 0.35;
            b.x += b.vx * dt; b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0) return false;
            if (rects.some(r => this.circleRect(b.x, b.y, 2, r)) || holes.some(h => Math.hypot(h.x - b.x, h.y - b.y) < 20)
                || bodies.some(o => Math.hypot(o.x - b.x, o.y - b.y) < o.r)) {
                this.sparks(b.x, b.y, 4, this.colors.secondary);
                return false;
            }
            for (let i = 0; i < this.rocks.length; i++) {
                const k = this.rocks[i];
                if (Math.hypot(k.x - b.x, k.y - b.y) < k.r) {
                    this.breakRock(i, b);
                    return false;
                }
            }
            return true;
        });

        // Rocks: fall toward holes, bounce off windows, and stay near the ship.
        const leash = T.rockLeash;
        for (let i = this.rocks.length - 1; i >= 0; i--) {
            const k = this.rocks[i];
            const g = this.pull(k.x, k.y, rects, holes);
            k.vx += g.ax * dt * 0.6; k.vy += g.ay * dt * 0.6;
            k.x += k.vx * dt; k.y += k.vy * dt;
            k.rot += k.spin * dt;
            rects.forEach(r => this.bounce(k, r));
            const struck = bodies.find(o => Math.hypot(o.x - k.x, o.y - k.y) < o.r + k.r * 0.7);
            if (struck) {
                this.rocks.splice(i, 1);
                this.strike(struck, k);
                continue;
            }
            if (holes.some(h => Math.hypot(h.x - k.x, h.y - k.y) < 26 + k.r * 0.3)) {
                this.sparks(k.x, k.y, 10, this.colors.alt);
                // No points: they would grow with the number of minimised windows.
                this.rocks.splice(i, 1);
                continue;
            }
            // Past the leash, the rock is turned gently back toward the ship.
            // Way past it (after a big zoom change), it simply re-enters.
            const dx = s.x - k.x, dy = s.y - k.y, dist = Math.hypot(dx, dy);
            if (dist > leash * 2.2) {
                this.rocks.splice(i, 1);
                this.spawnRock(k.size);
            } else if (dist > leash) {
                const sp = Math.max(60, Math.hypot(k.vx, k.vy));
                const turn = Math.min(1, 1.2 * dt * (dist / leash));
                k.vx += (dx / dist * sp - k.vx) * turn;
                k.vy += (dy / dist * sp - k.vy) * turn;
            }
        }

        // Phantoms follow their hole; if the hole is gone (window restored), they go too.
        this.phantoms = this.phantoms.filter(ph => {
            ph.t += dt;
            const h = holes.find(o => Math.hypot(o.x - ph.hx, o.y - ph.hy) < 60);
            if (h) { ph.hx = h.x; ph.hy = h.y; } else ph.gone = (ph.gone || 0) + dt;
            return ph.t < AsteroidsGame.PHANTOM && (ph.gone || 0) < 0.8;
        });

        // Particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt;
            return (p.life -= dt) > 0;
        });

        if (this.waveBreak > 0) {
            this.waveBreak -= dt;
            if (this.waveBreak <= 0) { this.waveBreak = 0; this.nextWave(); }
        } else if (this.state === 'play' && this.rocks.length === 0) {
            this.clearWave();
        }
        this.updateHud();
    }

    // Distance from a point to a window's rounded outline (negative inside).
    // The window is its rectangle shrunk by the corner radius, grown back by
    // it as a circle: corners are arcs, so the empty space a window's rounded
    // corner leaves is empty for the game too.
    outline(x, y, rect) {
        const rc = Math.min(rect.r || 0, rect.w / 2, rect.h / 2);
        const ix = Math.max(rect.x + rc, Math.min(x, rect.x + rect.w - rc));
        const iy = Math.max(rect.y + rc, Math.min(y, rect.y + rect.h - rc));
        const dx = x - ix, dy = y - iy, d = Math.hypot(dx, dy);
        return { gap: d - rc, d, dx, dy, ix, iy, rc };
    }

    circleRect(x, y, r, rect) {
        return this.outline(x, y, rect).gap < r;
    }

    bounce(k, rect) {
        const r = k.r * 0.86;
        const o = this.outline(k.x, k.y, rect);
        if (o.gap >= r) return;
        let ux, uy;
        if (o.d < 0.001) { // centre deep inside the window: push out the short way
            const l = k.x - rect.x, rr = rect.x + rect.w - k.x, t = k.y - rect.y, b = rect.y + rect.h - k.y;
            const m = Math.min(l, rr, t, b);
            ux = m === l ? -1 : m === rr ? 1 : 0;
            uy = m === t ? -1 : m === b ? 1 : 0;
            k.x = ux ? (ux < 0 ? rect.x - r : rect.x + rect.w + r) : k.x;
            k.y = uy ? (uy < 0 ? rect.y - r : rect.y + rect.h + r) : k.y;
        } else {
            ux = o.dx / o.d; uy = o.dy / o.d;
            k.x = o.ix + ux * (o.rc + r); k.y = o.iy + uy * (o.rc + r);
        }
        const vn = k.vx * ux + k.vy * uy;
        if (vn < 0) { k.vx -= 1.85 * vn * ux; k.vy -= 1.85 * vn * uy; }
    }

    breakRock(i, bullet) {
        const T = AsteroidsGame.T;
        const k = this.rocks[i];
        this.rocks.splice(i, 1);
        this.award(T.points[k.size]);
        this.sparks(k.x, k.y, 8 + k.size * 2, this.colors.secondary);
        if (k.size < T.sizes.length - 1) {
            const base = Math.atan2(bullet.vy, bullet.vx);
            for (const side of [-1, 1]) {
                const a = base + side * (0.5 + Math.random() * 0.6);
                const sp = Math.hypot(k.vx, k.vy) * 0.6 + 70 + Math.random() * 50;
                this.spawnRock(k.size + 1, k.x, k.y, Math.cos(a) * sp, Math.sin(a) * sp);
            }
        }
        if (window.AudioMng) AudioMng.play('flag_off');
    }

    // Rounded down to tens, as the scoreboard expects.
    award(points) {
        const run = asteroidRuns.get(this);
        run.points += points;
        run.score = Math.floor(run.points / 10) * 10;
    }

    crash(cause) {
        const s = this.ship;
        this.sparks(s.x, s.y, 28, this.colors.danger);
        this.sparks(s.x, s.y, 14, this.colors.alt);
        if (window.AudioMng) AudioMng.play('explode');
        this.lives--;
        this.state = 'dead';
        this.keys.clear();
        this.showBanner(cause === 'hole' ? 'Swallowed' : cause === 'window' ? 'Hit a window' : cause === 'world' ? 'Crashed at home' : 'Hit');
        setTimeout(() => {
            if (this.state !== 'dead') return;
            if (this.lives > 0) this.respawn();
            else this.gameOver();
        }, 1300);
    }

    // The centre of the view, or the nearest spot to it that is clear of
    // windows, black holes and rocks.
    clearSpot() {
        const v = this.view();
        const rects = this.windowRects(), holes = this.holes();
        const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
        // Far enough from windows that gravity is gentle there, so a ship that
        // just appeared has time to react.
        const clear = (x, y) => {
            if (rects.some(r => this.circleRect(x, y, 140, r))) return false;
            if (holes.some(h => Math.hypot(h.x - x, h.y - y) < 260)) return false;
            if (this.rocks.some(k => Math.hypot(k.x - x, k.y - y) < k.r + 120)) return false;
            if (this.worlds.some(w => Math.hypot(w.x - x, w.y - y) < w.r + 240)) return false;
            const g = this.pull(x, y, rects, holes);
            return Math.hypot(g.ax, g.ay) < 30;
        };
        if (clear(cx, cy)) return { x: cx, y: cy };
        for (let ring = 1; ring < 30; ring++) {
            for (let j = 0; j < 16; j++) {
                const a = j / 16 * Math.PI * 2;
                const x = cx + Math.cos(a) * ring * 50, y = cy + Math.sin(a) * ring * 50;
                if (clear(x, y)) return { x, y };
            }
        }
        return { x: cx, y: cy };
    }

    respawn() {
        const spot = this.clearSpot();
        this.ship = this.newShip(spot.x, spot.y);
        this.trail = [];
        this.state = 'play';
    }

    // Distance at which the hole pulls harder than the engine can push.
    noReturn() {
        const T = AsteroidsGame.T;
        return Math.max(T.holeRadius, Math.sqrt(Math.max(0, T.holePull / T.thrust - 1600)));
    }

    static get PHANTOM() { return 48; } // seconds a phantom lingers, about End of times' length

    phantomsOn() {
        return !!(window.NovaHorizon && NovaHorizon.phantomsUnlocked());
    }

    lostToHole(h) {
        if (window.NovaHorizon && NovaHorizon.roll()) {
            this.enterHorizon(h);
            return;
        }
        if (!this.phantomsOn()) { this.crash('hole'); return; }
        const s = this.ship;
        const dx = s.x - h.x, dy = s.y - h.y;
        this.phantoms.push({ hx: h.x, hy: h.y, ang: Math.atan2(dy, dx), d0: Math.hypot(dx, dy), a: s.a, t: 0 });
        if (window.AudioMng) AudioMng.play('collapse');
        this.lives--;
        this.keys.clear();
        this.trail = [];
        this.showBanner('Beyond return');
        if (this.lives > 0) this.respawn();
        else { this.state = 'dead'; setTimeout(() => this.state === 'dead' && this.gameOver(), 1300); }
    }

    // What an outside observer sees of a falling ship: it creeps toward the
    // horizon ever more slowly, is stretched along the fall, and its light
    // is redshifted and dimmed until it is gone.
    drawPhantoms(px) {
        if (!this.phantoms.length) return;
        const ctx = this.ctx;
        const rh = AsteroidsGame.T.holeRadius;
        const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
        // Seen from far away, a body falling in freezes at the horizon: its
        // light is redshifted by g ∝ e^(−t/τ), its distance to the horizon
        // shrinks as g² and its brightness as g⁴. The image flattens along the
        // horizon rather than stretching toward it. τ is cinematic (40 s here;
        // ~2·rs/c, a fraction of a millisecond, for a stellar black hole).
        const TAU = 40;
        this.phantoms.forEach(ph => {
            const g = Math.exp(-ph.t / TAU);
            const dist = rh + (ph.d0 - rh) * g * g;
            const x = ph.hx + Math.cos(ph.ang) * dist, y = ph.hy + Math.sin(ph.ang) * dist;
            const red = Math.min(1, -Math.log2(g) / 1.2);          // false colour by log g, as in End of times
            let col = mix([165, 180, 252], [255, 64, 32], Math.min(1, red * 1.3));
            col = mix(col, [70, 8, 4], Math.max(0, red - 0.6) / 0.4);
            const alpha = Math.min(1, Math.pow(g, 4) * 1.15) * (1 - Math.min(1, (ph.gone || 0) / 0.8));
            if (alpha <= 0.01) return;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ph.ang);                       // radial axis
            ctx.scale(Math.max(0.2, g), 1 + 1.6 * (1 - g));
            ctx.rotate(ph.a - ph.ang);
            ctx.beginPath();
            ctx.moveTo(15, 0); ctx.lineTo(-9, -9.5); ctx.lineTo(-5, 0); ctx.lineTo(-9, 9.5);
            ctx.closePath();
            ctx.globalAlpha = alpha * 0.35;
            ctx.fillStyle = `rgb(${col})`;
            ctx.fill();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = `rgb(${col})`;
            ctx.lineWidth = 1.5 * px;
            ctx.stroke();
            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    // The Horizon ends the game whatever lives are left. The game freezes
    // underneath, then shows "Game over" once the player wakes up.
    enterHorizon(hole) {
        this.exploring = true;
        this.state = 'over';
        this.keys.clear();
        if (this.canvas) this.canvas.classList.add('is-hidden');
        if (this.hud) this.hud.classList.add('is-hidden');
        NovaHorizon.play({ hue: hole ? hole.hue : 0 }, () => {
            if (this.canvas) this.canvas.classList.remove('is-hidden');
            if (this.hud) this.hud.classList.remove('is-hidden');
            this.rocks = []; this.bullets = []; this.particles = []; this.trail = []; this.phantoms = [];
            this.state = 'dead';
            this.lives = 0;
            this.updateHud();
            if (NovaHorizon.unlockedNow) {
                this.showBanner('Phantoms mode unlocked');
                setTimeout(() => this.gameOver(), 1800);
            } else {
                this.gameOver();
            }
        });
    }

    gameOver() {
        this.state = 'over';
        this.showBanner('Game over');
        setTimeout(() => {
            if (this.state !== 'over') return;
            if (!this.exploring && window.Scores && asteroidRuns.get(this).score > 0) {
                asteroidRuns.get(this).report(asteroidRuns.get(this).score, false, () => this.stop());
            } else {
                this.stop();
            }
        }, 1600);
    }

    puff(s) {
        const a = s.a + Math.PI + (Math.random() - 0.5) * 0.5;
        this.particles.push({
            x: s.x - Math.cos(s.a) * 10, y: s.y - Math.sin(s.a) * 10,
            vx: s.vx + Math.cos(a) * 160, vy: s.vy + Math.sin(a) * 160,
            life: 0.35, max: 0.35, color: this.colors.alt, size: 2
        });
    }

    sparks(x, y, n, color) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
            this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.5, max: 1, color, size: 1.6 });
        }
    }

    // Keep the ship inside the middle of the screen, leading slightly in the
    // direction of travel. The camera moves only when the ship leaves that box.
    followCamera(dt) {
        if (!this.ship || (window.NovaHorizon && NovaHorizon.running)) return;
        const Z = WindowManager.cameraZ;
        const s = this.ship;
        const sx = WindowManager.cameraX + (s.x + s.vx * 0.25) * Z;
        const sy = WindowManager.cameraY + (s.y + s.vy * 0.25) * Z;
        const W = window.innerWidth, H = window.innerHeight;
        const bx = W * 0.3, by = H * 0.3;
        let tx = 0, ty = 0;
        if (sx < bx) tx = bx - sx; else if (sx > W - bx) tx = (W - bx) - sx;
        if (sy < by) ty = by - sy; else if (sy > H - by) ty = (H - by) - sy;
        if (!tx && !ty) return;
        const k = 1 - Math.exp(-5 * dt);
        WindowManager.cameraX += tx * k;
        WindowManager.cameraY += ty * k;
        WindowManager.applyCameraTransform();
    }

    // ── Drawing ──────────────────────────────────────────────────────────────
    draw() {
        const ctx = this.ctx, Z = WindowManager.cameraZ, d = this.dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(d * Z, 0, 0, d * Z, d * WindowManager.cameraX, d * WindowManager.cameraY);
        const px = 1 / Z;
        const c = this.colors;

        // Trail: shows how gravity bends the path.
        if (this.trail.length > 1) {
            ctx.lineCap = 'round';
            for (let i = 1; i < this.trail.length; i++) {
                ctx.globalAlpha = (i / this.trail.length) * 0.35;
                ctx.strokeStyle = c.accent;
                ctx.lineWidth = 1.5 * px;
                ctx.beginPath();
                ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        this.worlds.forEach(w => this.drawWorld(w, px));

        // Rocks
        ctx.lineJoin = 'round';
        this.rocks.forEach(k => {
            ctx.save();
            ctx.translate(k.x, k.y);
            ctx.rotate(k.rot);
            ctx.beginPath();
            k.verts.forEach((m, i) => {
                const a = i / k.verts.length * Math.PI * 2;
                const x = Math.cos(a) * k.r * m, y = Math.sin(a) * k.r * m;
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            });
            ctx.closePath();
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = c.text;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = c.secondary;
            ctx.lineWidth = 1.75 * px;
            ctx.stroke();
            ctx.restore();
        });

        // Bullets
        ctx.fillStyle = c.accent;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 8;
        this.bullets.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, 2.4, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        // Particles
        this.particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life / p.max);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        });
        ctx.globalAlpha = 1;

        // Ship
        const s = this.ship;
        if (this.state === 'play' && !(s.safe > 0 && Math.floor(s.safe * 8) % 2)) {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.a);
            if (s.thrusting) {
                ctx.beginPath();
                ctx.moveTo(-8, -4.5);
                ctx.lineTo(-15 - Math.random() * 7, 0);
                ctx.lineTo(-8, 4.5);
                ctx.fillStyle = c.alt;
                ctx.fill();
            }
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-9, -9.5);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-9, 9.5);
            ctx.closePath();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = c.text;
            ctx.lineWidth = 1.75 * px;
            ctx.stroke();
            ctx.restore();
        }

        this.drawPhantoms(px);
        this.drawMarkers();
    }

    // The home world, in the game's own line style: a tinted disc under a
    // thin atmosphere, cloud bands that turn with it, a lit limb, and three
    // arcs around it for the strikes it can still take. Barren, it is a grey
    // cratered ball with no air.
    drawWorld(w, px) {
        const v = this.view(), reach = w.r * 2 + 280;
        if (w.x < v.x - reach || w.x > v.x + v.w + reach || w.y < v.y - reach || w.y > v.y + v.h + reach) return;
        const ctx = this.ctx, c = this.colors;
        const tint = w.tint || c.accent;
        // a ring, seen at a slant: the far half goes behind the planet
        const ringHalf = (from, to) => {
            if (!w.ring) return;
            ctx.save();
            ctx.translate(w.x, w.y); ctx.rotate(-0.38);
            ctx.strokeStyle = w.barren ? c.secondary : tint;
            [[1.55, 0.5], [1.78, 0.75], [1.98, 0.35]].forEach(([k, a]) => {
                ctx.globalAlpha = a;
                ctx.lineWidth = 2.5 * px;
                ctx.beginPath(); ctx.ellipse(0, 0, w.r * k, w.r * k * 0.3, 0, from, to); ctx.stroke();
            });
            ctx.restore();
        };
        ctx.save();
        ctx.lineCap = 'round';

        // orbits
        ctx.strokeStyle = c.secondary;
        ctx.lineWidth = px;
        ctx.setLineDash([2, 9]);
        w.moons.forEach(m => {
            ctx.globalAlpha = 0.28;
            ctx.beginPath(); ctx.arc(w.x, w.y, m.orbit, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.setLineDash([]);

        if (!w.barren) {
            const air = ctx.createRadialGradient(w.x, w.y, w.r * 0.9, w.x, w.y, w.r * 1.5);
            air.addColorStop(0, tint); air.addColorStop(1, 'transparent');
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = air;
            ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 1.5, 0, Math.PI * 2); ctx.fill();
        }

        ringHalf(Math.PI, Math.PI * 2);

        // body
        ctx.globalAlpha = w.barren ? 0.1 : 0.24;
        ctx.fillStyle = w.barren ? c.text : tint;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill();

        ctx.save();
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.clip();
        ctx.translate(w.x, w.y);
        if (!w.barren) {
            // cloud bands: the planet is tilted, so they read as shallow arcs
            ctx.rotate(-0.38);
            ctx.strokeStyle = c.text;
            ctx.lineWidth = 1.25 * px;
            [-0.58, -0.22, 0.16, 0.5].forEach((lat, i) => {
                const y = lat * w.r, half = Math.sqrt(1 - lat * lat) * w.r;
                const drift = Math.sin(w.rot * 2 + i * 1.7) * 0.25;
                ctx.globalAlpha = 0.22;
                ctx.beginPath();
                ctx.ellipse(0, y, half, w.r * 0.11, 0, Math.PI * (0.08 + drift * 0.2), Math.PI * (0.92 + drift * 0.2));
                ctx.stroke();
            });
            ctx.rotate(0.38);
        }
        // scars turn with the surface
        (w.scars || []).forEach(sc => {
            const a = sc.a + w.rot;
            ctx.globalAlpha = w.barren ? 0.5 : 0.75;
            ctx.strokeStyle = w.barren ? c.secondary : c.danger;
            ctx.lineWidth = 1.25 * px;
            ctx.beginPath(); ctx.arc(Math.cos(a) * w.r * sc.d, Math.sin(a) * w.r * sc.d, sc.r, 0, Math.PI * 2); ctx.stroke();
        });
        // night side
        const shade = ctx.createLinearGradient(-w.r, -w.r, w.r, w.r);
        shade.addColorStop(0.35, 'transparent'); shade.addColorStop(1, '#000');
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = shade;
        ctx.fillRect(-w.r, -w.r, w.r * 2, w.r * 2);
        if (w.flash > 0) {
            ctx.globalAlpha = w.flash * 0.45;
            ctx.fillStyle = c.danger;
            ctx.fillRect(-w.r, -w.r, w.r * 2, w.r * 2);
        }
        ctx.restore();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = w.barren ? c.secondary : c.text;
        ctx.lineWidth = 1.75 * px;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
        ringHalf(0, Math.PI);

        // strikes left
        if (!w.barren) {
            const left = AsteroidsGame.T.worldHits - w.hits;
            ctx.strokeStyle = left === 1 ? c.danger : tint;
            ctx.lineWidth = 2 * px;
            for (let i = 0; i < left; i++) {
                const a0 = -Math.PI / 2 + (i - left / 2) * 0.34 + 0.05;
                ctx.globalAlpha = 0.9;
                ctx.beginPath(); ctx.arc(w.x, w.y, w.r + 9, a0, a0 + 0.24); ctx.stroke();
            }
        }

        // moons: lit from the same side as the planet
        w.moons.forEach(m => {
            ctx.globalAlpha = 0.16 + 0.1 * m.hits;
            ctx.fillStyle = m.hits ? c.danger : c.text;
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = c.secondary;
            ctx.lineWidth = 1.5 * px;
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    // Off-screen rocks: a diamond on the screen edge pointing at each one.
    // Closer rocks get bigger, brighter diamonds; the last two pulse.
    // Every world found so far, when out of view, gets a ring in its colour.
    drawMarkers() {
        if (!this.rocks.length && !this.worlds.length) return;
        const ctx = this.ctx, d = this.dpr, Z = WindowManager.cameraZ;
        const W = window.innerWidth, H = window.innerHeight;
        const top = 132, bottom = H - 104, left = 22, right = W - 22; // clear of HUD and shelf
        const cx = W / 2, cy = (top + bottom) / 2;
        const diag = Math.hypot(W, H) / Z;
        const last = this.rocks.length <= 2;
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        this.rocks.forEach(k => {
            const sx = WindowManager.cameraX + k.x * Z, sy = WindowManager.cameraY + k.y * Z;
            const m = k.r * Z;
            if (sx > -m && sx < W + m && sy > -m && sy < H + m) return; // visible
            const dx = sx - cx, dy = sy - cy;
            const t = Math.min((dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity),
                               (dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity));
            const mx = cx + dx * t, my = cy + dy * t;
            const dist = Math.hypot(k.x - this.ship.x, k.y - this.ship.y);
            const near = Math.max(0, 1 - dist / (diag * 1.6));
            const size = 3.5 + near * 4 + (last ? pulse * 2.5 : 0);
            ctx.globalAlpha = 0.35 + near * 0.55;
            ctx.fillStyle = last ? this.colors.accent : this.colors.secondary;
            ctx.beginPath();
            ctx.moveTo(mx, my - size); ctx.lineTo(mx + size, my); ctx.lineTo(mx, my + size); ctx.lineTo(mx - size, my);
            ctx.closePath();
            ctx.fill();
        });
        this.worlds.forEach((w, i) => {
            if (!w.found) return;
            const sx = WindowManager.cameraX + w.x * Z, sy = WindowManager.cameraY + w.y * Z, m = w.r * Z;
            if (sx > -m && sx < W + m && sy > -m && sy < H + m) return;
            const dx = sx - cx, dy = sy - cy;
            const t = Math.min((dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity),
                               (dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity));
            ctx.globalAlpha = i === 0 ? 0.85 : 0.6;
            ctx.strokeStyle = w.barren ? this.colors.secondary : (w.tint || this.colors.accent);
            ctx.lineWidth = 1.75;
            ctx.beginPath(); ctx.arc(cx + dx * t, cy + dy * t, i === 0 ? 5.5 : 4, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }

    updateHud() {
        if (!this.hud) return;
        this.hud.querySelector('.ast-hud__score').textContent = asteroidRuns.get(this).score.toLocaleString();
        const wave = this.waveBreak > 0 ? `Wave ${this.wave} cleared` : `Wave ${this.wave} · ${this.rocks.length} left`;
        const waveEl = this.hud.querySelector('.ast-hud__wave');
        if (waveEl.textContent !== wave) waveEl.textContent = wave;
        const lives = this.hud.querySelector('.ast-hud__lives');
        const want = Math.max(0, this.lives);
        if (lives.childElementCount !== want) {
            lives.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12L6 4.5L8.5 12L6 19.5z"/></svg>'.repeat(want);
            lives.setAttribute('aria-label', `${want} ships left`);
        }
    }

    showBanner(text) {
        if (!this.banner) return;
        this.banner.textContent = text;
        this.banner.classList.remove('is-shown');
        void this.banner.offsetWidth;
        this.banner.classList.add('is-shown');
    }
}

// The system. The first is home and takes the theme's accent; the others keep
// fixed colours. moons: [orbit radius, moon radius].
AsteroidsGame.WORLDS = [
    { name: 'Home', r: 62, tint: null, moons: [[112, 13], [176, 8]] },
    { name: 'Ember', r: 38, tint: '#fb7185', moons: [] },
    { name: 'Halo', r: 92, tint: '#fbbf24', ring: true, moons: [[236, 11], [292, 8], [340, 6]] },
    { name: 'Tide', r: 52, tint: '#22d3ee', moons: [[98, 10]] }
];

window.NovaAsteroids = new AsteroidsGame();

})();
