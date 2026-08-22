import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";

/**
 * Behavior: Read Game Flag
 * Reads a scene world flag via canvas.scene.getFlag("world", flagName)
 * and stores it into the local execution variables.
 */
export class ReadGameFlagBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.READ_FLAG;
  static label = "LAM.behaviors.readFlag.label";
  static icon = "fa-solid fa-flag";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-flag-read.hbs";

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      flagScope: "world",
      flagName: "",
      variableName: "",
    };
  }

  /** @override */
  static getSummary(config) {
    const flag = config?.flagName || "(unnamed flag)";
    const varName = config?.variableName || flag;
    return `Read Flag "${flag}" → $${varName}`;
  }

  /** @override */
  static async execute(config, context) {
    if (!config?.flagName) return;

    const flagScope = config.flagScope || "world";
    const flagName = config.flagName.trim();
    const varName = (config.variableName || flagName || config.id).trim();

    const value = canvas?.scene?.getFlag?.(flagScope, flagName);
    context.setVariable(varName, value);
  }
}
