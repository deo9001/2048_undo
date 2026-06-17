# 2048 Premium — Implementation Report

## Executive Summary

The original `standalone/code.html` was a fully self-contained ~1 500-line monolithic HTML/CSS/JS file that delivered the core 2048 game with grid-size selection and undo functionality. While functional, it was difficult to maintain, lacked accessibility, and offered no quality-of-life features beyond the basics.

This renovation split the file into three dedicated assets, added a full suite of premium features (redo, themes, import/export, fullscreen, move timer, stats, keyboard help, toasts, confirm dialogs, ARIA annotations, and more), and documented the whole system for future developers.

---

## Architecture

### File Structure

```
standalone/
  code.html               ← Declarative HTML entry point (links assets)
  assets/
    style.css             ← All styles: tokens, theming, responsive, components
    app.js                ← All game logic, UI, lifecycle, AppConfig, AppBridge
  code_features.csv       ← Pre-existing feature inventory (retained)
  code_report.txt         ← Pre-existing report (retained)
docs/
  2048-renovation-report.md      ← This file
  2048-feature-inventory.md      ← Feature table
  2048-troubleshooting.md        ← Issue / Cause / Fix matrix
  2048-lessons-learned.md        ← Developer notes
```

### Initialization Sequence

1. HTML parsed; `<link>` and `<script>` tags load assets in order.
2. `DOMContentLoaded` fires in `app.js`.
3. `StatusBar.init()`, `ThemeManager.init()`, `HelpPanel.init()`, `FullscreenOverlay.init()`, `ConfirmDialog.init()`, `ImportModal.init()` each attach to their DOM elements.
4. Preset-button and custom-grid event listeners are attached.
5. `window.requestAnimationFrame` schedules `initGame(4, 4)`.
6. `initGame` increments the global `_generation` counter, creates a new `GameManager`, which in turn creates `KeyboardInputManager` (attaches all event listeners), `HTMLActuator`, and `LocalStorageManager`.
7. `GameManager.setup()` attempts to restore a saved game from `localStorage`; if none exists a fresh board is generated.
8. `GameManager.actuate()` calls `HTMLActuator.actuate()` → `requestAnimationFrame` → DOM update.
9. Status bar shows "Ready" and `window.AppBridge._game` is set.

### Centralized Configuration

```js
window.AppConfig = {
  version: "3.0.0",
  name: "2048 Premium",
  defaultWidth: 4, defaultHeight: 4,
  minSize: 3, maxSize: 10,
  maxUndoSteps: 50,
  themeKey: "2048_theme",
  storagePrefix: "2048_",
  targetTile: 2048,
  startTiles: 2
};
```

All magic numbers (storage keys, limits) are sourced from `AppConfig`.

### Debug / Testing Bridge

```js
window.AppBridge = {
  getState(),     // returns serialized game state
  getScore(),     // current score
  getBestScore(), // best score for this grid size
  move(dir),      // programmatic move (0=up,1=right,2=down,3=left)
  undo(), redo(), restart(),
  newGame(w, h),  // re-init with new dimensions
  exportJSON(),   // returns JSON string without downloading
  importJSON(str) // programmatic import
};
```

---

## Workflow Descriptions

### Happy Path

1. User opens `standalone/code.html` in a browser.
2. The 4×4 board loads with two tiles. Score = 0.
3. User presses arrow keys (or swipes) to merge tiles.
4. Score increments; tile animations play.
5. Reaching 2048 shows "You win!" overlay with Keep Going / Try Again buttons.
6. Progress is auto-saved to `localStorage` on every move; it persists across page reloads.

### Undo / Redo

- Up to 50 undo steps are stored in memory (and persisted via `localStorage`).
- Each successful move pushes the pre-move state onto `undoStack` and clears `redoStack`.
- Undo pops from `undoStack`, pushes to `redoStack`, restores state.
- Redo pops from `redoStack`, pushes to `undoStack`, restores state.
- Both buttons are disabled (grey) when their respective stacks are empty.

### New Game with Confirmation

When the current score > 0 and the game is not over, clicking "New Game" (or pressing R) shows a confirmation dialog. Confirming clears the undo/redo stacks, resets the timer, clears localStorage, and starts fresh.

### Import / Export

- **Export**: Serializes the full game state (grid, score, stacks, timer, best score, version) to JSON and triggers a browser download.
- **Import**: Opens a modal with a `<textarea>`; the user pastes exported JSON. The importer validates shape, grid dimensions, score range, and version compatibility before restoring.

### Theme Cycle

Pressing T (or clicking ☀️) cycles Light → Dark → System. The choice is stored in `localStorage["2048_theme"]`. `data-theme` on `<html>` drives CSS custom properties.

### Fullscreen Mode

Pressing F (or clicking ⛶) moves the game container into a fixed fullscreen overlay. Escape or the ✕ button moves it back to its original DOM position. Score bar mirrors current score in the overlay.

### Help Panel

Pressing ? toggles a collapsible shortcut reference below the main controls. The `aria-expanded` state is kept in sync on the toggle button.

---

## Technical Decisions

| Decision | Rationale |
|---|---|
| Single `app.js` (not ES modules) | No build step required; game opens directly from filesystem. |
| CSS custom properties for theming | Single `data-theme` attribute flip; no JS manipulation of individual colours. |
| Prototype-based JS (no classes) | Consistent with original code style; avoids introducing a transpiler dependency. |
| `_generation` counter | Prevents stale `setInterval` callbacks from a prior game session running after a grid size change. |
| Blob URL for export | Works offline without a server; URL revoked after 3 s to avoid memory leaks. |
| `ConfirmDialog` as Promise | Non-blocking; resolves cleanly when the user confirms or cancels. |
| `localStorage` key prefixed `2048_` | Avoids collision with other apps sharing the same origin. |
| `FakeStorage` fallback | Safari private mode and some browsers disable `localStorage`; the fallback keeps the game functional for the session. |

---

## Known Limitations

- **No real-time multiplayer or cloud sync** — state is local only.
- **Export is JSON-only** — no PNG/screenshot export.
- **Seeded/replayable game** — random tile placement is not seeded, so replaying from a save point produces a different game from the original.
- **Grid > 7×7** is capped at 10×10; very large grids produce tiny tiles on small screens.
- **Timer precision** — the timer uses `setInterval(1000)` so it can drift a few ms per minute; it is intended as a comfort feature, not a high-precision clock.
- **Reduced-motion** — CSS transitions are suppressed via `prefers-reduced-motion`; JavaScript animations (tile pop/appear) still fire but at near-zero duration.

---

## Extensibility Hooks

- **`window.AppConfig`** — change `targetTile`, `maxUndoSteps`, `startTiles`, or `defaultWidth/Height` to alter game behaviour without touching logic.
- **`window.AppBridge`** — stable testing and integration API; extend with new methods as needed.
- **CSS custom properties** — add new themes by declaring a `[data-theme="custom"]` block in `style.css` and cycling to it via `ThemeManager`.
- **`LocalStorageManager._key()`** — sub-prefix keys here to namespace saves by user or profile.
- **`GameManager.serialize()`** — add fields to the return object to persist new state (e.g., achievements, power-ups) without touching other layers.
- **`HTMLActuator.actuate()`** — add fields to the `metadata` parameter to drive new UI elements.
