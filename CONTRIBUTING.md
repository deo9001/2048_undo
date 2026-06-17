# Contributing

Thanks for contributing to `deo9001/2048_undo`.

## Scope

This repository currently ships a static browser app centered on:

- `standalone/code.html`
- `standalone/assets/app.js`
- `standalone/assets/style.css`

Please avoid introducing unrelated build systems or tooling unless clearly needed.

## Local setup

No dependency installation is required for normal development.

1. Clone/fork the repository.
2. Run a static server from the repository root (or open `standalone/code.html` directly).
3. Test your change in a browser.

Example:

```bash
cd 2048_undo
python -m http.server 8000
```

Open `http://localhost:8000/standalone/code.html`.

## Before opening a PR

- Keep changes focused and minimal.
- Verify gameplay paths impacted by your change (movement, merge behavior, game over/win flow).
- If your change touches premium features, verify relevant workflows:
  - undo/redo
  - import/export
  - persistence after reload
  - theme and fullscreen controls
  - keyboard shortcuts/help panel
- Verify accessibility is not regressed (focus order, labels, keyboard operation).
- Update docs in `docs/` and/or `README.md` when behavior changes.

## Style guidance

- Follow the existing style in each file.
- Keep browser compatibility and defensive checks used in the current codebase.
- Prefer small PRs with clear rationale.
