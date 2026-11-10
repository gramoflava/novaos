// The sky behind the desktop.
//
// Space is mostly empty: a thin scatter of field stars, a few tight clusters
// and a couple of faint nebulae. Everything sits at some depth, so panning the
// camera slides near things past far ones. Black holes bend their light: a star behind a hole is drawn where
// a point-mass lens would show it, pushed out to the Einstein radius and
// brightened, with its fainter second image on the far side. At night the
// stars are light on dark; in the light theme the same sky is drawn in ink,
// like a star chart.
class NovaStarfieldClass {
    constructor() {
        this.canvas = null;
        this.stars = [];
        this.meteor = null;
        this.nextMeteor = 0;
        this.dirty = true;
        this.lastDraw = 0;
        this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    }

    init() {
        this.canvas = document.querySelector('canvas.stars-overlay');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.nextMeteor = performance.now() + 9000 + Math.random() * 15000;
        requestAnimationFrame(t => this.frame(t));
    }

    touch() { this.dirty = true; }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.dpr = dpr;
        this.W = window.innerWidth;
        this.H = window.innerHeight;
        this.canvas.width = Math.round(this.W * dpr);
        this.canvas.height = Math.round(this.H * dpr);
        this.seed();
        this.dirty = true;
    }

    // Deterministic, so a resize does not reshuffle the sky.
    seed() {
        let s = 0x9e3779b9;
        const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };
        const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;      // roughly normal, ±1
        const tints = ['255,255,255', '255,255,255', '214,226,255', '190,205,255', '255,236,214', '249,168,212', '165,180,252'];
        const star = (u, v, depth, dim) => ({
            u: ((u % 1) + 1) % 1, v: ((v % 1) + 1) % 1, depth,
            size: 0.45 + depth * 3.2 + rnd() * 0.45,
            alpha: (0.2 + rnd() * 0.5 + depth) * dim,
            tint: tints[Math.floor(rnd() * tints.length)],
            phase: rnd() * Math.PI * 2,
            rate: 0.4 + rnd() * 1.6,
            twinkle: rnd() < 0.3 ? 0.25 + rnd() * 0.4 : 0.06
        });
        this.stars = [];
        // the field: sparse
        const field = Math.round(Math.min(260, Math.max(60, this.W * this.H / 9500)));
        for (let i = 0; i < field; i++) this.stars.push(star(rnd(), rnd(), 0.015 + Math.pow(rnd(), 2.2) * 0.3, 1));
        // clusters: a few dozen faint stars each, dense at the heart, all at one depth
        const aspect = this.W / this.H;
        for (let c = 0; c < 3; c++) {
            const cu = rnd(), cv = rnd(), depth = 0.03 + rnd() * 0.1, spread = 0.025 + rnd() * 0.03;
            const n = 26 + Math.floor(rnd() * 22);
            for (let i = 0; i < n; i++) this.stars.push(star(cu + gauss() * spread, cv + gauss() * spread * aspect, depth, 0.75));
        }
        // nebulae: two or three soft lobes of one hue, far away
        const hues = ['129,140,248', '236,72,153', '45,212,191'];
        this.nebulae = [];
        for (let c = 0; c < 2; c++) {
            const u = rnd(), v = rnd(), depth = 0.02 + rnd() * 0.05, tint = hues[Math.floor(rnd() * hues.length)];
            const lobes = [];
            for (let i = 0; i < 3; i++) lobes.push({ dx: gauss() * 150, dy: gauss() * 90, r: 110 + rnd() * 130, a: 0.05 + rnd() * 0.05 });
            this.nebulae.push({ u, v, depth, tint, lobes });
        }
    }

    // Holes in canvas pixels, with their Einstein radius.
    lenses() {
        const wm = window.WindowManager;
        if (!wm || wm.isMobile() || !wm.holes.size) return [];
        const lean = (v) => Math.tanh(v / 3000) * 48;   // the layer's own offset
        const ox = lean(wm.cameraX), oy = lean(wm.cameraY);
        const list = [];
        wm.holes.forEach(h => {
            if (!h.members.length) return;
            const x = wm.cameraX + h.x * wm.cameraZ - ox;
            const y = wm.cameraY + h.y * wm.cameraZ - oy;
            const e = 26 * wm.cameraZ * Math.sqrt(h.mass || 1);
            if (x < -6 * e || y < -6 * e || x > this.W + 6 * e || y > this.H + 6 * e) return;
            list.push({ x, y, e });
        });
        return list;
    }

    frame(now) {
        requestAnimationFrame(t => this.frame(t));
        // The theme can change under us; look twice a second.
        if (!this.themeAt || now - this.themeAt > 500) {
            this.themeAt = now;
            const ink = !getComputedStyle(document.documentElement).colorScheme.includes('dark');
            if (ink !== this.ink) { this.ink = ink; this.dirty = true; }
        }

        const still = this.reduced.matches;
        // Twinkling needs ~20 frames a second; camera motion gets every frame.
        if (!this.dirty && (still || now - this.lastDraw < 50) && !this.meteor) return;
        this.dirty = false;
        this.lastDraw = now;
        this.draw(now, still);
    }

    draw(now, still) {
        const ctx = this.ctx, W = this.W, H = this.H, d = this.dpr;
        const wm = window.WindowManager;
        const camX = wm && !wm.isMobile() ? wm.cameraX : 0;
        const camY = wm && !wm.isMobile() ? wm.cameraY : 0;
        const t = still ? 0 : now / 1000;
        const lenses = this.lenses();

        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.clearRect(0, 0, W, H);

        for (const n of this.nebulae) {
            // wrapped over a field wider than the view, so a lobe never pops at an edge
            const FW = W + 700, FH = H + 700;
            let nx = (n.u * FW + camX * n.depth) % FW, ny = (n.v * FH + camY * n.depth) % FH;
            if (nx < 0) nx += FW;
            if (ny < 0) ny += FH;
            nx -= 350; ny -= 350;
            for (const l of n.lobes) {
                const g = ctx.createRadialGradient(nx + l.dx, ny + l.dy, 0, nx + l.dx, ny + l.dy, l.r);
                g.addColorStop(0, `rgba(${n.tint},${this.ink ? l.a * 2.4 : l.a})`);
                g.addColorStop(1, `rgba(${n.tint},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(nx + l.dx - l.r, ny + l.dy - l.r, l.r * 2, l.r * 2);
            }
        }

        for (const s of this.stars) {
            let x = (s.u * W + camX * s.depth) % W;
            let y = (s.v * H + camY * s.depth + t * 14 * s.depth) % H;   // slow drift, as before
            if (x < 0) x += W;
            if (y < 0) y += H;

            let alpha = s.alpha * (1 - s.twinkle * (0.5 + 0.5 * Math.sin(t * s.rate + s.phase)));
            let size = s.size;

            for (const L of lenses) {
                const dx = x - L.x, dy = y - L.y;
                const r = Math.hypot(dx, dy);
                if (r > 6 * L.e) continue;
                const u = Math.max(0.02, r / L.e);
                const root = Math.sqrt(u * u + 4);
                const mu = Math.min(4, (u * u + 2) / (u * root));   // total magnification
                const r1 = L.e * (u + root) / 2;                    // primary image
                const nx = r ? dx / r : 1, ny = r ? dy / r : 0;
                // Secondary image: opposite side, inside the ring, fainter.
                if (u < 2.2) {
                    const r2 = L.e * (root - u) / 2;
                    this.dot(L.x - nx * r2, L.y - ny * r2, size * 0.9, Math.min(1, alpha * (mu - 1) * 0.5), s.tint);
                }
                x = L.x + nx * r1; y = L.y + ny * r1;
                alpha = Math.min(1, alpha * (0.5 + 0.5 * mu));
                size *= Math.min(1.7, 0.8 + 0.2 * mu);
                break;
            }
            this.dot(x, y, size, Math.min(1, alpha), s.tint);
        }

        if (!still) this.drawMeteor(now);
    }

    dot(x, y, size, alpha, tint) {
        if (this.ink) {
            // white and pale stars become indigo ink; coloured ones keep their hue, deepened
            tint = NovaStarfieldClass.INK[tint] || '55,48,163';
            size *= 1.35;
        }
        if (alpha <= 0.01) return;
        const ctx = this.ctx;
        ctx.fillStyle = `rgba(${tint},${alpha.toFixed(3)})`;
        if (size < 1.3) {
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
        } else {
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();
            // The brightest carry a faint halo.
            ctx.fillStyle = `rgba(${tint},${(alpha * 0.12).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x, y, size * 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawMeteor(now) {
        if (!this.meteor) {
            if (now < this.nextMeteor) return;
            const a = Math.PI * (0.12 + Math.random() * 0.2);
            this.meteor = {
                x: Math.random() * this.W * 0.8, y: Math.random() * this.H * 0.35,
                dx: Math.cos(a), dy: Math.sin(a),
                speed: 900 + Math.random() * 500, born: now, life: 550 + Math.random() * 350
            };
        }
        const m = this.meteor, k = (now - m.born) / m.life;
        if (k >= 1) {
            this.meteor = null;
            this.nextMeteor = now + 14000 + Math.random() * 26000;
            this.dirty = true;
            return;
        }
        const ctx = this.ctx;
        const dist = m.speed * (now - m.born) / 1000;
        const hx = m.x + m.dx * dist, hy = m.y + m.dy * dist;
        const tail = 130 * Math.sin(Math.PI * k);
        const g = ctx.createLinearGradient(hx, hy, hx - m.dx * tail, hy - m.dy * tail);
        const streak = this.ink ? '55,48,163' : '255,255,255';
        g.addColorStop(0, `rgba(${streak},${(0.85 * Math.sin(Math.PI * k)).toFixed(3)})`);
        g.addColorStop(1, `rgba(${streak},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - m.dx * tail, hy - m.dy * tail);
        ctx.stroke();
    }
}

NovaStarfieldClass.INK = {
    '249,168,212': '190,24,93',
    '165,180,252': '79,70,229',
    '255,236,214': '180,83,9'
};

window.NovaStarfield = new NovaStarfieldClass();
document.addEventListener('DOMContentLoaded', () => NovaStarfield.init());
