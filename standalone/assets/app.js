/* ============================================================
   2048 Premium – app.js
   Renovated from standalone/code.html original.
   Architecture: AppConfig → LocalStorageManager → Grid/Tile →
                 HTMLActuator → KeyboardInputManager → GameManager
   Bridge: window.AppBridge (debug / testing API)
   ============================================================ */

/* ── AppConfig ─────────────────────────────────────────────── */
window.AppConfig = {
  version: "3.0.0",
  name: "2048 Premium",
  defaultWidth: 4,
  defaultHeight: 4,
  minSize: 3,
  maxSize: 10,
  maxUndoSteps: 50,
  themeKey: "2048_theme",
  storagePrefix: "2048_",
  targetTile: 2048,
  startTiles: 2
};

/* ── Generation counter (stale-callback safety) ─────────────── */
var _generation = 0;

/* ── Toast Notification System ──────────────────────────────── */
var Toast = (function () {
  var container = null;

  function ensureContainer() {
    if (!container) {
      container = document.getElementById("toast-container");
    }
  }

  function show(message, type, duration) {
    ensureContainer();
    if (!container) return;
    duration = duration || 2800;
    type = type || "info";

    var el = document.createElement("div");
    el.className = "toast " + type;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = message;

    container.appendChild(el);

    setTimeout(function () {
      el.classList.add("toast-out");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }, duration);
  }

  return {
    success: function (msg, dur) { show(msg, "success", dur); },
    error:   function (msg, dur) { show(msg, "error",   dur || 4000); },
    info:    function (msg, dur) { show(msg, "info",    dur); }
  };
}());

/* ── Status Bar ─────────────────────────────────────────────── */
var StatusBar = (function () {
  var msgEl = null;
  var dotEl = null;

  function init() {
    msgEl = document.getElementById("status-message");
    dotEl = document.querySelector(".status-dot");
  }

  function set(message, state) {
    if (!msgEl) init();
    if (msgEl) msgEl.textContent = message;
    if (dotEl) {
      dotEl.className = "status-dot " + (state || "ready");
    }
  }

  return { set: set, init: init };
}());

/* ── ARIA Live Region ───────────────────────────────────────── */
function ariaAnnounce(message) {
  var el = document.getElementById("aria-live");
  if (el) {
    el.textContent = "";
    // flush then update so repeated identical messages fire
    setTimeout(function () { el.textContent = message; }, 10);
  }
}

/* ── Theme Manager ──────────────────────────────────────────── */
var ThemeManager = (function () {
  var currentTheme = "light";
  var THEMES = ["light", "dark", "system"];
  var LABELS = { light: "☀️", dark: "🌙", system: "🖥️" };
  var KEY = AppConfig.themeKey;

  function apply(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    var btn = document.getElementById("theme-btn");
    if (btn) {
      btn.textContent = LABELS[theme] || "☀️";
      btn.setAttribute("aria-label", "Theme: " + theme + " – click to cycle");
      btn.setAttribute("title", "Theme: " + theme);
    }
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
  }

  function cycle() {
    var idx = THEMES.indexOf(currentTheme);
    apply(THEMES[(idx + 1) % THEMES.length]);
    Toast.info("Theme: " + currentTheme);
  }

  function init() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    apply(saved && THEMES.indexOf(saved) >= 0 ? saved : "light");
  }

  return { init: init, cycle: cycle, apply: apply, get: function () { return currentTheme; } };
}());

/* ── Polyfills ──────────────────────────────────────────────── */
(function () {
  if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
      var aArgs = Array.prototype.slice.call(arguments, 1),
          fToBind = this,
          fNOP = function () {},
          fBound = function () {
            return fToBind.apply(
              this instanceof fNOP ? this : oThis,
              aArgs.concat(Array.prototype.slice.call(arguments))
            );
          };
      fNOP.prototype = this.prototype;
      fBound.prototype = new fNOP();
      return fBound;
    };
  }

  var lastTime = 0;
  var vendors = ["ms", "moz", "webkit", "o"];
  for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x] + "RequestAnimationFrame"];
    window.cancelAnimationFrame =
      window[vendors[x] + "CancelAnimationFrame"] ||
      window[vendors[x] + "CancelRequestAnimationFrame"];
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function (cb) {
      var curr = new Date().getTime();
      var wait = Math.max(0, 16 - (curr - lastTime));
      var id = setTimeout(function () { cb(curr + wait); }, wait);
      lastTime = curr + wait;
      return id;
    };
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = function (id) { clearTimeout(id); };
  }
}());

/* ── FakeStorage (localStorage fallback) ───────────────────── */
window.fakeStorage = {
  _data: {},
  setItem:    function (id, val) { this._data[id] = String(val); },
  getItem:    function (id) { return Object.prototype.hasOwnProperty.call(this._data, id) ? this._data[id] : undefined; },
  removeItem: function (id) { delete this._data[id]; },
  clear:      function ()   { this._data = {}; }
};

/* ── LocalStorageManager ────────────────────────────────────── */
function LocalStorageManager() {
  this.prefix = AppConfig.storagePrefix;
  this.bestScoreKey = "bestScore";
  this.gameStateKey = "gameState";
  this.storage = this._supported() ? window.localStorage : window.fakeStorage;
}

LocalStorageManager.prototype._supported = function () {
  try {
    var s = window.localStorage;
    s.setItem("__test", "1");
    s.removeItem("__test");
    return true;
  } catch (e) { return false; }
};

LocalStorageManager.prototype._key = function (key) {
  return this.prefix + key;
};

LocalStorageManager.prototype.getBestScore = function (key) {
  return parseInt(this.storage.getItem(this._key(key || this.bestScoreKey)), 10) || 0;
};

LocalStorageManager.prototype.setBestScore = function (score, key) {
  this.storage.setItem(this._key(key || this.bestScoreKey), score);
};

