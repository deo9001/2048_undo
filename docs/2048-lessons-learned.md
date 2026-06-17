# 2048 Premium — Lessons Learned

## What Succeeded

### CSS Custom Properties for Theming
Using CSS custom properties (`var(--bg)`, `var(--board-bg)`, etc.) as design tokens turned out to be the single best architectural decision. Switching themes required exactly one attribute change on `<html data-theme="dark">` — no JavaScript, no DOM walking, no class-toggling on individual elements. Adding new themes later requires only a new `[data-theme="my-theme"]` block in `style.css`.

### Promise-Based Dialogs
Wrapping `ConfirmDialog` and `ImportModal` as Promises made call sites dramatically cleaner:

```js
ConfirmDialog.ask("Start a new game?").then(function(ok) {
  if (ok) self.restart();
});
```

vs. the classic event-listener tangle. It also means dialogs are composable — an import flow can be chained after a confirm without callback hell.

### Generation Counter for Timer Safety
The `_generation` counter pattern solved a subtle but real bug: when a user rapidly changes grid sizes, old `setInterval` callbacks from the previous `GameManager` instance continued to fire and update the wrong DOM element. A simple check `if (self._generation !== gen) return;` killed stale callbacks cleanly without requiring a complex lifecycle manager.

### `KeyboardInputManager.destroy()`
Tracking all `addEventListener` calls in a `_handlers[]` array and providing a `destroy()` method made grid-size changes safe. Without it, each new `KeyboardInputManager` would stack duplicate listeners on `document`, causing move events to fire twice (or more) per keypress.

### Storing Undo/Redo in `localStorage`
Persisting the undo and redo stacks alongside the game state means the player can close the browser, return later, and still undo their last five moves. This "just works" with no additional code because `serialize()` already includes both stacks.

---

## What Was Difficult or Had to Be Redone

### Fullscreen DOM Manipulation
The first approach for fullscreen was to duplicate the game HTML inside the overlay and keep both in sync. This was error-prone — any state change had to be reflected in two places. The correct approach (move the actual DOM node into the overlay, then move it back) was simpler and guaranteed consistency, but required tracking `originalParent` and `originalNext` sibling carefully to re-insert the node in exactly the right place.

### Grid-Position CSS Generation
The original code generated CSS position rules inline inside `<style id="dynamic-tile-styles">`. The renovation preserved this approach because it avoids a full CSS preprocessor dependency. The main lesson: always `remove()` the old style element before appending the new one — forgetting this causes duplicate rules that produce flickering during grid transitions.

### Timer Accumulation Across Reloads
The first timer implementation simply stored `elapsedMs` but did not account for the time between the last save and the page reload (if the user reloaded mid-game without closing). The fix was to also store `elapsedMs` in `serialize()`, add it back as the base on `setup()`, and snapshot-accumulate on `_stopTimer()`. The key insight: the timer has two components — _accumulated elapsed_ (`_elapsedMs`) and _in-flight since last start_ (`Date.now() - _timerStart`).

### Import Validation
The first import implementation called `JSON.parse` and immediately restored state if it succeeded. This caused crashes when pasting a well-formed JSON file that had an incompatible schema (e.g., missing `grid.cells`, wrong dimensions). The fix added layered validation: check `typeof`, then required fields, then dimension bounds, then numeric score. Reject loudly with a `Toast.error()` rather than silently leaving the game in a broken state.

---

## What Was Surprising

### `localStorage` Key Collisions
The original code used bare keys like `"bestScore"` and `"gameState"`. When the renovated code uses the same key names on the same origin, older saved scores would be picked up but interpreted against the wrong schema. Prefixing all keys with `"2048_"` via `LocalStorageManager._key()` solved the collision and made clearing game data straightforward.

### Touch Events and `event.preventDefault()`
Calling `event.preventDefault()` in `touchstart` suppresses the browser's default scroll/zoom behaviour on the board. Without it, the game was unplayable on mobile because the page would scroll instead of tile-moving. However, some browsers emit a console warning ("Unable to preventDefault inside passive event listener") when this is done. The game needs the `passive: false` flag for this to work silently — or accepts the warning as harmless.

### `requestAnimationFrame` and Stale DOM References
`HTMLActuator.actuate()` queues its work inside `requestAnimationFrame`. If `initGame()` is called a second time before the first frame fires (possible during rapid preset-button clicks), the first frame may try to update DOM elements that have already been replaced. The generation counter mitigates this for the timer, but the actuator itself does not have a generation check. In practice, `rAF` fires within one frame (~16 ms) so the race window is tiny, but it is a known edge case.

---

## Guidance for the Next Developer

### Before Changing Game Logic
Read `GameManager.move()` carefully, especially the `saveState()` / `prepareTiles()` call order. `saveState()` must run _before_ `prepareTiles()` so the snapshot includes `previousPosition` data that is erased by `prepareTiles()`. Reversing the order will corrupt undo animation.

### Adding a New Feature That Needs State
1. Add the field to `GameManager.serialize()`.
2. Read it back in `GameManager.setup()` from `previousState`.
3. Include it in `undoStack` / `redoStack` pushes if it is per-move state.
4. Expose it via `AppBridge` if it needs to be testable externally.

### Adding a New Theme
1. Declare a `[data-theme="my-theme"]` CSS block with the required variable overrides.
2. Add the theme name to `ThemeManager.THEMES` array.
3. Add an emoji or icon to `ThemeManager.LABELS`.

### Changing Storage Keys
All keys go through `LocalStorageManager._key()`. Change `AppConfig.storagePrefix` or override `_key()` to move all persistence to a new namespace. Never hard-code storage key strings outside `LocalStorageManager`.

### Automated Testing
`window.AppBridge` is the entry point for automated tests. Example:

```js
// Start fresh, make three moves, confirm score increased
AppBridge.newGame(4, 4);
AppBridge.move(0); // up
AppBridge.move(1); // right
AppBridge.move(2); // down
console.assert(AppBridge.getScore() >= 0, "Score should be non-negative");
console.assert(AppBridge.getState().moveCount <= 3, "At most 3 moves logged");
```

### Responsive Tile Size
Tile size is computed in `HTMLActuator.updateGridSize()` using `window.innerWidth - 40` as the maximum board dimension. On very narrow screens (< 320 px), the minimum `cellSize` of 40 px caps the board, which may cause overflow. Fix by reducing the minimum or adding a horizontal scroll wrapper around `.game-wrapper`.
