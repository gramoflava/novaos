// Application Registry
class AppRegistry {
    constructor() {
        this.apps = new Map();
        this.running = new Set(); // Map window ID to App ID maybe? Or just a set of running app IDs
        // For simplicity, running holds the app IDs that have at least one window open
    }

    register(appConfig) {
        this.apps.set(appConfig.id, appConfig);
        Bus.emit('app:registered', appConfig);
    }

    getAll() {
        return Array.from(this.apps.values());
    }

    get(appId) {
        return this.apps.get(appId);
    }

    launch(appId, args = {}) {
        const app = this.apps.get(appId);
        if (!app) {
            console.error(`App ${appId} not found!`);
            return;
        }
        
        this.running.add(appId);
        Bus.emit('app:launching', appId);
        
        try {
            app.launch(args);
        } catch (e) {
            console.error(`Error launching app ${appId}:`, e);
        }
    }

    markClosed(appId) {
        // If no more windows belongs to this app, remove from running
        // Detailed window-to-app tracking happens in WindowManager
        this.running.delete(appId);
        Bus.emit('app:closed', appId);
    }

    isRunning(appId) {
        return this.running.has(appId);
    }
}

window.Apps = new AppRegistry();
