import { BEHAVIOR_TYPES, MODULE_ID } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";

/**
 * Behavior: Macro Call
 * Executes arbitrary JavaScript in Foundry macro context with trigger variables.
 */
export class MacroCallBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.MACRO;
  static label = "LAM.behaviors.macro.label";
  static icon = "fa-solid fa-code";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-macro.hbs";

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      command: "// Runs when trigger sequence reaches this step\n",
    };
  }

  /** @override */
  static getSummary(config) {
    const lines = (config?.command ?? "").trim().split("\n").filter(l => l.trim().length > 0);
    if (lines.length === 0) return "Macro (empty)";
    const first = lines[0].replace(/^\/\/\s*/, "").substring(0, 35);
    return `Macro: ${first}${lines[0].length > 35 ? "..." : ""}`;
  }

  /** @override */
  static async execute(config, context) {
    const code = config?.command;
    if (!code || code.trim() === "") return;

    const tokenDoc = context.tokenDoc;
    const actor = context.actor;
    const beamData = context.beamData;
    const variables = context.variables;
    const event = context.eventType;
    const scene = canvas?.scene;

    try {
      // Create an AsyncFunction runner
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(
        "token",
        "actor",
        "beamData",
        "variables",
        "event",
        "scene",
        "context",
        code
      );
      await fn.call(globalThis, tokenDoc, actor, beamData, variables, event, scene, context);
    } catch (err) {
      console.error(`${MODULE_ID} | Macro behavior error:`, err);
      if (typeof ui !== "undefined" && ui.notifications?.error) {
        ui.notifications.error(`Trigger Macro error: ${err.message}`);
      }
    }
  }
}
