class GamePauseController {
    constructor({ winId, button, surface, canPause, onPause, onResume }) {
        this.winId = winId;
        this.button = button;
        this.surface = surface;
        this.canPause = canPause || (() => true);
        this.onPause = onPause || (() => {});
        this.onResume = onResume || (() => {});
        this.paused = false;
        this.manuallyPaused = false;
        this.autoReasons = new Set();
        this.pausedAnimations = new Set();

        this.overlay = document.createElement('div');
        this.overlay.className = 'game-pause-overlay';
        this.overlay.hidden = true;
        this.overlay.textContent = 'Game paused';
        this.surface.classList.add('game-pause-surface');
        this.surface.appendChild(this.overlay);

        this.onButtonClick = () => {
            this.manuallyPaused = !this.manuallyPaused;
            this.sync();
        };
        this.onVisibilityChange = () => {
            this.setAutoPaused('document', document.hidden);
        };

        this.button.addEventListener('click', this.onButtonClick);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        this.unsubscribeMinimize = Bus.on('window:minimized', id => {
            if (id === this.winId) this.setAutoPaused('window', true);
        });
        this.unsubscribeRestore = Bus.on('window:restored', id => {
            if (id === this.winId) this.setAutoPaused('window', false);
        });

        if (document.hidden) {
            this.autoReasons.add('document');
        }
        this.sync();
    }

    isPaused() {
        return this.paused;
    }

    setAutoPaused(reason, value) {
        if (value) this.autoReasons.add(reason);
        else this.autoReasons.delete(reason);
        this.sync();
    }

    reset() {
        this.manuallyPaused = false;
        this.sync();
    }

    sync() {
        let shouldPause = this.manuallyPaused || this.autoReasons.size > 0;
        if (shouldPause && !this.paused && !this.canPause()) {
            if (this.manuallyPaused) this.manuallyPaused = false;
            shouldPause = false;
        }

        if (shouldPause === this.paused) {
            this.updateUI();
            return;
        }

        this.paused = shouldPause;
        if (this.paused) {
            this.pauseAnimations();
            this.onPause();
        } else {
            this.onResume();
            this.resumeAnimations();
        }
        this.updateUI();
    }

    pauseAnimations() {
        if (!this.surface.getAnimations) return;
        let animations;
        try {
            animations = this.surface.getAnimations({ subtree: true });
        } catch (_) {
            animations = this.surface.getAnimations();
        }
        animations.forEach(animation => {
            if (animation.playState === 'running') {
                animation.pause();
                this.pausedAnimations.add(animation);
            }
        });
    }

    resumeAnimations() {
        this.pausedAnimations.forEach(animation => {
            if (animation.playState === 'paused') animation.play();
        });
        this.pausedAnimations.clear();
    }

    updateUI() {
        this.overlay.hidden = !this.paused;
        this.button.setAttribute('aria-pressed', String(this.paused));
        this.button.setAttribute('aria-label', this.paused ? 'Resume' : 'Pause');
        this.button.title = this.paused ? 'Resume' : 'Pause';
    }

    destroy() {
        this.button.removeEventListener('click', this.onButtonClick);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.unsubscribeMinimize();
        this.unsubscribeRestore();
        this.resumeAnimations();
        this.overlay.remove();
    }
}

window.GamePauseController = GamePauseController;
