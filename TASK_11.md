# TASK 11 — Wire DataModels, Sheets, Drop Handler, and Lang

> **Goal:** Wire all new code into `module.mjs`, fix `item-hooks.mjs` to remove broken API calls and use correct type comparisons, fix `lang/en.json` localization keys, and add Item-type-aware helpers to data files.  
> **Dependencies:** TASK_8–10 must ALL be complete.  
> **This is the final integration task.**

---

## FILES TO MODIFY

### 1. `scripts/module.mjs`

Replace the entire file with this content. This adds DataModel registration, sheet registration, and moves `registerItemHooks` to the `init` hook.

**Full replacement file content:**

```js
import { MODULE_ID, ITEM_TYPES } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { initBeamLayer, refreshBeams } from "./canvas/beam-layer.mjs";
import { registerTokenHooks } from "./interaction/token-hooks.mjs";
import { registerHUDHooks } from "./interaction/hud-buttons.mjs";
import { registerItemHooks } from "./interaction/item-hooks.mjs";
import { LaserItemModel } from "./data-models/laser-item-model.mjs";
import { MirrorItemModel } from "./data-models/mirror-item-model.mjs";
import { LaserItemSheet } from "./apps/laser-item-sheet.mjs";
import { MirrorItemSheet } from "./apps/mirror-item-sheet.mjs";

/**
 * Module initialization — register data models, settings, sheets, and hooks.
 */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Register TypeDataModels for custom Item subtypes
  Object.assign(CONFIG.Item.dataModels, {
    [ITEM_TYPES.LASER]: LaserItemModel,
    [ITEM_TYPES.MIRROR]: MirrorItemModel,
  });

  // Register settings
  registerSettings();

  // Register Item sheets via DocumentSheetConfig
  const DSC = foundry.applications.apps.DocumentSheetConfig;
  DSC.registerSheet(foundry.documents.Item, MODULE_ID, LaserItemSheet, {
    types: [ITEM_TYPES.LASER],
    makeDefault: true,
    label: "LAM.sheets.laser.title",
  });
  DSC.registerSheet(foundry.documents.Item, MODULE_ID, MirrorItemSheet, {
    types: [ITEM_TYPES.MIRROR],
    makeDefault: true,
    label: "LAM.sheets.mirror.title",
  });

  // Register item-related hooks (drop-to-canvas, scene controls)
  registerItemHooks();
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

---

### 2. `scripts/interaction/item-hooks.mjs`

Remove the broken `Items.registerSheet(...)` calls and the `preCreateItem` hook (DataModels handle defaults now). Keep `dropCanvasData` and `getSceneControlButtons`. Fix the drop handler to read `item.system` instead of `item.flags`.

**Full replacement file content:**

```js
import { MODULE_ID, TYPES, ITEM_TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS } from "../constants.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * Register canvas-related Item hooks: drop-to-canvas and scene control buttons.
 * Call once during module init.
 */
export function registerItemHooks() {
  Hooks.on("dropCanvasData", onDropCanvasData);
  Hooks.on("getSceneControlButtons", onGetSceneControlButtons);
}

/**
 * Handle dropping an Item of type laser or mirror onto the canvas.
 * Creates a Token with the Item's system data copied into token flags.
 * @param {Canvas} _canvas
 * @param {object} data
 * @returns {boolean|void}
 */
async function onDropCanvasData(_canvas, data) {
  if (data.type !== "Item" || !data.uuid) return;

  let item;
  try {
    item = await fromUuid(data.uuid);
  } catch (e) {
    return;
  }
  if (!item) return;

  // Check if this is one of our custom Item types (prefixed)
  const isLaserItem = item.type === ITEM_TYPES.LASER;
  const isMirrorItem = item.type === ITEM_TYPES.MIRROR;
  if (!isLaserItem && !isMirrorItem) return;

  // Read data from the Item's TypeDataModel (item.system)
  const systemData = item.system?.toObject?.() ?? { ...item.system };

  // Build flag data: merge defaults with Item system data, set the flag type
  const flagData = isLaserItem
    ? { ...LASER_DEFAULTS, ...systemData }
    : { ...MIRROR_DEFAULTS, ...systemData };

  // Grid alignment
  const center = canvas.grid.getCenterPoint({ x: data.x, y: data.y });
  const tokenData = {
    name: item.name,
    img: item.img && item.img !== "icons/svg/item-bag.svg"
      ? item.img
      : (isLaserItem ? "icons/svg/light.svg" : "icons/svg/shield.svg"),
    x: center.x - canvas.grid.size / 2,
    y: center.y - canvas.grid.size / 2,
    width: 1,
    height: 1,
    [`flags.${MODULE_ID}`]: flagData,
  };

  await TokenDocument.create(tokenData, { parent: canvas.scene });
  refreshBeams();
  return false; // Prevent default drop handling
}

