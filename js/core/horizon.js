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
// dims. Then the engine gives out. Released from rest so near the horizon,
// the pilot still sees home light blueshifted ~10²¹× as the horizon passes;
// only inside does it slow, redden and dim toward the singularity (see
// fallState). The screen goes black, a flash — and the desktop is back, as
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

    unlockPhantoms() {
        try { localStorage.setItem('novaos_phantoms', '1'); } catch (e) { }
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
    // The descent and the hold last 38.2 s — the golden ratio's 0.382, ×100.
    // Everything before the fall is that one span, stretched evenly from the
    // original 28 s cut (K); the fall, darkness and waking keep their length.
    static get P() {
        const K = 38.2 / 28;
        return { K, inEnd: 2.5 * K, geomEnd: 11 * K, hoverEnd: 38.2, fallEnd: 44.2, darkEnd: 46.7, end: 49.7 };
    }

    // Where the craft is: x = log10(r − 1), r in units of rs. From r = 12 down
    // to just outside the photon sphere and the horizon, then holding ever
    // closer to it (r − 1 → 10⁻⁴⁴).
    logR1(t) {
        const P = Horizon.P;
        const ease = k => k * k * (3 - 2 * k);
        if (t < P.inEnd) return Math.log10(11);
        if (t < P.geomEnd) return Math.log10(11) + (-1.6 - Math.log10(11)) * ease((t - P.inEnd) / (P.geomEnd - P.inEnd));
        if (t < P.hoverEnd) return -1.6 - 42.4 * Math.pow((t - P.geomEnd) / (P.hoverEnd - P.geomEnd), 1.5);
        return -44;
    }

    // The flight console's outline (fractions of the view): top edge just
    // under the dash lip, wider toward the pilot.
    static get CONSOLE() { return [[0.32, 0.705], [0.68, 0.705], [0.71, 0.96], [0.29, 0.96]]; }

    // log10 of how many home seconds pass per cockpit second: for a static
    // observer, dt_home/dτ = 1/√(1 − rs/r).
    logRate(t) {
        const x = this.logR1(t);
        return -0.5 * (x - Math.log10(1 + Math.pow(10, x)));
    }

    // Free fall after the engine fails. The craft is released from rest at the
    // hold radius r₀ (energy per unit mass E = √(1 − rs/r₀) = 10^(−lr₀)), so
    // light from far away, arriving from overhead, is measured shifted by
    //   g = (E − √(E² − f)) / f,   f = 1 − rs/r.
    // At release g = 1/E (the hold value); at the horizon g = 1/(2E), still
    // ~10²¹; only inside, as f grows negative, does g fall as 1/√|f|, below 1
    // (red) once r < rs/2 and toward 0 at the singularity. Inside, r follows
    // the cycloid of a drop from the horizon: r = (1 + cos η)/2, with proper
    // time ∝ η + sin η, spread evenly over the cinematic fall.
    // k: fall progress 0→1. Returns { logG, r, x (log10(r−1) outside), inside }.
    fallState(k) {
        const lr0 = this.logRate(Horizon.P.hoverEnd);
        const OUT = 0.04;                          // a sliver of screen time to reach the horizon
        if (k <= OUT) {
            const sv = Math.max(0, 1 - k / OUT);   // f/E², 1 at release → 0 at the horizon
            const hh = sv < 1e-9 ? 0.5 : (1 - Math.sqrt(1 - sv)) / sv;
            return { logG: lr0 + Math.log10(hh), r: 1, x: this.logR1(Horizon.P.hoverEnd) + Math.log10(Math.max(sv, 1e-30)), inside: false };
        }
        const target = Math.PI * Math.min(1, (k - OUT) / (1 - OUT));
        let lo = 0, hi = Math.PI;                  // solve η + sin η = target
        for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (m + Math.sin(m) < target) lo = m; else hi = m; }
        const eta = (lo + hi) / 2;
        const r = Math.max(1e-6, (1 + Math.cos(eta)) / 2);
        const absF = 1 / r - 1;
        const lq = Math.log10(Math.max(absF, 1e-300)) + 2 * lr0;   // q = |f|/E²
        let logG;
        if (lq > 8) logG = -0.5 * Math.log10(absF);
        else { const q = Math.pow(10, lq); logG = lr0 + Math.log10((Math.sqrt(1 + q) - 1) / q); }
        return { logG, r, inside: true };
    }

    // log10 of the shift of home light as the pilot sees it, now.
    shiftNow(t) {
        const P = Horizon.P;
        return t < P.hoverEnd ? this.logRate(t) : this.fallState(this.s(t, P.hoverEnd, P.fallEnd)).logG;
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
        this.unlockPhantoms();

        this.buildDom();
        this.collectDesktop();
        this.planZoom();
        this.makeStars();
        this.rays = new SchwarzschildView(this.hue);
        this.lw = 420;
        this.msAvg = 0;
        this.qualityAt = 0;
        this.music = new HorizonScore();
        this.music.start();

        window.addEventListener('keydown', this.onKey, true);
        this.last = performance.now();
        this.nextDraw = this.last + 1000 / 60;
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
        if (this.rays) this.rays.dispose();
        this.rays = null;
        this.frameCache = null;
        // Detached canvases otherwise remain held by the singleton until the
        // next visit, including the full-screen high-DPI star/dust layer.
        for (const canvas of [this.sky, this.view]) {
            if (canvas) { canvas.width = 1; canvas.height = 1; }
        }
        this.sky = this.view = this.el = null;
        this.stars = this.dust = this.windows = this.chrome = null;
        this.music = null;
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
                        <small class="hz-clock__era"></small>
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
            era: root.querySelector('.hz-clock__era'),
            black: root.querySelector('.hz-black'),
            flash: root.querySelector('.hz-flash')
        };
        this.resize();
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.dpr = dpr;
        this.sky.width = Math.round(innerWidth * dpr);
        this.sky.height = Math.round(innerHeight * dpr);
        this.view.width = Math.max(1, Math.round(this.view.offsetWidth * dpr));
        this.view.height = Math.max(1, Math.round(this.view.offsetHeight * dpr));
    }

    // Everything at home that ages: windows, the island, the shelf, the cosmos.
    collectDesktop() {
        const rnd = (a, b) => a + Math.random() * (b - a);
        this.windows = [];
        if (window.WindowManager) {
            WindowManager.windows.forEach(w => {
                if (!w.el || w.el.dataset.minimized === 'true') return;
                this.save(w.el);
                // The window's opening animation holds opacity and transform
                // ('forwards') and would override the ageing below: switch it
                // off for the scene. Restoring the style replays it on waking.
                w.el.style.animation = 'none';
                w.el.style.opacity = '1';
                w.el.style.transform = 'none';
                const crack = document.createElement('div');
                crack.className = 'hz-crack';
                crack.innerHTML = this.crackSvg();
                w.el.appendChild(crack);
                this.windows.push({
                    el: w.el, crack,
                    // each ages a little out of step with the others
                    off: rnd(-0.4, 0.4), dx: rnd(-1, 1), rot: rnd(-6, 6), lastDust: 0
                });
            });
        }
        this.chrome = ['#nova-island-container', '#nova-shelf-container']
            .map(sel => document.querySelector(sel)).filter(Boolean)
            .map((el, i) => { this.save(el); return { el, off: i * 0.3, dy: i ? 1 : -1, lastDust: 0 }; });
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
        // Stars at home, each dying at its own log10(years). Only massive stars
        // explode, and they die young (~10⁷–10⁸·⁵ yr); sun-like and smaller
        // ones just fade, the red dwarfs last (up to ~10¹⁴ yr).
        this.stars = Array.from({ length: 170 }, () => {
            const massive = Math.random() < 0.12;
            return {
                x: Math.random() * W, y: Math.random() * H,
                r: massive ? 1.8 : Math.random() < 0.15 ? 1.4 : 0.9,
                death: massive ? 7 + Math.random() * 1.5 : 9.5 + Math.random() * 4.5,
                nova: massive,
                novaT: -1
            };
        });
    }

    // ── Loop ─────────────────────────────────────────────────────────────────
    frame(now) {
        // A 120/144 Hz display does not need twice as many photon images.
        // Keep the cinematic scene at ~60 rendered frames without busy waiting.
        if (now + 0.5 < this.nextDraw) { this.raf = requestAnimationFrame(this.frame); return; }
        this.nextDraw += 1000 / 60;
        if (this.nextDraw < now - 1000 / 60) this.nextDraw = now + 1000 / 60;
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        const P = Horizon.P;
        this.t += dt;
        const t = this.t;

        if (t < P.hoverEnd) this.homeSeconds += Math.pow(10, this.logRate(t)) * dt;
        else if (t < P.fallEnd) {
            // The clock keeps running at the measured shift — but over the fall's
            // real proper time, which is tiny: πGM/c³ ≈ 1.5·10⁻⁴ s from the
            // horizon in for 10 solar masses (and ~10⁻²⁶ s before it, from the
            // hold radius). So the home date barely moves after release.
            const fs = this.fallState(this.s(t, P.hoverEnd, P.fallEnd));
            if (fs.inside) this.homeSeconds += Math.pow(10, fs.logG) * dt * 1.55e-4 / (P.fallEnd - P.hoverEnd);
        }
        const years = this.homeSeconds / 3.15576e7;
        const ly = Math.log10(Math.max(years, 1e-9));

        this.ly = ly;
        this.music.update(t, this.shiftNow(t));
        if (!this.flashed) {
            this.zoomOut(t);
            this.updateHome(t, ly, dt);
            if (Math.round(this.view.offsetWidth * this.dpr) !== this.view.width || Math.round(this.view.offsetHeight * this.dpr) !== this.view.height) this.resize();
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

    // The desktop ages on the home clock, in stages anyone can name. ly is
    // log10 of home years, so each stage takes about as long on screen as the
    // clock needs to cross its span of years:
    //   10⁻² – 10¹·⁵ yr   colours fade
    //   10¹·⁵ – 10³ yr    glass cracks
    //   10³ – 10⁵ yr      frames give way: windows sag and slowly drift
    //   10⁵ – 10⁷ yr      windows turn to dust
    //   10⁶ – 10⁷·⁵ yr    the island and the shelf follow
    static era(ly) {
        if (ly < -2) return '';
        if (ly < 1.5) return 'colours fade';
        if (ly < 3) return 'glass cracks';
        if (ly < 5) return 'frames give way';
        if (ly < 7) return 'windows turn to dust';
        if (ly < 8.5) return 'massive stars explode';
        if (ly < 9.5) return 'the disc runs dry';
        if (ly < 13) return 'stars burn out';
        return 'the last red dwarfs fade';
    }

    updateHome(t, ly, dt) {
        const age = this.s(ly, -2, 1.5);
        const crack = this.s(ly, 1.5, 3);
        this.windows.forEach(w => {
            const l = ly - w.off;
            const sag = this.s(l, 3, 5);           // the frame gives way: a slow drift and settle
            const dust = this.s(l, 5, 7);          // and then it falls apart
            w.el.style.filter = `sepia(${0.85 * age}) saturate(${1 - 0.6 * age}) brightness(${1 - 0.3 * age - 0.25 * dust}) contrast(${1 - 0.2 * age}) blur(${(2.5 * dust).toFixed(2)}px)`;
            w.crack.style.opacity = crack * (1 - dust);
            w.el.style.translate = `${w.dx * 40 * sag}px ${70 * sag + 30 * dust}px`;
            w.el.style.rotate = `${w.rot * sag}deg`;
            w.el.style.scale = `${1 - 0.08 * dust}`;
            w.el.style.opacity = `${1 - dust}`;
            // dust is shed as the window crumbles, in step with it
            const n = Math.round((dust - w.lastDust) * 160);
            if (n > 0) { this.addDust(w.el.getBoundingClientRect(), n); w.lastDust = dust; }
        });
        this.chrome.forEach(c => {
            const l = ly - c.off;
            const sag = this.s(l, 4, 6), dust = this.s(l, 6, 7.5);
            c.el.style.filter = `sepia(${0.8 * age}) brightness(${1 - 0.3 * age}) blur(${(2 * dust).toFixed(2)}px)`;
            c.el.style.translate = `0 ${c.dy * (20 * sag + 20 * dust)}px`;
            c.el.style.opacity = `${1 - dust}`;
            const n = Math.round((dust - c.lastDust) * 90);
            if (n > 0 && c.el.firstElementChild) { this.addDust(c.el.firstElementChild.getBoundingClientRect(), n); c.lastDust = dust; }
        });
        if (this.indicators) this.indicators.style.opacity = `${1 - this.s(ly, 4, 6)}`;
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
                const R = 6 + 75 * Math.sqrt(k);
                const g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, R);
                g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k) * fade})`);
                g.addColorStop(0.3, `rgba(170,200,255,${0.6 * (1 - k) * fade})`);
                g.addColorStop(1, 'rgba(120,80,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(st.x, st.y, R, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(205,225,255,${0.38 * Math.sin(k * Math.PI) * fade})`;
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(st.x, st.y, R * 0.72, 0, Math.PI * 2); ctx.stroke();
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
        const sinceFall = Math.max(0, t - P.hoverEnd);
        const shake = h.falling ? 4.5 * Math.exp(-sinceFall * 1.6) + 0.22 * (1 - fall) : 0.22 * this.s(t, P.hoverEnd - 5, P.hoverEnd);
        // One damped craft shudder; the outside camera has its own angular drift.
        ctx.translate(Math.sin(t * 73) * shake * u, Math.sin(t * 91 + 1) * shake * u * 0.7);

        // ── Outside ──
        // The GPU shades at display resolution (with a pixel-budget cap).
        // The CPU fallback changes quality slowly, not every frame: this avoids
        // repeatedly reallocating buffers and making detail visibly breathe.
        let outside = null;
        if (fall < 1) {
            const lw = this.rays.gpu ? W : Math.round(this.lw), lh = Math.round(lw * H / W);
            const x = this.logR1(t), lr = this.logRate(t);
            const rho = 0.376 * Math.pow(0.1 / 0.376, this.s(t, P.geomEnd, P.hoverEnd));
            const t0 = performance.now();
            const ly = this.ly !== undefined ? this.ly : -9;
            const logG = Math.min(30, this.shiftNow(t));
            const img = this.rays.render(lw, lh, {
                logR1: x, logG, rho, fall,
                // gas orbits in home time; past a few radians a frame it blurs
                discTime: Math.min(this.homeSeconds, 1e4),
                smear: 2.2 * Math.pow(10, Math.max(0, Math.min(30, h.falling ? logG : lr))) / 60,
                // outside ages with the home clock: an accretion disc lasts
                // ~10⁷–10⁹ yr; stars dim out over ~10¹¹–10¹⁵ yr (the longest-
                // lived red dwarfs reach ~10¹³–10¹⁴), so a few remain to redden
                // in the fall
                discAlive: 1 - this.s(ly, 7, 9.5),
                starsAlive: 1 - this.s(ly, 11, 15.5)
            }, t);
            outside = img;
            const ms = performance.now() - t0;
            this.msAvg = this.msAvg ? this.msAvg * 0.9 + ms * 0.1 : ms;
            if (!this.rays.gpu && t > this.qualityAt) {
                if (this.msAvg > 13) this.lw = Math.max(280, this.lw - 40);
                else if (this.msAvg < 7) this.lw = Math.min(800, W, this.lw + 40);
                this.qualityAt = t + 0.75;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, W, H);
        }

        // ── The craft: a white wireframe cockpit ──
        ctx.drawImage(this.cockpitFrame(W, H, u), 0, 0);
        this.drawInstruments(ctx, W, H, u, t, outside);

        // ── Readouts, on the console ──
        this.drawConsole(ctx, W, H, u, t, fall);
    }

    // Distance and status on the left of the console; thrust and the shift of
    // the light from home on the right; a caution light when the engine fails.
    // The home clock stays in the top corner, as a head-up readout.
    drawConsole(ctx, W, H, u, t, fall) {
        const h = this.hud;
        const mono = (sz, w = 400) => `${w} ${Math.round(sz * u)}px "JetBrains Mono", ui-monospace, monospace`;
        const warn = '#ff937a', calm = 'rgba(235, 241, 255, 0.94)', dim = 'rgba(212, 224, 246, 0.62)';
        const alarm = h.falling || h.strain > 0.7;
        ctx.save();
        // left column
        // content block (~56u tall) centred in the console (y 0.705…0.96 of H)
        const lx = W * 0.335, top = H * 0.8325 - 34 * u;
        ctx.textAlign = 'left';
        ctx.fillStyle = dim; ctx.font = mono(8.5);
        ctx.fillText('DISTANCE', lx, top + 20 * u);
        ctx.fillStyle = h.falling ? warn : calm; ctx.font = mono(11.5, 500);
        ctx.fillText(h.radius, lx, top + 36 * u);
        ctx.fillStyle = alarm ? warn : dim; ctx.font = mono(8.5);
        ctx.fillText(h.status.toUpperCase(), lx, top + 52 * u);
        // right column
        const rx = W * 0.54, bw = W * 0.13;
        const bar = (y, label, v, colour) => {
            ctx.fillStyle = dim; ctx.font = mono(8.5);
            ctx.fillText(label, rx, y - 5 * u);
            ctx.fillStyle = 'rgba(235,240,255,0.15)'; ctx.fillRect(rx, y, bw, 2 * u);
            ctx.fillStyle = colour; ctx.fillRect(rx, y, bw * Math.max(0, Math.min(1, v)), 2 * u);
        };
        bar(top + 24 * u, `THRUST ${Math.round(h.thrust * 100)}%`, h.thrust, h.falling ? warn : calm);
        const shift = h.lr >= 0 ? 0.5 - 0.5 * Math.min(1, h.lr / 22) : 0.5 + 0.5 * Math.min(1, -h.lr / 1.5);
        ctx.fillStyle = dim; ctx.font = mono(8.5);
        ctx.fillText(h.lr > 0.13 ? 'LIGHT · BLUE' : h.lr < -0.13 ? 'LIGHT · RED' : 'LIGHT', rx, top + 46 * u);
        const sg = ctx.createLinearGradient(rx, 0, rx + bw, 0);
        sg.addColorStop(0, '#6b8cff'); sg.addColorStop(0.5, '#e8ecf8'); sg.addColorStop(1, '#ff4a2a');
        ctx.globalAlpha = 0.7; ctx.fillStyle = sg; ctx.fillRect(rx, top + 51 * u, bw, 2 * u); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.fillRect(rx + bw * shift - 1 * u, top + 48 * u, 2 * u, 8 * u);
        // caution light, top right of the console, only in the fall
        if (h.falling && Math.floor(t * 4) % 2 === 0) {
            ctx.fillStyle = warn; ctx.shadowColor = warn; ctx.shadowBlur = 10 * u;
            ctx.beginPath(); ctx.arc(W * 0.665, H * 0.705 + 12 * u, 3 * u, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
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
        // Every sill/strut foot lies on this same straight dash edge. Keeping
        // the joins derived avoids a bend that isn't attached to any member.
        const sillY = x => 0.8 - 0.14 * Math.min(x, 1 - x) / 0.385;
        const roofY = x => 0.04 + (x + 0.02) / 0.275 * 0.12;
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
        // A restrained dichroic coating: broad, transparent reflections on the
        // glass, and a narrow coloured bevel beside each white structural edge.
        const glass = g.createLinearGradient(W * 0.24, H * 0.1, W * 0.78, H * 0.8);
        glass.addColorStop(0, 'rgba(145,225,255,0.045)');
        glass.addColorStop(0.37, 'rgba(230,245,255,0.008)');
        glass.addColorStop(0.58, 'rgba(202,166,255,0.035)');
        glass.addColorStop(1, 'rgba(151,235,230,0.015)');
        poly([tl, tr, br, bl], glass);
        poly([P(0, 0.04), tl, bl, P(0, 0.8)], glass);
        poly([tr, P(1, 0.04), P(1, 0.8), br], glass);
        // overhead panel
        poly([P(-0.02, -0.02), P(1.02, -0.02), P(1.02, 0.04), tr, tl, P(-0.02, 0.04)], veil);
        // pillars (front pane edges), thick at the top, thinner at the dash
        poly([tl, P(0.255, 0.16), P(0.3675, sillY(0.3675)), bl], veil);
        poly([tr, P(0.745, 0.16), P(0.6325, sillY(0.6325)), br], veil);
        // side-pane struts from the overhead corners down to the sills
        // (they run from the overhead edge down to the dash lip, so they meet
        // the rest of the frame instead of floating across it)
        poly([P(0.085, roofY(0.085)), P(0.115, roofY(0.115)), P(0.055, sillY(0.055)), P(0.025, sillY(0.025))], veil);
        poly([P(0.915, roofY(0.085)), P(0.885, roofY(0.115)), P(0.945, sillY(0.945)), P(0.975, sillY(0.975))], veil);
        // dash: lip from the sides to the bottom of the front pane, console below
        poly([P(0, 0.8), bl, br, P(1, 0.8), P(1, 1), P(0, 1)], veil);
        // the flight console: the readouts live here, on a dark inset display
        const panel = Horizon.CONSOLE.map(([x, y]) => P(x, y));
        const panelGlass = g.createLinearGradient(0, H * 0.705, 0, H * 0.96);
        panelGlass.addColorStop(0, 'rgba(144,194,228,0.07)');
        panelGlass.addColorStop(1, 'rgba(8,14,24,0.6)');
        poly(panel, panelGlass);

        // edges
        g.lineCap = 'round'; g.lineJoin = 'round';
        const edge = (pts, a, w) => {
            g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
            const tint = g.createLinearGradient(0, 0, W, H);
            tint.addColorStop(0, `rgba(123,219,255,${a * 0.45})`);
            tint.addColorStop(0.48, `rgba(207,179,255,${a * 0.3})`);
            tint.addColorStop(1, `rgba(144,241,221,${a * 0.4})`);
            g.strokeStyle = tint; g.lineWidth = (w + 2) * u; g.stroke();
            g.strokeStyle = `rgba(235, 240, 255, ${a})`; g.lineWidth = w * u; g.stroke();
        };
        edge([tl, tr, br, bl, tl], 0.9, 1.3);                                  // front pane
        edge([P(0.255, 0.16), P(0.3675, sillY(0.3675))], 0.7, 1.1);
        edge([P(0.745, 0.16), P(0.6325, sillY(0.6325))], 0.7, 1.1);
        edge([P(-0.02, 0.04), [tl[0] - pw * W, tl[1] - 0.01 * H]], 0.7, 1.1);  // overhead
        edge([P(1.02, 0.04), [tr[0] + pw * W, tr[1] - 0.01 * H]], 0.7, 1.1);
        edge([P(0.1, roofY(0.1)), P(0.04, sillY(0.04))], 0.6, 1.1);           // side struts
        edge([P(0.9, roofY(0.1)), P(0.96, sillY(0.96))], 0.6, 1.1);
        edge([P(0, 0.8), bl, br, P(1, 0.8)], 0.8, 1.2);                      // unbroken dash lip
        edge([...panel, panel[0]], 0.65, 0.9);                               // inset flight console
        edge([P(0.5225, 0.725), P(0.5225, 0.935)], 0.22, 0.7);              // its two columns
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
        // The console is a physical dark inset, not another window: exterior
        // light should not show straight through its instrument display.
        g.globalCompositeOperation = 'destination-over';
        poly(panel, 'rgba(4, 8, 16, 0.78)');
        g.globalCompositeOperation = 'source-over';
        this.frameCache = c;
        return c;
    }

    drawInstruments(ctx, W, H, u, t, outside) {
        const h = this.hud;
        // Faint live ghost reflections in the oblique side panes. Reuse the
        // already-shaded image: no second ray trace, framebuffer or bloom pass.
        // The forward pane remains clear; the moving highlight is a coating,
        // not a second bright black hole floating over the pilot's view.
        if (outside) {
            ctx.save(); ctx.beginPath();
            ctx.moveTo(0, H * 0.06); ctx.lineTo(W * 0.255, H * 0.16);
            ctx.lineTo(W * 0.3675, H * (0.8 - 0.14 * 0.3675 / 0.385)); ctx.lineTo(0, H * 0.8); ctx.closePath();
            ctx.moveTo(W, H * 0.06); ctx.lineTo(W * 0.745, H * 0.16);
            ctx.lineTo(W * 0.6325, H * (0.8 - 0.14 * 0.3675 / 0.385)); ctx.lineTo(W, H * 0.8); ctx.closePath();
            ctx.clip();
            ctx.globalAlpha = 0.035 + 0.012 * Math.sin(t * 0.37);
            ctx.translate(W, 0); ctx.scale(-1, 1);
            ctx.drawImage(outside, -W * 0.08 + W * 0.025 * Math.sin(t * 0.18), H * 0.025, W * 1.16, H * 0.94);
            ctx.restore();
        }
        // The four existing overhead panels wake gradually as the engine
        // works harder. A short, deterministic dropout is a warning, not noise
        // on the home clock (which remains an honest physics readout).
        const pulse = h.dropout ? 0.2 : 1;
        const warm = h.strain;
        for (let i = 0; i < 4; i++) {
            const x = (0.33 + i * 0.087) * W;
            const level = Math.max(0, Math.min(1, h.thrust * 1.2 - i * 0.17));
            ctx.fillStyle = h.falling || (warm > 0.65 && i > 1) ? `rgba(255,139,110,${0.24 * pulse})` : `rgba(163,215,255,${0.12 * pulse})`;
            ctx.fillRect(x + 5 * u, H * 0.095, W * 0.06 * level, 2 * u);
        }
        // A changing reflection, faint and clipped to the front pane. It lends
        // the frame glassiness without bloom/post-processing on the ray image.
        ctx.save();
        ctx.beginPath(); ctx.moveTo(W * 0.29, H * 0.17); ctx.lineTo(W * 0.71, H * 0.17);
        ctx.lineTo(W * 0.615, H * 0.66); ctx.lineTo(W * 0.385, H * 0.66); ctx.closePath(); ctx.clip();
        const x = W * (0.36 + 0.035 * Math.sin(t * 0.22));
        const sheen = ctx.createLinearGradient(x, 0, x + W * 0.16, H * 0.2);
        sheen.addColorStop(0, 'rgba(190,230,255,0)');
        const glint = Math.exp(-Math.pow((t - 29.5) / 2.3, 2)) * 0.018;
        sheen.addColorStop(0.5, `rgba(${h.falling ? '255,189,159' : '196,220,255'},${(0.015 + warm * 0.016 + glint) * (1 - this.s(t, Horizon.P.hoverEnd, Horizon.P.fallEnd))})`);
        sheen.addColorStop(1, 'rgba(219,198,255,0)');
        ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    updateCockpit(t, years, ly) {
        const P = Horizon.P;
        const falling = t >= P.hoverEnd;
        const lr = this.logRate(t);
        const fs = falling ? this.fallState(this.s(t, P.hoverEnd, P.fallEnd)) : null;
        const shift = falling ? fs.logG : lr;
        // The home clock stays an honest readout in the fall too: light from
        // home keeps arriving, shifted by g, so the clock is seen running ×g.
        this.el.clock.textContent = this.formatHome(years);
        const era = Horizon.era(ly);
        if (this.el.era.textContent !== era) this.el.era.textContent = era;
        this.el.rate.textContent = shift >= 1 ? `running ×10${this.sup(Math.floor(shift))}`
            : shift > 0.13 ? `running ×${Math.pow(10, shift).toFixed(1)}`
            : shift > -0.13 ? 'running normally' : `running ×${Math.pow(10, shift).toPrecision(2)}`;
        if (falling && !this.el.cockpit.classList.contains('is-falling')) {
            this.el.cockpit.classList.add('is-falling');
            const title = this.root.querySelector('.hz-title');
            if (title) title.textContent = 'Single-seat craft · falling';
        }
        const hold = this.s(t, P.inEnd, P.hoverEnd);
        const inside = falling && fs.inside;
        const x = falling && !inside ? fs.x : this.logR1(t);
        const radius = inside ? `r = ${fs.r.toFixed(3)} rs`
            : x > -3 ? `r = ${(1 + Math.pow(10, x)).toFixed(5)} rs` : `r = (1 + 10${this.sup(Math.round(x))}) rs`;
        const strain = this.s(t, P.geomEnd + 3, P.hoverEnd);
        const dropout = !falling && ((t > 25.1 && t < 25.3) || (t > 32.7 && t < 33.05) || (t > 36.5 && t < 36.95));
        const thrust = falling ? Math.max(0, 0.45 - (t - P.hoverEnd) * 0.5) * (Math.sin(t * 37) > -0.3 ? 1 : 0) : (0.5 + 0.48 * hold) * (dropout ? 0.84 : 1);
        this.hud = {
            lr: shift,
            thrust,
            falling,
            strain, dropout,
            radius,
            status: falling ? (inside ? 'inside the horizon' : 'engine failure') : dropout ? 'thrust instability' : strain > 0.7 ? 'holding · engine at limit' : t < P.geomEnd ? 'descending' : 'holding position'
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
        const k = this.s(t, 1.5 * Horizon.P.K, Horizon.P.geomEnd);
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
        const root = this.root;
        this.el.flash.classList.add('is-on');
        this.music.wake();
        setTimeout(() => {
            if (this.root !== root) return;
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
    // Camera geometry only: how strongly the fall's aberration spreads the
    // overhead cone on screen. Frequencies come from Horizon.fallState().
    static fallBoost(k) {
        const velocity = 0.995 * k * k * (3 - 2 * k);
        return Math.sqrt((1 + velocity) / (1 - velocity));
    }

    constructor(hue) {
        this.hue = hue;
        this.bc = 3 * Math.sqrt(3) / 2;       // critical impact parameter
        this.rin = 3; this.rout = 10;
        this.beta = 7 * Math.PI / 180;        // observer a little above the disc plane
        this.n = [Math.sin(this.beta), Math.cos(this.beta), 0];
        this.NA = 1024; this.H = 0.02; this.MAXPHI = 12;
        this.S = Math.ceil(this.MAXPHI / this.H) + 2;
        this.rows = new Float32Array(this.NA * this.S);
        this.ws = new Float32Array(this.NA * this.S);
        this.end = new Float32Array(this.NA);
        this.esc = new Float32Array(this.NA);
        this.bs = new Float32Array(this.NA);
        this.tableKey = null;
        this.canvas = document.createElement('canvas');
        this.base = this.hsl(hue, 0.9, 0.56);
        try { this.gpu = new HorizonGPU(this); }
        catch (e) { this.gpu = null; } // Safari without WebGL2 / disabled acceleration
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

    prepare(st) {
        const x = st.logR1;                       // log10(r − 1)
        const rObs = 1 + Math.pow(10, x);
        const zenith = x < -1.6;                  // the outside is a narrow cone overhead
        const NA = this.NA, PI = Math.PI;
        let ac;
        if (!zenith) {
            this.build(rObs, i => i / (NA - 1) * PI, 'g' + x.toFixed(3));
            const sa = this.bc * Math.sqrt(1 - 1 / rObs) / rObs;
            const ash = rObs > 1.5 ? Math.asin(Math.min(1, sa)) : PI - Math.asin(Math.min(1, sa));
            ac = Math.max(0, Math.min(PI, (ash - 0.5) * 1.55));     // tilt up as the shadow grows
        } else {
            // In the limit r → 1 the image inside the cone depends only on
            // q = δ/δc, so one table, made just above the horizon, serves all.
            const rt = 1 + 1e-6;
            const dct = Math.asin(this.bc * Math.sqrt(1 - 1 / rt) / rt);
            this.build(rt, i => PI - (i / (NA - 1)) * 1.25 * dct, 'z');
            ac = PI;
        }
        return { zenith, ac };
    }

    // Starlight colour: blue-white when blueshifted (tint > 0), toward deep
    // red when redshifted (tint < 0). A compressed false colour, as for the disc.
    skyColour(tint) {
        if (tint >= 0) return [230 - 70 * tint, 236 - 40 * tint, 250];
        const k = Math.min(1, -tint * 2.7);
        return [230 + 25 * k, 236 - 150 * k, 250 - 200 * k];
    }

    dispose() {
        if (this.gpu) this.gpu.dispose();
        this.gpu = null;
        this.img = null;
        this.skySamples = this.starLayers = null;
    }

    // CPU mirror of the GPU's two fixed angular star populations. Cache cells
    // once, not nine procedural hashes per pixel on a low-powered device.
    makeStarLayer(cell, density, bright) {
        const nx = Math.ceil(3.2 / cell) + 3, ny = Math.ceil(2 * Math.PI / cell) + 3;
        const points = new Float32Array(nx * ny * 3);
        const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
        for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) {
            const a = x - 1, b = y - 1, seed = hash(a, b), i = (x * ny + y) * 3;
            if (seed >= density) continue;
            const seed2 = hash(a + 39.7, b + 39.7);
            points[i] = a + 0.2 + 0.6 * seed / density;
            points[i + 1] = b + 0.2 + 0.6 * seed2;
            points[i + 2] = bright ? 160 + 880 * Math.pow(seed2, 8) : 0.5 + seed2;
        }
        const variance = Math.pow(0.00072 / cell, 2);
        return { cell, nx, ny, points, variance, mean: 2 * Math.PI * variance * density * (bright ? 160 + 880 / 9 : 1) };
    }

    starLight(layer, a, b, dx, dy) {
        const u = a / layer.cell, v = b / layer.cell;
        const fx = Math.max(0.00027, dx) / layer.cell, fy = Math.max(0.00027, dy) / layer.cell;
        let unresolved = Math.max(0, Math.min(1, (Math.max(fx, fy) - 0.65) / 0.85));
        unresolved *= unresolved * (3 - 2 * unresolved);
        if (unresolved >= 1) return layer.mean;
        const vx = layer.variance + fx * fx / 12, vy = layer.variance + fy * fy / 12;
        const energy = layer.variance / Math.sqrt(vx * vy);
        const ix = Math.floor(u) + 1, iy = Math.floor(v) + 1;
        let light = 0;
        for (let x = ix - 1; x <= ix + 1; x++) for (let y = iy - 1; y <= iy + 1; y++) {
            if (x < 0 || y < 0 || x >= layer.nx || y >= layer.ny) continue;
            const i = (x * layer.ny + y) * 3, peak = layer.points[i + 2];
            if (!peak) continue;
            const du = u - layer.points[i], dv = v - layer.points[i + 1];
            const exponent = -0.5 * (du * du / vx + dv * dv / vy);
            if (exponent > -16) light += peak * energy * Math.exp(exponent);
        }
        return light * (1 - unresolved) + layer.mean * unresolved;
    }

    render(w, h, st, time) {
        const camera = this.prepare(st);
        if (this.gpu) {
            const img = this.gpu.render(this, w, h, st, time, camera);
            if (img) return img;
            this.gpu.dispose(); this.gpu = null;
            // A lost context must not turn a high-DPI request into a huge CPU job.
            const ratio = h / w; w = Math.min(w, 420); h = Math.round(w * ratio);
        }
        const cpuScale = Math.min(1, 800 / w, Math.sqrt(500000 / (w * h)));
        w = Math.max(1, Math.round(w * cpuScale)); h = Math.max(1, Math.round(h * cpuScale));
        const c = this.canvas;
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; this.img = null; }
        const ctx = c.getContext('2d');
        if (!this.img) {
            this.img = ctx.createImageData(w, h);
            this.skySamples = new Float32Array(w * h * 3);
        }
        const data = this.img.data;
        const sky = this.skySamples;
        sky.fill(0);
        if (!this.starLayers) this.starLayers = [this.makeStarLayer(0.018, 0.1, false), this.makeStarLayer(0.25, 0.5, true)];
        // Stable spatial samples: there is no history to ghost moving gas.
        const jx = 0, jy = 0;
        const { zenith, ac } = camera;
        const NA = this.NA, PI = Math.PI, fovHalf = 62 * PI / 180;
        const falling = st.fall || 0;
        const boost = SchwarzschildView.fallBoost(falling);
        const roll = 0.1 * falling * falling, rollC = Math.cos(roll), rollS = Math.sin(roll);
        const rho = st.rho;
        const ca = Math.cos(ac), sa = Math.sin(ac);
        const C = [-ca, sa, 0], U = [sa, ca, 0], R = [0, 0, 1];
        const n = this.n, S = this.S, H = this.H;
        const { rows, ws, end, esc } = this;
        // logG: log10 of the shift of light arriving from far away (home), as
        // measured by the pilot: 1/√(1−rs/r) while holding, then the free-fall
        // value from Horizon.fallState(). The aberration boost above only bends
        // directions (a cinematic camera); it no longer touches frequencies.
        const logG = st.logG !== undefined ? st.logG : Math.log10(st.gObs);
        const gObs = Math.pow(10, Math.min(30, logG));
        const dimG = logG < 0 ? Math.pow(10, 4 * logG) : Math.min(2, 1 + logG * 0.12); // I ∝ g⁴ once it goes red
        const starsAlive = st.starsAlive !== undefined ? st.starsAlive : 1;
        const discAlive = st.discAlive !== undefined ? st.discAlive : 1;
        const discTime = st.discTime !== undefined ? st.discTime : time;
        const smear = st.smear || 0;
        const base = this.base, rin = this.rin, rout = this.rout;
        const skyTint = Math.max(-1, Math.min(1, logG / 4));
        const aspect = h / w;
        const cb0 = Math.cos(this.beta), sb0 = Math.sin(this.beta);
        const smooth = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };

        // r along a row at angle φ, or −1 past the row's end
        const rAt = (row, phi) => {
            if (phi >= end[row]) return -1;
            const fi = phi / H, i0 = Math.floor(fi), fr = fi - i0, off = row * S;
            return rows[off + i0] * (1 - fr) + rows[off + i0 + 1] * fr;
        };

        let p = 0;
        for (let py = 0; py < h; py++) {
            const sy = -((py + 0.5 + jy) / h * 2 - 1) * aspect - 0.06 * falling * falling;
            for (let px = 0; px < w; px++, p += 4) {
                const sx = (px + 0.5 + jx) / w * 2 - 1 + 0.075 * Math.sin(falling * 1.8);
                const nx = sx * rollC + sy * rollS, ny = -sx * rollS + sy * rollC;
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
                    const qv = 2 * Math.atan(Math.tan(rr * 0.54) / boost) / (rho * 1.08);
                    if (qv > 1.25 || rr * 0.54 >= PI / 2) outside = true;
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
                        // Photon direction in the local static frame: the radial
                        // component is dr/dφ divided by √(1−1/r), not dr/dφ itself.
                        const wv = ws[row * S + fi], rp = -r * r * wv / Math.sqrt(1 - 1 / r);
                        let kx = -(rp * cph - r * sph), ky = -(rp * sph + r * cph) * e2y, kz = -(rp * sph + r * cph) * e2z;
                        const km = Math.hypot(kx, ky, kz) || 1; kx /= km; ky /= km; kz /= km;
                        const v = Math.sqrt(0.5 / (r - 1));
                        const gam = 1 / Math.sqrt(1 - v * v);
                        const dop = 1 / (gam * (1 - v * (vx * kx + vy * ky + vz * kz)));
                        const az = Math.atan2(Pz, Px * cb0 - Py * sb0);
                        // The gas orbits in home time. Once it turns more than a
                        // few radians per frame its structure averages out.
                        const kep = Math.pow(r / 3, -1.5), om = discTime * 2.2 * kep;
                        const sharp = 1 - smooth(0.6, 3, smear * kep);
                        const streak = 0.58 + sharp * (0.23 * Math.sin(az * 6 + 7 * Math.log(r) - om) + 0.13 * Math.sin(az * 17 - 11 * r - om * 1.7) + 0.06 * Math.sin(az * 31 + 36 * Math.log(r) - om * 2.3));
                        const em = Math.pow(rin / r, 3) * (1 - Math.sqrt(rin / r) * 0.92) * 9 * streak * discAlive;
                        const localG = Math.sqrt(1 - 1 / r) * dop;
                        const I = em * Math.pow(localG, 4) * dimG / (1 + k * 0.6);
                        const L = 1 - Math.exp(-I * 4);
                        const lg = Math.log2(Math.max(1e-3, localG)) + Math.max(-6, Math.min(4.5, logG * 0.60));
                        let cr = base[0], cg = base[1], cbl = base[2];
                        if (lg > 0) { const m2 = Math.min(0.85, lg / 3.6); cr += (199 - cr) * m2; cg += (224 - cg) * m2; cbl += (255 - cbl) * m2; }
                        else { const m2 = Math.min(1, -lg / 1.8); cr += (255 - cr) * m2; cg += (50 - cg) * m2; cbl += (24 - cbl) * m2; }
                        const a = cover * remain;
                        rC += cr * L * a; gC += cg * L * a; bC += cbl * L * a;
                        remain *= 1 - cover;
                    }
                    if (remain > 0.01 && (Number.isFinite(esc[r0]) || Number.isFinite(esc[r1]))) {
                        const e0 = esc[r0], e1 = esc[r1];
                        const pf = !Number.isFinite(e0) ? e1 : !Number.isFinite(e1) ? e0 : e0 * (1 - wr) + e1 * wr;
                        const coverage = !Number.isFinite(e0) ? wr : !Number.isFinite(e1) ? 1 - wr : 1;
                        const c2 = Math.cos(pf), s2 = Math.sin(pf);
                        const Sx = c2, Sy = s2 * e2y, Sz = s2 * e2z;
                        const lat = Math.asin(Math.max(-1, Math.min(1, Sx))), lon = Math.atan2(Sz, Sy);
                        const band = 0.045 * starsAlive * Math.exp(-Math.pow(Sx * 0.3 + Sy * 0.5 + Sz * 0.81, 2) / 0.03);
                        const lum = (band + 0.008) * remain * coverage * Math.min(1, dimG);
                        const [sr, sg, sb] = this.skyColour(skyTint);
                        rC += sr * lum; gC += sg * lum; bC += sb * lum;
                        const si = (py * w + px) * 3;
                        sky[si] = lat + 1.6; sky[si + 1] = (lon + PI) * Math.cos(lat);
                        sky[si + 2] = remain * coverage;
                    }
                }
                const fade = 1 - smooth(0.9, 1, falling);   // only the very end; the physics dims the rest
                data[p] = rC * fade; data[p + 1] = gC * fade; data[p + 2] = bC * fade; data[p + 3] = 255;
            }
        }
        const exposure = (1.4 + 1.1 * Math.max(0, Math.min(1, logG / 5))) * Math.min(1, dimG) * starsAlive;
        const fade = 1 - smooth(0.9, 1, falling);
        const [skyR, skyGc, skyB] = this.skyColour(skyTint);
        const defaultFootprint = zenith ? 2 * PI / (rho * boost * w) : 2 * fovHalf / w;
        // Finite differences of the actual escaped rays provide the pixel's
        // angular footprint. Do this after mapping, so both CPU and GPU retain
        // subpixel light and suppress aliasing in the tightly compressed cone.
        for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
            const i = (py * w + px) * 3;
            if (sky[i + 2] <= 0) continue;
            const right = px < w - 1 ? i + 3 : i - 3, up = py < h - 1 ? i + w * 3 : i - w * 3;
            const validX = sky[right + 2] > 0, validY = sky[up + 2] > 0;
            const dx = (validX ? Math.abs(sky[right] - sky[i]) : defaultFootprint) + (validY ? Math.abs(sky[up] - sky[i]) : defaultFootprint);
            const circumference = 2 * PI * Math.cos(sky[i] - 1.6);
            const lonX = validX ? Math.abs(sky[right + 1] - sky[i + 1]) : defaultFootprint;
            const lonY = validY ? Math.abs(sky[up + 1] - sky[i + 1]) : defaultFootprint;
            const dy = (validX ? Math.min(lonX, Math.abs(circumference - lonX)) : lonX)
                + (validY ? Math.min(lonY, Math.abs(circumference - lonY)) : lonY);
            let stars = 0;
            for (const layer of this.starLayers) stars += this.starLight(layer, sky[i], sky[i + 1], dx, dy);
            const light = Math.min(1, stars * exposure) * sky[i + 2] * fade, p = (py * w + px) * 4;
            data[p] += skyR * light; data[p + 1] += skyGc * light; data[p + 2] += skyB * light;
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
        const P = Horizon.P, K = P.K;
        this.score = [
            [0.4, 3.6, Am, 0.05], [3.4, 3.6, F, 0.055], [6.4, 3.6, C, 0.06], [9.4, 4.6, E, 0.065],
            [13.6, 3.8, up(Am), 0.07], [17.0, 3.8, up(F), 0.075], [20.4, 3.8, up(C), 0.08], [23.8, 4.4, up(E).concat([69]), 0.09]
        ].map(([at, len, notes, lv]) => [at * K, len * K, notes, lv]);
        this.score.push([P.hoverEnd - 0.2, 6.4, [33, 45, 52, 57, 60, 64, 71], 0.09]);   // the fall
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
        const P = Horizon.P, H = P.hoverEnd, F = P.fallEnd - 0.5;
        if (t < H) {
            const interval = Math.max(0.05, 0.9 / (1 + logRate * 0.6));
            while (this.nextTick < t + 0.25 && this.nextTick < H) {
                this.tick(this.t0 + this.nextTick, 0.55 + logRate / 40, 1 + logRate / 22);
                this.nextTick += interval;
            }
        } else {
            // In the fall the clock is heard as the light is shifted: still a
            // blur until the horizon, then slowing toward a single tick a
            // second, then lower and slower as the light goes red.
            while (this.nextTick < t + 0.25 && this.nextTick < F) {
                const k = Math.max(0, Math.min(1, (this.nextTick - H) / (F - H)));
                const g = Math.max(-1.2, Math.min(1.3, logRate));
                this.tick(this.t0 + this.nextTick, 0.9 * (1 - 0.7 * k), Math.pow(2, g * 0.8));
                this.nextTick += Math.max(0.05, 0.9 / Math.pow(10, g));
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
