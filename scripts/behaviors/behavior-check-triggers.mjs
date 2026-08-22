import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";
import { isTriggerHit } from "../canvas/beam-layer.mjs";
import { BehaviorRunner } from "./behavior-runner.mjs";

/**
 * Behavior: Check Triggers State
 * Evaluates the hit state of multiple trigger tokens against configured conditions.
 * Supports:
 * - All Hit: All triggers in the list must be currently hit by laser beams
 * - All Unhit: All triggers in the list must currently NOT be hit (false)
 * - Any Hit: At least one trigger in the list must be hit
 * - Custom Sequence: Each trigger in the list must match its specific configured state (hit / unhit)
 *
 * If the condition fails, runs optional else behaviors and halts the sequence execution context.
 * Can also store the boolean result in a local execution variable.
 */
export class CheckTriggersBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.CHECK_TRIGGERS;
  static label = "LAM.behaviors.checkTriggers.label";
  static icon = "fa-solid fa-list-check";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-check-triggers.hbs";

  static MATCH_MODES = [
    { value: "all_hit", label: "LAM.behaviors.checkTriggers.modes.allHit" },
    { value: "all_not_hit", label: "LAM.behaviors.checkTriggers.modes.allNotHit" },
    { value: "any_hit", label: "LAM.behaviors.checkTriggers.modes.anyHit" },
    { value: "any_not_hit", label: "LAM.behaviors.checkTriggers.modes.anyNotHit" },
    { value: "custom", label: "LAM.behaviors.checkTriggers.modes.custom" },
  ];

  static TRIGGER_STATES = [
    { value: "hit", label: "LAM.behaviors.checkTriggers.states.hit" },
    { value: "not_hit", label: "LAM.behaviors.checkTriggers.states.notHit" },
  ];

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      matchMode: "all_hit",
      triggers: [
        { uuid: "", state: "hit" },
      ],
      storeVariable: "",
      onFalse: "stop", // "stop" or "execute_else"
      elseBehaviors: [],
    };
  }

  /** @override */
  static getSummary(config) {
    if (!config) return "Check Triggers";
    const triggers = Array.isArray(config.triggers) ? config.triggers : [];
    const validTriggers = triggers.filter(t => t?.uuid?.trim());

    if (validTriggers.length === 0) {
      return "Check Triggers (No triggers specified)";
    }

    const formatTarget = (u) => {
      const trimmed = (u || "").trim();
      return trimmed.includes(".") ? trimmed.split(".").pop() : trimmed;
    };

    const mode = config.matchMode || "all_hit";
    let summary = "";

    switch (mode) {
      case "all_hit": {
        const names = validTriggers.map(t => formatTarget(t.uuid)).join(", ");
        summary = `If All Hit: [${names}]`;
        break;
      }
      case "all_not_hit": {
        const names = validTriggers.map(t => formatTarget(t.uuid)).join(", ");
        summary = `If All Unhit: [${names}]`;
        break;
      }
      case "any_hit": {
        const names = validTriggers.map(t => formatTarget(t.uuid)).join(", ");
        summary = `If Any Hit: [${names}]`;
        break;
      }
      case "any_not_hit": {
        const names = validTriggers.map(t => formatTarget(t.uuid)).join(", ");
        summary = `If Any Unhit: [${names}]`;
        break;
      }
      case "custom": {
        const parts = validTriggers.map(t => {
          const name = formatTarget(t.uuid);
          const stateLabel = (t.state === "not_hit" || t.state === false || t.state === "false" || t.state === "unhit") ? "Unhit" : "Hit";
          return `${name}=${stateLabel}`;
        });
        summary = `If Sequence: [${parts.join(", ")}]`;
        break;
      }
      default:
        summary = `Check Triggers (${validTriggers.length})`;
    }

    if (config.storeVariable?.trim()) {
      const varName = config.storeVariable.replace(/^\$/, "").trim();
      summary += ` → $${varName}`;
    }

    if (config.onFalse === "execute_else" && Array.isArray(config.elseBehaviors) && config.elseBehaviors.length > 0) {
      const count = config.elseBehaviors.length;
      summary += ` [Else: ${count} action${count > 1 ? "s" : ""}]`;
    }

    return summary;
  }

  /** @override */
  static async execute(config, context) {
    const rawTriggers = Array.isArray(config?.triggers) ? config.triggers : [];
    const validTriggers = rawTriggers.filter(t => t && typeof t.uuid === "string" && t.uuid.trim().length > 0);

    let passed = true;

    if (validTriggers.length > 0) {
      const mode = config?.matchMode || "all_hit";

      switch (mode) {
        case "all_hit": {
          passed = validTriggers.every(t => {
            const target = String(this.resolveValue(t.uuid, context) || "").trim();
            return isTriggerHit(target);
          });
          break;
        }

        case "all_not_hit": {
          passed = validTriggers.every(t => {
            const target = String(this.resolveValue(t.uuid, context) || "").trim();
            return !isTriggerHit(target);
          });
          break;
        }

        case "any_hit": {
          passed = validTriggers.some(t => {
            const target = String(this.resolveValue(t.uuid, context) || "").trim();
            return isTriggerHit(target);
          });
          break;
        }

        case "any_not_hit": {
          passed = validTriggers.some(t => {
            const target = String(this.resolveValue(t.uuid, context) || "").trim();
            return !isTriggerHit(target);
          });
          break;
        }

        case "custom": {
          passed = validTriggers.every(t => {
            const target = String(this.resolveValue(t.uuid, context) || "").trim();
            const expected = (t.state !== "not_hit" && t.state !== false && t.state !== "false" && t.state !== "unhit");
            const actual = isTriggerHit(target);
            return actual === expected;
          });
          break;
        }

        default:
          passed = true;
      }
    }

    // Optional: store result in variable
    if (config?.storeVariable?.trim()) {
      const rawVar = config.storeVariable;
      const varName = String(this.resolveValue(rawVar, context) || rawVar).replace(/^\$/, "").trim();
      if (varName) {
        context.setVariable(varName, passed);
      }
    }

    // If condition failed, run optional else behaviors and stop sequence execution
    if (!passed) {
      if (config.onFalse === "execute_else" && Array.isArray(config.elseBehaviors) && config.elseBehaviors.length > 0) {
        await BehaviorRunner.runSequence(config.elseBehaviors, context);
      }
      context.stop(`Trigger condition failed: ${this.getSummary(config)}`);
    }
  }
}