LocalStorageManager.prototype.getGameState = function (key) {
  var raw = this.storage.getItem(this._key(key || this.gameStateKey));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
};

LocalStorageManager.prototype.setGameState = function (state, key) {
  try {
    this.storage.setItem(this._key(key || this.gameStateKey), JSON.stringify(state));
  } catch (e) {
    StatusBar.set("Could not save game – storage may be full.", "error");
  }
};

LocalStorageManager.prototype.clearGameState = function (key) {
  this.storage.removeItem(this._key(key || this.gameStateKey));
};

/* ── Tile ───────────────────────────────────────────────────── */
function Tile(position, value) {
  this.x = position.x;
  this.y = position.y;
  this.value = value || 2;
  this.previousPosition = null;
  this.mergedFrom = null;
}

Tile.prototype.savePosition = function () {
  this.previousPosition = { x: this.x, y: this.y };
};

Tile.prototype.updatePosition = function (pos) {
  this.x = pos.x;
  this.y = pos.y;
};

Tile.prototype.serialize = function () {
  return { position: { x: this.x, y: this.y }, value: this.value };
};

/* ── Grid ───────────────────────────────────────────────────── */
function Grid(width, height, previousState) {
  this.width  = width;
  this.height = height;
  this.cells  = previousState ? this.fromState(previousState) : this.empty();
}

Grid.prototype.empty = function () {
  var cells = [];
  for (var x = 0; x < this.width; x++) {
    var row = cells[x] = [];
    for (var y = 0; y < this.height; y++) row.push(null);
  }
  return cells;
};

Grid.prototype.fromState = function (state) {
  var cells = [];
  for (var x = 0; x < this.width; x++) {
    var row = cells[x] = [];
    for (var y = 0; y < this.height; y++) {
      var t = state[x] && state[x][y];
      row.push(t ? new Tile(t.position, t.value) : null);
    }
  }
  return cells;
};

Grid.prototype.randomAvailableCell = function () {
  var cells = this.availableCells();
  if (cells.length) return cells[Math.floor(Math.random() * cells.length)];
};

Grid.prototype.availableCells = function () {
  var cells = [];
  this.eachCell(function (x, y, tile) { if (!tile) cells.push({ x: x, y: y }); });
  return cells;
};

Grid.prototype.eachCell = function (cb) {
  for (var x = 0; x < this.width; x++)
    for (var y = 0; y < this.height; y++)
      cb(x, y, this.cells[x][y]);
};

Grid.prototype.cellsAvailable   = function () { return !!this.availableCells().length; };
Grid.prototype.cellAvailable    = function (c) { return !this.cellOccupied(c); };
Grid.prototype.cellOccupied     = function (c) { return !!this.cellContent(c); };

Grid.prototype.cellContent = function (c) {
  return this.withinBounds(c) ? this.cells[c.x][c.y] : null;
};

Grid.prototype.insertTile = function (tile) { this.cells[tile.x][tile.y] = tile; };
Grid.prototype.removeTile = function (tile) { this.cells[tile.x][tile.y] = null; };

Grid.prototype.withinBounds = function (p) {
  return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
};

Grid.prototype.serialize = function () {
  var cellState = [];
  for (var x = 0; x < this.width; x++) {
    var row = cellState[x] = [];
    for (var y = 0; y < this.height; y++)
      row.push(this.cells[x][y] ? this.cells[x][y].serialize() : null);
  }
  return { width: this.width, height: this.height, cells: cellState };
};

/* ── HTMLActuator ───────────────────────────────────────────── */
function HTMLActuator() {
  this.tileContainer    = document.querySelector(".tile-container");
  this.scoreContainer   = document.getElementById("score-value");
  this.bestContainer    = document.getElementById("best-value");
  this.messageContainer = document.querySelector(".game-message");
  this.undoButton       = document.getElementById("undo-button");
  this.redoButton       = document.getElementById("redo-button");
  this.gridContainer    = document.getElementById("grid-container");
  this.gameContainer    = document.getElementById("game-container");
  this.movesEl          = document.getElementById("moves-value");
  this.timerEl          = document.getElementById("timer-value");
  this.currentGridEl    = document.getElementById("current-grid-size");
  this.score            = 0;
  this.cellSize         = 107;
  this.cellGap          = 15;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;
  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);
    self.updateGridSize(grid.width, grid.height);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) self.addTile(cell);
      });
    });

    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);
    self.updateHistoryButtons(metadata.undoAvailable, metadata.redoAvailable);
    if (metadata.moves !== undefined && self.movesEl)
      self.movesEl.textContent = metadata.moves;

    // Mirror scores into fullscreen overlay
    var fsScore = document.getElementById("fs-score-value");
    var fsBest  = document.getElementById("fs-best-value");
    if (fsScore) fsScore.textContent = metadata.score;
    if (fsBest)  fsBest.textContent  = metadata.bestScore;

    if (metadata.terminated) {
      if (metadata.over)      self.message(false);
      else if (metadata.won)  self.message(true);
    }
  });
};

