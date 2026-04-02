// App Shelf Manager
class Shelf {
    constructor() {
        this.container = document.getElementById('nova-shelf');
        
        // Listen to app lifecycle events
        Bus.on('app:registered', (app) => this.render());
        Bus.on('app:launching', (appId) => this.render());
        Bus.on('app:closed', (appId) => this.render());
    }

    render() {
        this.container.innerHTML = '';
        
        const appsToRender = Apps.getAll().filter(app => app.keepInDock || Apps.isRunning(app.id));
        
        appsToRender.forEach(app => {
            const el = document.createElement('div');
            el.className = 'shelf-item';
            if (Apps.isRunning(app.id)) el.classList.add('is-running');
            
            // For now, if no SVG logic yet, just text or placeholder
            el.innerHTML = Icons.get(app.iconId) || `<svg><circle cx="12" cy="12" r="10"/></svg>`;
            el.title = app.name;
            
            el.onclick = () => {
                if (!Apps.isRunning(app.id)) {
                    // Launch fresh
                    Apps.launch(app.id);
                } else {
                    // Try to focus its highest window (would require window manager query, simplified here)
                    const winArray = Array.from(WindowManager.windows.values());
                    const appWindows = winArray.filter(w => w.appId === app.id);
                    if (appWindows.length > 0) {
                        WindowManager.focus(appWindows[appWindows.length - 1].id);
                    } else {
                        // Recalculate
                        Apps.launch(app.id);
                    }
                }
                
                // Visual pop
                el.classList.add('is-active');
                setTimeout(() => el.classList.remove('is-active'), 300);
            };
            
            this.container.appendChild(el);
        });
    }
}

// Will instantiate after all apps register, typically in main.js
// but we can prep it here
