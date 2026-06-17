# 2048 Premium (Undo)

This repository contains a renovated, multi-file browser version of 2048 with premium UX improvements (undo/redo, import/export, themes, fullscreen, accessibility, and guided help).

## Current app entry point

- Main app: `standalone/code.html`
- Scripts: `standalone/assets/app.js`
- Styles: `standalone/assets/style.css`

Open `standalone/code.html` in a modern browser to play.

## Features

- Classic 2048 gameplay with keyboard and touch input
- Undo/redo history (up to configured limit)
- New game confirmation and status feedback
- Import/export full game state (JSON)
- Persistent progress and best score via `localStorage`
- Theme cycling (light/dark/system)
- Fullscreen gameplay mode
- In-app keyboard shortcut help panel
- Accessibility improvements (skip link, ARIA live regions, focus-visible support)

## Local run

No build step is required.

Options:

1. Open `standalone/code.html` directly in a browser, or
2. Serve the repository with a static server and open `standalone/code.html`.

Example with Python:

```bash
cd 2048_undo
python -m http.server 8000
```

Then visit `http://localhost:8000/standalone/code.html`.

## Project structure

- `standalone/code.html` — app shell and UI structure
- `standalone/assets/app.js` — game logic, state, persistence, bridge APIs
- `standalone/assets/style.css` — theming, layout, responsive styles
- `docs/2048-renovation-report.md` — implementation report
- `docs/2048-feature-inventory.md` — feature inventory
- `docs/2048-troubleshooting.md` — troubleshooting matrix
- `docs/2048-lessons-learned.md` — lessons learned

## Docs

See `docs/` for architecture notes, feature inventory, troubleshooting, and renovation details.

## Contributing

Please read `CONTRIBUTING.md` for setup and contribution guidance.

## License

MIT. See `LICENSE.txt`.
