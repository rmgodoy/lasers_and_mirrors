import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { initBeamLayer, refreshBeams } from "./canvas/beam-layer.mjs";
import { registerTokenHooks } from "./interaction/token-hooks.mjs";
import { registerHUDHooks } from "./interaction/hud-buttons.mjs";
import { registerItemHooks } from "./interaction/item-hooks.mjs";

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
  registerItemHooks();
});

/**
 * Canvas ready — initialize the beam rendering layer.
 * Fires every time a new scene is loaded.
 */
Hooks.on("canvasReady", async () => {
  console.log(`${MODULE_ID} | Canvas ready, initializing beam layer`);
  await initBeamLayer();
});


