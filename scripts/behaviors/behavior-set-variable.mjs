import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";

/**
 * Behavior: Set Variable
 * Sets a local temporary variable available only to this execution flow.
 */
export class SetVariableBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.SET_VARIABLE;
  static label = "LAM.behaviors.setVariable.label";
  static icon = "fa-solid fa-code-branch";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-set-variable.hbs";

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      name: "tempVar",
      value: "1",
    };
  }

  /** @override */
  static getSummary(config) {
    const name = config?.name || "(unnamed)";
    const val = config?.value !== undefined ? config.value : "";
    return `Set $${name.replace(/^\$/, "")} = ${val}`;
  }

  /** @override */
  static async execute(config, context) {
    if (!config?.name) return;

    const varName = config.name.replace(/^\$/, "").trim();
    const resolvedValue = this.resolveValue(config.value, context);
    context.setVariable(varName, resolvedValue);
  }
}
