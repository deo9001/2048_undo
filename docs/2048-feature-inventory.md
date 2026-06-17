# 2048 Premium — Feature Inventory

| Section | Purpose | Snippet | Explanation |
|---------|---------|---------|-------------|
| **AppConfig** | Centralized configuration and version object | `window.AppConfig = { version: "3.0.0", maxUndoSteps: 50, … }` | All magic numbers (storage keys, limits, grid defaults) are sourced from here so they can be changed in one place. |
| **AppBridge** | Debug and testing API on `window` | `window.AppBridge.getState()` | Exposes stable programmatic methods (`move`, `undo`, `redo`, `restart`, `exportJSON`, `importJSON`) for automated testing and external integration. |
| **ThemeManager** | Light / Dark / System theme cycle | `ThemeManager.cycle()` | Writes a `data-theme` attribute to `<html>` which drives CSS custom properties. Persisted in `localStorage["2048_theme"]`. |
| **StatusBar** | Always-visible app state indicator | `StatusBar.set("Ready", "ready")` | Shows a coloured dot (green/amber/red) and a text message. Updated on init, move, game-over, import, error. |
| **Toast** | Ephemeral feedback notifications | `Toast.success("Game exported.")` | Three flavours: success (green), error (red), info (blue). Auto-dismissed after 2.8 s; styled with entrance/exit animations. |
| **ConfirmDialog** | Prevents accidental new-game | `ConfirmDialog.ask("Start a new game?")` | Promise-based; resolves `true` (proceed) or `false` (cancel). Triggered when score > 0 and game is not over. |
| **ImportModal** | Paste-JSON import flow | `ImportModal.open().then(raw => …)` | Opens a modal with a textarea; validates JSON shape and grid dimensions before restoring state. |
| **HelpPanel** | Collapsible keyboard-shortcut reference | `HelpPanel.toggle()` | Toggled by `?` key or the `?` button. Keeps `aria-expanded` in sync on the trigger button. |
| **FullscreenOverlay** | Maximised board view | `FullscreenOverlay.toggle()` | Moves the game-container DOM node into a fixed overlay; moves it back on close. Score bar mirrored at top of overlay. |
| **skip-nav link** | Accessibility — skip to game board | `<a class="skip-nav" href="#game-container">` | First focusable element; becomes visible on focus so keyboard users can jump past the header. |
| **ARIA live region** | Screen-reader announcements | `ariaAnnounce("Move undone.")` | Uses `aria-live="assertive"` so moves, game-over, undo/redo, import results are announced immediately. |
| **Undo button** | Step back one move | `<button id="undo-button" disabled>` | Disabled when `undoStack` is empty. Keyboard shortcut: Ctrl+Z. Stack depth: up to 50. |
| **Redo button** | Re-apply an undone move | `<button id="redo-button" disabled>` | Disabled when `redoStack` is empty. Keyboard shortcut: Ctrl+Y / Ctrl+Shift+Z. |
| **New Game button** | Reset the board | `<button id="new-game-button">` | Shows confirmation dialog when progress exists. Keyboard shortcut: R. |
| **Export button** | Download state as JSON | `<button id="export-btn">` | Serializes grid, stacks, timer, best score, version; triggers browser download. Keyboard shortcut: E. |
| **Import button** | Restore from JSON | `<button id="import-btn">` | Opens ImportModal; validates and restores. Handles grid-size changes. Keyboard shortcut: I. |
| **Theme button** | Cycle theme | `<button id="theme-btn">` | Cycles Light → Dark → System. Keyboard shortcut: T. |
| **Fullscreen button** | Enter/exit fullscreen | `<button id="fullscreen-btn">` | Toggles FullscreenOverlay. Keyboard shortcut: F. |
| **Help button** | Show shortcut panel | `<button id="help-btn">` | Toggles HelpPanel; manages `aria-expanded`. Keyboard shortcut: ?. |
| **Score chip** | Current session score | `<span id="score-value">` | Updated on every actuate; animates +N additions above the chip. |
| **Best chip** | All-time best for this grid | `<span id="best-value">` | Persisted per grid size (`bestScore_4x4`). Updated when current score exceeds it. |
| **Moves chip** | Move counter | `<span id="moves-value">` | Incremented on every move that results in tile movement. Persisted and restored with game state. |
| **Timer chip** | Elapsed game time | `<span id="timer-value">` | Counts up from 00:00. Paused on game-over/win. Accumulated correctly across reloads and undo/redo. |
| **Preset buttons** | Quick grid-size presets | `<button data-width="4" data-height="4">4×4</button>` | 3×3, 4×4, 5×5, 6×6, 7×7. Active button highlighted. Triggers `initGame()`. |
| **Custom grid inputs** | Arbitrary grid dimensions | `<input id="custom-width">` | 3–10 per axis. Validated on apply; out-of-range values are clamped. |
| **Game message overlay** | Win / Game-over announcements | `.game-message.game-won` | Semi-transparent overlay with "You win!" or "Game over!". Includes Keep Going and Try Again actions. |
| **LocalStorageManager** | Persistence layer | `this.storage.setItem(key, JSON.stringify(state))` | Prefixed with `2048_`. Falls back to `fakeStorage` (in-memory) if `localStorage` is unavailable. Catches quota errors. |
| **Generation counter** | Stale-callback safety | `if (self._generation !== gen) { clearInterval(…); return; }` | Incremented on every `initGame()` call. Timer callbacks self-cancel when they detect a stale generation. |
| **GameManager.serialize()** | State snapshot | `{ grid, score, undoStack, redoStack, moveCount, elapsedMs }` | Full game state including both history stacks; written to `localStorage` on every move. |
| **Grid / Tile classes** | Core game model | `new Grid(4, 4); new Tile({x,y}, value)` | Unchanged from original. `Grid.serialize()` / `Tile.serialize()` produce plain objects safe for JSON round-trips. |
| **HTMLActuator** | DOM rendering layer | `actuator.actuate(grid, metadata)` | Called via `requestAnimationFrame`. Rebuilds tile container; dynamically generates position CSS for any grid size. |
| **KeyboardInputManager** | Input handling | `document.addEventListener("keydown", …)` | Tracks all added listeners in `_handlers[]` for clean `destroy()` on grid-size change. Supports arrows, WASD, vim HJKL, touch swipe. |
| **CSS custom properties** | Design token system | `--bg: #faf8ef; --board-bg: #bbada0;` | All colours defined as variables in `:root` (light) and `[data-theme="dark"]`. System preference via `@media (prefers-color-scheme: dark)`. |
| **Responsive breakpoints** | Mobile / tablet / desktop | `@media (max-width: 680px)` | Font size, padding, button sizes scale down. Custom grid inputs stack vertically on narrow screens. |
| **Reduced-motion** | Honour OS preference | `@media (prefers-reduced-motion: reduce)` | All animation and transition durations set to `0.01ms`. |
| **Focus-visible styles** | Keyboard focus ring | `:focus-visible { outline: 3px solid var(--focus-ring); }` | Orange ring on all interactive elements. Mouse users see no ring; keyboard users always do. |
