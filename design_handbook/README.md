# Nova OS-specific design notes

The family-wide source of truth now lives in [`../gramofdesign/`](../gramofdesign/):
colour themes, typography, spacing, radii, glass surfaces, buttons, controls and
Tabler UI icons all come from there.

This directory remains a reference for Nova-only behavior: infinite-space window
physics, expressive animation, the black-hole brand mark, and geometric app
marks. The historical HTML specimens below are snapshots, not a second token or
component system.

## Overview
Nova OS is an experimental browser-based operating system built by **gramoflava** ([github.com/gramoflava/novaos](https://github.com/gramoflava/novaos)). This design system documents the visual language, component patterns, and interaction model for the OS and its built-in apps.

The handoff package contains the full design system as documented HTML reference files. The goal is to extend or build on Nova OS's existing vanilla HTML/CSS/JS codebase using these patterns — not to port to a framework.

---

## About the Design Files
The files in this bundle are **design references created in HTML** — high-fidelity prototypes showing intended look, tokens, and behavior. They are not production code to copy directly. The task is to **recreate these designs inside the existing Nova OS codebase** (`gramoflava/novaos`) using its established vanilla HTML, CSS custom properties, and modular JS patterns.

---

## Fidelity
**High-fidelity.** All colors, typography, spacing, blur values, animation curves, and component structures are final and pixel-accurate. Implement them using the existing CSS custom property system documented below.

---

## Source Repository
```
https://github.com/gramoflava/novaos
```
CSS lives in `css/nova-*.css`. JS modules in `js/core/` and `js/apps/`. No build step — pure static files.

---

## Design Tokens

### Colors
```css
/* Surfaces (dark mode default) */
--surface-base:         #0E0E11;
--surface-glass:        rgba(20, 20, 25, 0.4);
--surface-glass-hover:  rgba(30, 30, 35, 0.5);
--surface-glass-active: rgba(40, 40, 45, 0.6);

/* Accents */
--accent-primary:   #6366F1;   /* Indigo — active states, shelf dot, focus ring */
--accent-secondary: #EC4899;   /* Pink — gradient endpoint, blob-2 */
--accent-tertiary:  #10B981;   /* Emerald — maximize btn, Calculator icon, blob-3 */
--accent-glow:      rgba(99, 102, 241, 0.5);

/* Signature gradient: always indigo → pink */
/* linear-gradient(90deg, #4F46E5, #EC4899) */

/* Text */
--text-primary:   #FFFFFF;
--text-secondary: rgba(255, 255, 255, 0.6);
--text-disabled:  rgba(255, 255, 255, 0.3);

/* Borders */
--border-glass:        rgba(255, 255, 255, 0.08);
--border-glass-strong: rgba(255, 255, 255, 0.15);

/* App accent colors */
--color-app-calculator:  #10B981;
--color-app-codex:       #6366F1;
--color-app-minesweeper: #EF4444;
--color-app-2048:        #8B5CF6;
--color-app-colorlines:  #3B82F6;
--color-app-wordl-green: #22C55E;
--color-app-wordl-amber: #EAB308;
--color-app-scores:      #FBBF24;

/* Window controls */
--color-wc-close:    #EF4444;
--color-wc-minimize: #F59E0B;
--color-wc-maximize: #10B981;
```

### Light Mode Overrides (`prefers-color-scheme: light`)
```css
--surface-base:         #F0F4FF;   /* soft lavender — NOT plain white */
--surface-glass:        rgba(255, 255, 255, 0.6);
--surface-glass-hover:  rgba(255, 255, 255, 0.8);
--surface-glass-active: rgba(255, 255, 255, 0.9);
--text-primary:   #0F172A;
--text-secondary: rgba(15, 23, 42, 0.7);
--text-disabled:  rgba(15, 23, 42, 0.4);
--border-glass:        rgba(0, 0, 0, 0.08);
--border-glass-strong: rgba(0, 0, 0, 0.15);
/* Blobs: opacity drops from 0.55 → 0.28 */
/* Stars overlay: display:none in light mode */
```

### Typography
```css
--font-sans: 'Outfit', -apple-system, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
/* Google Fonts import required: Outfit (300,400,500,600,700) + JetBrains Mono (400,500,700) */
```

| Role | Size | Weight | Color |
|---|---|---|---|
| Display/Hero | 48px | 700 | `--text-primary` |
| h1 / App title | 24px | 700 | `--text-primary` |
| h2 | 20px | 600 | `--text-primary` |
| Body | 14px | 400 | `--text-secondary` |
| Label / UI | 13px | 500 | `--text-secondary` |
| Caption / meta | 11px | 400 | `--text-disabled`, uppercase, `letter-spacing: 0.5px` |
| Monospace | 13px | 400 | `--text-primary`, `font-family: --font-mono` |
| Gradient text | 14px | 700 | `linear-gradient(90deg, #6366F1, #EC4899)` via `-webkit-background-clip: text` |

### Spacing
```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64px
```

### Border Radius
```
6px   small buttons, code, stat boxes
12px  context menu, notification cards
16px  windows, shelf items (48px item)
20px  system island, spotlight modal
32px  command shelf pill
50%   window control dots, running indicator dots
```

### Shadows
```css
--shadow-ambient:  0 0 40px rgba(0, 0, 0, 0.5);
--shadow-elevated: 0 20px 60px rgba(0, 0, 0, 0.7);
--shadow-inset:    inset 0 1px 1px rgba(255, 255, 255, 0.1);
--shadow-glow:     0 0 20px rgba(99, 102, 241, 0.5);
```
Every elevated surface uses `--shadow-elevated + --shadow-inset` together. The inset top-edge highlight simulates rim lighting and is **always** present on glass surfaces.

### Glassmorphism
```css
/* The universal glass recipe */
background: rgba(20, 20, 25, 0.4);  /* or surface-glass */
backdrop-filter: blur(Npx) saturate(180%);
-webkit-backdrop-filter: blur(Npx) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.08);   /* or 0.15 for strong */
box-shadow: 0 20px 60px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.1);

/* Blur level by component */
5px   — backdrop overlay (spotlight bg)
12px  — black hole preview bubble
24px  — system island, notifications
30px  — command shelf, context menu
40px  — windows, spotlight modal
```

### Animation
```css
--curve-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);  /* bouncy: window open, shelf hover, spotlight */
--curve-smooth: cubic-bezier(0.4, 0, 0.2, 1);              /* fluid: blob drift, fades, transitions */
--duration-fast: 150ms;   /* hover feedback */
--duration-base: 300ms;   /* transitions */
--duration-slow: 500ms;   /* page-level */
```

---

## Component Patterns

### Glass Window
```
border-radius: 16px
background: surface-glass (blur 40px)
border: 1px solid border-glass-strong (active) / border-glass (inactive)
box-shadow: shadow-elevated + shadow-inset (active) / shadow-ambient + shadow-inset (inactive)
transition: box-shadow 0.3s ease, border-color 0.3s ease
open animation: scale(0.95)→scale(1), opacity 0→1, 400ms spring
close animation: reverse, 200ms ease-in
```

**Titlebar** (48px, `border-bottom: 1px solid border-glass`, `cursor: grab`):
- Left: traffic light dots — close `#EF4444`, minimize `#F59E0B`, maximize `#10B981`, each 14px diameter
- Center: window title, 14px/600
- Right: 60px placeholder (balances controls)

**Window content area**: `background: rgba(0,0,0,0.15)`, `border-bottom-left-radius: 16px`, `border-bottom-right-radius: 16px`

### App Toolbar (inside content area, always first)
```
padding: 16px 20px 0
display: flex; justify-content: space-between; align-items: flex-end
```
- **Left column**: app title (24px/700) above controls row
- **Controls row**: dropdown select + "Restart" btn-secondary + optional "Forfeit" btn-danger, gap 6px
- **Right column**: 1–2 stat boxes, flush bottom

### Buttons
```css
/* base */
font-family: Outfit; font-size: 12px; font-weight: 500;
border-radius: 6px; padding: 5px 14px; cursor: pointer;
border: 1px solid transparent;

/* Secondary (default) */
background: rgba(128,128,128,0.12);
border-color: rgba(255,255,255,0.08);
color: --text-primary;

/* Primary */
background: linear-gradient(135deg, #6366F1, #5B5BD6);
border-color: rgba(99,102,241,0.4);
box-shadow: 0 0 12px rgba(99,102,241,0.3);

/* Danger (Forfeit) */
background: rgba(249,115,22,0.18);
border-color: rgba(249,115,22,0.4);
color: #F97316;
```

### Dropdown Select
```css
font-family: Outfit; font-size: 12px; font-weight: 500;
background: rgba(128,128,128,0.1);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 6px; padding: 5px 24px 5px 10px;
appearance: none;
/* custom chevron via background-image SVG */
```

### Stat Box
```css
background: rgba(128,128,128,0.1);
border: 1px solid rgba(255,255,255,0.06);
padding: 5px 12px; border-radius: 6px;
text-align: right; min-width: 56px;
/* label: 10px/400/uppercase/text-disabled */
/* value: 18px/600/text-primary */
```

### System Island
```
position: fixed; top: 20px; centered
height: 40px; border-radius: 20px; padding: 0 16px; gap: 20px
background: surface-glass; blur(24px) saturate(200%)
border: 1px solid border-glass-strong
box-shadow: shadow-elevated + shadow-inset
hover: scale(1.02)
```
- App name: gradient text (indigo→pink), 14px/700, letter-spacing 0.5px
- Clock: 14px/500
- Icon buttons: 16px SVG, `border-radius: 50%`, hover bg `rgba(255,255,255,0.1)`

### Command Shelf
```
position: fixed; bottom: 24px; centered
height: 64px; border-radius: 32px; padding: 0 12px; gap: 8px
background: surface-glass; blur(30px) saturate(150%)
border: 1px solid border-glass-strong
```
**Shelf item** (48×48px, `border-radius: 16px`):
- Hover: `background: rgba(255,255,255,0.07)`, `border: 1px solid border-glass`, `transform: translateY(-8px) scale(1.1)`, spring curve
- Active press: `transform: translateY(-4px) scale(0.95)`
- Running dot: `4×4px`, `border-radius: 50%`, `background: rgba(255,255,255,0.5)`, `bottom: -6px`
- Active dot: same + `background: accent-primary`, `box-shadow: 0 0 8px accent-glow`
- Divider: `1×32px`, `background: border-glass-strong`, `opacity: 0.5`

### Context Menu
```
background: rgba(20,20,25,0.85); blur(30px)
border: 1px solid border-glass-strong; border-radius: 12px
padding: 6px; min-width: 200px; font-size: 13px
```
- Item: `padding: 8px 12px`, `border-radius: 6px`
- Item hover: `background: accent-primary` (only case of full accent fill on hover)
- Separator: `height: 1px`, `background: border-glass`
- Shortcut: right-aligned, 11px, `color: rgba(255,255,255,0.35)`

### Spotlight Search
```
position: fixed; centered; padding-top: 15vh
backdrop: rgba(0,0,0,0.4) blur(5px)
modal: width 600px; blur(40px); border-radius: 20px
input: 28px/300 Outfit; padding 24px 32px
results: border-top border-glass per item; hover rgba(255,255,255,0.05)
animation: slideDown — translateY(-20px)→0, scale(0.95)→1, 300ms spring
```

### Settings Toggle
```css
width: 40px; height: 22px; border-radius: 11px;
/* on */  background: linear-gradient(90deg, #6366F1, #EC4899);
/* off */ background: rgba(255,255,255,0.15);
/* knob: 16×16px circle, white, left: 3px (off) / 21px (on), spring transition */
```

### Black Hole Remnant
Spawns at window-close position. Floats freely on the canvas. No interaction.
```
position: absolute; width: 120px; height: 120px; pointer-events: none
```
- Nebula halo: blurred radial-gradient circle (accent color), `filter: blur(8px)`, slow `scale + rotate` pulse (8s alternate)
- Rotating disc: SVG `<g>` with `transform-origin: center`, `animation: rotateDisc 60s linear infinite`
- Accretion streams: 3 `<path>` strokes with `stroke-dasharray` + `stroke-dashoffset` animation (`flowIn 9–12s linear infinite`)
- Event horizon: `<circle r="10" fill="#000">`
- Neutron star: `<circle r="2.5" fill="#fff">` with `twinkleStar 3s infinite alternate`
- Color: pick one of indigo / pink / emerald per remnant

### Cosmic Background (3 layers)
```
1. Base: #0E0E11 (light: #F0F4FF)
2. Stars: repeating radial-gradient dot pattern, 400×400px tile, drift downward 100s
   — hidden in light mode
3. Blobs: 3 large circles, filter:blur(120px)
   — dark: opacity 0.55 / light: opacity 0.28
   blob-1: 60vw, #6366F1, top-left
   blob-2: 50vw, #EC4899, bottom-right, delay -5s
   blob-3: 40vw, #10B981, center, delay -10s
   animation: 20s infinite alternate smooth — translate + scale
4. Noise: SVG fractalNoise, opacity 0.05, mix-blend-mode: overlay
5. Mask: -webkit-mask radial-gradient(ellipse at center, black 40%, transparent 95%)
```

---

## Screens / Views

| Screen | File reference |
|---|---|
| Full OS desktop prototype | `ui_kits/novaos/index.html` |
| Component language reference | `preview/component-language.html` |
| Icon library | `preview/icon-library.html` |
| Surface colors (translucent on bg) | `preview/colors-dark.html` |
| Accent & gradient palette | `preview/colors-accents.html` |
| Type scale | `preview/type-scale.html` |
| Font specimens | `preview/type-fonts.html` |
| Spacing, radius, shadow tokens | `preview/spacing-tokens.html` |
| Glass blur levels | `preview/glass-surfaces.html` |
| Animation curves | `preview/animation-curves.html` |
| Window chrome | `preview/component-window.html` |
| Island & shelf | `preview/component-shelf.html` |
| Buttons & controls | `preview/component-buttons.html` |
| Notifications & boot | `preview/component-notifications.html` |

---

## Assets

| File | Description |
|---|---|
| `assets/icons.js` | Full Nova OS SVG icon library — `window.Icons.get('id')` |
| `assets/gemini-blackhole.svg` | Gemini-inspired black hole SVG (used in window-close physics) |
| `colors_and_type.css` | All CSS custom properties, semantic aliases, type classes |

---

## Key Interactions to Implement

| Interaction | Spec |
|---|---|
| Window open | scale(0.95)→scale(1), opacity 0→1, 400ms `--curve-spring` |
| Window close | reverse, 200ms ease-in, then spawn black hole remnant at position |
| Shelf item hover | translateY(-8px) scale(1.1), 300ms spring |
| Shelf item press | translateY(-4px) scale(0.95) |
| Island hover | scale(1.02), 300ms smooth |
| Spotlight open | backdrop fade + modal slideDown 300ms spring |
| Maximize push | neighboring windows slide outward (gravity/mass physics) |
| Close black hole | surrounding windows slide inward |
| Boot sequence | progress bar fills 0→100% with gradient, then fade out 1s |
| Context menu | appears at cursor position, hover fills item with accent-primary |

---

## Notes for Claude Code

- The existing codebase uses **no build tools** — pure HTML/CSS/JS. Keep it that way.
- CSS custom properties are declared in `css/nova-theme.css`. Extend there; don't hardcode values.
- New apps follow the pattern in `js/apps/*.js` — register via `Apps.register({id, label, icon, launch})`.
- The window manager (`js/core/window-manager.js`) handles drag, resize, z-order, and physics — don't reimplement.
- `Bus.emit()` / `Bus.on()` (in `js/core/bus.js`) is the inter-module communication pattern — use it.
- Icons are defined in `js/utils/icons.js` as inline SVG strings in `Icons.library`. Add new icons there.
- Light/dark mode is **automatic** via `prefers-color-scheme` — no manual toggle, no JS.
