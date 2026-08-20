import { MODULE_ID } from "./constants.mjs";
import { refreshBeams } from "./canvas/beam-layer.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, "enableLaserLight", {
    name: "LAM.settings.enableLaserLight.name",
    hint: "LAM.settings.enableLaserLight.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => refreshBeams(),
  });

  game.settings.register(MODULE_ID, "laserLightRadius", {
    name: "LAM.settings.laserLightRadius.name",
    hint: "LAM.settings.laserLightRadius.hint",
    scope: "world",
    config: true,
    type: Number,
    default: 1.0,
    range: { min: 0.1, max: 5.0, step: 0.1 },
    onChange: () => refreshBeams(),
  });

  game.settings.register(MODULE_ID, "maxBounces", {
    name: "LAM.settings.maxBounces.name",
    hint: "LAM.settings.maxBounces.hint",
    scope: "world",
    config: true,
    type: Number,
    default: 10,
    range: { min: 1, max: 50, step: 1 },
    onChange: () => refreshBeams(),
  });

  game.settings.register(MODULE_ID, "beamOpacity", {
    name: "LAM.settings.beamOpacity.name",
    hint: "LAM.settings.beamOpacity.hint",
    scope: "world",
    config: true,
    type: Number,
    default: 0.8,
    range: { min: 0.1, max: 1.0, step: 0.1 },
    onChange: () => refreshBeams(),
  });

  game.settings.register(MODULE_ID, "glowEffect", {
    name: "LAM.settings.glowEffect.name",
    hint: "LAM.settings.glowEffect.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => refreshBeams(),
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
