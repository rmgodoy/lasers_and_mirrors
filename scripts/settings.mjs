import { MODULE_ID } from "./constants.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, "maxBounces", {
    name: "LAM.settings.maxBounces.name",
    hint: "LAM.settings.maxBounces.hint",
    scope: "world",
    config: true,
    type: Number,
    default: 10,
    range: { min: 1, max: 50, step: 1 },
  });

  game.settings.register(MODULE_ID, "beamOpacity", {
    name: "LAM.settings.beamOpacity.name",
    hint: "LAM.settings.beamOpacity.hint",
    scope: "world",
    config: true,
    type: Number,
    default: 0.8,
    range: { min: 0.1, max: 1.0, step: 0.1 },
  });

  game.settings.register(MODULE_ID, "glowEffect", {
    name: "LAM.settings.glowEffect.name",
    hint: "LAM.settings.glowEffect.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "debugMode", {
    name: "LAM.settings.debugMode.name",
    hint: "LAM.settings.debugMode.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });
}
