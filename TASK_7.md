# TASK 7 — Integration & Final Wiring

> **Goal:** Wire all modules together in `module.mjs`, verify the complete system works end-to-end.  
> **Dependencies:** TASK_1–6 must ALL be complete.  
> **This is the final task.**

---

## FILE TO MODIFY

### `scripts/module.mjs`

Replace the skeleton from TASK_1 with the full entry point that wires everything.

**Final content:**

```js
import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { initBeamLayer, refreshBeams } from "./canvas/beam-layer.mjs";
import { registerTokenHooks } from "./interaction/token-hooks.mjs";
import { registerHUDHooks } from "./interaction/hud-buttons.mjs";

/**
 * Module initialization — register settings and hooks.
 */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
});

/**
 * Module ready — register interaction hooks.
 */
Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
  registerTokenHooks();
  registerHUDHooks();
});

/**
 * Canvas ready — initialize the beam rendering layer.
 * Fires every time a new scene is loaded.
 */
Hooks.on("canvasReady", async () => {
  console.log(`${MODULE_ID} | Canvas ready, initializing beam layer`);
  await initBeamLayer();
});
```

That's the complete file — clean, short, and clear.

---

## FINAL CHECKLIST

Before considering the module done, verify every item:

### File Count Check

Verify all 20 files exist:

```
module.json
lang/en.json
styles/module.css
templates/laser-sheet.hbs
templates/mirror-sheet.hbs
templates/mirror-player-sheet.hbs
scripts/module.mjs
scripts/constants.mjs
scripts/settings.mjs
scripts/laser-data.mjs
scripts/mirror-data.mjs
scripts/utils/geometry.mjs
scripts/utils/token-helpers.mjs
scripts/physics/reflection.mjs
scripts/physics/ray-caster.mjs
scripts/canvas/beam-layer.mjs
scripts/canvas/beam-renderer.mjs
scripts/apps/laser-sheet.mjs
scripts/apps/mirror-sheet.mjs
scripts/apps/mirror-player-sheet.mjs
scripts/interaction/token-hooks.mjs
scripts/interaction/attachment.mjs
scripts/interaction/hud-buttons.mjs
```

### Line Count Check

No file should exceed 300 lines. Verify with your editor or by inspection.

### Import/Export Check

Every `import` statement must resolve to an actual file and exported symbol. Common mistakes:
- Wrong relative path (e.g., `../` vs `./`)
- Importing a function that wasn't exported
- Circular imports (there should be none with this architecture)

**Import dependency graph** (arrows show "imports from"):

```
module.mjs
  ← constants.mjs
  ← settings.mjs ← constants.mjs
  ← beam-layer.mjs ← constants.mjs, beam-renderer.mjs, ray-caster.mjs
  ← token-hooks.mjs ← constants.mjs, laser-data.mjs, token-helpers.mjs, beam-layer.mjs, attachment.mjs
  ← hud-buttons.mjs ← constants.mjs, laser-data.mjs, mirror-data.mjs, token-helpers.mjs, all 3 sheets, attachment.mjs, beam-layer.mjs

ray-caster.mjs ← geometry.mjs, token-helpers.mjs, reflection.mjs, laser-data.mjs, mirror-data.mjs, constants.mjs
reflection.mjs ← geometry.mjs
beam-renderer.mjs ← (no module imports, only PIXI)
laser-data.mjs ← constants.mjs
mirror-data.mjs ← constants.mjs
token-helpers.mjs ← constants.mjs
geometry.mjs ← (no imports — pure math)
attachment.mjs ← constants.mjs, laser-data.mjs
laser-sheet.mjs ← constants.mjs, laser-data.mjs, beam-layer.mjs
mirror-sheet.mjs ← constants.mjs, mirror-data.mjs, beam-layer.mjs
mirror-player-sheet.mjs ← constants.mjs, mirror-data.mjs, beam-layer.mjs
```

No circular dependencies exist in this graph.

---

## END-TO-END TESTING SCRIPT

Run this sequence in the Foundry browser console after enabling the module:

```js
// === TEST 1: Module loaded ===
console.assert(game.modules.get("lasers-and-mirrors")?.active, "Module not active");

// === TEST 2: Settings registered ===
console.assert(game.settings.get("lasers-and-mirrors", "maxBounces") === 10, "Settings failed");

// === TEST 3: Create a laser token ===
const laserTokenDoc = await TokenDocument.create({
  name: "Test Laser",
  x: 500, y: 500,
  width: 1, height: 1,
  rotation: 0,
  "flags.lasers-and-mirrors": {
    type: "laser", color: "#ff0000", width: 4,
    range: 30, intensity: 0.8, visible: true,
    interactable: true, attachable: true, attachedToTokenId: null
  }
}, { parent: canvas.scene });
console.log("Laser created:", laserTokenDoc.id);

// === TEST 4: Create a mirror token ===
const mirrorTokenDoc = await TokenDocument.create({
  name: "Test Mirror",
  x: 800, y: 500,
  width: 1, height: 1,
  "flags.lasers-and-mirrors": {
    type: "mirror", color: "#c0c0c0", width: 1, orientation: 45
  }
}, { parent: canvas.scene });
console.log("Mirror created:", mirrorTokenDoc.id);

// === TEST 5: Beams should be visible on canvas ===
// Look at the canvas — a red beam should go from the laser toward the mirror,
// reflect at 45°, and continue in a new direction.

// === TEST 6: Move the mirror — beam should update ===
await mirrorTokenDoc.update({ x: 700 });
// Beam should re-render automatically

// === TEST 7: Toggle laser visibility ===
await laserTokenDoc.update({ "flags.lasers-and-mirrors.visible": false });
// Beam should disappear
await laserTokenDoc.update({ "flags.lasers-and-mirrors.visible": true });
// Beam should reappear

// === TEST 8: Open sheets ===
const LaserSheet = (await import("modules/lasers-and-mirrors/scripts/apps/laser-sheet.mjs")).LaserSheet;
new LaserSheet(laserTokenDoc).render(true);
// Should open a config window

// === TEST 9: Cleanup ===
await laserTokenDoc.delete();
await mirrorTokenDoc.delete();
console.log("All tests passed!");
```

---

## TROUBLESHOOTING GUIDE

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Module not in list | Invalid `module.json` | Check JSON syntax, ensure `id` field exists |
| No console log on load | `esmodules` path wrong | Should be `["scripts/module.mjs"]` |
| Beam doesn't render | `initBeamLayer` not called | Check `canvasReady` hook fires |
| PIXI error on draw | Wrong PIXI v8 API | Use `.stroke({...})` AFTER `.lineTo()`, not `.lineStyle()` |
| Flags not saving | Wrong flag path | Must be `flags.lasers-and-mirrors.key` |
| Sheet won't open | Template path wrong | Check `modules/lasers-and-mirrors/templates/...` |
| HUD buttons missing | Hook name wrong | Must be `renderTokenHUD` (camelCase) |
| Adjacency always false | Wrong distance calc | Check `canvas.grid.measurePath` returns valid result |
| Attached laser won't move | `syncAttachedLasers` not called | Check `updateToken` hook fires for the carrier token |
