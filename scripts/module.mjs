import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { initBeamLayer } from "./canvas/beam-layer.mjs";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
});

Hooks.on("canvasReady", async () => {
  await initBeamLayer();
});

