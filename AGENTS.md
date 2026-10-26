# Agent rules

## Design
- Built on gramof design: `../gramofdesign` (github.com/gramoflava/gramofdesign). Read its README before any visual/UX change. Vendored `gramofdesign/` = deploy copy, never edit.
- Order: gramof has it → use it. Reusable → add to gramofdesign, `../gramofdesign/check.py --sync`. Site-only → build here from tokens; new values = `--nova-*` tokens.
- No raw sizes/weights/durations/colours in rules. Don't restyle shared components; scope to site classes.
- Before commit: `../gramofdesign/check.py .` → all clear.

## Site: physics-first world (owned drifts, `.gramof.json`)
- `viewport-zoom`: zoom blocked; it fights the camera/window manager. Deliberate for now — do not change.
- `motion`: springs, star drift, bursts, game feedback on own clocks (100 ms–100 s).
- `colour`: fixed game/window-control palettes.
- Expressive tier. Everything else is family: `--nova-text-*` only where the scale lacks a step; weights ≤ 600.
- Fragile: small visual steps; verify desktop, phone layout and every app.
