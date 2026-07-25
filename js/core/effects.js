/**
 * Nova OS Effects Manager
 * Centralized system for global visual celebrations and feedback.
 */
class NovaEffectsClass {
    constructor() {
        this.container = null;
        this.celebrationActive = false;
        this.celebrationInterval = null;
        this.celebrationTimeout = null;
        this.rafId = null;
        this.particles = new Set();
    }

    init() {
        this.canvasContainer = document.getElementById('desktop-content');
        // Fixed overlay for screen-space effects like celebrations
        this.overlay = document.createElement('div');
        this.overlay.style.position = 'fixed';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.width = '100vw';
        this.overlay.style.height = '100vh';
        this.overlay.style.pointerEvents = 'none';
        this.overlay.style.zIndex = '7000';
        this.overlay.style.overflow = 'hidden';
        document.body.appendChild(this.overlay);
    }

    /**
     * Triggers a 3D particle explosion at a specific global coordinate.
     * @param {number} x - The horizontal position in the desktop-content coordinate system.
     * @param {number} y - The vertical position in the desktop-content coordinate system.
     * @param {Object} options - Customization options.
     */
    burst(x, y, options = {}) {
        if (!this.overlay) this.init();
        if (!this.overlay) return;

        // Convert world coordinates to screen coordinates
        const wm = window.WindowManager;
        let screenX = x, screenY = y;
        if (wm && !options.isScreenSpace) {
            screenX = wm.cameraX + x * wm.cameraZ;
            screenY = wm.cameraY + y * wm.cameraZ;
        }

        const count = options.count || Math.floor(Math.random() * 25) + 30;
        const colors = options.colors || ['var(--accent)', 'var(--nova-accent-alt)', '#fff'];
        const spread = options.spread || 400;
        const duration = options.duration || 4000;

        for (let i = 0; i < count; i++) {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.left = screenX + 'px';
            wrapper.style.top = screenY + 'px';
            wrapper.style.width = '0';
            wrapper.style.height = '0';
            wrapper.style.transformStyle = 'preserve-3d';
            wrapper.style.pointerEvents = 'none';

            const part = document.createElement('div');
            part.style.position = 'absolute';
            const size = Math.random() * 16 + 8;
            part.style.width = size + 'px';
            part.style.height = size + 'px';
            part.style.marginTop = (-size / 2) + 'px';
            part.style.marginLeft = (-size / 2) + 'px';
            part.style.background = colors[Math.floor(Math.random() * colors.length)];
            part.style.borderRadius = '50%';
            part.style.boxShadow = `0 0 ${size * 2}px ${part.style.background}`;

            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * spread + 100;

            wrapper.appendChild(part);
            this.overlay.appendChild(wrapper);

            part.animate([
                { transform: 'translate(0px, 0px) scale(0)', opacity: 1 },
                { transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px) scale(1.5)`, opacity: 1, offset: 0.1 },
                { transform: `translate(${Math.cos(angle) * radius * 1.1}px, ${Math.sin(angle) * radius * 1.1}px) scale(1)`, opacity: 1, offset: 0.8 },
                { transform: `translate(${Math.cos(angle) * radius * 1.2}px, ${Math.sin(angle) * (radius * 1.2 + 100)}px) scale(0)`, opacity: 0 }
            ], { duration: duration, easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)', fill: 'forwards' });

            const rotX = (Math.random() - 0.5) * 120;
            const rotY = (Math.random() - 0.5) * 120;
            const dir = Math.random() > 0.5 ? 1 : -1;
            wrapper.animate([
                { transform: `rotateX(0deg) rotateY(0deg) rotateZ(0deg)` },
                { transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${360 * 3 * dir}deg)` }
            ], { duration: duration, easing: 'linear' });

            setTimeout(() => { if (wrapper.parentNode) wrapper.remove(); }, duration + 100);
        }