HTMLActuator.prototype.updateGridSize = function (width, height) {
  var maxSize  = Math.min(window.innerWidth - 40, 500);
  var gap      = 15;
  var padding  = 15;
  var largest  = Math.max(width, height);
  var avail    = maxSize - 2 * padding - (largest - 1) * gap;
  var cell     = Math.max(Math.floor(avail / largest), 40);

  this.cellSize = cell;
  this.cellGap  = gap;

  var cw = cell * width  + (width  - 1) * gap + 2 * padding;
  var ch = cell * height + (height - 1) * gap + 2 * padding;

  this.gameContainer.style.width  = cw + "px";
  this.gameContainer.style.height = ch + "px";

  /* Rebuild grid background cells */
  this.clearContainer(this.gridContainer);
  for (var y = 0; y < height; y++) {
    var row = document.createElement("div");
    row.className = "grid-row";
    for (var x = 0; x < width; x++) {
      var el = document.createElement("div");
      el.className = "grid-cell";
      el.style.width  = cell + "px";
      el.style.height = cell + "px";
      row.appendChild(el);
    }
    this.gridContainer.appendChild(row);
  }

  /* Dynamic tile position / font styles */
  var sid  = "dynamic-tile-styles";
  var old  = document.getElementById(sid);
  if (old) old.remove();

  var big   = Math.floor(cell * 0.50);
  var med   = Math.floor(cell * 0.35);
  var small = Math.floor(cell * 0.27);
  var tiny  = Math.floor(cell * 0.30);

  var css = ".tile { width:" + cell + "px; height:" + cell + "px; }";
  css += ".tile .tile-inner { font-size:" + big + "px; }";
  css += ".tile.tile-128 .tile-inner,.tile.tile-256 .tile-inner,.tile.tile-512 .tile-inner { font-size:" + med + "px; }";
  css += ".tile.tile-1024 .tile-inner,.tile.tile-2048 .tile-inner { font-size:" + small + "px; }";
  css += ".tile.tile-super .tile-inner { font-size:" + tiny + "px; }";

  for (var tx = 0; tx < width; tx++) {
    for (var ty = 0; ty < height; ty++) {
      var dx = tx * (cell + gap);
      var dy = ty * (cell + gap);
      css += ".tile.tile-position-" + (tx + 1) + "-" + (ty + 1) +
             " { transform:translate(" + dx + "px," + dy + "px); }";
    }
  }

  var styleEl = document.createElement("style");
  styleEl.id  = sid;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  if (this.currentGridEl)
    this.currentGridEl.textContent = width + "×" + height;
};

HTMLActuator.prototype.continueGame = function () { this.clearMessage(); };
HTMLActuator.prototype.clearContainer = function (c) {
  while (c.firstChild) c.removeChild(c.firstChild);
};

