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
            const now = new Date();
            let h = now.getHours();
            let m = now.getMinutes();
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            m = m < 10 ? '0' + m : m;

            if (this.clockEl) {
                this.clockEl.textContent = `${h}:${m} ${ampm}`;
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
