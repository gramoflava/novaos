// End of times (internally: Horizon) — the second Asteroids easter egg.
//
// Each fall into a black hole adds one to a counter kept in localStorage, so it
// survives games and visits. The n-th fall plays the Horizon with chance n/8;
// the 8th is certain. Playing it resets the counter, and the first time it
// plays it unlocks the secret Phantoms mode for good (see asteroids.js).
//
// The scene: a cockpit window opens over everything. The pilot holds a small
// single-seat craft on its engine just above the horizon. For an observer kept
// still there (not one in free fall) the outside clock runs fast, and the
// outside sky shrinks into a bright, blueshifted disc overhead. So the home
// clock races, and the desktop around the cockpit ages with it: windows yellow,
// crack and crumble, stars burn out or go supernova, the cosmos stretches and
// dims. Then the engine gives out. In free fall the disc reddens, stretches
// and goes out, the screen goes black, a flash — and the desktop is back, as
// if waking from a dream. The game is over whatever lives were left.
//
// The score is original, made in Web Audio: an organ-like chord progression in
// A minor over a ticking pulse that speeds up with the home clock, pulled down
// in pitch during the fall and answered by a major chord on waking.
//
// Esc skips to the dark. NovaHorizon.play() runs it from the console.
class Horizon {
    constructor() {
        this.KEY = 'novaos_horizon_falls';
        this.running = false;
        this.frame = this.frame.bind(this);
        this.onKey = this.onKey.bind(this);
    }

    // ── The counter ──────────────────────────────────────────────────────────
    falls() {
        try { return parseInt(localStorage.getItem(this.KEY) || '0', 10) || 0; } catch (e) { return 0; }
    }

    setFalls(n) {
        try { localStorage.setItem(this.KEY, String(n)); } catch (e) { }
    }

    phantomsUnlocked() {
        try { return localStorage.getItem('novaos_phantoms') === '1'; } catch (e) { return false; }
    }

    // Called on every fall into a black hole. True means: play it now.
    roll() {
        const n = this.falls() + 1;
        if (Math.random() < n / 8) {
            this.setFalls(0);
            return true;
        }
        this.setFalls(n);
        return false;
    }

    // ── Timeline (seconds) ───────────────────────────────────────────────────
    static get P() {
        return { inEnd: 2.5, descentEnd: 14, hoverEnd: 28, fallEnd: 34, darkEnd: 36.5, end: 39.5 };
    }

    // Where the craft is: x = log10(r − 1), r in units of rs. From r = 12 down
    // to just outside the photon sphere and the horizon, then holding ever
    // closer to it (r − 1 → 10⁻⁴⁴).
    logR1(t) {
        const P = Horizon.P;
        const ease = k => k * k * (3 - 2 * k);
        if (t < P.inEnd) return Math.log10(11);
        if (t < 11) return Math.log10(11) + (-1.6 - Math.log10(11)) * ease((t - P.inEnd) / (11 - P.inEnd));
        if (t < P.hoverEnd) return -1.6 - 42.4 * Math.pow((t - 11) / (P.hoverEnd - 11), 1.5);
        return -44;
    }

    // log10 of how many home seconds pass per cockpit second: for a static
    // observer, dt_home/dτ = 1/√(1 − rs/r).
    logRate(t) {
        const x = this.logR1(t);
        return -0.5 * (x - Math.log10(1 + Math.pow(10, x)));
    }