HTMLActuator.prototype.addTile = function (tile) {
  var self    = this;
  var wrapper = document.createElement("div");
  var inner   = document.createElement("div");
  var pos     = tile.previousPosition || { x: tile.x, y: tile.y };
  var classes = ["tile", "tile-" + tile.value, this.positionClass(pos)];

  if (tile.value > 2048) classes.push("tile-super");
  this.applyClasses(wrapper, classes);
  inner.className = "tile-inner";
  inner.textContent = tile.value;

  if (tile.previousPosition) {
    window.requestAnimationFrame(function () {
      classes[2] = self.positionClass({ x: tile.x, y: tile.y });
      self.applyClasses(wrapper, classes);
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    this.applyClasses(wrapper, classes);
    tile.mergedFrom.forEach(function (m) { self.addTile(m); });
  } else {
    classes.push("tile-new");
    this.applyClasses(wrapper, classes);
  }

  wrapper.appendChild(inner);
  this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.applyClasses = function (el, classes) {
  el.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (p) {
  return { x: p.x + 1, y: p.y + 1 };
};

HTMLActuator.prototype.positionClass = function (p) {
  p = this.normalizePosition(p);
  return "tile-position-" + p.x + "-" + p.y;
};

HTMLActuator.prototype.updateScore = function (score) {
  var diff = score - this.score;
  this.score = score;
  if (this.scoreContainer) this.scoreContainer.textContent = score;
  if (diff > 0 && this.scoreContainer) {
    var add = document.createElement("div");
    add.className = "score-addition";
    add.setAttribute("aria-hidden", "true");
    add.textContent = "+" + diff;
    this.scoreContainer.appendChild(add);
    setTimeout(function () {
      if (add.parentNode) add.parentNode.removeChild(add);
    }, 650);
  }
};

HTMLActuator.prototype.updateBestScore = function (best) {
  if (this.bestContainer) this.bestContainer.textContent = best;
};

HTMLActuator.prototype.updateHistoryButtons = function (canUndo, canRedo) {
  if (this.undoButton) this.undoButton.disabled = !canUndo;
  if (this.redoButton) this.redoButton.disabled = !canRedo;
};

HTMLActuator.prototype.message = function (won) {
  var type = won ? "game-won" : "game-over";
  var msg  = won ? "You win!" : "Game over!";
  this.messageContainer.classList.add(type);
  this.messageContainer.querySelector("p").textContent = msg;
  ariaAnnounce(msg);
};

HTMLActuator.prototype.clearMessage = function () {
  this.messageContainer.classList.remove("game-won", "game-over");
};

/* ── KeyboardInputManager ───────────────────────────────────── */
function KeyboardInputManager() {
  this.events = {};
  this._handlers = [];  // for cleanup
  var ms = window.navigator.msPointerEnabled;
  this.eventTouchstart = ms ? "MSPointerDown"  : "touchstart";
  this.eventTouchmove  = ms ? "MSPointerMove"  : "touchmove";
  this.eventTouchend   = ms ? "MSPointerUp"    : "touchend";
  this.listen();
}

KeyboardInputManager.prototype.on = function (event, cb) {
  if (!this.events[event]) this.events[event] = [];
  this.events[event].push(cb);
};

KeyboardInputManager.prototype.emit = function (event, data) {
  var cbs = this.events[event];
  if (cbs) cbs.forEach(function (cb) { cb(data); });
};

KeyboardInputManager.prototype._addListener = function (el, ev, fn) {
  el.addEventListener(ev, fn);
  this._handlers.push({ el: el, ev: ev, fn: fn });
};

KeyboardInputManager.prototype.destroy = function () {
  this._handlers.forEach(function (h) {
    h.el.removeEventListener(h.ev, h.fn);
  });
  this._handlers = [];
  this.events = {};
};

KeyboardInputManager.prototype.listen = function () {
  var self = this;
  var map = {
    38: 0, 39: 1, 40: 2, 37: 3,   // arrows
    75: 0, 76: 1, 74: 2, 72: 3,   // vim HJKL
    87: 0, 68: 1, 83: 2, 65: 3    // WASD
  };

  var keyHandler = function (e) {
    var mods    = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;
    var ctrlMod = e.ctrlKey || e.metaKey;
    var mapped  = map[e.which];

    // Arrow / WASD / HJKL movement
    if (!mods && mapped !== undefined) {
      e.preventDefault();
      self.emit("move", mapped);
      return;
    }

    // R – restart
    if (!mods && e.which === 82) {
      self.emit("restart");
      return;
    }

    // Ctrl+Z – undo
    if (ctrlMod && e.which === 90 && !e.shiftKey) {
      e.preventDefault();
      self.emit("undo");
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z – redo
    if (ctrlMod && (e.which === 89 || (e.which === 90 && e.shiftKey))) {
      e.preventDefault();
      self.emit("redo");
      return;
    }

    // T – theme cycle
    if (!mods && e.which === 84) {
      ThemeManager.cycle();
      return;
    }

    // ? (Shift+/) – help toggle
    if (!mods && e.which === 191 && e.shiftKey) {
      self.emit("toggleHelp");
      return;
    }

    // F – fullscreen toggle
    if (!mods && e.which === 70) {
      self.emit("toggleFullscreen");
      return;
    }

    // E – export
    if (!mods && e.which === 69) {
      self.emit("exportState");
      return;
    }

    // I – import
    if (!mods && e.which === 73) {
      self.emit("importState");
      return;
    }

    // Escape – close panels
    if (e.which === 27) {
      self.emit("escape");
      return;
    }
  };

  this._addListener(document, "keydown", keyHandler);

  /* Button bindings */
  this._bindButton("#new-game-button",       this.restart.bind(this));
  this._bindButton(".retry-button",          this.restart.bind(this));
  this._bindButton(".restart-button",        this.restart.bind(this));
  this._bindButton(".keep-playing-button",   this.keepPlaying.bind(this));
  this._bindButton("#undo-button",           this.undo.bind(this));
  this._bindButton("#redo-button",           this.redo.bind(this));
  this._bindButton("#theme-btn",             this._onTheme.bind(this));
  this._bindButton("#help-btn",              this._onHelp.bind(this));
  this._bindButton("#fullscreen-btn",        this._onFullscreen.bind(this));
  this._bindButton("#export-btn",            this._onExport.bind(this));
  this._bindButton("#import-btn",            this._onImport.bind(this));
  this._bindButton("#fullscreen-close",      this._onFullscreenClose.bind(this));

  /* Touch swipe on the board */
  var gc = document.getElementById("game-container");
  var tx, ty;

  var touchStart = function (e) {
    if (e.touches && e.touches.length > 1) return;
    tx = window.navigator.msPointerEnabled ? e.pageX : e.touches[0].clientX;
    ty = window.navigator.msPointerEnabled ? e.pageY : e.touches[0].clientY;
    e.preventDefault();
  };

  var touchMove = function (e) { e.preventDefault(); };

  var touchEnd = function (e) {
    if (e.touches && e.touches.length > 0) return;
    var ex = window.navigator.msPointerEnabled ? e.pageX : e.changedTouches[0].clientX;
    var ey = window.navigator.msPointerEnabled ? e.pageY : e.changedTouches[0].clientY;
    var dx = ex - tx, dy = ey - ty;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) > 10)
      self.emit("move", adx > ady ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  };

  this._addListener(gc, self.eventTouchstart, touchStart);
  this._addListener(gc, self.eventTouchmove,  touchMove);
  this._addListener(gc, self.eventTouchend,   touchEnd);
};

KeyboardInputManager.prototype._bindButton = function (selector, fn) {
  var el = document.querySelector(selector);
  if (!el) return;
  this._addListener(el, "click", fn);
  this._addListener(el, this.eventTouchend, fn);
};

KeyboardInputManager.prototype.restart        = function (e) { if (e) e.preventDefault(); this.emit("restart"); };
KeyboardInputManager.prototype.keepPlaying    = function (e) { if (e) e.preventDefault(); this.emit("keepPlaying"); };
KeyboardInputManager.prototype.undo           = function (e) { if (e) e.preventDefault(); this.emit("undo"); };
KeyboardInputManager.prototype.redo           = function (e) { if (e) e.preventDefault(); this.emit("redo"); };
KeyboardInputManager.prototype._onTheme       = function (e) { if (e) e.preventDefault(); ThemeManager.cycle(); };
KeyboardInputManager.prototype._onHelp        = function (e) { if (e) e.preventDefault(); this.emit("toggleHelp"); };
KeyboardInputManager.prototype._onFullscreen  = function (e) { if (e) e.preventDefault(); this.emit("toggleFullscreen"); };
KeyboardInputManager.prototype._onFullscreenClose = function (e) { if (e) e.preventDefault(); this.emit("closeFullscreen"); };
KeyboardInputManager.prototype._onExport      = function (e) { if (e) e.preventDefault(); this.emit("exportState"); };
KeyboardInputManager.prototype._onImport      = function (e) { if (e) e.preventDefault(); this.emit("importState"); };

/* ── ConfirmDialog ──────────────────────────────────────────── */
var ConfirmDialog = (function () {
  var modal, msgEl, okBtn, cancelBtn;
  var _resolve = null;

  function init() {
    modal     = document.getElementById("confirm-modal");
    msgEl     = document.getElementById("confirm-message");
    okBtn     = document.getElementById("confirm-ok");
    cancelBtn = document.getElementById("confirm-cancel");

    if (!modal) return;

    okBtn.addEventListener("click", function () { close(true); });
    cancelBtn.addEventListener("click", function () { close(false); });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.which === 27 && modal.classList.contains("open")) close(false);
    });
  }

  function close(result) {
    if (!modal) return;
    modal.classList.remove("open");
    if (_resolve) { _resolve(result); _resolve = null; }
  }

  function ask(message) {
    if (!modal) return Promise.resolve(true);
    if (msgEl) msgEl.textContent = message;
    modal.classList.add("open");
    okBtn.focus();
    return new Promise(function (resolve) { _resolve = resolve; });
  }

  return { init: init, ask: ask };
}());

/* ── ImportModal ────────────────────────────────────────────── */
var ImportModal = (function () {
  var modal, textarea, okBtn, cancelBtn;
  var _resolve = null;

  function init() {
    modal     = document.getElementById("import-modal");
    textarea  = document.getElementById("import-json");
    okBtn     = document.getElementById("import-ok");
    cancelBtn = document.getElementById("import-cancel");

    if (!modal) return;

    okBtn.addEventListener("click", function () { close(textarea ? textarea.value : ""); });
    cancelBtn.addEventListener("click", function () { close(null); });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close(null);
    });
    document.addEventListener("keydown", function (e) {
      if (e.which === 27 && modal.classList.contains("open")) close(null);
    });
  }

  function close(val) {
    if (!modal) return;
    modal.classList.remove("open");
    if (_resolve) { _resolve(val); _resolve = null; }
  }

  function open() {
    if (!modal) return Promise.resolve(null);
    if (textarea) textarea.value = "";
    modal.classList.add("open");
    if (textarea) textarea.focus();
    return new Promise(function (resolve) { _resolve = resolve; });
  }

  return { init: init, open: open };
}());

