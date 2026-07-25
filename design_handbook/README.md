# Nova OS-specific design notes

Nova OS uses the family-wide design language bundled in
[`../gramofdesign/`](../gramofdesign/). That folder is the only source of truth
for colour themes, typography, spacing, radii, glass surfaces, controls and
Tabler UI icons.

The HTML files in this directory are historical visual specimens. They may help
explain the original direction, but their tokens and component code are not
production contracts.

## What remains Nova-specific

### Expressive tier

Nova OS is the only family site using:

```html
<html data-accent="novaos" data-tier="expressive">
```

The expressive tier raises glass depth, blur and radius, and supplies the
animated three-blob Cosmos background. The starfield and noise layer remain
Nova-only additions.

### Infinite desktop

On desktop, the window manager owns:

- drag, resize, z-order and camera movement;
- infinite-space panning and zoom;
- window push and collapse physics;
- minimize, maximize and black-hole close effects.

On phones, these behaviours are deliberately gated off. Only one window is
shown at a time and the shelf becomes the shared `.tabbar`.

### Brand mark

[`assets/gemini-blackhole.svg`](assets/gemini-blackhole.svg) is the Nova OS
brand mark. It appears in the boot sequence, system island, title bars and
favicon. Do not redraw or replace it with a UI icon.

### App marks

Nova's geometric icon library is reserved for app identities:

- Files
- Calculator
- Codex
- Minesweeper
- 2048
- Color Lines
- Wordl
- Scores

Settings and every interface action use Tabler sources from
`../gramofdesign/icons/`. UI icons do not belong in the geometric app-mark
library.

### Nova vocabulary

Project-only tokens in `css/nova-theme.css` are limited to:

- `--color-app-*` for app marks;
- `--color-wc-*` for desktop window controls;
- Nova gradient endpoints.

All other surfaces, text, borders, shadows, radii, motion and theme values come
from `gramofdesign/gramof.css`.

## Implementation boundaries

- Keep the existing vanilla HTML, CSS and JavaScript architecture.
- Extend apps through `Apps.register()`.
- Keep window behaviour in `js/core/window-manager.js`.
- Use `Bus.emit()` and `Bus.on()` for cross-module events.
- Use the shared Light / Auto / Dark switch; Auto follows the system.
- Treat the historical specimens as references, never as a second design
  system.
