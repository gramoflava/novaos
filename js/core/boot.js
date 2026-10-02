// Boot sequence manager
const BOOT_KEY = 'novaos_booted';

class BootSequence {
    constructor() {
        this.screen = document.getElementById('boot-screen');
        this.progress = document.getElementById('boot-progress');
        this.desktop = document.getElementById('desktop');
    }

    // Full sequence on the first visit and after a factory reset; a short one otherwise.
    isFirstBoot() {
        try { return localStorage.getItem(BOOT_KEY) !== 'true'; } catch (e) { return false; }
    }

    start() {
        this.full = this.isFirstBoot();
        try { localStorage.setItem(BOOT_KEY, 'true'); } catch (e) { }
        if (!this.full) this.screen.classList.add('boot-screen--quick');

        let pct = 0;
        const step = this.full ? 15 : 45;
        const interval = setInterval(() => {
            pct += this.full ? Math.random() * step : step;
            if (pct >= 100) {
                pct = 100;
                clearInterval(interval);
                this.finish();
            }
            this.progress.style.width = pct + '%';
        }, this.full ? 100 : 70);
    }

    finish() {
        const hold = this.full ? 500 : 60;
        const fade = this.full ? 1000 : 180;
        setTimeout(() => {
            this.screen.style.opacity = '0';
            setTimeout(() => {
                this.screen.style.display = 'none';
                this.desktop.style.display = 'block';

                // Play subtle startup animation on island and shelf
                const island = document.getElementById('nova-island');
                const shelf = document.getElementById('nova-shelf');

                island.style.transform = 'translateY(-20px) scale(0.9)';
                island.style.opacity = '0';
                island.style.transition = 'all 0.6s var(--ease-spring)';

                shelf.style.transform = 'translateY(20px) scale(0.9)';
                shelf.style.opacity = '0';
                shelf.style.transition = 'all 0.6s var(--ease-spring) 0.1s';

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        island.style.transform = 'translateY(0) scale(1)';
                        island.style.opacity = '1';
                        shelf.style.transform = 'translateY(0) scale(1)';
                        shelf.style.opacity = '1';
                    });
                });

                Bus.emit('system:ready');
            }, fade);
        }, hold);
    }
}

window.Boot = new BootSequence();
