import assert from "node:assert/strict";
import { ConditionEvaluator } from "../scripts/behaviors/condition-evaluator.mjs";
import { BaseBehavior } from "../scripts/behaviors/base-behavior.mjs";
import { ExecutionContext, BehaviorRunner } from "../scripts/behaviors/behavior-runner.mjs";
import { BehaviorRegistry } from "../scripts/behaviors/behavior-registry.mjs";

console.log("Running condition-evaluator unit tests...");

// Setup mock Foundry global scene flags
const mockFlags = {
  puzzleUnlocked: true,
  doorCounter: 3,
  secretWord: "laser",
  emptyFlag: "",
};

globalThis.canvas = {
  scene: {
    getFlag: (scope, key) => mockFlags[key],
  },
};

// 1. Test BaseBehavior value resolution
assert.equal(BaseBehavior.resolveValue("123"), 123, "Should resolve numeric string to number");
assert.equal(BaseBehavior.resolveValue("true"), true, "Should resolve 'true' to boolean true");
assert.equal(BaseBehavior.resolveValue("false"), false, "Should resolve 'false' to boolean false");
assert.equal(BaseBehavior.resolveValue("null"), null, "Should resolve 'null' to null");
assert.equal(BaseBehavior.resolveValue('"hello world"'), "hello world", "Should unquote double-quoted string");
assert.equal(BaseBehavior.resolveValue("'hello world'"), "hello world", "Should unquote single-quoted string");

const context = new ExecutionContext({
  variables: {
    heroHp: 50,
    doorState: "open",
    hasKey: true,
    tagList: ["fire", "light"],
  },
});

assert.equal(BaseBehavior.resolveValue("$heroHp", context), 50, "Should resolve $variable");
assert.equal(BaseBehavior.resolveValue("var:doorState", context), "open", "Should resolve var:variable");
assert.equal(BaseBehavior.resolveValue("flag:doorCounter", context), 3, "Should resolve flag:name");

// 2. Test Atomic Comparisons
assert.equal(ConditionEvaluator.compare(5, "==", 5), true);
assert.equal(ConditionEvaluator.compare(5, "!=", 10), true);
assert.equal(ConditionEvaluator.compare(10, ">", 5), true);
assert.equal(ConditionEvaluator.compare(5, ">=", 5), true);
assert.equal(ConditionEvaluator.compare(3, "<", 5), true);
assert.equal(ConditionEvaluator.compare(5, "<=", 5), true);
assert.equal(ConditionEvaluator.compare("hello world", "contains", "world"), true);
assert.equal(ConditionEvaluator.compare("hello world", "!contains", "beam"), true);
assert.equal(ConditionEvaluator.compare(["fire", "light"], "contains", "fire"), true);
assert.equal(ConditionEvaluator.compare(true, "is_true", null), true);
assert.equal(ConditionEvaluator.compare(false, "is_false", null), true);
assert.equal(ConditionEvaluator.compare("", "is_empty", null), true);
assert.equal(ConditionEvaluator.compare("hello", "is_not_empty", null), true);

// 3. Test Clause evaluation
assert.equal(
  ConditionEvaluator.evaluateClause({ left: "$heroHp", operator: ">", right: "20" }, context),
  true,
  "heroHp (50) > 20 should be true"
);
assert.equal(
  ConditionEvaluator.evaluateClause({ left: "$heroHp", operator: "<", right: "20" }, context),
  false,
  "heroHp (50) < 20 should be false"
);
assert.equal(
  ConditionEvaluator.evaluateClause({ left: "flag:secretWord", operator: "==", right: "laser" }, context),
  true,
  "flag:secretWord == laser should be true"
);

// 4. Test Expression parser and evaluator with AND, OR, parentheses
assert.equal(
  ConditionEvaluator.evaluateExpression("$heroHp > 20 && $doorState == 'open'", context),
  true,
  "AND expression should evaluate to true"
);

assert.equal(
  ConditionEvaluator.evaluateExpression("$heroHp < 20 || $hasKey == true", context),
  true,
  "OR expression should evaluate to true when one operand is true"
);

assert.equal(
  ConditionEvaluator.evaluateExpression("($heroHp < 20 || $doorState == 'open') && flag:doorCounter == 3", context),
  true,
  "Parenthesized expression should evaluate correctly"
);

assert.equal(
  ConditionEvaluator.evaluateExpression("($heroHp < 20 || $doorState == 'closed') && flag:doorCounter == 3", context),
  false,
  "Parenthesized false branch should yield false"
);

assert.equal(
  ConditionEvaluator.evaluateExpression("$heroHp > 10 AND flag:puzzleUnlocked == true", context),
  true,
  "Word AND should evaluate to true"
);

assert.equal(
  ConditionEvaluator.evaluateExpression("$heroHp < 10 OR flag:doorCounter > 1", context),
  true,
  "Word OR should evaluate to true"
);

// 5. Test BehaviorRunner with conditional flow control
class MockSetVarBehavior extends BaseBehavior {
  static type = "mockSetVar";
  static async execute(config, ctx) {
    ctx.setVariable(config.name, config.value);
  }
}

class MockConditionalBehavior extends BaseBehavior {
  static type = "mockConditional";
  static async execute(config, ctx) {
    const passed = ConditionEvaluator.evaluate(config.condition, ctx);
    if (!passed) {
      ctx.stop("Condition failed");
    }
  }
}

BehaviorRegistry.register(MockSetVarBehavior);
BehaviorRegistry.register(MockConditionalBehavior);

// Sequence 1: Condition passes -> all steps execute
const seq1 = [
  { type: "mockSetVar", name: "step1", value: true },
  { type: "mockConditional", condition: "$step1 == true" },
  { type: "mockSetVar", name: "step2", value: true },
];

const ctx1 = new ExecutionContext();
await BehaviorRunner.runSequence(seq1, ctx1);
assert.equal(ctx1.getVariable("step1"), true);
assert.equal(ctx1.getVariable("step2"), true);
assert.equal(ctx1.stopped, false);

// Sequence 2: Condition fails -> step 2 is skipped
const seq2 = [
  { type: "mockSetVar", name: "step1", value: 10 },
  { type: "mockConditional", condition: "$step1 == 999" },
  { type: "mockSetVar", name: "step2", value: "should_not_run" },
];

const ctx2 = new ExecutionContext();
await BehaviorRunner.runSequence(seq2, ctx2);
assert.equal(ctx2.getVariable("step1"), 10);
assert.equal(ctx2.getVariable("step2"), undefined, "Step 2 should be skipped when condition fails");
assert.equal(ctx2.stopped, true, "Context should be stopped");

console.log("All condition-evaluator and behavior runner tests passed successfully!");
