class Island {
    constructor() {
        this.container = document.getElementById('nova-island-container');
        this.islandNode = document.getElementById('nova-island');
        this.appNameEl = document.getElementById('island-app-name');

        // The name follows the focused window, and falls back to "Nova" when a
        // window closes or minimises or the desktop itself is clicked.
        Bus.on('window:focused', (id) => {
            const win = id && WindowManager.windows.get(id);
            const app = win && win.appId && Apps.get(win.appId);
            this.setAppName(app ? app.name : 'Nova');
        });
        document.body.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.nova-window, #nova-island, #nova-shelf, .kofi-panel')) {
                this.setAppName('Nova');
            }
        });

        this.muteBtn = document.getElementById('btn-mute');
        if (this.muteBtn) {
            this.muteBtn.onclick = () => {
                const isMuted = AudioMng.toggleMute();
                if (isMuted) {
                    this.muteBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 8a5 5 0 0 1 .912 2.322M17.7 5a9 9 0 0 1 1.747 9.038M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l4 -4v5M10 14v5l-4 -4M3 3l18 18"></path></svg>';
                } else {
                    this.muteBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 8a5 5 0 0 1 0 8M17.7 5a9 9 0 0 1 0 14M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l4 -4v14z"></path></svg>';
                }
            };
        }
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
                    this.appNameEl.style.transition = 'all 0.2s var(--ease-spring)';
                    this.appNameEl.style.opacity = '1';
                    this.appNameEl.style.transform = 'translateY(0)';
                });
            }, 100);
        }
    }
}
// Will be instantiated in main.js