/* ── HelpPanel ──────────────────────────────────────────────── */
var HelpPanel = (function () {
  var panel = null;

  function init() {
    panel = document.getElementById("help-panel");
  }

  function toggle() {
    if (!panel) return;
    var isOpen = panel.classList.toggle("open");
    var btn = document.getElementById("help-btn");
    if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    ariaAnnounce(isOpen ? "Help panel opened" : "Help panel closed");
  }

  function close() {
    if (panel) panel.classList.remove("open");
    var btn = document.getElementById("help-btn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  return { init: init, toggle: toggle, close: close };
}());

/* ── FullscreenOverlay ──────────────────────────────────────── */
var FullscreenOverlay = (function () {
  var overlay = null;
  var originalParent = null;
  var originalNext   = null;
  var gameEl         = null;

  function init() {
    overlay = document.getElementById("fullscreen-overlay");
    gameEl  = document.getElementById("game-container");
  }

  function open() {
    if (!overlay || !gameEl) return;
    originalParent = gameEl.parentNode;
    originalNext   = gameEl.nextSibling;
    overlay.appendChild(gameEl);
    overlay.classList.add("open");
    var closeBtn = document.getElementById("fullscreen-close");
    if (closeBtn) closeBtn.focus();
    ariaAnnounce("Fullscreen mode opened. Press Escape or F to exit.");
    var btn = document.getElementById("fullscreen-btn");
    if (btn) btn.setAttribute("aria-pressed", "true");
  }

  function close() {
    if (!overlay || !gameEl) return;
    if (originalParent) {
      if (originalNext) originalParent.insertBefore(gameEl, originalNext);
      else originalParent.appendChild(gameEl);
    }
    overlay.classList.remove("open");
    ariaAnnounce("Fullscreen mode closed.");
    var btn = document.getElementById("fullscreen-btn");
    if (btn) { btn.setAttribute("aria-pressed", "false"); btn.focus(); }
  }

  function toggle() {
    if (overlay && overlay.classList.contains("open")) close();
    else open();
  }

  function isOpen() {
    return overlay && overlay.classList.contains("open");
  }

  return { init: init, open: open, close: close, toggle: toggle, isOpen: isOpen };
}());

/* ── GameManager ────────────────────────────────────────────── */
function GameManager(width, height, InputManager, Actuator, StorageManager) {
  this.width          = width;
  this.height         = height;
  this.storageManager = new StorageManager();
  this.actuator       = new Actuator();
  this.startTiles     = AppConfig.startTiles;
  this.undoStack      = [];
  this.redoStack      = [];
  this.moveCount      = 0;
  this._generation    = ++_generation;

  this.bestScoreKey  = "bestScore_" + width + "x" + height;
  this.gameStateKey  = "gameState_" + width + "x" + height;

  // Re-create input manager (destroys old listeners)
  if (this.inputManager) this.inputManager.destroy();
  this.inputManager = new InputManager();

  this.inputManager.on("move",            this.move.bind(this));
  this.inputManager.on("restart",         this._handleRestart.bind(this));
  this.inputManager.on("keepPlaying",     this.keepPlaying.bind(this));
  this.inputManager.on("undo",            this.undo.bind(this));
  this.inputManager.on("redo",            this.redo.bind(this));
  this.inputManager.on("toggleHelp",      HelpPanel.toggle.bind(HelpPanel));
  this.inputManager.on("toggleFullscreen",FullscreenOverlay.toggle.bind(FullscreenOverlay));
  this.inputManager.on("closeFullscreen", FullscreenOverlay.close.bind(FullscreenOverlay));
  this.inputManager.on("exportState",     this.exportState.bind(this));
  this.inputManager.on("importState",     this.importState.bind(this));
  this.inputManager.on("escape",          this._handleEscape.bind(this));

  this._timerInterval = null;
  this._elapsedMs     = 0;
  this._timerStart    = null;

  this.setup();
}

GameManager.prototype._handleEscape = function () {
  if (FullscreenOverlay.isOpen()) { FullscreenOverlay.close(); return; }
  HelpPanel.close();
};

GameManager.prototype._handleRestart = function () {
  var self = this;
  if (this.score > 0 && !this.over) {
    ConfirmDialog.ask("Start a new game? Your current progress will be lost.").then(function (ok) {
      if (ok) self.restart();
    });
  } else {
    this.restart();
  }
};

GameManager.prototype.restart = function () {
  this._stopTimer();
  this.storageManager.clearGameState(this.gameStateKey);
  this.actuator.continueGame();
  this.undoStack  = [];
  this.redoStack  = [];
  this.moveCount  = 0;
  this._elapsedMs = 0;
  this.setup();
  StatusBar.set("New game started – good luck!", "ready");
  ariaAnnounce("New game started.");
};

GameManager.prototype.keepPlaying = function () {
  this._keepPlaying = true;
  this.actuator.continueGame();
  StatusBar.set("Keep going — reach for the highest tile!", "ready");
};

GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this._keepPlaying);
};

