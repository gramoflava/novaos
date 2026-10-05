class SpotlightSearch {
    constructor() {
        this.overlay = document.getElementById('spotlight-overlay');
        this.input = document.getElementById('spotlight-input');
        this.results = document.getElementById('spotlight-results');
        this.trigger = document.getElementById('btn-search');

        this.isOpen = false;

        this.setupListeners();
    }

    setupListeners() {
        // Toggle on Island button click
        if(this.trigger) {
            this.trigger.addEventListener('click', () => this.toggle());
        }

        // Global hotkey: Cmd+Space or Ctrl+Space
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
                e.preventDefault();
                this.toggle();
            }
            if (e.code === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Close when clicking outside
        this.overlay.addEventListener('mousedown', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Input search
        this.input.addEventListener('input', () => this.performSearch());
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.matches?.length) {
                e.preventDefault();
                Apps.launch(this.matches[0].id);
                this.close();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.overlay.style.display = 'flex';
        this.input.value = '';
        this.results.innerHTML = '';
        this.matches = [];
        setTimeout(() => this.input.focus(), 100);
    }

    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
        this.input.blur();
    }

    performSearch() {
        const query = this.input.value.toLowerCase().trim();
        this.results.innerHTML = '';
        this.matches = [];

        if (!query) return;

        // Search apps
        const apps = Apps.getAll().filter(a => a.name.toLowerCase().includes(query) || a.id.includes(query));
        this.matches = apps;

        apps.forEach(app => {
            const el = document.createElement('div');
            el.className = 'spotlight-item';
            el.innerHTML = `
                <div style="width: 24px; height: 24px;">${Icons.get(app.iconId) || ''}</div>
                <div>${app.name} <span style="font-size: 11px; opacity: 0.5;">App</span></div>
            `;
            el.onclick = () => {
                Apps.launch(app.id);
                this.close();
            };
            this.results.appendChild(el);
        });

        if(apps.length === 0) {
            const el = document.createElement('div');
            el.className = 'spotlight-item';
            el.textContent = `No results found for "${query}"`;
            this.results.appendChild(el);
        }
    }
}
