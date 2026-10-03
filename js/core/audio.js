class AudioManager {
    constructor() {
        this.context = null;
        this.limiter = null;
        this.masterGain = null;

        // Load muted state from LocalStorage
        try {
            this.muted = localStorage.getItem('nova_muted') === 'true';
        } catch(e) {
            this.muted = false;
        }

        // Browsers only let audio start from a user gesture, and may stop it
        // later (sleep, a headphone switch, another app taking the device).
        // So every gesture re-checks the context, not just the first one, and
        // returning to the tab does too.
        const wake = () => this.init();
        ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
            document.addEventListener(ev, wake, { capture: true, passive: true }));
        document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
    }

    build() {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.context = new Ctx();
        // Limiter: a stateless soft clipper. A compressor keeps internal state,
        // and one bad sample could leave it (and so all sound) silent for good.
        this.limiter = this.context.createWaveShaper();
        const n = 2048, curve = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
        this.limiter.curve = curve;
        this.limiter.oversample = '2x';
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.7;
        this.limiter.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);
        this.lastTime = -1; this.lastWall = performance.now();
    }

    // Throw the context away and start a fresh one.
    rebuild() {
        const old = this.context;
        this.context = this.limiter = this.masterGain = null;
        try { if (old && old.state !== 'closed') old.close(); } catch (e) { }
        this.build();
    }

    // A context that is closed, or "running" while its clock no longer moves
    // (seen after audio device changes), is replaced.
    check() {
        const c = this.context;
        if (!c) return;
        if (c.state === 'closed') { this.rebuild(); return; }
        const now = performance.now();
        if (c.state === 'running') {
            if (c.currentTime === this.lastTime && now - this.lastWall > 1500) { this.rebuild(); return; }
            if (c.currentTime !== this.lastTime) { this.lastTime = c.currentTime; this.lastWall = now; }
        }
    }

    init() {
        if (!this.context) {
            try { this.build(); } catch (e) { console.warn('Web Audio API not supported', e); return; }
        }
        this.check();
        // 'suspended' after autoplay rules, 'interrupted' after Safari loses the device
        if (this.context && this.context.state !== 'running' && this.context.state !== 'closed') {
            const p = this.context.resume();
            if (p && p.catch) p.catch(() => this.rebuild());
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        try {
            localStorage.setItem('nova_muted', this.muted);
        } catch(e) {}
        return this.muted;
    }

    play(type) {
        if (this.muted) return;
        this.init();
        if (!this.context || !this.limiter) return;

        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.connect(gain);

            // Connect to the global limiter instead of destination
            gain.connect(this.limiter);

            const now = this.context.currentTime;
            if (type === 'click') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.05, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                gain.gain.linearRampToValueAtTime(0, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'win') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(554, now + 0.1);
                osc.frequency.setValueAtTime(659, now + 0.2);
                osc.frequency.setValueAtTime(880, now + 0.3);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
                gain.gain.linearRampToValueAtTime(0, now + 0.6);
                osc.start(now);
                osc.stop(now + 0.65);
            } else if (type === 'lose') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
                gain.gain.linearRampToValueAtTime(0, now + 0.8);
                osc.start(now);
                osc.stop(now + 0.85);
            } else if (type === 'explode') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
                gain.gain.linearRampToValueAtTime(0, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'flag_on') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.04, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'flag_off') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.03, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'collapse') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                gain.gain.linearRampToValueAtTime(0, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'expand') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                gain.gain.linearRampToValueAtTime(0, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch(e) {
            console.warn('Audio play failed', e);
        }
    }
}
window.AudioMng = new AudioManager();