GameManager.prototype.setup = function () {
  var prev = this.storageManager.getGameState(this.gameStateKey);

  if (prev && prev.grid &&
      prev.grid.width === this.width && prev.grid.height === this.height) {
    this.grid         = new Grid(prev.grid.width, prev.grid.height, prev.grid.cells);
    this.score        = prev.score   || 0;
    this.over         = prev.over    || false;
    this.won          = prev.won     || false;
    this._keepPlaying = prev.keepPlaying || false;
    this.undoStack    = prev.undoStack   || [];
    this.redoStack    = prev.redoStack   || [];
    this.moveCount    = prev.moveCount   || 0;
    this._elapsedMs   = prev.elapsedMs   || 0;
    StatusBar.set("Game restored from last session.", "ready");
  } else {
    this.storageManager.clearGameState(this.gameStateKey);
    this.grid         = new Grid(this.width, this.height);
    this.score        = 0;
    this.over         = false;
    this.won          = false;
    this._keepPlaying = false;
    this.undoStack    = [];
    this.redoStack    = [];
    this.moveCount    = 0;
    this._elapsedMs   = 0;
    this.addStartTiles();
    StatusBar.set("Ready – use arrow keys or swipe to play!", "ready");
  }

  this._startTimer();
  this.actuate();
};

/* ── Timer ──────────────────────────────────────────────────── */
GameManager.prototype._startTimer = function () {
  this._stopTimer();
  if (this.over) return;
  var self = this;
  var gen  = this._generation;
  this._timerStart = Date.now();
  this._timerInterval = setInterval(function () {
    if (self._generation !== gen) { clearInterval(self._timerInterval); return; }
    var elapsed = self._elapsedMs + (Date.now() - self._timerStart);
    var el = document.getElementById("timer-value");
    if (el) el.textContent = self._formatTime(elapsed);
  }, 1000);
};

GameManager.prototype._stopTimer = function () {
  if (this._timerInterval) {
    clearInterval(this._timerInterval);
    this._timerInterval = null;
  }
  if (this._timerStart !== null) {
    this._elapsedMs += Date.now() - this._timerStart;
    this._timerStart = null;
  }
};

GameManager.prototype._formatTime = function (ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  s = s % 60;
  return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
};

/* ── Tiles ──────────────────────────────────────────────────── */
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) this.addRandomTile();
};

GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var val  = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), val);
    this.grid.insertTile(tile);
  }
};

/* ── Actuate / Persist ──────────────────────────────────────── */
GameManager.prototype.actuate = function () {
  var best = this.storageManager.getBestScore(this.bestScoreKey);
  if (best < this.score) {
    this.storageManager.setBestScore(this.score, this.bestScoreKey);
    best = this.score;
  }

  if (this.over) {
    this._stopTimer();
    this.storageManager.clearGameState(this.gameStateKey);
  } else {
    this.storageManager.setGameState(this.serialize(), this.gameStateKey);
  }

  this.actuator.actuate(this.grid, {
    score:         this.score,
    over:          this.over,
    won:           this.won,
    bestScore:     best,
    terminated:    this.isGameTerminated(),
    undoAvailable: this.undoStack.length > 0,
    redoAvailable: this.redoStack.length > 0,
    moves:         this.moveCount
  });
};

GameManager.prototype.serialize = function () {
  return {
    grid:         this.grid.serialize(),
    score:        this.score,
    over:         this.over,
    won:          this.won,
    keepPlaying:  this._keepPlaying,
    undoStack:    this.undoStack,
    redoStack:    this.redoStack,
    moveCount:    this.moveCount,
    elapsedMs:    this._elapsedMs + (this._timerStart ? Date.now() - this._timerStart : 0)
  };
};

/* ── Undo / Redo ────────────────────────────────────────────── */
GameManager.prototype.saveState = function () {
  this.undoStack.push({
    grid:   this.grid.serialize(),
    score:  this.score,
    over:   this.over,
    won:    this.won,
    moves:  this.moveCount
  });
  if (this.undoStack.length > AppConfig.maxUndoSteps)
    this.undoStack.shift();
  this.redoStack = [];
};

GameManager.prototype.undo = function () {
  if (this.undoStack.length === 0) {
    Toast.info("Nothing to undo.");
    return;
  }
  // Push current to redo before popping undo
  this.redoStack.push({
    grid:  this.grid.serialize(),
    score: this.score,
    over:  this.over,
    won:   this.won,
    moves: this.moveCount
  });

  var prev = this.undoStack.pop();
  this.grid       = new Grid(prev.grid.width, prev.grid.height, prev.grid.cells);
  this.score      = prev.score;
  this.over       = prev.over;
  this.won        = prev.won;
  this.moveCount  = prev.moves;
  StatusBar.set("Undone – " + this.undoStack.length + " undo steps remaining.", "ready");
  ariaAnnounce("Move undone.");
  this.actuate();
};

