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
