import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";

/**
 * Behavior: Set Game Flag
 * Writes an arbitrary flag to the current scene via canvas.scene.setFlag("world", flagName, flagValue).
 */
export class SetGameFlagBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.SET_FLAG;
  static label = "LAM.behaviors.setFlag.label";
  static icon = "fa-solid fa-flag-checkered";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-flag-set.hbs";

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      flagScope: "world",
      flagName: "",
      value: "true",
    };
  }

  /** @override */
  static getSummary(config) {
    const flag = config?.flagName || "(unnamed flag)";
    const val = config?.value !== undefined ? config.value : "";
    return `Set Flag "${flag}" = ${val}`;
  }

  /** @override */
  static async execute(config, context) {
    if (!config?.flagName) return;

    const rawScope = config.flagScope || "world";
    const flagScope = String(this.resolveValue(rawScope, context) || "world").trim();
    const flagName = String(this.resolveValue(config.flagName, context) || "").trim();
    const resolvedValue = this.resolveValue(config.value, context);

    if (flagName && canvas?.scene?.setFlag) {
      await canvas.scene.setFlag(flagScope, flagName, resolvedValue);
    }
  }
}
