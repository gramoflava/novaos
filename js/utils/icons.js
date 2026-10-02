// Nova OS app marks.
// One construction for every app: 24 grid, 1.75 rounded stroke in the app's
// hue, the same hue as a soft fill (opacity .2), and one solid "spark" detail.
// Hues come from css/nova-theme.css (.app-mark--<id>): lighter in dark mode,
// deeper in light mode. No gradients or ids, so a mark can repeat on a page.
// Interface actions use the shared Tabler set in gramofdesign/icons/, never these.
const Icons = {
    library: {
        // Fallback for anything without a mark of its own.
        'finder': `<svg class="app-mark app-mark--finder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1 -2 2h-13a2 2 0 0 1 -2 -2z" fill="currentColor" fill-opacity=".2"/>
        </svg>`,

        // Codex: an open book with a star on the right page.
        'codex': `<svg class="app-mark app-mark--codex" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 6.5c-2.2 -1.6 -5.4 -2 -8.5 -1.5v13.5c3.1 -.5 6.3 -.1 8.5 1.5c2.2 -1.6 5.4 -2 8.5 -1.5v-13.5c-3.1 -.5 -6.3 -.1 -8.5 1.5z" fill="currentColor" fill-opacity=".2"/>
            <path d="M12 6.5v13"/>
            <path d="M16.5 8.6c.2 1.5 .9 2.2 2.4 2.4c-1.5 .2 -2.2 .9 -2.4 2.4c-.2 -1.5 -.9 -2.2 -2.4 -2.4c1.5 -.2 2.2 -.9 2.4 -2.4z" style="fill:var(--spark)" stroke="none"/>
        </svg>`,

        // Settings: a dial with three knobs on its rim.
        'settings': `<svg class="app-mark app-mark--settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="7.5" fill="currentColor" fill-opacity=".2"/>
            <circle cx="12" cy="12" r="2.6"/>
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4 -1.4M17.3 6.7l1.4 -1.4"/>
            <circle cx="12" cy="12" r="1.1" style="fill:var(--spark)" stroke="none"/>
        </svg>`,

        // Calculator: a body, a lit display and an equals key.
        'calculator': `<svg class="app-mark app-mark--calculator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="5" y="2.75" width="14" height="18.5" rx="3.5" fill="currentColor" fill-opacity=".2"/>
            <rect x="8" y="6" width="8" height="3.5" rx="1" style="fill:var(--spark)" stroke="none"/>
            <path d="M8.5 13.25h.01M12 13.25h.01M15.5 13.25h.01M8.5 17h.01M12 17h.01"/>
            <path d="M14.75 16.25h2M14.75 18h2" stroke-width="1.5"/>
        </svg>`,

        // Minesweeper: a mine with eight spikes and a glint.
        'minesweeper': `<svg class="app-mark app-mark--minesweeper" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5.75" fill="currentColor" fill-opacity=".2"/>
            <path d="M12 3.5v2.75M12 17.75v2.75M3.5 12h2.75M17.75 12h2.75M6 6l1.9 1.9M16.1 16.1l1.9 1.9M6 18l1.9 -1.9M16.1 7.9l1.9 -1.9"/>
            <circle cx="10.1" cy="10.1" r="1.5" style="fill:var(--spark)" stroke="none"/>
        </svg>`,

        // 2048: four tiles that grow toward the merged corner.
        'game2048': `<svg class="app-mark app-mark--game2048" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3.5" y="3.5" width="7" height="7" rx="2"/>
            <rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="currentColor" fill-opacity=".2"/>
            <rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="currentColor" fill-opacity=".2"/>
            <rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor" stroke="none"/>
        </svg>`,

        // Color Lines: five in a row, three of them showing.
        'colorlines': `<svg class="app-mark app-mark--colorlines" viewBox="0 0 24 24" fill="none" stroke-linecap="round" aria-hidden="true">
            <path d="M4 20l16 -16" style="stroke:var(--neutral)" stroke-width="1.5" stroke-dasharray=".01 3.5" opacity=".7"/>
            <circle cx="6.5" cy="17.5" r="3.25" fill="#60a5fa"/>
            <circle cx="12" cy="12" r="3.25" fill="#34d399"/>
            <circle cx="17.5" cy="6.5" r="3.25" fill="#f472b6"/>
            <circle cx="5.5" cy="16.5" r="1" fill="#fff" opacity=".55"/>
            <circle cx="11" cy="11" r="1" fill="#fff" opacity=".55"/>
            <circle cx="16.5" cy="5.5" r="1" fill="#fff" opacity=".55"/>
        </svg>`,

        // Columns: three gems falling into a well.
        'columns': `<svg class="app-mark app-mark--columns" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5.5 4v14.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-14.5" style="stroke:var(--neutral)" stroke-width="1.75"/>
            <path d="M12 3l3 2.5l-3 2.5l-3 -2.5z" fill="#f472b6"/>
            <path d="M12 8.75l3 2.5l-3 2.5l-3 -2.5z" fill="#22d3ee"/>
            <path d="M12 14.5l3 2.5l-3 2.5l-3 -2.5z" fill="#fbbf24"/>
        </svg>`,

        // Wordl: a guess row that turns from grey to amber to green.
        'wordl': `<svg class="app-mark app-mark--wordl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2.75" y="4" width="5.5" height="5.5" rx="1.5" style="stroke:var(--neutral)"/>
            <rect x="9.25" y="4" width="5.5" height="5.5" rx="1.5" style="stroke:var(--neutral)"/>
            <rect x="15.75" y="4" width="5.5" height="5.5" rx="1.5" style="stroke:var(--neutral)"/>
            <rect x="2.75" y="14.5" width="5.5" height="5.5" rx="1.5" fill="#facc15" stroke="none"/>
            <rect x="9.25" y="14.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" stroke="none"/>
            <rect x="15.75" y="14.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" stroke="none"/>
        </svg>`,

        // Nova Run: a helmet cresting the lunar horizon, with speed lines.
        'novarun': `<svg class="app-mark app-mark--novarun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2.5 19.5c5.5 -3 13.5 -3 19 0"/>
            <circle cx="13" cy="10" r="5" fill="currentColor" fill-opacity=".2"/>
            <path d="M10.5 9.5a2.5 2 0 0 1 5 0v.5a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1z" style="fill:var(--spark)" stroke="none"/>
            <path d="M3 9h3M2.5 12h2.5"/>
        </svg>`,

        // Scores: a medal on a ribbon, with a star.
        'scores': `<svg class="app-mark app-mark--scores" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 2.75l2.5 6M16 2.75l-2.5 6"/>
            <circle cx="12" cy="15" r="6" fill="currentColor" fill-opacity=".2"/>
            <path d="M12 11.6l1 2.1l2.3 .3l-1.65 1.6l.4 2.3l-2.05 -1.1l-2.05 1.1l.4 -2.3l-1.65 -1.6l2.3 -.3z" style="fill:var(--spark)" stroke="none"/>
        </svg>`,
    },

    get(id) {
        return this.library[id] || this.library['finder'];
    }
};

window.Icons = Icons;
