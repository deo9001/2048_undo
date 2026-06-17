# 2048 Premium — Troubleshooting Matrix

## Game / Gameplay

**Issue:** Board does not appear; page is blank or shows only the header.  
**Cause:** `assets/app.js` or `assets/style.css` failed to load (wrong path, file missing, or server-side path restriction).  
**Fix:** Open browser DevTools → Console and Network tabs. Confirm both files return HTTP 200. Check that `code.html` is opened from the `standalone/` directory, not its parent. If opened as a local `file://` URL, all assets must be relative siblings.

---

**Issue:** Game starts but tiles have no colour / appear as plain white boxes.  
**Cause:** `style.css` loaded but the `[data-theme]` attribute on `<html>` was removed or its value is unrecognised.  
**Fix:** Open DevTools → Elements and confirm `<html data-theme="light">` or `"dark"` or `"system"` is present. Call `ThemeManager.init()` in the console to restore the default.

---

**Issue:** Arrow keys do not move tiles; nothing happens.  
**Cause:** Focus is on a text input (e.g., the custom-width field) rather than the document, so `keydown` is consumed by the input.  
**Fix:** Click anywhere on the board or press Tab to focus the game container (`#game-container`). The game registers `keydown` on `document`, so focus on the game container itself is not required — but a focused `<input>` will prevent arrow-key events from reaching the handler.

---

**Issue:** Undo / Redo buttons remain disabled even after several moves.  
**Cause:** A grid-size change was performed between moves; `initGame()` calls `KeyboardInputManager.destroy()` which clears events, then creates a new `GameManager` with empty stacks.  
**Fix:** This is expected behaviour — history does not carry over after a grid-size change. After the first move on the new grid, Undo will become enabled.

---

**Issue:** Score resets to 0 on every page refresh.  
**Cause:** `localStorage` is unavailable (private/incognito mode, browser setting, quota exceeded) so `FakeStorage` is used — which is in-memory only.  
**Fix:** Check DevTools → Application → Local Storage for the `2048_` keys. Allow `localStorage` for the origin, or use Export to save progress manually.

---

**Issue:** "Game over!" overlay appears but the board still has empty cells and merges.  
**Cause:** A logic error or stale state in `movesAvailable()` — should not occur in the current code, but can happen if `Grid` cells are mutated without going through `insertTile`/`removeTile`.  
**Fix:** Call `AppBridge.getState()` in the console; examine the `grid.cells` array for unexpected `null` vs `Tile` values. If detected, `AppBridge.restart()` to reset cleanly.

---

## Import / Export

**Issue:** Import fails with "Invalid JSON" even though the file appears correct.  
**Cause:** The JSON file contains a BOM (byte-order mark) or was saved with Windows line endings that confuse `JSON.parse`.  
**Fix:** Open the file in a text editor, ensure it is saved as UTF-8 without BOM and without a trailing comma after the last property.

---

**Issue:** Import succeeds but the grid looks wrong (tiles in wrong positions).  
**Cause:** The imported JSON has `gridWidth` / `gridHeight` that differ from the current board dimensions; the importer switches dimensions automatically but the HTML inputs may still show old values.  
**Fix:** This is handled automatically — the importer updates `#custom-width`, `#custom-height`, and `#current-grid-size`. If mismatches persist, use `AppBridge.getState()` to inspect `gridWidth` and `gridHeight` in the restored state.

---

**Issue:** Export download does not trigger.  
**Cause:** The browser blocked the programmatic click on the anchor element (popup blocker or sandboxed iframe policy).  
**Fix:** Use `AppBridge.exportJSON()` in the DevTools console; copy the returned JSON string and paste it into a file manually.

---

## Theme

**Issue:** Theme does not switch; the page stays light/dark regardless of the button.  
**Cause:** A CSS specificity conflict overrides `[data-theme="dark"]` variables, or the `data-theme` attribute is being set on `<body>` instead of `<html>`.  
**Fix:** Open DevTools → Elements and confirm the attribute lands on `<html>`. Search `style.css` for any hardcoded `background` or `color` rules that are not using CSS variables.

---

**Issue:** Dark theme has unreadable white-on-white text in tile containers.  
**Cause:** A CSS rule targeting `.tile .tile-inner` sets `color: inherit` or another light value that overrides `var(--tile-fg-light)`.  
**Fix:** Search `style.css` for `.tile-inner` rules and confirm they reference `var(--tile-fg-light)` and `var(--tile-fg-dark)` rather than hard-coded hex values.

---

## Fullscreen

**Issue:** Exiting fullscreen leaves the game board inside the overlay (invisible on main page).  
**Cause:** `FullscreenOverlay.close()` failed to re-insert the game container because `originalParent` was `null` (init ran before the DOM was ready).  
**Fix:** Ensure `FullscreenOverlay.init()` is called after `DOMContentLoaded`. If the problem persists, call `document.getElementById("game-container").parentNode` in the console to check where the element currently lives, then manually move it back.

---

## Timer

**Issue:** Timer keeps running after game-over.  
**Cause:** `_stopTimer()` was not reached because `this.over` was set by an external call (e.g., `AppBridge`) that bypassed the normal `move()` path.  
**Fix:** Always call `AppBridge.restart()` (not direct property mutation) to change game state. The `_stopTimer()` call in `GameManager.restart()` will clean up.

---

## Accessibility

**Issue:** Screen reader does not announce "Game over!" after tiles stop.  
**Cause:** The game-message element uses `aria-live="assertive"` but the text content is set inside a `requestAnimationFrame` callback, which may fire after the live region has already been polled.  
**Fix:** The `ariaAnnounce()` helper updates `#aria-live` with a 10 ms delay flush. Confirm it is being called and that `#aria-live` exists in the DOM. Some screen readers require the live region to be present on page load (it is, in `code.html`).
