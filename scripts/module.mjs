import { MODULE_ID, ACTOR_TYPES } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { initBeamLayer, refreshBeams } from "./canvas/beam-layer.mjs";
import { registerTokenHooks } from "./interaction/token-hooks.mjs";
import { registerHUDHooks } from "./interaction/hud-buttons.mjs";
import { registerActorHooks } from "./interaction/actor-hooks.mjs";
import { LaserActorModel } from "./data-models/laser-actor-model.mjs";
import { MirrorActorModel } from "./data-models/mirror-actor-model.mjs";
import { LaserActorSheet } from "./apps/laser-actor-sheet.mjs";
import { MirrorActorSheet } from "./apps/mirror-actor-sheet.mjs";

/**
 * Module initialization — register data models, settings, sheets, and hooks.
 */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Register TypeDataModels for custom Actor subtypes
  Object.assign(CONFIG.Actor.dataModels, {
    [ACTOR_TYPES.LASER]: LaserActorModel,
    [ACTOR_TYPES.MIRROR]: MirrorActorModel,
  });

  // Register settings
  registerSettings();

  // Register Actor sheets via DocumentSheetConfig
  const DSC = foundry.applications.apps.DocumentSheetConfig;
  DSC.registerSheet(foundry.documents.Actor, MODULE_ID, LaserActorSheet, {
    types: [ACTOR_TYPES.LASER],
    makeDefault: true,
    label: "LAM.sheets.laser.title",
  });
  DSC.registerSheet(foundry.documents.Actor, MODULE_ID, MirrorActorSheet, {
    types: [ACTOR_TYPES.MIRROR],
    makeDefault: true,
    label: "LAM.sheets.mirror.title",
  });

  // Register actor-related hooks (scene controls, actor pre-creation)
  registerActorHooks();
});

/**
 * Module ready — register interaction hooks and ensure mirror permissions.
 */
Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | Ready`);
  registerTokenHooks();
  registerHUDHooks();

  // Ensure all existing mirror actors are owned by everyone by default
  if (game.user.isGM) {
    const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    for (const actor of game.actors.filter(a => a.type === ACTOR_TYPES.MIRROR)) {
      if (actor.ownership?.default !== ownerLevel) {
        await actor.update({ "ownership.default": ownerLevel });
      }
    }
  }
});

/**
 * Canvas ready — initialize the beam rendering layer.
 * Fires every time a new scene is loaded.
 */
Hooks.on("canvasReady", async () => {
  console.log(`${MODULE_ID} | Canvas ready, initializing beam layer`);
  await initBeamLayer();
});
