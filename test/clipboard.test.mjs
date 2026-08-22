import assert from "node:assert/strict";
import "../scripts/behaviors/index.mjs";
import { BehaviorClipboard } from "../scripts/behaviors/behavior-clipboard.mjs";
import { BehaviorRegistry } from "../scripts/behaviors/behavior-registry.mjs";
import { BEHAVIOR_TYPES } from "../scripts/constants.mjs";

console.log("Running BehaviorClipboard unit tests...");

// Setup mock game and i18n
globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`,
  },
};

// 1. Initial state
BehaviorClipboard.clear();
assert.equal(BehaviorClipboard.hasClipboard, false, "Clipboard is initially empty");
assert.equal(BehaviorClipboard.get(), null, "get() returns null when empty");
assert.equal(BehaviorClipboard.paste(), null, "paste() returns null when empty");
assert.equal(BehaviorClipboard.getSummary(), "", "getSummary() returns empty string when empty");

// 2. Copy a Light behavior
const lightBehavior = {
  id: "light-original-id-123",
  type: BEHAVIOR_TYPES.LIGHT,
  enabled: true,
  uuid: "Scene.1.AmbientLight.light1",
  properties: [
    { property: "config.dim", value: "20" },
    { property: "config.color", value: "#ff0000" },
  ],
};

const copied = BehaviorClipboard.copy(lightBehavior);
assert.notEqual(copied, null, "copy() returned non-null object");
assert.equal(BehaviorClipboard.hasClipboard, true, "hasClipboard returns true after copy");
assert.equal(BehaviorClipboard.get().id, "light-original-id-123", "get() retains original ID");

// Mutating original object should not mutate clipboard
lightBehavior.properties.push({ property: "config.bright", value: "10" });
assert.equal(BehaviorClipboard.get().properties.length, 2, "Clipboard is isolated from original object mutation");

// 3. Paste behavior
const pasted1 = BehaviorClipboard.paste();
assert.notEqual(pasted1, null, "paste() returns behavior object");
assert.notEqual(pasted1.id, "light-original-id-123", "pasted behavior receives a fresh new ID");
assert.equal(pasted1.type, BEHAVIOR_TYPES.LIGHT, "pasted behavior preserves type");
assert.equal(pasted1.uuid, "Scene.1.AmbientLight.light1", "pasted behavior preserves uuid");
assert.equal(pasted1.properties.length, 2, "pasted behavior preserves properties");
assert.equal(pasted1.properties[0].property, "config.dim");
assert.equal(pasted1.properties[0].value, "20");

// Subsequent paste should generate another distinct ID
const pasted2 = BehaviorClipboard.paste();
assert.notEqual(pasted2.id, pasted1.id, "Each paste() call generates a unique ID");
assert.notEqual(pasted2.id, "light-original-id-123");

// 4. Test nested behaviors (Conditional with Else behaviors)
const conditionalBehavior = {
  id: "cond-id-999",
  type: BEHAVIOR_TYPES.CONDITIONAL,
  enabled: true,
  mode: "clause",
  left: "$doorOpen",
  operator: "==",
  right: "true",
  onFalse: "execute_else",
  elseBehaviors: [
    {
      id: "else-light-1",
      type: BEHAVIOR_TYPES.LIGHT,
      uuid: "Scene.1.AmbientLight.redAlarm",
      properties: [{ property: "config.color", value: "#ff0000" }],
    },
    {
      id: "else-door-2",
      type: BEHAVIOR_TYPES.DOOR,
      uuid: "Scene.1.Wall.door1",
      properties: [{ property: "ds", value: "2" }],
    },
  ],
};

BehaviorClipboard.copy(conditionalBehavior);
assert.equal(BehaviorClipboard.hasClipboard, true);

const pastedCond = BehaviorClipboard.paste();
assert.notEqual(pastedCond.id, "cond-id-999", "Root conditional ID was regenerated");
assert.equal(pastedCond.elseBehaviors.length, 2, "Else behaviors preserved");
assert.notEqual(pastedCond.elseBehaviors[0].id, "else-light-1", "Nested else behavior 1 ID regenerated");
assert.notEqual(pastedCond.elseBehaviors[1].id, "else-door-2", "Nested else behavior 2 ID regenerated");
assert.notEqual(pastedCond.elseBehaviors[0].id, pastedCond.elseBehaviors[1].id, "Nested else behavior IDs are unique");
assert.equal(pastedCond.elseBehaviors[0].type, BEHAVIOR_TYPES.LIGHT);
assert.equal(pastedCond.elseBehaviors[1].type, BEHAVIOR_TYPES.DOOR);

// 5. Cross-event & cross-trigger flow simulation
const triggerA = {
  id: "tokenA",
  behaviorsEnter: [
    {
      id: "enter-b1",
      type: BEHAVIOR_TYPES.SET_FLAG,
      scope: "world",
      flagName: "puzzleStep1",
      value: "true",
    },
  ],
  behaviorsExit: [],
};

const triggerB = {
  id: "tokenB",
  behaviorsStay: [],
  behaviorsHitChange: [],
};

// Copy from Trigger A (behaviorsEnter)
BehaviorClipboard.copy(triggerA.behaviorsEnter[0]);

// Paste into Trigger A (behaviorsExit)
const pastedExit = BehaviorClipboard.paste();
triggerA.behaviorsExit.push(pastedExit);

// Paste into Trigger B (behaviorsHitChange)
const pastedHitChange = BehaviorClipboard.paste();
triggerB.behaviorsHitChange.push(pastedHitChange);

assert.equal(triggerA.behaviorsExit.length, 1);
assert.equal(triggerB.behaviorsHitChange.length, 1);
assert.notEqual(triggerA.behaviorsEnter[0].id, triggerA.behaviorsExit[0].id);
assert.notEqual(triggerA.behaviorsExit[0].id, triggerB.behaviorsHitChange[0].id);
assert.equal(triggerB.behaviorsHitChange[0].flagName, "puzzleStep1");
assert.equal(triggerB.behaviorsHitChange[0].value, "true");

// 6. Test Clear
BehaviorClipboard.clear();
assert.equal(BehaviorClipboard.hasClipboard, false, "hasClipboard false after clear");
assert.equal(BehaviorClipboard.get(), null, "get() null after clear");

// 7. Full Trigger Configuration Copy & Paste
BehaviorClipboard.clearTrigger();
assert.equal(BehaviorClipboard.hasTriggerClipboard, false, "hasTriggerClipboard initially false");
assert.equal(BehaviorClipboard.getTrigger(), null);
assert.equal(BehaviorClipboard.pasteTrigger(), null);

const sourceTrigger = {
  enabled: true,
  anchorRadius: 1.5,
  passThrough: true,
  onBeamHit: "console.log('hit');",
  behaviorsEnter: [
    {
      id: "orig-enter-1",
      type: BEHAVIOR_TYPES.LIGHT,
      uuid: "Scene.1.AmbientLight.l1",
      properties: [{ property: "config.dim", value: "10" }],
    },
    {
      id: "orig-enter-2",
      type: BEHAVIOR_TYPES.CONDITIONAL,
      mode: "clause",
      left: "$x",
      operator: ">",
      right: "5",
      onFalse: "execute_else",
      elseBehaviors: [
        {
          id: "orig-else-1",
          type: BEHAVIOR_TYPES.DOOR,
          uuid: "Scene.1.Wall.w1",
          properties: [{ property: "ds", value: "0" }],
        },
      ],
    },
  ],
  behaviorsStay: [
    {
      id: "orig-stay-1",
      type: BEHAVIOR_TYPES.MACRO,
      command: "game.user.character?.update({})",
    },
  ],
  behaviorsExit: [
    {
      id: "orig-exit-1",
      type: BEHAVIOR_TYPES.SET_VARIABLE,
      name: "exited",
      value: "true",
    },
  ],
  behaviorsHitChange: [],
};

const copiedTrigger = BehaviorClipboard.copyTrigger(sourceTrigger);
assert.notEqual(copiedTrigger, null);
assert.equal(BehaviorClipboard.hasTriggerClipboard, true, "hasTriggerClipboard is true after copy");
assert.equal(BehaviorClipboard.getTrigger().anchorRadius, 1.5);
assert.equal(BehaviorClipboard.getTrigger().passThrough, true);

// Mutating source should not mutate clipboard
sourceTrigger.behaviorsEnter.push({ id: "extra", type: BEHAVIOR_TYPES.LIGHT });
assert.equal(BehaviorClipboard.getTrigger().behaviorsEnter.length, 2, "Trigger clipboard isolated from original");

// Paste full trigger config into a new target
const targetTrigger = BehaviorClipboard.pasteTrigger();
assert.notEqual(targetTrigger, null);
assert.equal(targetTrigger.enabled, true);
assert.equal(targetTrigger.anchorRadius, 1.5);
assert.equal(targetTrigger.passThrough, true);
assert.equal(targetTrigger.onBeamHit, "console.log('hit');");
assert.equal(targetTrigger.behaviorsEnter.length, 2);
assert.equal(targetTrigger.behaviorsStay.length, 1);
assert.equal(targetTrigger.behaviorsExit.length, 1);
assert.equal(targetTrigger.behaviorsHitChange.length, 0);

// Verify ALL IDs in target are freshly regenerated and unique
assert.notEqual(targetTrigger.behaviorsEnter[0].id, "orig-enter-1");
assert.notEqual(targetTrigger.behaviorsEnter[1].id, "orig-enter-2");
assert.notEqual(targetTrigger.behaviorsEnter[1].elseBehaviors[0].id, "orig-else-1");
assert.notEqual(targetTrigger.behaviorsStay[0].id, "orig-stay-1");
assert.notEqual(targetTrigger.behaviorsExit[0].id, "orig-exit-1");

// Test Clear Trigger Clipboard
BehaviorClipboard.clearTrigger();
assert.equal(BehaviorClipboard.hasTriggerClipboard, false);
assert.equal(BehaviorClipboard.getTrigger(), null);

console.log("All BehaviorClipboard unit tests passed successfully!");
