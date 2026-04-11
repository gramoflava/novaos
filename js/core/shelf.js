// App Shelf Manager
class Shelf {
    constructor() {
        this.container = document.getElementById('nova-shelf');
        
        // Listen to app lifecycle events
        Bus.on('app:registered', (app) => this.render());
        Bus.on('app:launching', (appId) => this.render());
        Bus.on('app:closed', (appId) => this.render());
        window.ShelfInstance = this;
    }

    render() {
        this.container.innerHTML = '';
        
        const allApps = Apps.getAll().filter(app => app.keepInDock || Apps.isRunning(app.id));
        
        // Logical Order & Grouping
        const GROUPS = [
            { id: 'utils', apps: ['codex', 'settings', 'calculator'] },
            { id: 'games', apps: ['minesweeper', 'game2048', 'colorlines', 'wordl'] },
            { id: 'stats', apps: ['scores'] }
        ];

        let renderedCount = 0;

        GROUPS.forEach((group, groupIdx) => {
            const groupApps = allApps.filter(app => group.apps.includes(app.id));
            
            // Sort within group based on the order in GROUPS
            groupApps.sort((a, b) => group.apps.indexOf(a.id) - group.apps.indexOf(b.id));

            groupApps.forEach(app => {
                const el = document.createElement('div');
                el.className = 'shelf-item';
                if (Apps.isRunning(app.id)) el.classList.add('is-running');
                
                el.innerHTML = Icons.get(app.iconId) || `<svg><circle cx="12" cy="12" r="10"/></svg>`;
                el.title = app.name;
                
                el.onclick = () => {
                    if (!Apps.isRunning(app.id)) {
                        Apps.launch(app.id);
                    } else {
                        const winArray = Array.from(WindowManager.windows.values());
                        const appWindows = winArray.filter(w => w.appId === app.id);
                        if (appWindows.length > 0) {
                            const lastWin = appWindows[appWindows.length - 1];
                            if (lastWin.el.dataset.minimized === 'true') {
                                WindowManager.restore(lastWin.id);
                            } else {
                                WindowManager.focus(lastWin.id);
                            }
                            
                            // Center camera on the window (whether just restored or already active)
                            const left = parseFloat(lastWin.el.dataset.x);
                            const top = parseFloat(lastWin.el.dataset.y);
                            const w = parseFloat(lastWin.el.dataset.w);
                            const h = parseFloat(lastWin.el.dataset.h);
                            const cx = left + w / 2;
                            const cy = top + h / 2;
                            const targetX = window.innerWidth / 2 - cx * WindowManager.cameraZ;
                            const targetY = window.innerHeight / 2 - cy * WindowManager.cameraZ;
                            WindowManager.animateCameraTo(targetX, targetY);
                        } else {
                            Apps.launch(app.id);
                        }
                    }
                    
                    el.classList.add('is-active');
                    setTimeout(() => el.classList.remove('is-active'), 300);
                };
                
                this.container.appendChild(el);
                renderedCount++;
            });

            // Add divider if not the last group and we actually rendered something in this group
            if (groupIdx < GROUPS.length - 1 && groupApps.length > 0) {
                // Peek if next groups have anything to render
                const remainingApps = GROUPS.slice(groupIdx + 1).some(g => 
                    allApps.some(a => g.apps.includes(a.id))
                );
                
                if (remainingApps) {
                    const divider = document.createElement('div');
                    divider.className = 'shelf-divider';
                    this.container.appendChild(divider);
                }
            }
        });
    }
}

// Will instantiate after all apps register, typically in main.js
// but we can prep it here