/**
 * Inject 1-click creation tools into Token Controls canvas palette.
 * @param {Array} controls
 */
function onGetSceneControlButtons(controls) {
  const tokenControls = controls.find(c => c.name === "token");
  if (!tokenControls) return;

  tokenControls.tools.push({
    name: "createLaser",
    title: "LAM.controls.createLaser",
    icon: "fas fa-lightbulb",
    button: true,
    onClick: async () => {
      const point = canvas.grid.getTopLeftPoint(canvas.center);
      await TokenDocument.create({
        name: "Laser",
        img: "icons/svg/light.svg",
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        [`flags.${MODULE_ID}`]: { ...LASER_DEFAULTS },
      }, { parent: canvas.scene });
      refreshBeams();
    },
  });

  tokenControls.tools.push({
    name: "createMirror",
    title: "LAM.controls.createMirror",
    icon: "fas fa-shield-alt",
    button: true,
    onClick: async () => {
      const point = canvas.grid.getTopLeftPoint(canvas.center);
      await TokenDocument.create({
        name: "Mirror",
        img: "icons/svg/shield.svg",
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        [`flags.${MODULE_ID}`]: { ...MIRROR_DEFAULTS },
      }, { parent: canvas.scene });
      refreshBeams();
    },
  });
}
```

**Key changes from the old version:**
- Removed `Items.registerSheet(...)` calls (moved to `module.mjs` using correct API)
- Removed `preCreateItem` hook (DataModels handle defaults automatically)
- Removed `fromDropData` → use `fromUuid` instead (V14 standard)
- Removed local `TokenDocument` variable assignment (use global)
- Fixed drop handler to read `item.system` instead of `item.flags`
- Use `ITEM_TYPES` for type comparison (prefixed types)

---

### 3. `lang/en.json`

Fix the `TYPES.Item` localization keys to exactly match what Foundry V14 looks up. Foundry looks for `TYPES.Item.{prefixed-type}` where the prefixed type is `LasersAndMirrors.laser`.

**Replace the entire file with:**

```json
{
  "LAM": {
    "settings": {
      "maxBounces": {
        "name": "Maximum Bounces",
        "hint": "Maximum number of times a laser beam can reflect off mirrors."
      },
      "beamOpacity": {
        "name": "Beam Opacity",
        "hint": "Opacity level for rendered laser beams (0.1 to 1.0)."
      },
      "glowEffect": {
        "name": "Glow Effect",
        "hint": "Enable outer glow visual effect on rendered laser beams."
      },
      "debugMode": {
        "name": "Debug Mode",
        "hint": "Enable debug logging and visual overlays for laser raycasting."
      }
    },
    "sheets": {
      "laser": {
        "title": "Laser Configuration"
      },
      "mirror": {
        "title": "Mirror Configuration (GM)"
      },
      "mirrorPlayer": {
        "title": "Adjust Mirror Orientation"
      }
    },
    "labels": {
      "color": "Beam Color",
      "width": "Beam Width",
      "range": "Beam Range (Grids)",
      "intensity": "Beam Intensity",
      "visible": "Laser Active / Visible",
      "interactable": "Players Can Rotate",
      "attachable": "Can Attach to Tokens",
      "orientation": "Mirror Angle (Degrees)"
    },
    "hud": {
      "adjustMirror": "Rotate Mirror",
      "toggleLaser": "Toggle Laser Beam",
      "attachLaser": "Attach Laser to Target",
      "detachLaser": "Detach Laser"
    },
    "notify": {
      "notAdjacent": "You must be adjacent to the mirror to adjust it.",
      "laserAttached": "Laser attached to target token.",
      "laserDetached": "Laser detached.",
      "laserToggled": "Laser state toggled."
    },
    "controls": {
      "createLaser": "Create Laser Token",
      "createMirror": "Create Mirror Token"
    }
  },
  "TYPES": {
    "Item": {
      "LasersAndMirrors.laser": "Laser",
      "LasersAndMirrors.mirror": "Mirror"
    }
  }
}
```

**Key change:** The `TYPES.Item` section now uses the **prefixed** keys `"LasersAndMirrors.laser"` and `"LasersAndMirrors.mirror"`. Removed all the redundant/incorrect variants.

---

## VERIFICATION — FULL END-TO-END TEST

Run this sequence in the Foundry browser console after reloading:

```js
// === TEST 1: Module loaded ===
console.assert(game.modules.get("LasersAndMirrors")?.active, "Module not active");

