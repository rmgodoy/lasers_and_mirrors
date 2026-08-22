import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";
import { ConditionEvaluator } from "./condition-evaluator.mjs";
import { BehaviorRunner } from "./behavior-runner.mjs";

/**
 * Behavior: Conditional
 * Evaluates assertions between game flags, variables, and values.
 * If true, continues sequence execution; if false, runs optional else behaviors and stops execution flow.
 */
export class ConditionalBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.CONDITIONAL;
  static label = "LAM.behaviors.conditional.label";
  static icon = "fa-solid fa-code-compare";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-conditional.hbs";

  /**
   * Predefined comparison operators for UI.
   */
  static OPERATORS = [
    { value: "==", label: "==" },
    { value: "!=", label: "!=" },
    { value: ">", label: ">" },
    { value: ">=", label: ">=" },
    { value: "<", label: "<" },
    { value: "<=", label: "<=" },
    { value: "contains", label: "contains" },
    { value: "!contains", label: "does not contain" },
    { value: "is_true", label: "is true / truthy" },
    { value: "is_false", label: "is false / falsy" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ];

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      mode: "clause", // "clause" or "expression"
      left: "$tempVar",
      operator: "==",
      right: "1",
      expression: "$tempVar == 1",
      onFalse: "stop", // "stop" or "execute_else"
      elseBehaviors: [],
    };
  }

  /** @override */
  static getSummary(config) {
    if (!config) return "Condition";
    let summary = "";
    if (config.mode === "expression" && config.expression) {
      summary = `If: (${config.expression})`;
    } else {
      const left = config.left || "?";
      const op = config.operator || "==";
      const right = config.right !== undefined ? config.right : "";
      summary = `If: ${left} ${op} ${right}`.trim();
    }

    if (config.onFalse === "execute_else" && Array.isArray(config.elseBehaviors) && config.elseBehaviors.length > 0) {
      const count = config.elseBehaviors.length;
      summary += ` [Else: ${count} action${count > 1 ? "s" : ""}]`;
    }

    return summary;
  }

  /** @override */
  static async execute(config, context) {
    const isExpr = config.mode === "expression" || (!config.left && Boolean(config.expression));
    const target = isExpr
      ? (config.expression ?? "")
      : {
          left: config.left,
          operator: config.operator,
          right: config.right,
          clauses: config.clauses,
          logic: config.logic,
        };

    const passed = ConditionEvaluator.evaluate(target, context);

    if (!passed) {
      if (config.onFalse === "execute_else" && Array.isArray(config.elseBehaviors) && config.elseBehaviors.length > 0) {
        await BehaviorRunner.runSequence(config.elseBehaviors, context);
      }
      context.stop(`Condition failed: ${this.getSummary(config)}`);
    }
  }
}

