// Boot sequence manager
class BootSequence {
    constructor() {
        this.screen = document.getElementById('boot-screen');
        this.progress = document.getElementById('boot-progress');
        this.desktop = document.getElementById('desktop');
    }

    start() {
        let pct = 0;
        const interval = setInterval(() => {
            pct += Math.random() * 15;
            if (pct >= 100) {
                pct = 100;
                clearInterval(interval);
                this.finish();
            }
            this.progress.style.width = pct + '%';
        }, 100);
    }

    finish() {
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
                island.style.transition = 'all 0.6s var(--curve-spring)';
                
                shelf.style.transform = 'translateY(20px) scale(0.9)';
                shelf.style.opacity = '0';
                shelf.style.transition = 'all 0.6s var(--curve-spring) 0.1s';

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        island.style.transform = 'translateY(0) scale(1)';
                        island.style.opacity = '1';
                        shelf.style.transform = 'translateY(0) scale(1)';
                        shelf.style.opacity = '1';
                    });
                });

                Bus.emit('system:ready');
            }, 1000);
        }, 500);
    }
}

window.Boot = new BootSequence();
