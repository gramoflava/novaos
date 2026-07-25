# Contributing to Nova OS

We're thrilled you want to help map this digital space! Nova OS is an experimental project pushing the bounds of pure front-end spatial computing.

## Development Philosophy

- **Zero Build Tools:** We rely 100% on Vanilla JavaScript (ES6+), CSS3 custom properties and HTML5. No Webpack, no React, no Tailwind.
- **Smoothness Above All:** Any changes to the `WindowManager` or structural CSS must maintain smooth 60fps animations. Use `translate3d` over positional absolute recalculations to preserve GPU power.
- **Shared Design Language:** Use `gramofdesign/gramof.css` for family-wide tokens and components. Keep `css/nova-theme.css` for Nova app marks, window controls and gradients only. Geometric SVGs in `js/utils/icons.js` are app marks; interface actions use Tabler files from `gramofdesign/icons/`.
- **Cosmic Positioning & Fluid Physics:** Nova is fundamentally visually engaging but tangibly swift. Treat interactive elements as having mass—windows pull toward collapsing black holes or forcefully push their neighbors aside when expanding. App spawning should be a rapid and chaotic spread to mimic celestial scattering, leaning into our physics-led approach for spatial navigation.
- **Clear Game End States:** All games must provide obvious visual feedback upon conclusion (e.g., Game Over overlays or board resets) and ensure a clear, accessible path to Restart directly from the game's toolbar.
- **Redundancy-Free UI:** Since app names are consistently provided in the window titlebars, avoid duplicating app titles within the app body or toolbars. Prioritize compact, single-row layouts for controls and stats.

## How to Submit Changes

1. Fork the repository and run it locally via `python3 -m http.server 8080`.
2. Create your feature branch (`git checkout -b feature/AmazingIdea`).
3. If creating a new app, model it after lightweight examples like `js/apps/calculator.js` and be sure to register it in `Apps.register({...})`.
4. Run manual panning and scaling tests to ensure your app hooks properly into the `WindowManager` without dragging regressions.
5. Commit, push, and submit a Pull Request.

Thank you for exploring Nova!