GameManager.prototype.redo = function () {
  if (this.redoStack.length === 0) {
    Toast.info("Nothing to redo.");
    return;
  }
  // Push current to undo
  this.undoStack.push({
    grid:  this.grid.serialize(),
    score: this.score,
    over:  this.over,
    won:   this.won,
    moves: this.moveCount
  });

  var next = this.redoStack.pop();
  this.grid       = new Grid(next.grid.width, next.grid.height, next.grid.cells);
  this.score      = next.score;
  this.over       = next.over;
  this.won        = next.won;
  this.moveCount  = next.moves;
  StatusBar.set("Redone – " + this.redoStack.length + " redo steps remaining.", "ready");
  ariaAnnounce("Move redone.");
  this.actuate();
};

/* ── Movement ───────────────────────────────────────────────── */
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) { tile.mergedFrom = null; tile.savePosition(); }
  });
};

GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

GameManager.prototype.move = function (direction) {
  if (this.isGameTerminated()) return;
  var self = this;
  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  this.saveState();
  this.prepareTiles();

  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      var cell = { x: x, y: y };
      var tile = self.grid.cellContent(cell);
      if (!tile) return;

      var pos  = self.findFarthestPosition(cell, vector);
      var next = self.grid.cellContent(pos.next);

      if (next && next.value === tile.value && !next.mergedFrom) {
        var merged = new Tile(pos.next, tile.value * 2);
        merged.mergedFrom = [tile, next];
        self.grid.insertTile(merged);
        self.grid.removeTile(tile);
        tile.updatePosition(pos.next);
        self.score += merged.value;
        if (merged.value === AppConfig.targetTile) self.won = true;
      } else {
        self.moveTile(tile, pos.farthest);
      }

      if (!self.positionsEqual(cell, tile)) moved = true;
    });
  });

  if (moved) {
    this.moveCount++;
    this.addRandomTile();
    if (!this.movesAvailable()) {
      this.over = true;
      this._stopTimer();
      StatusBar.set("Game over! Score: " + this.score, "error");
      ariaAnnounce("Game over! Final score: " + this.score);
    }
    if (this.won && !this._keepPlaying) {
      this._stopTimer();
      StatusBar.set("You reached 2048! Congratulations!", "ready");
    }
    this.actuate();
  } else {
    // No movement – discard the saved state
    this.undoStack.pop();
  }
};

GameManager.prototype.getVector = function (dir) {
  return [{ x:0, y:-1 }, { x:1, y:0 }, { x:0, y:1 }, { x:-1, y:0 }][dir];
};

GameManager.prototype.buildTraversals = function (v) {
  var t = { x: [], y: [] };
  for (var i = 0; i < this.width;  i++) t.x.push(i);
  for (var j = 0; j < this.height; j++) t.y.push(j);
  if (v.x === 1) t.x.reverse();
  if (v.y === 1) t.y.reverse();
  return t;
};

GameManager.prototype.findFarthestPosition = function (cell, v) {
  var prev;
  do {
    prev = cell;
    cell = { x: prev.x + v.x, y: prev.y + v.y };
  } while (this.grid.withinBounds(cell) && this.grid.cellAvailable(cell));
  return { farthest: prev, next: cell };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;
  for (var x = 0; x < this.width; x++) {
    for (var y = 0; y < this.height; y++) {
      var tile = this.grid.cellContent({ x: x, y: y });
      if (!tile) continue;
      for (var d = 0; d < 4; d++) {
        var v    = self.getVector(d);
        var other = self.grid.cellContent({ x: x + v.x, y: y + v.y });
        if (other && other.value === tile.value) return true;
      }
    }
  }
  return false;
};

GameManager.prototype.positionsEqual = function (a, b) {
  return a.x === b.x && a.y === b.y;
};

/* ── Import / Export ────────────────────────────────────────── */
GameManager.prototype.exportState = function () {
  this._stopTimer();
  var state = this.serialize();
  state.version   = AppConfig.version;
  state.gridWidth  = this.width;
  state.gridHeight = this.height;
  state.bestScore  = this.storageManager.getBestScore(this.bestScoreKey);

  var json = JSON.stringify(state, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href     = url;
  a.download = "2048-save-" + Date.now() + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 3000);

  Toast.success("Game exported successfully.");
  if (this._timerStart === null && !this.over) this._startTimer();
};