        if (options.shake) this.shake(0.5);
        if (options.flash) this.flash(options.flashColor || 'rgba(255,255,255,0.1)');
    }

    /**
     * Triggers a momentary background flash.
     * @param {string} color - The color/opacity of the flash.
     */
    flash(color) {
        const flashEl = document.createElement('div');
        flashEl.style.position = 'fixed';
        flashEl.style.top = '0';
        flashEl.style.left = '0';
        flashEl.style.width = '100vw';
        flashEl.style.height = '100vh';
        flashEl.style.background = color;
        flashEl.style.zIndex = '9999';
        flashEl.style.pointerEvents = 'none';
        flashEl.style.transition = 'opacity 0.5s ease-out';
        document.body.appendChild(flashEl);

        requestAnimationFrame(() => {
            flashEl.animate([
                { opacity: 1 },
                { opacity: 0 }
            ], { duration: 800, fill: 'forwards' }).onfinish = () => flashEl.remove();
        });
    }

    /**
     * Applies a momentary shake to the entire desktop canvas.
     * @param {number} intensity - 0 to 1 intensity factor.
     */
    shake(intensity = 0.5) {
        if (!this.canvasContainer) this.init();
        const duration = 500;
        const magnitude = intensity * 20;

        this.canvasContainer.animate([
            { transform: `translate(${Math.random() * magnitude}px, ${Math.random() * magnitude}px)` },
            { transform: `translate(${Math.random() * -magnitude}px, ${Math.random() * magnitude}px)` },
            { transform: `translate(${Math.random() * magnitude}px, ${Math.random() * -magnitude}px)` },
            { transform: `translate(${Math.random() * -magnitude}px, ${Math.random() * -magnitude}px)` },
            { transform: `translate(0, 0)` }
        ], { duration: duration, easing: 'ease-in-out' });
    }

    /**
     * Starts a high-fidelity, continuous celebration at the given position.
     * Implements "breathing" emission and distance-based velocity physics.
     */
    startCelebration(x, y, options = {}) {
        this.stopCelebration(); // Clear any existing
        if (!this.overlay) this.init();

        this.celebrationActive = true;
        this.celebrationOrigin = { x, y };
        this.celebrationOptions = {
            count: 30,
            colors: ['var(--accent)', 'var(--nova-accent-alt)', '#fff'],
            spread: 0.2, // Conical spread in radians
            angle: -Math.PI / 2, // Default: upwards
            duration: 3500,
            ...options
        };

        const tick = (now) => {
            if (!this.celebrationActive) return;

            // Breathing: modulate emission intensity
            const breathing = (Math.sin(now / 400) + 1) / 2;
            const emissionRate = 0.5 + breathing * 1.5;

            if (Math.random() < emissionRate) {
                this._spawnCelebrationParticle();
            }

            this._updateParticles(now);
            this.rafId = requestAnimationFrame(tick);
        };

        this.rafId = requestAnimationFrame(tick);

        // Safety timeout (30s)
        this.celebrationTimeout = setTimeout(() => {
            this.stopCelebration();
        }, 30000);
    }

    _spawnCelebrationParticle() {
        const { x, y } = this.celebrationOrigin;
        const options = this.celebrationOptions;

        // Origin conversion
        const wm = window.WindowManager;
        let screenX = x, screenY = y;
        if (wm && !options.isScreenSpace) {
            screenX = wm.cameraX + x * wm.cameraZ;
            screenY = wm.cameraY + y * wm.cameraZ;
        }

        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = screenX + 'px';
        el.style.top = screenY + 'px';
        const size = Math.random() * 12 + 4;
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.borderRadius = '50%';
        const color = options.colors[Math.floor(Math.random() * options.colors.length)];
        el.style.background = color;
        el.style.boxShadow = `0 0 ${size * 2}px ${color}`;
        el.style.pointerEvents = 'none';
        el.style.zIndex = '7001';
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s ease';

        this.overlay.appendChild(el);

        // Physics: Orbital "Collapsed Black Hole" inspired
        // Closer to origin = faster angular velocity, farther = slower
        const spreadAngle = (Math.random() - 0.5) * options.spread;
        const startAngle = options.angle + spreadAngle;

        const p = {
            el,
            baseX: screenX,
            baseY: screenY,
            angle: startAngle,
            radius: 5,
            angularVelocity: 0.05 + Math.random() * 0.1,
            radialVelocity: 1.5 + Math.random() * 2,
            life: 1.0,
            decay: 0.005 + Math.random() * 0.015,
            blinkFreq: 5 + Math.random() * 15,
            born: performance.now()
        };

        // Fade in
        requestAnimationFrame(() => el.style.opacity = '1');

        this.particles.add(p);
    }

    _updateParticles(now) {
        for (const p of this.particles) {
            p.life -= p.decay;

            if (p.life <= 0) {
                p.el.remove();
                this.particles.delete(p);
                continue;
            }

            // Physics logic: Orbital movement
            // Angular velocity (spin) is faster when closer to the center
            const orbitalSpeedFactor = 1 / (1 + p.radius * 0.01);
            p.angle += p.angularVelocity * orbitalSpeedFactor;

            // Radial velocity (expansion)
            const drag = 0.98;
            p.radialVelocity *= drag;
            p.radius += p.radialVelocity;

            // Compute Cartesian coordinates
            const currentX = p.baseX + Math.cos(p.angle) * p.radius;
            const currentY = p.baseY + Math.sin(p.angle) * p.radius;

            // Blinking
            const blink = (Math.sin(now / p.blinkFreq) + 1) / 2;
            const finalOpacity = p.life * (0.4 + blink * 0.6);

            p.el.style.transform = `translate3d(${currentX - p.el.offsetLeft}px, ${currentY - p.el.offsetTop}px, 0) scale(${p.life})`;
            p.el.style.opacity = finalOpacity;
        }
    }

    /**
     * Stops the continuous celebration with a smooth fade-out.
     */
    stopCelebration() {
        this.celebrationActive = false;
        if (this.celebrationInterval) {
            clearInterval(this.celebrationInterval);
            this.celebrationInterval = null;
        }
        if (this.celebrationTimeout) {
            clearTimeout(this.celebrationTimeout);
            this.celebrationTimeout = null;
        }
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Smoothly clear remaining particles
        for (const p of this.particles) {
            p.el.style.opacity = '0';
            p.el.style.transform += ' scale(0)';
            setTimeout(() => {
                if (p.el.parentNode) p.el.remove();
            }, 500);
        }
        this.particles.clear();
    }
}

window.NovaEffects = new NovaEffectsClass();
