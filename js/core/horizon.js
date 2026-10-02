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

    // log10 of how many home seconds pass per cockpit second.
    logRate(t) {
        const P = Horizon.P;
        const ease = x => x * x * (3 - 2 * x);
        if (t < P.inEnd) return 0;
        if (t < P.descentEnd) return 6 * ease((t - P.inEnd) / (P.descentEnd - P.inEnd));
        if (t < P.hoverEnd) return 6 + 16 * Math.pow((t - P.descentEnd) / (P.hoverEnd - P.descentEnd), 1.4);
        return 22;
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
        this.discTex = null;
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
        // Stars in the porthole sky, in unit-disc coordinates.
        this.viewStars = Array.from({ length: 140 }, () => {
            const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random());
            return { x: Math.cos(a) * d, y: Math.sin(a) * d, m: 0.4 + Math.random() * 0.6 };
        });
    }

    // A top-down accretion disc in this hole's colour, drawn once: a soft
    // annulus, white-hot at the inner edge, and hundreds of thin filaments.
    makeDiscTexture() {
        const N = 1024, c = document.createElement('canvas');
        c.width = c.height = N;
        const g = c.getContext('2d'), m = N / 2;
        const rin = N * 0.17, rout = N * 0.5;
        const base = g.createRadialGradient(m, m, rin, m, m, rout);
        base.addColorStop(0, `hsla(${this.hue}, 30%, 96%, 0.95)`);
        base.addColorStop(0.08, `hsla(${this.hue}, 95%, 72%, 0.75)`);
        base.addColorStop(0.45, `hsla(${this.hue}, 90%, 50%, 0.35)`);
        base.addColorStop(1, `hsla(${this.hue}, 90%, 40%, 0)`);
        g.fillStyle = base;
        g.beginPath(); g.arc(m, m, rout, 0, Math.PI * 2); g.arc(m, m, rin, 0, Math.PI * 2, true); g.fill('evenodd');
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 1400; i++) {
            const k = Math.pow(Math.random(), 1.7);            // denser toward the inside
            const r = rin + (rout - rin) * k;
            const a = Math.random() * Math.PI * 2, len = 0.15 + Math.random() * 1.6;
            const hot = 1 - k;
            g.strokeStyle = `hsla(${this.hue + (Math.random() - 0.5) * 18}, ${40 + 55 * k}%, ${55 + 40 * hot}%, ${0.04 + 0.22 * Math.random() * (0.4 + hot)})`;
            g.lineWidth = 0.6 + Math.random() * 2.4;
            g.beginPath(); g.arc(m, m, r, a, a + len); g.stroke();
        }
        g.strokeStyle = 'rgba(255,255,255,0.45)';           // innermost stable orbit
        g.lineWidth = 3;
        g.beginPath(); g.arc(m, m, rin + 2, 0, Math.PI * 2); g.stroke();
        this.discTex = c;
        this.layers = [document.createElement('canvas'), document.createElement('canvas')];
    }

    // Draws the disc as seen nearly edge-on, with the hole between its halves:
    // the far half and its lensed image (an arc thrown over the top of the
    // shadow, and a faint secondary arc under it) go behind the shadow, the
    // near half in front. The approaching side is brighter (Doppler beaming).
    drawDisc(ctx, W, H, cx, hy, sR, spin, fall, u) {
        if (!this.discTex) this.makeDiscTexture();
        const tex = this.discTex, T = tex.width;
        const [back, front] = this.layers;
        [back, front].forEach(l => { if (l.width !== W || l.height !== H) { l.width = W; l.height = H; } });
        const b = back.getContext('2d'), f = front.getContext('2d');
        b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
        f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, W, H);
        const D = sR * 7.6;                                   // disc diameter: inner edge (0.34·D/2) ≈ 1.3× the shadow
        const flat = 0.13;

        const flatDisc = (g, half) => {
            g.save();
            g.beginPath();
            if (half === 'far') g.rect(0, 0, W, hy); else g.rect(0, hy, W, H - hy);
            g.clip();
            g.translate(cx, hy); g.scale(1, flat); g.rotate(spin);
            g.drawImage(tex, -D / 2, -D / 2, D, D);
            g.restore();
        };
        // lensed images of the far side: almost circular arcs hugging the shadow
        const lensed = (g, top, scale, alpha) => {
            g.save();
            g.beginPath();
            if (top) g.rect(0, 0, W, hy); else g.rect(0, hy, W, H - hy);
            g.clip();
            g.globalAlpha = alpha;
            g.translate(cx, hy); g.scale(1, top ? 0.92 : 0.82); g.rotate(-spin);
            const L = sR * scale;
            g.drawImage(tex, -L / 2, -L / 2, L, L);
            g.restore();
        };
        b.globalCompositeOperation = 'lighter';
        lensed(b, true, 3.3, 0.85);
        lensed(b, false, 2.6, 0.35);
        flatDisc(b, 'far');
        f.globalCompositeOperation = 'lighter';
        flatDisc(f, 'near');

        // Doppler beaming and, in the fall, a deep red shift
        [b, f].forEach(g => {
            g.globalCompositeOperation = 'destination-in';
            const beam = g.createLinearGradient(cx - D / 2, 0, cx + D / 2, 0);
            beam.addColorStop(0, 'rgba(0,0,0,1)'); beam.addColorStop(0.5, 'rgba(0,0,0,0.75)'); beam.addColorStop(1, 'rgba(0,0,0,0.3)');
            g.fillStyle = beam; g.fillRect(0, 0, W, H);
            if (fall > 0) {
                g.globalCompositeOperation = 'source-atop';
                g.fillStyle = `rgba(150, 20, 8, ${0.75 * fall})`;
                g.fillRect(0, 0, W, H);
            }
            g.globalCompositeOperation = 'source-over';
        });

        const dim = 1 - 0.8 * fall;
        const glow = (layer) => {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.55 * dim;
            ctx.filter = `blur(${Math.round(14 * u)}px)`;
            ctx.drawImage(layer, 0, 0);
            ctx.filter = 'none';
            ctx.globalAlpha = dim;
            ctx.drawImage(layer, 0, 0);
            ctx.restore();
        };
        glow(back);
        // the shadow and its photon ring
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(cx, hy, sR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `hsla(${this.hue}, 60%, 85%, ${0.55 * dim})`;
        ctx.lineWidth = 1.3 * u;
        ctx.beginPath(); ctx.arc(cx, hy, sR * 1.025, 0, Math.PI * 2); ctx.stroke();
        glow(front);
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

    // Pilot's view: the canopy, the sky beyond it, and the dashboard below.
    // Outside, the sky is a disc overhead ringed by light skimming the photon
    // sphere; everything else is the shadow of the hole.
    drawView(t) {
        const P = Horizon.P;
        const ctx = this.view.getContext('2d');
        const W = this.view.width, H = this.view.height, u = W / 760;
        const hover = this.s(t, P.inEnd, P.hoverEnd);   // 0→1 while holding position
        const fall = this.s(t, P.hoverEnd, P.fallEnd);   // 0→1 in free fall
        const h = this.hud;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        const shake = (fall * 6 + this.s(t, P.hoverEnd - 4, P.hoverEnd) * 1.5) * u;
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

        // ── Through the canopy ──
        // Two things share the view. Above: the rest of the universe, squeezed
        // into a shrinking disc, blueshifted while we hold, reddened in the
        // fall. Below: the hole itself — its shadow grows until it fills the
        // canopy, wrapped in an accretion disc in this hole's own colour, its
        // far side lensed up over the top of the shadow.
        const skyH = H * 0.64, cx = W / 2;
        const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
        let col = mix([226, 232, 248], [150, 196, 255], hover);
        col = mix(col, [255, 92, 48], fall);
        const glow = (0.15 + 0.85 * hover) * (1 - 0.85 * fall);

        // the hole and its disc
        const grow = Math.pow(this.s(t, 0, P.hoverEnd), 1.6) + fall * 2.2;
        const hy = skyH * (0.92 - 0.12 * grow);
        const sR = W * (0.07 + 0.3 * grow);                 // shadow radius
        this.drawDisc(ctx, W, H, cx, hy, sR, t * 0.35, fall, u);

        // In the fall the shadow takes the whole view.
        if (fall > 0) {
            ctx.fillStyle = `rgba(0,0,0,${this.s(fall, 0.55, 1)})`;
            ctx.fillRect(0, 0, W, skyH + 30 * u);
        }

        // the universe overhead, drawn last: it stays visible to the end,
        // reddening and shrinking while the shadow swallows the rest
        const uy = skyH * (0.34 - 0.16 * hover);
        const UR = Math.min(W * 0.5, skyH * 0.62) * (1.05 - 0.85 * Math.pow(hover, 1.2)) * (1 - 0.92 * fall);
        if (UR > 0.5) {
            ctx.save();
            ctx.translate(cx, uy);
            ctx.scale(1 - 0.55 * fall, 1 + 1.6 * fall);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, UR);
            g.addColorStop(0, `rgba(${col},${0.08 + 0.45 * glow})`);
            g.addColorStop(0.8, `rgba(${col},${0.04 + 0.2 * glow})`);
            g.addColorStop(1, `rgba(${col},0)`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, UR, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgb(${col})`;
            this.viewStars.forEach(st => {
                ctx.globalAlpha = Math.min(1, st.m * (0.5 + glow));
                const size = (1 + glow * 1.4) * u;
                ctx.fillRect(st.x * UR - size / 2, st.y * UR - size / 2, size, size);
            });
            ctx.globalAlpha = 1;
            ctx.strokeStyle = `rgba(${col},${0.25 + 0.5 * glow})`;
            ctx.lineWidth = (1 + 1.6 * glow) * u;
            ctx.shadowColor = `rgba(${col},0.9)`; ctx.shadowBlur = 14 * glow * u;
            ctx.beginPath(); ctx.arc(0, 0, UR * 1.03, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // ── Canopy frame: top bow, two pillars, a faint glare ──
        const frame = '#0c0e15', edge = 'rgba(150,160,190,0.22)';
        ctx.fillStyle = frame;
        ctx.beginPath();                                   // left pillar
        ctx.moveTo(0, 0); ctx.lineTo(W * 0.13, 0); ctx.lineTo(W * 0.04, skyH + 20 * u); ctx.lineTo(0, skyH + 20 * u);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();                                   // right pillar
        ctx.moveTo(W, 0); ctx.lineTo(W * 0.87, 0); ctx.lineTo(W * 0.96, skyH + 20 * u); ctx.lineTo(W, skyH + 20 * u);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(0, 0, W, 10 * u);                     // top bow
        ctx.strokeStyle = edge; ctx.lineWidth = 1.5 * u;
        ctx.beginPath(); ctx.moveTo(W * 0.13, 10 * u); ctx.lineTo(W * 0.04, skyH + 20 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * 0.87, 10 * u); ctx.lineTo(W * 0.96, skyH + 20 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * 0.13, 10 * u); ctx.lineTo(W * 0.87, 10 * u); ctx.stroke();
        const glare = ctx.createLinearGradient(W * 0.2, 0, W * 0.45, skyH);
        glare.addColorStop(0, 'rgba(255,255,255,0.035)'); glare.addColorStop(0.5, 'rgba(255,255,255,0)');
        ctx.fillStyle = glare; ctx.fillRect(W * 0.1, 10 * u, W * 0.8, skyH);

        // ── Dashboard ──
        const top = skyH - 6 * u;
        ctx.fillStyle = '#10131b';
        ctx.beginPath();
        ctx.moveTo(0, top + 40 * u);
        ctx.quadraticCurveTo(W / 2, top - 24 * u, W, top + 40 * u);
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(170,180,210,0.18)'; ctx.lineWidth = 1.5 * u;
        ctx.beginPath(); ctx.moveTo(0, top + 40 * u); ctx.quadraticCurveTo(W / 2, top - 24 * u, W, top + 40 * u); ctx.stroke();

        const mono = s => `${Math.round(s * u)}px "JetBrains Mono", ui-monospace, monospace`;
        const dimText = 'rgba(170,180,205,0.75)';
        const panelY = top + 34 * u, panelH = H - panelY - 14 * u;

        // Dial helper: value 0..1 across a 240° sweep
        const dial = (x, y, r, v, label, valueText, warn) => {
            ctx.fillStyle = '#0a0c12'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(170,180,210,0.25)'; ctx.lineWidth = 1.2 * u; ctx.stroke();
            for (let i = 0; i <= 12; i++) {
                const a = (-210 + i * 20) * Math.PI / 180;
                const r1 = r * (i % 3 === 0 ? 0.72 : 0.8);
                ctx.strokeStyle = i >= 10 ? 'rgba(255,100,70,0.6)' : 'rgba(190,200,225,0.45)';
                ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
                ctx.lineTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88); ctx.stroke();
            }
            const a = (-210 + Math.max(0, Math.min(1, v)) * 240) * Math.PI / 180;
            ctx.strokeStyle = warn ? '#ff5a3c' : '#9fb6ff'; ctx.lineWidth = 2 * u;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); ctx.stroke();
            ctx.fillStyle = '#c9d2ea'; ctx.beginPath(); ctx.arc(x, y, 2.5 * u, 0, Math.PI * 2); ctx.fill();
            ctx.textAlign = 'center';
            ctx.fillStyle = dimText; ctx.font = mono(9); ctx.fillText(label, x, y + r * 0.5);
            ctx.fillStyle = warn ? '#ff6a4a' : '#e6ecff'; ctx.font = mono(11); ctx.fillText(valueText, x, y + r + 14 * u);
        };

        const dialR = Math.min(panelH * 0.38, 52 * u);
        const dy = panelY + panelH * 0.46;
        dial(W * 0.2, dy, dialR, h.lr / 22, 'HOME CLOCK', h.falling ? '— — —' : `×10${this.sup(Math.floor(h.lr))}`, h.falling);
        dial(W * 0.8, dy, dialR, h.thrust, 'THRUST', `${Math.round(h.thrust * 100)} %`, h.falling);

        // Centre screen: radius, spectrum shift, status
        const sw = W * 0.34, sh = panelH * 0.78, sx0 = W / 2 - sw / 2, sy0 = panelY + panelH * 0.06;
        ctx.fillStyle = '#060810';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx0, sy0, sw, sh, 6 * u) : ctx.rect(sx0, sy0, sw, sh); ctx.fill();
        ctx.strokeStyle = 'rgba(170,180,210,0.2)'; ctx.lineWidth = 1 * u; ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = dimText; ctx.font = mono(9);
        ctx.fillText('DISTANCE', sx0 + 12 * u, sy0 + 18 * u);
        ctx.fillStyle = h.falling ? '#ff6a4a' : '#e6ecff'; ctx.font = mono(13);
        ctx.fillText(h.radius, sx0 + 12 * u, sy0 + 36 * u);
        // spectrum bar: where the outside light sits, blue ← → red
        const bx = sx0 + 12 * u, by = sy0 + 50 * u, bw = sw - 24 * u, bh = 6 * u;
        const spec = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        spec.addColorStop(0, '#6b8cff'); spec.addColorStop(0.5, '#e8ecf8'); spec.addColorStop(1, '#ff4a2a');
        ctx.fillStyle = spec; ctx.fillRect(bx, by, bw, bh);
        const shift = 0.5 - 0.42 * hover + 0.9 * fall;
        ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * Math.min(1, shift) - 1.5 * u, by - 4 * u, 3 * u, bh + 8 * u);
        ctx.fillStyle = dimText; ctx.font = mono(9);
        ctx.fillText('BLUE', bx, by + bh + 13 * u);
        ctx.textAlign = 'right'; ctx.fillText('RED', bx + bw, by + bh + 13 * u);
        ctx.textAlign = 'left';
        ctx.fillStyle = h.falling ? '#ff6a4a' : '#9fb6ff'; ctx.font = mono(10);
        ctx.fillText(h.status.toUpperCase(), sx0 + 12 * u, sy0 + sh - 12 * u);

        // Indicator lights; the caution light blinks in free fall
        const lights = [['PWR', '#5ee08a', true], ['NAV', '#5ee08a', !h.falling], ['ENG', h.falling ? '#ff5a3c' : '#5ee08a', true],
                        ['CAUTION', '#ff5a3c', h.falling && Math.floor(t * 4) % 2 === 0]];
        lights.forEach(([name, c, on], i) => {
            const lx = W * 0.06 + i * 30 * u, ly = H - 22 * u;
            ctx.fillStyle = on ? c : 'rgba(120,130,150,0.25)';
            if (on) { ctx.shadowColor = c; ctx.shadowBlur = 8 * u; }
            ctx.beginPath(); ctx.arc(lx, ly, 3.2 * u, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(170,180,205,0.45)'; ctx.font = mono(9);
        ctx.fillText('SC-1 · SINGLE SEAT', W * 0.96, H - 18 * u);
        ctx.textAlign = 'left';
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
        // r/r_s creeps toward 1 while holding, then crosses it.
        const hold = this.s(t, P.inEnd, P.hoverEnd);
        const inside = falling && t > P.hoverEnd + 2;
        const thrust = falling ? Math.max(0, 0.45 - (t - P.hoverEnd) * 0.5) * (Math.random() < 0.3 ? 0 : 1) : 0.5 + 0.48 * hold;
        this.hud = {
            lr: falling ? 22 : lr,
            thrust,
            falling,
            radius: inside ? 'inside the horizon' : `r = ${(1 + Math.pow(10, -6 * hold) * 0.5).toFixed(8)} rs`,
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
        if (t < 28) {
            const interval = Math.max(0.05, 0.9 / (1 + logRate * 0.6));
            while (this.nextTick < t + 0.25 && this.nextTick < 28) {
                this.tick(this.t0 + this.nextTick, 0.55 + logRate / 40, 1 + logRate / 22);
                this.nextTick += interval;
            }
        } else {
            while (this.nextTick < t + 0.25 && this.nextTick < 33.5) {
                const k = (this.nextTick - 28) / 5.5;            // 0→1 through the fall
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
        g.connect(AudioMng.limiter || ctx.destination);
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
