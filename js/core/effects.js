/**
 * Nova OS Effects Manager
 * Centralized system for global visual celebrations and feedback.
 */
class NovaEffectsClass {
    constructor() {
        this.container = null;
        this.celebrationInterval = null;
        this.celebrationTimeout = null;
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
        const colors = options.colors || ['var(--accent-primary)', 'var(--accent-secondary)', '#fff'];
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
            const size = Math.random() * 8 + 4;
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
     * Starts a periodic celebration burst at the given position.
     * Automatically stops after 30 seconds for safety.
     */
    startCelebration(x, y, options = {}) {
        this.stopCelebration(); // Clear any existing
        
        // Immediate burst
        this.burst(x, y, options);

        // Loop for persistent feel
        this.celebrationInterval = setInterval(() => {
            // Lower particle count for loop to be lighter on performance
            const loopOptions = { ...options, count: 12, flash: false, shake: false };
            this.burst(x, y, loopOptions);
        }, 1200);

        // Safety timeout (30s)
        this.celebrationTimeout = setTimeout(() => {
            this.stopCelebration();
        }, 30000);
    }

    /**
     * Stops the periodic celebration.
     */
    stopCelebration() {
        if (this.celebrationInterval) {
            clearInterval(this.celebrationInterval);
            this.celebrationInterval = null;
        }
        if (this.celebrationTimeout) {
            clearTimeout(this.celebrationTimeout);
            this.celebrationTimeout = null;
        }
    }
}

window.NovaEffects = new NovaEffectsClass();