    // ── Start and finish ─────────────────────────────────────────────────────
    // opts.hue: the colour of the hole being entered (hue-rotation of the
    // standard orange disc, as in WindowManager). play() alone works too.
    play(opts, onDone) {
        if (typeof opts === 'function') { onDone = opts; opts = {}; }
        opts = opts || {};
        if (this.running) return;
        this.running = true;
        this.onDone = onDone || null;
        this.hue = ((opts.hue || 0) + 24) % 360;  // base disc orange ≈ 24°
        this.t = 0;
        this.homeSeconds = 0;
        this.startDate = new Date();
        this.saved = new Map();
        this.flashed = false;
        this.unlockedNow = !this.phantomsUnlocked();
        try { localStorage.setItem('novaos_phantoms', '1'); } catch (e) { }

        this.buildDom();
        this.collectDesktop();
        this.planZoom();
        this.makeStars();
        this.rays = new SchwarzschildView(this.hue);
        this.snapshot = null;
        this.music = new HorizonScore();
        this.music.start();

        window.addEventListener('keydown', this.onKey, true);
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.frame);
    }

    onKey(e) {
        e.preventDefault();
        e.stopPropagation();
        const P = Horizon.P;
        if (e.key === 'Escape' && this.t < P.fallEnd) {
            this.t = P.fallEnd;
            this.music.cut();
        }
    }

    finish() {
        cancelAnimationFrame(this.raf);
        window.removeEventListener('keydown', this.onKey, true);
        if (this.root) this.root.remove();
        this.root = null;
        this.running = false;
        const done = this.onDone;
        this.onDone = null;
        if (done) done();
    }

    // ── DOM ──────────────────────────────────────────────────────────────────
    buildDom() {
        const root = document.createElement('div');
        root.className = 'hz-root';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'End of times');
        root.innerHTML = `
            <canvas class="hz-sky" aria-hidden="true"></canvas>
            <div class="hz-shade"></div>
            <section class="hz-cockpit">
                <header class="hz-head">
                    <span class="hz-title">Single-seat craft · holding above the horizon</span>
                    <div class="hz-clock">
                        <span class="hz-clock__label">Home time</span>
                        <b class="hz-clock__value"></b>
                        <small class="hz-clock__rate"></small>
                    </div>
                </header>
                <canvas class="hz-view" aria-hidden="true"></canvas>
            </section>
            <div class="hz-black"></div>
            <div class="hz-flash"></div>`;
        document.body.appendChild(root);
        this.root = root;
        this.sky = root.querySelector('.hz-sky');
        this.view = root.querySelector('.hz-view');
        this.el = {
            shade: root.querySelector('.hz-shade'),
            cockpit: root.querySelector('.hz-cockpit'),
            clock: root.querySelector('.hz-clock__value'),
            rate: root.querySelector('.hz-clock__rate'),
            black: root.querySelector('.hz-black'),
            flash: root.querySelector('.hz-flash')
        };
        this.resize();
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.dpr = dpr;
        this.sky.width = innerWidth * dpr;
        this.sky.height = innerHeight * dpr;
        this.view.width = Math.max(1, this.view.offsetWidth * dpr);
        this.view.height = Math.max(1, this.view.offsetHeight * dpr);
    }

    // Everything at home that ages: windows, the island, the shelf, the cosmos.
    collectDesktop() {
        const rnd = (a, b) => a + Math.random() * (b - a);
        this.windows = [];
        if (window.WindowManager) {
            WindowManager.windows.forEach(w => {
                if (!w.el || w.el.dataset.minimized === 'true') return;
                this.save(w.el);
                const crack = document.createElement('div');
                crack.className = 'hz-crack';
                crack.innerHTML = this.crackSvg();
                w.el.appendChild(crack);
                this.windows.push({
                    el: w.el, crack,
                    // each crumbles at its own moment, in its own direction
                    at: rnd(3.1, 4.4), dx: rnd(-1, 1), dy: rnd(-0.6, 1), rot: rnd(-25, 25), dusted: false
                });
            });
        }
        this.chrome = ['#nova-island-container', '#nova-shelf-container']
            .map(sel => document.querySelector(sel)).filter(Boolean)
            .map((el, i) => { this.save(el); return { el, at: 4.6 + i * 0.5, dy: i ? 1 : -1, dusted: false }; });
        this.cosmos = document.getElementById('nova-background');
        if (this.cosmos) this.save(this.cosmos);
        this.indicators = document.getElementById('window-indicators');
        if (this.indicators) this.save(this.indicators);
        this.dust = [];
    }

    save(el) {
        if (!this.saved.has(el)) this.saved.set(el, el.style.cssText);
    }

    // Put every touched element back exactly as it was.
    restoreDesktop() {
        this.saved.forEach((css, el) => { el.style.cssText = css; });
        this.saved.clear();
        (this.windows || []).forEach(w => w.crack.remove());
    }

    crackSvg() {
        let paths = '';
        for (let i = 0; i < 5; i++) {
            let x = 10 + Math.random() * 80, y = 10 + Math.random() * 80, d = `M${x} ${y}`;
            const a = Math.random() * Math.PI * 2;
            for (let j = 0; j < 6; j++) {
                const b = a + (Math.random() - 0.5) * 1.4;
                x += Math.cos(b) * (6 + Math.random() * 10);
                y += Math.sin(b) * (6 + Math.random() * 10);
                d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
            }
            paths += `<path d="${d}"/>`;
        }
        return `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${paths}</svg>`;
    }

    makeStars() {
        const W = innerWidth, H = innerHeight;
        // Stars at home: each dies at its own log10(years), one in five as a supernova.
        this.stars = Array.from({ length: 170 }, () => ({
            x: Math.random() * W, y: Math.random() * H,
            r: Math.random() < 0.15 ? 1.6 : 0.9,
            death: 8 + Math.random() * 6,
            nova: Math.random() < 0.2,
            novaT: -1
        }));
    }

    // ── Loop ─────────────────────────────────────────────────────────────────
    frame(now) {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        const P = Horizon.P;
        this.t += dt;
        const t = this.t;

        if (t < P.hoverEnd) this.homeSeconds += Math.pow(10, this.logRate(t)) * dt;
        const years = this.homeSeconds / 3.15576e7;
        const ly = Math.log10(Math.max(years, 1e-9));

        this.music.update(t, this.logRate(t));
        if (!this.flashed) {
            this.zoomOut(t);
            this.updateHome(t, ly, dt);
            if (this.view.offsetWidth * this.dpr !== this.view.width || this.view.offsetHeight * this.dpr !== this.view.height) this.resize();
            this.drawSky(t, ly, dt);
            this.updateCockpit(t, years, ly);
            this.drawView(t);
        }

        if (t >= P.darkEnd && !this.flashed) this.flash();
        if (t >= P.end) { this.finish(); return; }
        this.raf = requestAnimationFrame(this.frame);
    }

    // Smooth 0→1 as x goes from a to b.
    s(x, a, b) {
        const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return k * k * (3 - 2 * k);
    }

    updateHome(t, ly, dt) {
        const age = this.s(ly, -2.3, 2);         // days to a century: colours fade
        const crack = this.s(ly, 1, 3);          // decades to millennia: glass cracks
        this.windows.forEach(w => {
            const k = this.s(ly, w.at, w.at + 1.3);
            w.el.style.filter = `sepia(${0.85 * age}) saturate(${1 - 0.6 * age}) brightness(${1 - 0.3 * age - 0.3 * k}) contrast(${1 - 0.2 * age})`;
            w.crack.style.opacity = crack * (1 - k);
            w.el.style.translate = `${w.dx * 260 * k}px ${w.dy * 220 * k}px`;
            w.el.style.rotate = `${w.rot * k}deg`;
            w.el.style.scale = `${1 - 0.35 * k}`;
            w.el.style.opacity = `${1 - k}`;
            if (k > 0.05 && !w.dusted) { w.dusted = true; this.addDust(w.el.getBoundingClientRect(), 70); }
        });
        this.chrome.forEach(c => {
            const k = this.s(ly, c.at, c.at + 1.2);
            c.el.style.filter = `sepia(${0.8 * age}) brightness(${1 - 0.3 * age})`;
            c.el.style.translate = `0 ${c.dy * 90 * k}px`;
            c.el.style.opacity = `${1 - k}`;
            if (k > 0.05 && !c.dusted) { c.dusted = true; this.addDust(c.el.firstElementChild.getBoundingClientRect(), 40); }
        });
        if (this.indicators) this.indicators.style.opacity = `${1 - this.s(ly, 2, 4)}`;
        if (this.cosmos) {
            const d = this.s(ly, 6, 13);         // galaxies redden, stretch and fade
            this.cosmos.style.scale = `${1 + 0.4 * d} ${1 + 1.3 * d}`;
            this.cosmos.style.filter = `brightness(${1 - 0.9 * d}) saturate(${1 - 0.6 * d}) hue-rotate(${-25 * d}deg)`;
        }
        // The edge of the cockpit darkens as the free fall begins.
        const P = Horizon.P;
        this.el.shade.style.opacity = `${0.25 + 0.6 * this.s(t, P.hoverEnd, P.fallEnd)}`;
        this.el.black.style.opacity = `${this.s(t, P.fallEnd - 1.5, P.fallEnd + 0.8)}`;
    }

    addDust(rect, n) {
        for (let i = 0; i < n; i++) {
            const edge = Math.random();
            const x = rect.left + Math.random() * rect.width;
            const y = edge < 0.5 ? rect.top + Math.random() * rect.height : (edge < 0.75 ? rect.top : rect.bottom);
            const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 50;
            this.dust.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 12, life: 2.5 + Math.random() * 3, max: 5.5 });
        }
    }

    drawSky(t, ly, dt) {
        const ctx = this.sky.getContext('2d'), d = this.dpr;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        const fade = 1 - this.s(t, Horizon.P.hoverEnd, Horizon.P.fallEnd);

        this.stars.forEach(st => {
            const life = 1 - this.s(ly, st.death - 0.6, st.death);
            if (st.nova && ly >= st.death - 0.05 && st.novaT < 0) st.novaT = 0;
            if (st.novaT >= 0 && st.novaT < 1.6) {
                st.novaT += dt;
                const k = st.novaT / 1.6;
                const R = 6 + 60 * Math.sqrt(k);
                const g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, R);
                g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`);
                g.addColorStop(0.3, `rgba(170,200,255,${0.6 * (1 - k)})`);
                g.addColorStop(1, 'rgba(120,80,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(st.x, st.y, R, 0, Math.PI * 2); ctx.fill();
                return;
            }
            if (st.novaT >= 1.6 || life <= 0) return;
            const tw = 0.75 + 0.25 * Math.sin(t * 3 + st.x);
            ctx.globalAlpha = life * tw * fade * 0.85;
            ctx.fillStyle = '#e8eefc';
            ctx.fillRect(st.x, st.y, st.r, st.r);
        });
        ctx.globalAlpha = 1;

        this.dust = this.dust.filter(p => {
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.life -= dt;
            ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.7 * fade;
            ctx.fillStyle = '#b9a98c';
            ctx.fillRect(p.x, p.y, 1.6, 1.6);
            return p.life > 0;
        });
        ctx.globalAlpha = 1;
    }

    // Pilot's view. The whole window is the outside, ray-traced; the craft is
    // only its white wireframe — the same lines as the ship in the game — and
    // the few readouts sit small in the corners.
    drawView(t) {
        const P = Horizon.P;
        const ctx = this.view.getContext('2d');
        const W = this.view.width, H = this.view.height, u = W / 760;
        const fall = this.s(t, P.hoverEnd, P.fallEnd);
        const h = this.hud;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        const shake = (fall * 6 + this.s(t, P.hoverEnd - 4, P.hoverEnd) * 1.5) * u;
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

        // ── Outside ──
        // Resolution follows the machine: aim for ~10 ms per frame.
        this.lw = this.lw || 420;
        const lw = Math.round(this.lw), lh = Math.round(lw * H / W);
        if (!h.falling) {
            const x = this.logR1(t), lr = this.logRate(t);
            const rho = 0.376 * Math.pow(0.1 / 0.376, this.s(t, 11, P.hoverEnd));
            const t0 = performance.now();
            const img = this.rays.render(lw, lh, { logR1: x, gObs: Math.pow(10, Math.min(lr, 30)), rho }, t);
            const ms = performance.now() - t0;
            this.msAvg = this.msAvg ? this.msAvg * 0.9 + ms * 0.1 : ms;
            if (this.msAvg > 13 && this.lw > 260) this.lw *= 0.94;
            else if (this.msAvg < 7 && this.lw < Math.min(720, W)) this.lw *= 1.04;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, W, H);
            if (t > P.hoverEnd - 0.2) {               // keep the last sight for the fall
                if (!this.snapshot) this.snapshot = document.createElement('canvas');
                this.snapshot.width = img.width; this.snapshot.height = img.height;
                this.snapshot.getContext('2d').drawImage(img, 0, 0);
            }
        } else if (this.snapshot) {
            // Free fall: the cone of outside light widens a little (aberration
            // for a falling observer), reddens and dims, and then it is gone.
            const sc = 1 + 0.9 * fall, dw = W * sc, dh = H * sc;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - fall * 1.15);
            ctx.drawImage(this.snapshot, (W - dw) / 2, (H - dh) / 2, dw, dh);
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `rgb(255, ${Math.round(255 - 205 * fall)}, ${Math.round(255 - 230 * fall)})`;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        // ── The craft: a white wireframe cockpit ──
        ctx.drawImage(this.cockpitFrame(W, H, u), 0, 0);

        // ── Readouts, small, in the corners ──
        const mono = s => `${Math.round(s * u)}px "JetBrains Mono", ui-monospace, monospace`;
        const warn = '#ff6a4a', calm = 'rgba(225, 232, 250, 0.82)', dim = 'rgba(200, 210, 235, 0.5)';
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6 * u;
        const pad = 16 * u, by = H - pad;

        // bottom left: where we are, and what the craft is doing
        ctx.textAlign = 'left';
        ctx.fillStyle = dim; ctx.font = mono(9);
        ctx.fillText('DISTANCE', pad, by - 30 * u);
        ctx.fillStyle = h.falling ? warn : calm; ctx.font = mono(12);
        ctx.fillText(h.radius, pad, by - 14 * u);
        ctx.fillStyle = h.falling ? warn : dim; ctx.font = mono(9);
        ctx.fillText(h.status.toUpperCase(), pad, by);

        // bottom right: thrust and the light's shift, as two thin bars
        ctx.textAlign = 'right';
        const bw = 120 * u, bx = W - pad - bw;
        const bar = (y, label, v, colour) => {
            ctx.fillStyle = dim; ctx.font = mono(9);
            ctx.fillText(label, W - pad, y - 6 * u);
            ctx.fillStyle = 'rgba(235,240,255,0.15)'; ctx.fillRect(bx, y, bw, 2 * u);
            ctx.fillStyle = colour; ctx.fillRect(bx, y, bw * Math.max(0, Math.min(1, v)), 2 * u);
        };
        bar(by - 26 * u, `THRUST ${Math.round(h.thrust * 100)}%`, h.thrust, h.falling ? warn : calm);
        const shift = h.falling ? 0.5 + 0.5 * fall : 0.5 - 0.5 * Math.min(1, h.lr / 4);
        ctx.fillStyle = dim; ctx.font = mono(9);
        ctx.fillText(shift < 0.48 ? 'LIGHT · BLUESHIFTED' : shift > 0.52 ? 'LIGHT · REDSHIFTED' : 'LIGHT', W - pad, by - 6 * u);
        const sg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        sg.addColorStop(0, '#6b8cff'); sg.addColorStop(0.5, '#e8ecf8'); sg.addColorStop(1, '#ff4a2a');
        ctx.globalAlpha = 0.6; ctx.fillStyle = sg; ctx.fillRect(bx, by, bw, 2 * u); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * shift - 1 * u, by - 3 * u, 2 * u, 8 * u);

        // a single caution light, top left under the title, only when needed
        if (h.falling && Math.floor(t * 4) % 2 === 0) {
            ctx.fillStyle = warn; ctx.shadowColor = warn; ctx.shadowBlur = 10 * u;
            ctx.beginPath(); ctx.arc(pad + 3 * u, 44 * u, 3 * u, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    }

    // The cockpit as white lines, built once per size: overhead panel, a
    // front pane narrowing toward the dash, two pillars, side panes, and the
    // dash lip below. Surfaces are a dark veil, edges white; both fade toward
    // the middle of the view and grow stronger toward the corners, so the
    // frame reads without getting in the way.
    cockpitFrame(W, H, u) {
        if (this.frameCache && this.frameCache.width === W && this.frameCache.height === H) return this.frameCache;
        const c = this.frameCache || document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.clearRect(0, 0, W, H);
        const P = (x, y) => [x * W, y * H];
        // key points (fractions of the view)
        const tl = P(0.29, 0.17), tr = P(0.71, 0.17);      // front pane, top corners
        const bl = P(0.385, 0.66), br = P(0.615, 0.66);     // front pane, bottom corners
        const veil = 'rgba(6, 8, 14, 0.72)';
        const poly = (pts, fill) => {
            g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
            g.closePath(); g.fillStyle = fill; g.fill();
        };
        const pw = 0.035;                                   // pillar width, in W
        // overhead panel
        poly([P(-0.02, -0.02), P(1.02, -0.02), P(1.02, 0.04), tr, tl, P(-0.02, 0.04)], veil);
        // pillars (front pane edges), thick at the top, thinner at the dash
        poly([tl, [tl[0] - pw * W, tl[1] - 0.01 * H], [bl[0] - pw * 0.5 * W, bl[1]], bl], veil);
        poly([tr, [tr[0] + pw * W, tr[1] - 0.01 * H], [br[0] + pw * 0.5 * W, br[1]], br], veil);
        // side-pane struts from the overhead corners down to the sills
        // (they run from the overhead edge down to the dash lip, so they meet
        // the rest of the frame instead of floating across it)
        poly([P(0.085, 0.085), P(0.115, 0.098), P(0.055, 0.76), P(0.025, 0.775)], veil);
        poly([P(0.915, 0.085), P(0.885, 0.098), P(0.945, 0.76), P(0.975, 0.775)], veil);
        // dash: lip from the sides to the bottom of the front pane, console below
        poly([P(-0.02, 0.8), P(0.18, 0.7), bl, br, P(0.82, 0.7), P(1.02, 0.8), P(1.02, 1.02), P(-0.02, 1.02)], veil);

        // edges
        g.lineCap = 'round'; g.lineJoin = 'round';
        const edge = (pts, a, w) => {
            g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
            g.strokeStyle = `rgba(235, 240, 255, ${a})`; g.lineWidth = w * u; g.stroke();
        };
        edge([tl, tr, br, bl, tl], 0.9, 1.3);                                  // front pane
        edge([[tl[0] - pw * W, tl[1] - 0.01 * H], [bl[0] - pw * 0.5 * W, bl[1]]], 0.7, 1.1);
        edge([[tr[0] + pw * W, tr[1] - 0.01 * H], [br[0] + pw * 0.5 * W, br[1]]], 0.7, 1.1);
        edge([P(-0.02, 0.04), [tl[0] - pw * W, tl[1] - 0.01 * H]], 0.7, 1.1);  // overhead
        edge([P(1.02, 0.04), [tr[0] + pw * W, tr[1] - 0.01 * H]], 0.7, 1.1);
        edge([P(0.1, 0.091), P(0.04, 0.768)], 0.6, 1.1);                       // side struts
        edge([P(0.9, 0.091), P(0.96, 0.768)], 0.6, 1.1);
        edge([P(-0.02, 0.8), P(0.18, 0.7), bl], 0.8, 1.2);                     // dash lip
        edge([br, P(0.82, 0.7), P(1.02, 0.8)], 0.8, 1.2);
        edge([P(0.3, 1.02), P(0.36, 0.76), P(0.64, 0.76), P(0.7, 1.02)], 0.45, 1); // console
        // overhead warning strip: four small empty panels
        for (let i = 0; i < 4; i++) {
            const x0 = 0.33 + i * 0.087;
            edge([P(x0, 0.07), P(x0 + 0.075, 0.07), P(x0 + 0.075, 0.12), P(x0, 0.12), P(x0, 0.07)], 0.35, 0.9);
        }
        // a few ribs on the overhead, for scale
        for (let i = 0; i < 14; i++) {
            const x = 0.35 + i * 0.022;
            edge([P(x, 0.015), P(x, 0.04)], 0.3, 0.8);
        }

        // fade toward the middle, stronger toward the corners
        g.globalCompositeOperation = 'destination-in';
        const m = g.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.12, W / 2, H * 0.42, Math.hypot(W, H) * 0.55);
        m.addColorStop(0, 'rgba(0,0,0,0.12)');
        m.addColorStop(0.45, 'rgba(0,0,0,0.45)');
        m.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = m; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
        this.frameCache = c;
        return c;
    }

    updateCockpit(t, years, ly) {
        const P = Horizon.P;
        const falling = t >= P.hoverEnd;
        const lr = this.logRate(t);
        if (!falling) {
            this.el.clock.textContent = this.formatHome(years);
            this.el.rate.textContent = lr < 0.3 ? 'running normally' : `running ×10${this.sup(Math.floor(lr))}`;
        } else {
            this.el.rate.textContent = 'signal lost';
            this.el.cockpit.classList.add('is-falling');
        }
        const hold = this.s(t, P.inEnd, P.hoverEnd);
        const inside = falling && t > P.hoverEnd + 2;
        const x = this.logR1(t);
        const radius = x > -3 ? `r = ${(1 + Math.pow(10, x)).toFixed(5)} rs` : `r = (1 + 10${this.sup(Math.round(x))}) rs`;
        const thrust = falling ? Math.max(0, 0.45 - (t - P.hoverEnd) * 0.5) * (Math.random() < 0.3 ? 0 : 1) : 0.5 + 0.48 * hold;
        this.hud = {
            lr: falling ? 22 : lr,
            thrust,
            falling,
            radius: inside ? 'inside the horizon' : radius,
            status: falling ? 'engine failure · free fall' : t < P.inEnd ? 'descending' : 'holding position'
        };
    }

    formatHome(years) {
        if (years < 1) {
            const d = new Date(this.startDate.getTime() + this.homeSeconds * 1000);
            const p = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        }
        const year = this.startDate.getFullYear() + years;
        if (year < 1e6) return `Year ${Math.floor(year).toLocaleString('en-US').replace(/,/g, ' ')}`;
        const e = Math.floor(Math.log10(year));
        return `Year ${(year / Math.pow(10, e)).toFixed(2)} × 10${this.sup(e)}`;
    }

    sup(n) {
        const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
        return String(n).split('').map(c => map[c] || c).join('');
    }

    // Pull the camera back so windows that were off screen come into view and
    // age in front of the player. Nothing to show: the camera stays put.
    planZoom() {
        const WM = window.WindowManager;
        this.cam = WM ? { x: WM.cameraX, y: WM.cameraY, z: WM.cameraZ } : null;
        this.camTo = null;
        if (!WM || WM.isMobile() || !this.windows.length) return;
        const Z = WM.cameraZ, W = innerWidth, H = innerHeight;
        let x0 = -WM.cameraX / Z, y0 = -WM.cameraY / Z, x1 = x0 + W / Z, y1 = y0 + H / Z;
        const vx0 = x0, vy0 = y0, vx1 = x1, vy1 = y1;
        this.windows.forEach(w => {
            const d = w.el.dataset;
            const a = parseFloat(d.x), b = parseFloat(d.y), c = a + parseFloat(d.w), e = b + parseFloat(d.h);
            x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, e);
        });
        if (x0 >= vx0 && y0 >= vy0 && x1 <= vx1 && y1 <= vy1) return; // all in view already
        const pad = 80;
        const z = Math.max(0.2, Math.min(Z, W / (x1 - x0 + pad * 2 / Z), H / (y1 - y0 + pad * 2 / Z)));
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        this.camTo = { x: W / 2 - mx * z, y: H / 2 - my * z, z };
    }

    zoomOut(t) {
        if (!this.camTo) return;
        const k = this.s(t, 1.5, 11);
        const WM = window.WindowManager, a = this.cam, b = this.camTo;
        WM.cameraZ = a.z + (b.z - a.z) * k;
        WM.cameraX = a.x + (b.x - a.x) * k;
        WM.cameraY = a.y + (b.y - a.y) * k;
        WM.applyCameraTransform();
    }

    restoreCamera() {
        const WM = window.WindowManager;
        if (!WM || !this.cam) return;
        WM.cameraX = this.cam.x; WM.cameraY = this.cam.y; WM.cameraZ = this.cam.z;
        WM.applyCameraTransform();
    }

    // White flash; under it the desktop is put back, then the light fades.
    flash() {
        this.flashed = true;
        this.el.flash.classList.add('is-on');
        this.music.wake();
        setTimeout(() => {
            this.restoreDesktop();
            ['.hz-sky', '.hz-shade', '.hz-cockpit', '.hz-black'].forEach(sel => {
                const n = this.root && this.root.querySelector(sel);
                if (n) n.remove();
            });
            if (this.el.flash) this.el.flash.classList.add('is-fading');
            this.restoreCamera();
        }, 420);
    }
}

// ── The view, ray-traced ────────────────────────────────────────────────────
// Light is followed through Schwarzschild spacetime (units: rs = 1). Each
// photon moves in a plane; its path obeys the Binet equation
//   d²u/dφ² = −u + (3/2)u²,   u = 1/r,
// started from a static observer at r_obs with impact parameter
//   b = r sinα / √(1 − 1/r),  α = angle between the ray and the hole.
// Paths are tabulated once per observer radius; each pixel then looks up where
// its photon crosses the plane of the accretion disc (first, second, third
// image), or whether it falls in (black) or escapes to the stars.
//
// The disc (3 ≤ r ≤ 10, the inner edge at the last stable orbit) glows in the
// hole's own hue. Its light is shifted by g = √(1−1/r_e)/√(1−1/r_o) · δ, with
// δ the Doppler factor of Keplerian orbits (v = √(1/(2(r−1))) in the local
// static frame), and dims as g⁴. The approaching side is brighter and bluer.
//
// Nearer than the photon sphere (r < 1.5) the shadow covers more than half the
// sky; at r → 1 everything outside — stars and disc alike — is squeezed into a
// cone straight up of half-angle ≈ b_c·√(r−1), blueshifted by 1/√(1−1/r). The
// camera turns from the hole to that cone and zooms to keep it in sight.
class SchwarzschildView {
    constructor(hue) {
        this.hue = hue;
        this.bc = 3 * Math.sqrt(3) / 2;       // critical impact parameter
        this.rin = 3; this.rout = 10;
        this.beta = 7 * Math.PI / 180;        // observer a little above the disc plane
        this.n = [Math.sin(this.beta), Math.cos(this.beta), 0];
        this.NA = 640; this.H = 0.02; this.MAXPHI = 12;
        this.S = Math.ceil(this.MAXPHI / this.H) + 2;
        this.rows = new Float32Array(this.NA * this.S);
        this.ws = new Float32Array(this.NA * this.S);
        this.end = new Float32Array(this.NA);
        this.esc = new Float32Array(this.NA);
        this.bs = new Float32Array(this.NA);
        this.tableKey = null;
        this.canvas = document.createElement('canvas');
        this.base = this.hsl(hue, 0.9, 0.56);
    }

    hsl(h, s, l) {
        h /= 360;
        const f = n => {
            const k = (n + h * 12) % 12;
            return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        };
        return [f(0) * 255, f(8) * 255, f(4) * 255];
    }

    // Tabulate photon paths for the given observer and list of ray angles α.
    build(rObs, alphaOf, key) {
        if (this.tableKey === key) return;
        this.tableKey = key;
        const { NA, H, S, rows, ws, end, esc, bs } = this;
        const sq = Math.sqrt(Math.max(1e-30, 1 - 1 / rObs));
        const u0 = 1 / rObs;
        for (let i = 0; i < NA; i++) {
            const a = alphaOf(i);
            const b = rObs * Math.sin(a) / sq;
            bs[i] = b;
            const off = i * S;
            end[i] = 0; esc[i] = NaN;
            if (b < 1e-6) {                          // straight down or straight up
                if (a < Math.PI / 2) { end[i] = 0; } else { esc[i] = 0; end[i] = 0; }
                rows[off] = rObs; continue;
            }
            let u = u0;
            let w = Math.sqrt(Math.max(0, 1 / (b * b) - u * u * (1 - u))) * (a < Math.PI / 2 ? 1 : -1);
            let phi = 0, k = 0;
            rows[off] = 1 / u; ws[off] = w;
            const acc = x => -x + 1.5 * x * x;
            while (true) {
                // RK4 on (u, w)
                const k1u = w, k1w = acc(u);
                const k2u = w + 0.5 * H * k1w, k2w = acc(u + 0.5 * H * k1u);
                const k3u = w + 0.5 * H * k2w, k3w = acc(u + 0.5 * H * k2u);
                const k4u = w + H * k3w, k4w = acc(u + H * k3u);
                u += H / 6 * (k1u + 2 * k2u + 2 * k3u + k4u);
                w += H / 6 * (k1w + 2 * k2w + 2 * k3w + k4w);
                phi += H; k++;
                if (u >= 1) { end[i] = phi; rows[off + k] = 1; break; }             // through the horizon
                rows[off + k] = 1 / u; ws[off + k] = w;
                if (u < 1 / 60 && w < 0) {                                          // away to the stars
                    end[i] = phi; esc[i] = phi + Math.asin(Math.min(1, b * u)); break;
                }
                if (k >= S - 2) { end[i] = phi; break; }                            // circling the photon sphere
            }
        }
    }

    // Draws the canopy view into this.canvas (w × h) for the given state.
    // Draws the view into this.canvas (w × h). Antialiasing is temporal: each
    // frame is sampled at a slightly different sub-pixel offset and blended
    // into a running average, so edges and stars settle smooth at no extra
    // cost per frame. The disc's edges and the stars are soft by construction.
    render(w, h, st, time) {
        const c = this.canvas;
        if (c.width !== w || c.height !== h) {
            c.width = w; c.height = h; this.img = null;
            this.acc = new Float32Array(w * h * 3); this.fresh = true;
        }
        const ctx = c.getContext('2d');
        if (!this.img) this.img = ctx.createImageData(w, h);
        const data = this.img.data, acc = this.acc;
        this.frameNo = (this.frameNo || 0) + 1;
        const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
        const jx = halton(this.frameNo % 16 + 1, 2) - 0.5, jy = halton(this.frameNo % 16 + 1, 3) - 0.5;
        const keep = this.fresh ? 0 : 0.62;     // share of the running average kept each frame
        this.fresh = false;

        const x = st.logR1;                       // log10(r − 1)
        const rObs = 1 + Math.pow(10, x);
        const zenith = x < -1.6;                  // the outside is a narrow cone overhead
        const NA = this.NA, PI = Math.PI;
        let fovHalf, ac, rho = 0;

        if (!zenith) {
            this.build(rObs, i => i / (NA - 1) * PI, 'g' + x.toFixed(3));
            const sa = this.bc * Math.sqrt(1 - 1 / rObs) / rObs;
            const ash = rObs > 1.5 ? Math.asin(Math.min(1, sa)) : PI - Math.asin(Math.min(1, sa));
            ac = Math.max(0, Math.min(PI, (ash - 0.5) * 1.55));     // tilt up as the shadow grows
            fovHalf = 62 * PI / 180;
        } else {
            // In the limit r → 1 the image inside the cone depends only on
            // q = δ/δc, so one table, made just above the horizon, serves all.
            const rt = 1 + 1e-6;
            const dct = Math.asin(this.bc * Math.sqrt(1 - 1 / rt) / rt);
            this.build(rt, i => PI - (i / (NA - 1)) * 1.25 * dct, 'z');
            ac = PI;
            rho = st.rho;
        }
        const ca = Math.cos(ac), sa = Math.sin(ac);
        const C = [-ca, sa, 0], U = [sa, ca, 0], R = [0, 0, 1];
        const n = this.n, S = this.S, H = this.H;
        const { rows, ws, end, esc } = this;
        const gObs = st.gObs;                     // blueshift of everything outside, 1/√(1−1/r)
        const base = this.base, rin = this.rin, rout = this.rout;
        const skyTint = Math.min(1, Math.log10(gObs) / 4);
        const glowObs = Math.min(3, 1 + Math.log10(gObs) * 0.35);
        const aspect = h / w;
        const cb0 = Math.cos(this.beta), sb0 = Math.sin(this.beta);
        const smooth = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
        const CELL = 0.0055;

        // r along a row at angle φ, or −1 past the row's end
        const rAt = (row, phi) => {
            if (phi >= end[row]) return -1;
            const fi = phi / H, i0 = Math.floor(fi), fr = fi - i0, off = row * S;
            return rows[off + i0] * (1 - fr) + rows[off + i0 + 1] * fr;
        };

        let p = 0, q3 = 0;
        for (let py = 0; py < h; py++) {
            const ny = -((py + 0.5 + jy) / h * 2 - 1) * aspect;
            for (let px = 0; px < w; px++, p += 4, q3 += 3) {
                const nx = (px + 0.5 + jx) / w * 2 - 1;
                const rr = Math.hypot(nx, ny);
                let fa, e2y, e2z, outside = false;
                const tx = R[0] * nx + U[0] * ny, ty = R[1] * nx + U[1] * ny, tz = R[2] * nx + U[2] * ny;
                if (!zenith) {
                    const th = rr * fovHalf;
                    if (th > PI) outside = true;
                    const s = rr > 1e-9 ? Math.sin(th) / rr : 0, co = Math.cos(th);
                    const dx = C[0] * co + tx * s, dy = C[1] * co + ty * s, dz = C[2] * co + tz * s;
                    fa = Math.acos(Math.max(-1, Math.min(1, -dx))) / PI * (NA - 1);
                    const m = Math.hypot(dy, dz) || 1;
                    e2y = dy / m; e2z = dz / m;
                } else {
                    const qv = rr / rho;
                    if (qv > 1.25) outside = true;
                    fa = qv / 1.25 * (NA - 1);
                    const m = Math.hypot(ty, tz) || 1;
                    e2y = ty / m; e2z = tz / m;
                }
                let rC = 0, gC = 0, bC = 0;
                if (!outside) {
                    const r0 = Math.min(NA - 1, Math.floor(fa)), r1 = Math.min(NA - 1, r0 + 1), wr = fa - r0;
                    const row = wr < 0.5 ? r0 : r1;
                    // crossings of the disc plane: cosφ(n·e1) + sinφ(n·e2) = 0
                    const A = n[0], B = n[1] * e2y + n[2] * e2z;
                    let phi = Math.atan2(-A, B);
                    while (phi <= 1e-3) phi += PI;
                    let remain = 1;
                    for (let k = 0; k < 3 && remain > 0.01; k++, phi += PI) {
                        const ra = rAt(r0, phi), rb = rAt(r1, phi);
                        if (ra < 0 && rb < 0) break;
                        const r = ra < 0 ? rb : rb < 0 ? ra : ra * (1 - wr) + rb * wr;
                        const cover = smooth(rin, rin + 0.18, r) * (1 - smooth(rout - 1.6, rout, r)) * (ra < 0 || rb < 0 ? 0.5 : 1);
                        if (cover <= 0) continue;
                        const cph = Math.cos(phi), sph = Math.sin(phi);
                        const Px = cph, Py = sph * e2y, Pz = sph * e2z;
                        let vx = n[1] * Pz - n[2] * Py, vy = n[2] * Px - n[0] * Pz, vz = n[0] * Py - n[1] * Px;
                        const vm = Math.hypot(vx, vy, vz) || 1; vx /= vm; vy /= vm; vz /= vm;
                        const fi = Math.min(S - 2, Math.floor(phi / H));
                        const wv = ws[row * S + fi], rp = -r * r * wv;
                        let kx = -(rp * cph - r * sph), ky = -(rp * sph + r * cph) * e2y, kz = -(rp * sph + r * cph) * e2z;
                        const km = Math.hypot(kx, ky, kz) || 1; kx /= km; ky /= km; kz /= km;
                        const v = Math.sqrt(0.5 / (r - 1));
                        const gam = 1 / Math.sqrt(1 - v * v);
                        const dop = 1 / (gam * (1 - v * (vx * kx + vy * ky + vz * kz)));
                        const g = Math.sqrt(1 - 1 / r) * dop * gObs;
                        const az = Math.atan2(Pz, Px * cb0 - Py * sb0);
                        const om = time * 2.2 * Math.pow(r / 3, -1.5);
                        const streak = 0.62 + 0.24 * Math.sin(az * 6 + 7 * Math.log(r) - om) + 0.14 * Math.sin(az * 17 - 11 * r - om * 1.7);
                        const em = Math.pow(rin / r, 3) * (1 - Math.sqrt(rin / r) * 0.92) * 9 * streak;
                        const I = em * Math.min(1e3, Math.pow(Math.min(g, 6), 4)) / (1 + k * 0.6);
                        const L = 1 - Math.exp(-I * 1.6);
                        const lg = Math.log2(Math.max(1e-3, g));
                        let cr = base[0], cg = base[1], cbl = base[2];
                        if (lg > 0) { const m2 = Math.min(0.8, lg / 2.6); cr += (238 - cr) * m2; cg += (242 - cg) * m2; cbl += (255 - cbl) * m2; }
                        else { const m2 = Math.min(1, -lg / 1.8); cr += (255 - cr) * m2; cg += (50 - cg) * m2; cbl += (24 - cbl) * m2; }
                        const a = cover * remain;
                        rC += cr * L * a; gC += cg * L * a; bC += cbl * L * a;
                        remain *= 1 - cover;
                    }
                    if (remain > 0.01 && !isNaN(esc[row])) {
                        // escaped: the sky it came from — soft round stars, a faint band
                        const pf = esc[row], c2 = Math.cos(pf), s2 = Math.sin(pf);
                        const Sx = c2, Sy = s2 * e2y, Sz = s2 * e2z;
                        const lat = Math.asin(Math.max(-1, Math.min(1, Sx))), lon = Math.atan2(Sz, Sy);
                        const u = (lat + 1.6) / CELL, vv = (lon + PI) * Math.cos(lat) / CELL;
                        const ci = Math.floor(u), cj = Math.floor(vv);
                        let hsh = Math.sin(ci * 127.1 + cj * 311.7) * 43758.5453; hsh -= Math.floor(hsh);
                        let star = 0;
                        if (hsh < 0.02) {
                            let h2 = Math.sin(ci * 269.5 + cj * 183.3) * 43758.5453; h2 -= Math.floor(h2);
                            const du = u - ci - (0.25 + 0.5 * hsh / 0.02), dv = vv - cj - (0.25 + 0.5 * h2);
                            star = (0.3 + 0.7 * h2) * Math.exp(-(du * du + dv * dv) / 0.035);
                        }
                        const band = 0.09 * Math.exp(-Math.pow(Sx * 0.3 + Sy * 0.5 + Sz * 0.81, 2) / 0.03);
                        const lum = Math.min(1, (star + band + 0.015) * glowObs) * remain;
                        rC += (230 - 70 * skyTint) * lum; gC += (236 - 40 * skyTint) * lum; bC += 250 * lum;
                    }
                }
                acc[q3] = acc[q3] * keep + rC * (1 - keep);
                acc[q3 + 1] = acc[q3 + 1] * keep + gC * (1 - keep);
                acc[q3 + 2] = acc[q3 + 2] * keep + bC * (1 - keep);
                data[p] = acc[q3]; data[p + 1] = acc[q3 + 1]; data[p + 2] = acc[q3 + 2]; data[p + 3] = 255;
            }
        }
        ctx.putImageData(this.img, 0, 0);
        return c;
    }
}

// ── The score ───────────────────────────────────────────────────────────────
// Original music. An organ voice (sine partials at the first drawbar ratios),
// a long synthetic reverb, a minor progression that grows in register and
// weight, and a soft tick that speeds up with the home clock.
class HorizonScore {
    constructor() {
        this.on = !!(window.AudioMng && !AudioMng.muted);
        if (!this.on) return;
        AudioMng.init();
        this.ctx = AudioMng.context;
        if (!this.ctx) { this.on = false; return; }
        const ctx = this.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0.0001;
        this.out.connect(AudioMng.limiter || ctx.destination);

        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this.impulse(5.5);
        const wet = ctx.createGain(); wet.gain.value = 0.55;
        this.reverb.connect(wet); wet.connect(this.out);

        this.bus = ctx.createBiquadFilter();  // closes during the fall
        this.bus.type = 'lowpass';
        this.bus.frequency.value = 9000;
        this.bus.connect(this.out);
        this.bus.connect(this.reverb);

        this.voices = [];
        this.nextChord = 0;
        this.nextTick = 2.2;
        this.fell = false;
    }

    impulse(seconds) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const data = buf.getChannelData(c);
            for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
        }
        return buf;
    }

    start() {
        if (!this.on) return;
        this.t0 = this.ctx.currentTime + 0.05;
        this.out.gain.setValueAtTime(0.0001, this.t0);
        this.out.gain.exponentialRampToValueAtTime(1, this.t0 + 2.5);
        // [start s, length s, MIDI notes, level]
        const Am = [45, 52, 59, 60, 64], F = [41, 48, 52, 57, 59], C = [43, 48, 52, 55, 62], E = [40, 45, 47, 52, 57];
        const up = ch => ch.concat(ch.slice(2).map(n => n + 12));
        this.score = [
            [0.4, 3.6, Am, 0.05], [3.4, 3.6, F, 0.055], [6.4, 3.6, C, 0.06], [9.4, 4.6, E, 0.065],
            [13.6, 3.8, up(Am), 0.07], [17.0, 3.8, up(F), 0.075], [20.4, 3.8, up(C), 0.08], [23.8, 4.4, up(E).concat([69]), 0.09],
            [27.8, 6.4, [33, 45, 52, 57, 60, 64, 71], 0.09]        // the fall
        ];
    }

    mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

    organ(notes, at, len, level, fall) {
        const ctx = this.ctx;
        const partials = [[1, 1], [2, 0.55], [3, 0.3], [4, 0.2]];
        notes.forEach((m, i) => {
            const f = this.mtof(m);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(level / notes.length * (i === 0 ? 1.6 : 1), at + 1.3);
            g.gain.setValueAtTime(level / notes.length * (i === 0 ? 1.6 : 1), at + len - 0.2);
            g.gain.exponentialRampToValueAtTime(0.0001, at + len + 2.2);
            g.connect(this.bus);
            partials.forEach(([h, w]) => {
                if (f * h > 6000) return;
                const o = ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = f * h;
                o.detune.value = (Math.random() - 0.5) * 6;
                if (fall) o.detune.linearRampToValueAtTime(-1400, at + len); // gravitational redshift
                const pg = ctx.createGain(); pg.gain.value = w;
                o.connect(pg); pg.connect(g);
                o.start(at); o.stop(at + len + 2.4);
                this.voices.push(o);
            });
        });
    }

    // A clock's tick-tock: two short wooden knocks, alternating pitch and side.
    // As the home clock races the knocks climb in pitch; in the fall they
    // stretch apart and sink — the clock seen through a redshift.
    tick(at, strength, pitch) {
        const ctx = this.ctx;
        this.tock = !this.tock;
        const f = (this.tock ? 1320 : 990) * pitch;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f * 1.6, at);
        o.frequency.exponentialRampToValueAtTime(f, at + 0.012);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.22 * strength, at + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        o.connect(g);
        if (pan) { pan.pan.value = this.tock ? -0.35 : 0.35; g.connect(pan); pan.connect(this.out); pan.connect(this.reverb); }
        else { g.connect(this.out); g.connect(this.reverb); }
        o.start(at); o.stop(at + 0.09);
    }

    // Called every frame with scene time and log10(home rate).
    update(t, logRate) {
        if (!this.on || this.cutAt) return;
        while (this.nextChord < this.score.length && this.score[this.nextChord][0] < t + 1) {
            const [s, len, notes, level] = this.score[this.nextChord];
            const fall = this.nextChord === this.score.length - 1;
            this.organ(notes, this.t0 + s, len, level, fall);
            if (fall) {
                this.bus.frequency.setValueAtTime(9000, this.t0 + s + 0.5);
                this.bus.frequency.exponentialRampToValueAtTime(180, this.t0 + s + len);
                this.out.gain.setValueAtTime(1, this.t0 + s + len - 1.5);
                this.out.gain.exponentialRampToValueAtTime(0.0001, this.t0 + s + len + 1);
            }
            this.nextChord++;
        }
        // The tick follows the home clock: about once a second at first, a
        // blur at the end of the hold; in the fall it slows, sinks and stops.
        // Never schedule into the past: after a skip or a hidden tab the
        // tick would otherwise try to catch up (and at absurd pitches).
        if (this.nextTick < t - 0.1) this.nextTick = t;
        if (t < 28) {
            const interval = Math.max(0.05, 0.9 / (1 + logRate * 0.6));
            while (this.nextTick < t + 0.25 && this.nextTick < 28) {
                this.tick(this.t0 + this.nextTick, 0.55 + logRate / 40, 1 + logRate / 22);
                this.nextTick += interval;
            }
        } else {
            while (this.nextTick < t + 0.25 && this.nextTick < 33.5) {
                const k = Math.max(0, Math.min(1, (this.nextTick - 28) / 5.5)); // 0→1 through the fall
                this.tick(this.t0 + this.nextTick, 0.9 * (1 - k), 2 * Math.pow(0.12, k));
                this.nextTick += 0.05 + 1.4 * k * k;
            }
        }
    }

    // Esc: let it all go quickly.
    cut() {
        if (!this.on) return;
        this.cutAt = this.ctx.currentTime;
        this.out.gain.cancelScheduledValues(this.cutAt);
        this.out.gain.setValueAtTime(this.out.gain.value || 0.5, this.cutAt);
        this.out.gain.exponentialRampToValueAtTime(0.0001, this.cutAt + 0.8);
    }

    // Waking: one open A major chord, bright and slowly fading.
    wake() {
        if (!this.on) return;
        const ctx = this.ctx, at = ctx.currentTime + 0.02;
        const g = ctx.createGain();
        g.gain.value = 1;
        g.connect(AudioMng.context === ctx && AudioMng.limiter ? AudioMng.limiter : ctx.destination);
        const verb = ctx.createConvolver(); verb.buffer = this.impulse(4);
        const wet = ctx.createGain(); wet.gain.value = 0.6;
        verb.connect(wet); wet.connect(g);
        [45, 52, 57, 61, 64, 69, 76].forEach((m, i) => {
            const o = ctx.createOscillator();
            o.type = i > 4 ? 'triangle' : 'sine';
            o.frequency.value = this.mtof(m);
            const v = ctx.createGain();
            v.gain.setValueAtTime(0.0001, at);
            v.gain.exponentialRampToValueAtTime(0.028, at + 0.05);
            v.gain.exponentialRampToValueAtTime(0.0001, at + 5.5);
            o.connect(v); v.connect(g); v.connect(verb);
            o.start(at); o.stop(at + 6);
        });
    }
}

window.NovaHorizon = new Horizon();
