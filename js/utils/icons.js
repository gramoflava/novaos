// Advanced Geometric SVG Icons for Nova OS
const Icons = {
    cache: new Map(),

    library: {
        // Core System
        'finder': `<svg viewBox="0 0 24 24" fill="none" stroke="url(#finderGrad)" stroke-width="2" stroke-linejoin="round">
            <defs>
                <linearGradient id="finderGrad" x1="0" y1="0" x2="24" y2="24"><stop stop-color="#4F46E5"/><stop offset="1" stop-color="#EC4899"/></linearGradient>
            </defs>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>`,

        // Settings is a system affordance, so it comes from the shared Tabler set.
        'settings': `<img class="tabler-app-mark" src="gramofdesign/icons/adjustments-x.svg" alt="">`,

        // Apps
        'calculator': `<svg viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
            <rect x="4" y="2" width="16" height="20" rx="4"></rect>
            <path d="M8 6h8"></path><path d="M12 10v8"></path><path d="M8 14h8"></path>
        </svg>`,

        'codex': `<svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
        </svg>`,

        'minesweeper': `<svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
            <circle cx="12" cy="12" r="8"></circle>
            <path d="M12 2v2"></path><path d="M12 20v2"></path>
            <path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path>
            <path d="M2 12h2"></path><path d="M20 12h2"></path>
            <path d="M6.34 17.66l-1.41 1.41"></path><path d="M19.07 4.93l-1.41 1.41"></path>
        </svg>`,

        'colorlines': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="6" cy="12" r="3" fill="#3B82F6" stroke="none"></circle>
            <circle cx="12" cy="12" r="3" fill="#10B981" stroke="none"></circle>
            <circle cx="18" cy="12" r="3" fill="#EC4899" stroke="none"></circle>
            <path d="M3 12h18" stroke-dasharray="2 4"></path>
        </svg>`,

        'columns': `<svg viewBox="0 0 24 24" fill="none" stroke-linejoin="round">
            <path d="M12 1.5l4.5 3.5L12 8.5 7.5 5z" fill="#EC4899" stroke="#BE185D" stroke-width="1"></path>
            <path d="M12 8l4.5 3.5L12 15l-4.5-3.5z" fill="#06B6D4" stroke="#0E7490" stroke-width="1"></path>
            <path d="M12 14.5l4.5 3.5-4.5 4.5L7.5 18z" fill="#F59E0B" stroke="#B45309" stroke-width="1"></path>
        </svg>`,

        'game2048': `<svg viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
        </svg>`,

        'novarun': `<svg viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 14v-4a5 5 0 0 1 10 0v4"></path>
            <path d="M8 10h8"></path>
            <path d="M9 10a3 3 0 0 1 6 0" fill="#8B5CF6" stroke="none"></path>
            <path d="M5 19c3 -2 11 -2 14 0"></path>
            <circle cx="18.5" cy="5.5" r="1.5" fill="#F59E0B" stroke="none"></circle>
        </svg>`,

        'scores': `<svg viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
            <path d="M4 22h16"></path>
            <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"></path>
            <path d="M8 2h8a4 4 0 0 1 4 4v3a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7V6a4 4 0 0 1 4-4z"></path>
        </svg>`,

        'wordl': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="4" height="4" rx="1" stroke="#4B5563"></rect>
            <rect x="10" y="4" width="4" height="4" rx="1" stroke="#4B5563"></rect>
            <rect x="17" y="4" width="4" height="4" rx="1" stroke="#4B5563"></rect>
            <rect x="3" y="10" width="4" height="4" rx="1" fill="#EAB308" stroke="none"></rect>
            <rect x="10" y="10" width="4" height="4" rx="1" fill="#22C55E" stroke="none"></rect>
            <rect x="17" y="10" width="4" height="4" rx="1" stroke="#4B5563"></rect>
            <rect x="3" y="16" width="4" height="4" rx="1" fill="#22C55E" stroke="none"></rect>
            <rect x="10" y="16" width="4" height="4" rx="1" fill="#22C55E" stroke="none"></rect>
            <rect x="17" y="16" width="4" height="4" rx="1" fill="#22C55E" stroke="none"></rect>
        </svg>`,

    },

    get(id) {
        return this.library[id] || this.library['finder'];
    }
};

window.Icons = Icons;
