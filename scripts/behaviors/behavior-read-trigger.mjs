import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";
import { isTriggerHit } from "../canvas/beam-layer.mjs";

/**
 * Behavior: Read Trigger State
 * Reads whether another trigger token on the scene is currently hit by any laser beam.
 * Stores the boolean result into a local execution variable.
 */
export class ReadTriggerStateBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.READ_TRIGGER;
  static label = "LAM.behaviors.readTrigger.label";
  static icon = "fa-solid fa-bullseye";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-trigger-read.hbs";

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      uuid: "",
      variableName: "isTargetHit",
    };
  }

  /** @override */
  static getSummary(config) {
    const target = config?.uuid ? config.uuid.split(".").pop() : "No target";
    const varName = (config?.variableName || "isTargetHit").replace(/^\$/, "");
    return `Read Trigger [${target}] Hit → $${varName}`;
  }

  /** @override */
  static async execute(config, context) {
    if (!config?.uuid) return;

    const target = String(this.resolveValue(config.uuid, context) || "").trim();
    const rawVar = config.variableName || "isTargetHit";
    const varName = String(this.resolveValue(rawVar, context) || "isTargetHit").replace(/^\$/, "").trim();

    const isHit = isTriggerHit(target);
    context.setVariable(varName, isHit);
  }
}
