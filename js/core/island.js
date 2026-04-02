class Island {
    constructor() {
        this.container = document.getElementById('nova-island-container');
        this.islandNode = document.getElementById('nova-island');
        this.appNameEl = document.getElementById('island-app-name');
        
        // Listen to app focus changes
        document.body.addEventListener('mousedown', (e) => {
            const winEl = e.target.closest('.nova-window');
            if (winEl) {
                const appId = winEl.dataset.appId;
                if (appId) {
                    const app = Apps.get(appId);
                    if (app) this.setAppName(app.name);
                }
            } else if (!e.target.closest('#nova-island') && !e.target.closest('#nova-shelf')) {
                // Clicked on desktop background
                this.setAppName('Nova');
            }
        });
    }

    setAppName(name) {
        if (this.appNameEl.textContent !== name) {
            // Quick animation
            this.appNameEl.style.opacity = '0';
            this.appNameEl.style.transform = 'translateY(-5px)';
            setTimeout(() => {
                this.appNameEl.textContent = name;
                this.appNameEl.style.transform = 'translateY(5px)';
                requestAnimationFrame(() => {
                    this.appNameEl.style.transition = 'all 0.2s var(--curve-spring)';
                    this.appNameEl.style.opacity = '1';
                    this.appNameEl.style.transform = 'translateY(0)';
                });
            }, 100);
        }
    }
}
// Will be instantiated in main.js