GameManager.prototype.importState = function () {
  var self = this;
  ImportModal.open().then(function (raw) {
    if (raw === null || raw === "") return;

    var state;
    try {
      state = JSON.parse(raw);
    } catch (e) {
      Toast.error("Invalid JSON – could not import.");
      return;
    }

    /* Validate */
    if (!state || typeof state !== "object") {
      Toast.error("Import failed: not a valid game state.");
      return;
    }
    if (!state.grid || !state.grid.cells || !Array.isArray(state.grid.cells)) {
      Toast.error("Import failed: missing grid data.");
      return;
    }
    var w = state.gridWidth  || (state.grid && state.grid.width)  || self.width;
    var h = state.gridHeight || (state.grid && state.grid.height) || self.height;

    if (typeof w !== "number" || typeof h !== "number" ||
        w < AppConfig.minSize || w > AppConfig.maxSize ||
        h < AppConfig.minSize || h > AppConfig.maxSize) {
      Toast.error("Import failed: grid dimensions out of range.");
      return;
    }
    if (typeof state.score !== "number" || state.score < 0) {
      Toast.error("Import failed: invalid score.");
      return;
    }

    self._stopTimer();

    /* Switch grid size if needed */
    if (w !== self.width || h !== self.height) {
      self.width  = w;
      self.height = h;
      self.bestScoreKey = "bestScore_" + w + "x" + h;
      self.gameStateKey = "gameState_" + w + "x" + h;
      document.getElementById("custom-width").value  = w;
      document.getElementById("custom-height").value = h;
      document.getElementById("current-grid-size").textContent = w + "×" + h;
      /* Update preset button active state */
      document.querySelectorAll(".preset-btn").forEach(function (b) {
        b.classList.toggle("active",
          parseInt(b.dataset.width,  10) === w &&
          parseInt(b.dataset.height, 10) === h);
      });
    }

    self.grid        = new Grid(w, h, state.grid.cells);
    self.score       = state.score       || 0;
    self.over        = state.over        || false;
    self.won         = state.won         || false;
    self._keepPlaying = state.keepPlaying || false;
    self.undoStack   = Array.isArray(state.undoStack) ? state.undoStack : [];
    self.redoStack   = Array.isArray(state.redoStack) ? state.redoStack : [];
    self.moveCount   = state.moveCount   || 0;
    self._elapsedMs  = state.elapsedMs   || 0;
    self._timerStart = null;

    if (state.bestScore && typeof state.bestScore === "number") {
      var cur = self.storageManager.getBestScore(self.bestScoreKey);
      if (state.bestScore > cur)
        self.storageManager.setBestScore(state.bestScore, self.bestScoreKey);
    }

    if (!self.over) self._startTimer();
    self.actuate();
    Toast.success("Game imported successfully.");
    StatusBar.set("Game loaded from import.", "ready");
    ariaAnnounce("Game state imported.");
  });
};

/* ── Grid Size Controller ───────────────────────────────────── */
var currentGame = null;

function initGame(width, height) {
  _generation++;

  if (currentGame) {
    currentGame._stopTimer();
    currentGame.inputManager.destroy();
  }

  StatusBar.set("Initializing " + width + "×" + height + " game…", "busy");

  currentGame = new GameManager(
    width, height,
    KeyboardInputManager, HTMLActuator, LocalStorageManager
  );

  /* Update preset highlight */
  document.querySelectorAll(".preset-btn").forEach(function (b) {
    b.classList.toggle("active",
      parseInt(b.dataset.width,  10) === width &&
      parseInt(b.dataset.height, 10) === height);
  });

  /* Sync custom inputs */
  var cw = document.getElementById("custom-width");
  var ch = document.getElementById("custom-height");
  if (cw) cw.value = width;
  if (ch) ch.value = height;

  /* Expose on bridge */
  if (window.AppBridge) window.AppBridge._game = currentGame;
}

/* ── AppBridge (debug / testing API) ───────────────────────── */
window.AppBridge = {
  version: AppConfig.version,
  _game: null,

  getState: function () {
    return currentGame ? currentGame.serialize() : null;
  },

  getScore: function () {
    return currentGame ? currentGame.score : 0;
  },

  getBestScore: function () {
    if (!currentGame) return 0;
    return currentGame.storageManager.getBestScore(currentGame.bestScoreKey);
  },

  move: function (direction) {
    if (currentGame) currentGame.move(direction);
  },

  undo: function () {
    if (currentGame) currentGame.undo();
  },

  redo: function () {
    if (currentGame) currentGame.redo();
  },

  restart: function () {
    if (currentGame) currentGame.restart();
  },

  newGame: function (width, height) {
    initGame(
      Math.max(AppConfig.minSize, Math.min(AppConfig.maxSize, width  || AppConfig.defaultWidth)),
      Math.max(AppConfig.minSize, Math.min(AppConfig.maxSize, height || AppConfig.defaultHeight))
    );
  },

  setTheme: function (theme) {
    var valid = ["light", "dark", "system"];
    if (valid.indexOf(theme) >= 0) {
      ThemeManager.apply(theme);
    } else {
      ThemeManager.cycle();
    }
  },

  importJSON: function (json) {
    if (!currentGame) return;
    var orig = ImportModal.open;
    ImportModal.open = function () {
      ImportModal.open = orig;
      return Promise.resolve(json);
    };
    currentGame.importState();
  },

  exportJSON: function () {
    if (!currentGame) return null;
    var s = currentGame.serialize();
    s.version    = AppConfig.version;
    s.gridWidth  = currentGame.width;
    s.gridHeight = currentGame.height;
    s.bestScore  = currentGame.storageManager.getBestScore(currentGame.bestScoreKey);
    return JSON.stringify(s, null, 2);
  }
};

/* ── Boot ───────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  /* Init subsystems */
  StatusBar.init();
  ThemeManager.init();
  HelpPanel.init();
  FullscreenOverlay.init();
  ConfirmDialog.init();
  ImportModal.init();

  StatusBar.set("Initializing…", "busy");

  /* Preset buttons */
  document.querySelectorAll(".preset-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var w = parseInt(this.getAttribute("data-width"),  10);
      var h = parseInt(this.getAttribute("data-height"), 10);
      initGame(w, h);
    });
  });

  /* Custom grid apply */
  document.getElementById("apply-custom").addEventListener("click", function () {
    var wEl = document.getElementById("custom-width");
    var hEl = document.getElementById("custom-height");
    var w = Math.max(AppConfig.minSize, Math.min(AppConfig.maxSize, parseInt(wEl.value, 10) || AppConfig.defaultWidth));
    var h = Math.max(AppConfig.minSize, Math.min(AppConfig.maxSize, parseInt(hEl.value, 10) || AppConfig.defaultHeight));
    wEl.value = w;
    hEl.value = h;
    initGame(w, h);
  });

  /* Clean up timer on unload */
  window.addEventListener("beforeunload", function () {
    if (currentGame) currentGame._stopTimer();
  });

  /* Launch default game */
  window.requestAnimationFrame(function () {
    initGame(AppConfig.defaultWidth, AppConfig.defaultHeight);
    AppBridge._game = currentGame;
  });
});
