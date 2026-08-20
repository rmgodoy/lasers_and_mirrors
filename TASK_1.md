# TASK 1 — Foundation

> **Goal:** Create the module manifest, constants, settings, localization, CSS, and entry point.  
> **Dependencies:** None (this is the first task).  
> **Read PLAN.md first** for schemas, API patterns, and file tree.

---

## FILES TO CREATE

### 1. `module.json`

The Foundry V14 module manifest. Create exactly this file at the project root.

**Requirements:**
- `id`: `"lasers-and-mirrors"`
- `title`: `"Lasers & Mirrors"`
- `description`: Puzzle module for laser beams and mirrors
- `version`: `"1.0.0"`
- `compatibility`: `{ "minimum": "14", "verified": "14" }`
- `authors`: array with one author object `{ "name": "Rodrigo" }`
- `esmodules`: `["scripts/module.mjs"]`
- `styles`: `["styles/module.css"]`
- `languages`: `[{ "lang": "en", "name": "English", "path": "lang/en.json" }]`

No `documentTypes` needed — we use flags, not custom document subtypes.

---

### 2. `scripts/constants.mjs`

Export all module constants used across every other file.

**Must export:**
```js
export const MODULE_ID = "lasers-and-mirrors";

export const FLAGS = {
  TYPE: "type",
  // Laser flags
  COLOR: "color",
  WIDTH: "width",
  RANGE: "range",
  INTENSITY: "intensity",
  VISIBLE: "visible",
  INTERACTABLE: "interactable",
  ATTACHABLE: "attachable",
  ATTACHED_TO_TOKEN_ID: "attachedToTokenId",
  // Mirror flags
  ORIENTATION: "orientation",
};

export const TYPES = {
  LASER: "laser",
  MIRROR: "mirror",
};

export const LASER_DEFAULTS = {
  type: "laser",
  color: "#ff0000",
  width: 4,
  range: 30,
  intensity: 0.8,
  visible: true,
  interactable: false,
  attachable: false,
  attachedToTokenId: null,
};

export const MIRROR_DEFAULTS = {
  type: "mirror",
  color: "#c0c0c0",
  width: 1,
  orientation: 0,
};
```

---

### 3. `scripts/settings.mjs`

One exported function `registerSettings()` that registers all 4 settings.

**Requirements:**
- Import `MODULE_ID` from `constants.mjs`.
- Call `game.settings.register(MODULE_ID, key, config)` for each setting.
- Settings to register (all with `config: true`):

| Key | Type | Default | Scope | name (i18n key) | hint (i18n key) |
|-----|------|---------|-------|-----------------|-----------------|
| `maxBounces` | `Number` | `10` | `"world"` | `LAM.settings.maxBounces.name` | `LAM.settings.maxBounces.hint` |
| `beamOpacity` | `Number` | `0.8` | `"world"` | `LAM.settings.beamOpacity.name` | `LAM.settings.beamOpacity.hint` |
| `glowEffect` | `Boolean` | `true` | `"world"` | `LAM.settings.glowEffect.name` | `LAM.settings.glowEffect.hint` |
| `debugMode` | `Boolean` | `false` | `"client"` | `LAM.settings.debugMode.name` | `LAM.settings.debugMode.hint` |

- `maxBounces` should also have `range: { min: 1, max: 50, step: 1 }`.
- `beamOpacity` should also have `range: { min: 0.1, max: 1.0, step: 0.1 }`.

**Export:**
```js
export function registerSettings() { ... }
```

---

### 4. `lang/en.json`

JSON localization file. All keys start with `LAM.`.

**Must include keys for:**
- Settings names and hints (4 settings × 2 = 8 keys)
- Sheet titles: `LAM.sheets.laser.title`, `LAM.sheets.mirror.title`, `LAM.sheets.mirrorPlayer.title`
- Form labels: `LAM.labels.color`, `LAM.labels.width`, `LAM.labels.range`, `LAM.labels.intensity`, `LAM.labels.visible`, `LAM.labels.interactable`, `LAM.labels.attachable`, `LAM.labels.orientation`
- HUD button tooltips: `LAM.hud.adjustMirror`, `LAM.hud.toggleLaser`, `LAM.hud.attachLaser`, `LAM.hud.detachLaser`
- Notifications: `LAM.notify.notAdjacent`, `LAM.notify.laserAttached`, `LAM.notify.laserDetached`, `LAM.notify.laserToggled`

Provide sensible English text for each.

---

### 5. `styles/module.css`

CSS for the module sheets and HUD buttons.

**Must include styles for:**
- `.lasers-and-mirrors-sheet` — sheet container
- `.lasers-and-mirrors-sheet .form-group` — label + input rows
- `.lasers-and-mirrors-sheet label` — label styling
- `.lasers-and-mirrors-sheet input[type="range"]` — range slider styling
- `.lasers-and-mirrors-sheet input[type="color"]` — color picker
- `.lam-hud-button` — HUD button styling (match Foundry's `.control-icon` look)
- `.lam-hud-button:hover` — hover effect
- `.lam-hud-button.active` — active/toggle-on state

Keep it clean and minimal. ~50-80 lines max.

---

### 6. `scripts/module.mjs`

The entry point. For now, create a **skeleton** that only does Task 1 work.

**Requirements:**
- Import `registerSettings` from `./settings.mjs`.
- Import `MODULE_ID` from `./constants.mjs`.
- Register the `init` hook to call `registerSettings()` and log a startup message.
- Register a `ready` hook that logs `"Lasers & Mirrors | Ready"`.

```js
import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
});
```

This file will be expanded in TASK_7 to wire all other modules.

---

## VERIFICATION

After creating all 6 files:

1. The module should appear in Foundry VTT's module list.
2. Enabling the module should show `"lasers-and-mirrors | Initializing"` and `"lasers-and-mirrors | Ready"` in the browser console.
3. Module settings should appear in Foundry's Module Settings panel.
4. No console errors.
