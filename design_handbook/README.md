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

[`assets/nova-emblem.svg`](assets/nova-emblem.svg) is the Nova OS emblem: a
four-point star (the nova) inside a tilted orbit, indigo to pink like the
wordmark. It appears on the boot screen and in the system island. The favicon
is the same star and orbit in white on the indigo squircle
(`gramofdesign/marks/novaos.svg`). Title bars show the app's own mark.

### App marks

Every app, Settings included, has its own mark in `js/utils/icons.js`. One
construction for all of them: 24 grid, 1.75 rounded stroke in the app's hue,
the same hue as a soft fill (opacity .2), and one solid spark detail. Hues live
in `css/nova-theme.css` (`.app-mark--<id>`): 400 tones in dark mode, 600 tones
in light. Multicolour games (Color Lines, Columns, Wordl) keep fixed piece
colours. Marks use no gradients or ids, so one can appear several times on a
page (shelf, title bar, spotlight).

Interface actions use Tabler sources from `../gramofdesign/icons/`. App marks
never stand in for UI icons, and Tabler icons never stand in for apps.

### Nova vocabulary

Project-only tokens in `css/nova-theme.css` are limited to:

- `.app-mark--*` hues for app marks;
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
