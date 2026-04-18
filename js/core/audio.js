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
        
        // Listen for boot or user interaction to init context properly
        document.body.addEventListener('mousedown', () => this.init(), { once: true });
        document.body.addEventListener('keydown', () => this.init(), { once: true });
    }

    init() {
        if (!this.context) {
            try {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
                
                // Create Limiter (Compressor with high ratio)
                this.limiter = this.context.createDynamicsCompressor();
                this.limiter.threshold.setValueAtTime(-12, this.context.currentTime);
                this.limiter.knee.setValueAtTime(40, this.context.currentTime);
                this.limiter.ratio.setValueAtTime(12, this.context.currentTime);
                this.limiter.attack.setValueAtTime(0, this.context.currentTime);
                this.limiter.release.setValueAtTime(0.25, this.context.currentTime);

                // Master Gain
                this.masterGain = this.context.createGain();
                this.masterGain.gain.setValueAtTime(0.7, this.context.currentTime);

                this.limiter.connect(this.masterGain);
                this.masterGain.connect(this.context.destination);
            } catch(e) {
                console.warn('Web Audio API not supported', e);
            }
        }
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
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
                gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
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
                gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'flag_off') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            }
        } catch(e) { 
            console.warn('Audio play failed', e); 
        }
    }
}
window.AudioMng = new AudioManager();