// === TEST 2: DataModels registered ===
console.assert(CONFIG.Item.dataModels["LasersAndMirrors.laser"], "Laser DataModel not registered");
console.assert(CONFIG.Item.dataModels["LasersAndMirrors.mirror"], "Mirror DataModel not registered");

// === TEST 3: Settings registered ===
console.assert(game.settings.get("LasersAndMirrors", "maxBounces") === 10, "Settings failed");

// === TEST 4: Create a Laser Item from code ===
const laserItem = await Item.create({
  name: "Test Laser",
  type: "LasersAndMirrors.laser",
});
console.log("Laser Item created:", laserItem.id);
console.log("Laser system data:", laserItem.system);
console.assert(laserItem.system.color === "#ff0000", "Laser default color wrong");
console.assert(laserItem.system.visible === true, "Laser default visible wrong");

// === TEST 5: Create a Mirror Item from code ===
const mirrorItem = await Item.create({
  name: "Test Mirror",
  type: "LasersAndMirrors.mirror",
});
console.log("Mirror Item created:", mirrorItem.id);
console.log("Mirror system data:", mirrorItem.system);
console.assert(mirrorItem.system.orientation === 0, "Mirror default orientation wrong");

// === TEST 6: Open the laser item sheet ===
laserItem.sheet.render(true);
// The LaserItemSheet should open with all fields populated

// === TEST 7: Create tokens via canvas controls ===
// Click the Laser/Mirror buttons in the token controls toolbar

// === TEST 8: Token HUD still works ===
// Place a laser token, right-click → gear icon → LaserTokenConfigSheet opens

// === TEST 9: Cleanup ===
await laserItem.delete();
await mirrorItem.delete();
console.log("All tests passed!");
```

### UI Test (manual):
1. Open the Items sidebar tab
2. Click "Create Item"
3. In the "Type" dropdown, verify "Laser" and "Mirror" appear
4. Create a Laser → sheet opens automatically with color, width, range etc.
5. Create a Mirror → sheet opens with color, width, orientation
6. Drag the Laser item from sidebar onto the canvas → Token appears with correct flags
7. Right-click the token → HUD buttons work correctly
8. No console errors throughout

---

## FILE COUNT CHECK

After all tasks, verify these files exist:

```
scripts/data-models/laser-item-model.mjs    (NEW — TASK_8)
scripts/data-models/mirror-item-model.mjs   (NEW — TASK_8)
scripts/apps/laser-item-sheet.mjs           (NEW — TASK_9)
scripts/apps/mirror-item-sheet.mjs          (NEW — TASK_9)
scripts/apps/laser-sheet.mjs                (MODIFIED — TASK_10, exports LaserTokenConfigSheet)
scripts/apps/mirror-sheet.mjs               (MODIFIED — TASK_10, exports MirrorTokenConfigSheet)
scripts/apps/mirror-player-sheet.mjs        (UNCHANGED)
scripts/interaction/hud-buttons.mjs         (MODIFIED — TASK_10, updated imports)
scripts/interaction/item-hooks.mjs          (MODIFIED — TASK_11, removed broken code)
scripts/module.mjs                          (MODIFIED — TASK_11, full wiring)
scripts/constants.mjs                       (MODIFIED — TASK_8, added ITEM_TYPES)
lang/en.json                                (MODIFIED — TASK_11, fixed TYPES keys)
```

## IMPORT DEPENDENCY GRAPH (updated)

```
module.mjs
  ← constants.mjs
  ← settings.mjs ← constants.mjs
  ← beam-layer.mjs ← constants.mjs, beam-renderer.mjs, ray-caster.mjs
  ← token-hooks.mjs ← constants.mjs, laser-data.mjs, token-helpers.mjs, beam-layer.mjs, attachment.mjs
  ← hud-buttons.mjs ← constants.mjs, laser-data.mjs, mirror-data.mjs, token-helpers.mjs, laser-sheet.mjs(TokenConfig), mirror-sheet.mjs(TokenConfig), mirror-player-sheet.mjs, attachment.mjs, beam-layer.mjs
  ← item-hooks.mjs ← constants.mjs, beam-layer.mjs
  ← laser-item-model.mjs (no imports)
  ← mirror-item-model.mjs (no imports)
  ← laser-item-sheet.mjs ← constants.mjs
  ← mirror-item-sheet.mjs ← constants.mjs
```

No circular dependencies.
