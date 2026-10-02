// Nova OS Shell (System context and settings)
class Shell {
    constructor() {
        this.codexWelcomeKey = 'novaos_codex_welcome_seen';
        this.clockEl = document.getElementById('island-clock');
        this.initClock();

        Bus.on('system:ready', () => {
            this.welcome();
        });
    }

    initClock() {
        const update = () => {
            // Hour cycle follows the visitor's locale: 21:10 in Vilnius, 9:10 PM in New York.
            if (this.clockEl) {
                this.clockEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            }
        };
        update();
        setInterval(update, 10000); // Check every 10s
    }

    welcome() {
        let shouldOpenCodex = true;
        try {
            shouldOpenCodex = localStorage.getItem(this.codexWelcomeKey) !== 'true';
            if (shouldOpenCodex) {
                localStorage.setItem(this.codexWelcomeKey, 'true');
            }
        } catch (error) {
            // Without persistent storage, keep the introduction available.
        }

        if (shouldOpenCodex) {
            Apps.launch('codex');
        }
    }
}

window.OSShell = new Shell();
