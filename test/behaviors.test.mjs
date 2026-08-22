import assert from "node:assert/strict";
import "../scripts/behaviors/index.mjs";
import { BehaviorRegistry } from "../scripts/behaviors/behavior-registry.mjs";
import { BehaviorRunner, ExecutionContext } from "../scripts/behaviors/behavior-runner.mjs";
import { BEHAVIOR_TYPES, TRIGGER_EVENTS, FLAGS, TRIGGER_DEFAULTS } from "../scripts/constants.mjs";
import { isTriggerHit } from "../scripts/canvas/beam-layer.mjs";
import { ConditionalBehavior } from "../scripts/behaviors/behavior-conditional.mjs";


console.log("Running behaviors unit tests...");

// Setup mock Foundry canvas and scene documents
const sceneFlags = {};
const mockLights = new Map();
const mockWalls = new Map();
const mockTiles = new Map();

globalThis.canvas = {
  scene: {
    getFlag: (scope, key) => sceneFlags[`${scope}.${key}`],
    setFlag: async (scope, key, val) => {
      sceneFlags[`${scope}.${key}`] = val;
    },
    lights: mockLights,
    walls: mockWalls,
    tiles: mockTiles,
  },
};

globalThis.fromUuid = async (uuid) => {
  if (mockLights.has(uuid)) return mockLights.get(uuid);
  if (mockWalls.has(uuid)) return mockWalls.get(uuid);
  if (mockTiles.has(uuid)) return mockTiles.get(uuid);
  return null;
};

// 1. Verify all 9 behaviors are registered
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.LIGHT), true, "Light behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.DOOR), true, "Door behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.TILE), true, "Tile behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.MACRO), true, "Macro behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.READ_FLAG), true, "ReadFlag behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.SET_FLAG), true, "SetFlag behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.SET_VARIABLE), true, "SetVariable behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.CONDITIONAL), true, "Conditional behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.CHECK_TRIGGERS), true, "CheckTriggers behavior registered");

// 2. Test ChangeLightPropertyBehavior
let lightUpdatedData = null;
const mockLightDoc = {
  id: "light1",
  update: async (changes) => { lightUpdatedData = changes; },
};
mockLights.set("Scene.1.AmbientLight.light1", mockLightDoc);

const lightConfig = {
  type: BEHAVIOR_TYPES.LIGHT,
  uuid: "Scene.1.AmbientLight.light1",
  properties: [
    { property: "config.dim", value: "$customDim" },
    { property: "hidden", value: "false" },
    { property: "config.color", value: "#00ff00" },
  ],
};

const lightContext = new ExecutionContext({
  variables: { customDim: 25 },
});

await BehaviorRunner.runSequence([lightConfig], lightContext);
assert.deepEqual(lightUpdatedData, {
  "config.dim": 25,
  hidden: false,
  "config.color": "#00ff00",
}, "Light properties updated correctly with variable substitution");

// 3. Test ChangeDoorPropertyBehavior
let doorUpdatedData = null;
const mockDoorDoc = {
  id: "door1",
  update: async (changes) => { doorUpdatedData = changes; },
};
mockWalls.set("Scene.1.Wall.door1", mockDoorDoc);

const doorConfig = {
  type: BEHAVIOR_TYPES.DOOR,
  uuid: "Scene.1.Wall.door1",
  properties: [
    { property: "ds", value: "open" },
    { property: "door", value: "1" },
  ],
};

await BehaviorRunner.runSequence([doorConfig], new ExecutionContext());
assert.deepEqual(doorUpdatedData, {
  ds: 1, // Normalized from "open" -> 1
  door: 1,
}, "Door properties updated correctly with state normalization");

// 4. Test ChangeTilePropertyBehavior
let tileUpdatedData = null;
const mockTileDoc = {
  id: "tile1",
  update: async (changes) => { tileUpdatedData = changes; },
};
mockTiles.set("Scene.1.Tile.tile1", mockTileDoc);

const tileConfig = {
  type: BEHAVIOR_TYPES.TILE,
  uuid: "Scene.1.Tile.tile1",
  properties: [
    { property: "hidden", value: "false" },
    { property: "alpha", value: "0.75" },
  ],
};

await BehaviorRunner.runSequence([tileConfig], new ExecutionContext());
assert.deepEqual(tileUpdatedData, {
  hidden: false,
  alpha: 0.75,
}, "Tile properties updated correctly");

// 5. Test ReadGameFlag & SetGameFlag & SetVariable behaviors
sceneFlags["world.puzzleProgress"] = 3;

const flagPipeline = [
  // 1. Read scene flag into variable
  { type: BEHAVIOR_TYPES.READ_FLAG, flagScope: "world", flagName: "puzzleProgress", variableName: "progress" },
  // 2. Set temporary variable
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "multiplier", value: "2" },
  // 3. Conditional: if $progress == 3
  { type: BEHAVIOR_TYPES.CONDITIONAL, left: "$progress", operator: "==", right: "3" },
  // 4. Macro to do math
  { type: BEHAVIOR_TYPES.MACRO, command: "variables.result = variables.progress * variables.multiplier;" },
  // 5. Save back to scene flag
  { type: BEHAVIOR_TYPES.SET_FLAG, flagScope: "world", flagName: "finalScore", value: "$result" },
];

const pipelineContext = new ExecutionContext();
await BehaviorRunner.runSequence(flagPipeline, pipelineContext);

assert.equal(pipelineContext.getVariable("progress"), 3, "Read flag stored in variables");
assert.equal(pipelineContext.getVariable("multiplier"), 2, "Set variable stored in variables");
assert.equal(pipelineContext.getVariable("result"), 6, "Macro updated variable correctly");
assert.equal(sceneFlags["world.finalScore"], 6, "SetFlag saved result correctly to scene");
assert.equal(pipelineContext.stopped, false, "Pipeline completed without halting");

// 6. Test Default Variables: $thisTokenId, $thisTokenUuid, $thisActorId
const mockToken = {
  id: "token_abc123",
  uuid: "Scene.1.Token.token_abc123",
  actor: { id: "actor_xyz789" },
};

const defaultVarsContext = new ExecutionContext({ token: mockToken });
assert.equal(defaultVarsContext.getVariable("thisTokenId"), "token_abc123", "thisTokenId is automatically available");
assert.equal(defaultVarsContext.getVariable("thisTokenUuid"), "Scene.1.Token.token_abc123", "thisTokenUuid is automatically available");
assert.equal(defaultVarsContext.getVariable("thisActorId"), "actor_xyz789", "thisActorId is automatically available");

// Test SetFlag using $thisTokenId as the flag name
const dynamicFlagPipeline = [
  { type: BEHAVIOR_TYPES.SET_FLAG, flagScope: "world", flagName: "$thisTokenId", value: "active" },
  { type: BEHAVIOR_TYPES.READ_FLAG, flagScope: "world", flagName: "$thisTokenId", variableName: "readBackVal" },
];

await BehaviorRunner.runSequence(dynamicFlagPipeline, defaultVarsContext);
assert.equal(sceneFlags["world.token_abc123"], "active", "SetFlag dynamically resolved $thisTokenId as the flag name");
assert.equal(defaultVarsContext.getVariable("readBackVal"), "active", "ReadFlag dynamically resolved $thisTokenId as flag name");

// 7. Test ReadTriggerStateBehavior and trigger: prefix
const readTriggerPipeline = [
  { type: BEHAVIOR_TYPES.READ_TRIGGER, uuid: "Scene.1.Token.targetTrigger1", variableName: "t1Hit" },
  { type: BEHAVIOR_TYPES.READ_TRIGGER, uuid: "targetTrigger2", variableName: "t2Hit" },
  { type: BEHAVIOR_TYPES.CONDITIONAL, expression: "$t1Hit == true && $t2Hit == false" },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "puzzlePassed", value: true },
];

const readTriggerContext = new ExecutionContext();
// Before hitting triggers
await BehaviorRunner.runSequence(readTriggerPipeline, readTriggerContext);
assert.equal(readTriggerContext.getVariable("t1Hit"), false);
assert.equal(readTriggerContext.getVariable("t2Hit"), false);
assert.equal(readTriggerContext.stopped, true, "Pipeline stopped because t1Hit was false");

// 8. Test Conditional Halting in Pipeline
const haltedPipeline = [
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "stepA", value: "ran" },
  { type: BEHAVIOR_TYPES.CONDITIONAL, left: "$stepA", operator: "==", right: "should_not_match" },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "stepB", value: "ran" },
];

const haltedContext = new ExecutionContext();
await BehaviorRunner.runSequence(haltedPipeline, haltedContext);
assert.equal(haltedContext.getVariable("stepA"), "ran");
assert.equal(haltedContext.getVariable("stepB"), undefined, "Step B was stopped");
assert.equal(haltedContext.stopped, true, "Context stopped flag is true");

// 9. Test CheckTriggersBehavior
import { initBeamLayer, beamLayer } from "../scripts/canvas/beam-layer.mjs";
import { CheckTriggersBehavior } from "../scripts/behaviors/behavior-check-triggers.mjs";

globalThis.PIXI = {
  Container: class {
    addChild() {}
    destroy() {}
  },
};
canvas.effects = {
  addChild: () => {},
};

await initBeamLayer();

// Simulate trigger hit states
beamLayer._previouslyHitTriggers.add("triggerA");
beamLayer._previouslyHitTriggers.add("triggerB");
// triggerC and triggerD remain unhit

// 9a. Test summaries
assert.equal(
  CheckTriggersBehavior.getSummary({ matchMode: "all_hit", triggers: [{ uuid: "triggerA" }, { uuid: "Scene.1.Token.triggerB" }] }),
  "If All Hit: [triggerA, triggerB]"
);
assert.equal(
  CheckTriggersBehavior.getSummary({ matchMode: "all_not_hit", triggers: [{ uuid: "triggerC" }] }),
  "If All Unhit: [triggerC]"
);
assert.equal(
  CheckTriggersBehavior.getSummary({ matchMode: "any_hit", triggers: [{ uuid: "triggerA" }] }),
  "If Any Hit: [triggerA]"
);
assert.equal(
  CheckTriggersBehavior.getSummary({ matchMode: "any_not_hit", triggers: [{ uuid: "triggerC" }] }),
  "If Any Unhit: [triggerC]"
);
assert.equal(
  CheckTriggersBehavior.getSummary({ matchMode: "custom", triggers: [{ uuid: "triggerA", state: "hit" }, { uuid: "triggerC", state: "not_hit" }], storeVariable: "$passed" }),
  "If Sequence: [triggerA=Hit, triggerC=Unhit] → $passed"
);

// 9b. Test "all_hit" mode - Passing
const allHitPassPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "all_hit",
    triggers: [
      { uuid: "Scene.1.Token.triggerA" },
      { uuid: "triggerB" },
    ],
    storeVariable: "allHitResult",
  },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "stepAfterCheck", value: "success" },
];
const allHitPassCtx = new ExecutionContext();
await BehaviorRunner.runSequence(allHitPassPipeline, allHitPassCtx);
assert.equal(allHitPassCtx.getVariable("allHitResult"), true, "all_hit stored true in variable");
assert.equal(allHitPassCtx.getVariable("stepAfterCheck"), "success", "Step ran after condition passed");
assert.equal(allHitPassCtx.stopped, false, "Pipeline was not stopped");

// 9c. Test "all_hit" mode - Failing
const allHitFailPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "all_hit",
    triggers: [
      { uuid: "triggerA" },
      { uuid: "triggerC" }, // triggerC is not hit
    ],
    storeVariable: "allHitFailResult",
  },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "shouldNotRun", value: "fail" },
];
const allHitFailCtx = new ExecutionContext();
await BehaviorRunner.runSequence(allHitFailPipeline, allHitFailCtx);
assert.equal(allHitFailCtx.getVariable("allHitFailResult"), false, "all_hit stored false in variable");
assert.equal(allHitFailCtx.getVariable("shouldNotRun"), undefined, "Subsequent step did not run");
assert.equal(allHitFailCtx.stopped, true, "Pipeline stopped on condition failure");

// 9d. Test "all_not_hit" mode - Passing
const allNotHitPassPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "all_not_hit",
    triggers: [
      { uuid: "triggerC" },
      { uuid: "Scene.1.Token.triggerD" },
    ],
    storeVariable: "allNotHitResult",
  },
];
const allNotHitPassCtx = new ExecutionContext();
await BehaviorRunner.runSequence(allNotHitPassPipeline, allNotHitPassCtx);
assert.equal(allNotHitPassCtx.getVariable("allNotHitResult"), true);
assert.equal(allNotHitPassCtx.stopped, false);

// 9e. Test "all_not_hit" mode - Failing (triggerA is hit)
const allNotHitFailPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "all_not_hit",
    triggers: [
      { uuid: "triggerA" },
      { uuid: "triggerC" },
    ],
  },
];
const allNotHitFailCtx = new ExecutionContext();
await BehaviorRunner.runSequence(allNotHitFailPipeline, allNotHitFailCtx);
assert.equal(allNotHitFailCtx.stopped, true, "Halted because triggerA is hit");

// 9f. Test "any_hit" mode
const anyHitPassPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "any_hit",
    triggers: [
      { uuid: "triggerC" }, // unhit
      { uuid: "triggerA" }, // hit
    ],
  },
];
const anyHitPassCtx = new ExecutionContext();
await BehaviorRunner.runSequence(anyHitPassPipeline, anyHitPassCtx);
assert.equal(anyHitPassCtx.stopped, false, "Passed because triggerA is hit");

const anyHitFailPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "any_hit",
    triggers: [
      { uuid: "triggerC" }, // unhit
      { uuid: "triggerD" }, // unhit
    ],
  },
];
const anyHitFailCtx = new ExecutionContext();
await BehaviorRunner.runSequence(anyHitFailPipeline, anyHitFailCtx);
assert.equal(anyHitFailCtx.stopped, true, "Halted because none of the triggers are hit");

// 9g. Test "any_not_hit" mode
const anyNotHitPassPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "any_not_hit",
    triggers: [
      { uuid: "triggerA" }, // hit
      { uuid: "triggerC" }, // unhit -> satisfies "at least one is unhit"
    ],
  },
];
const anyNotHitPassCtx = new ExecutionContext();
await BehaviorRunner.runSequence(anyNotHitPassPipeline, anyNotHitPassCtx);
assert.equal(anyNotHitPassCtx.stopped, false, "Passed because triggerC is unhit");

const anyNotHitFailPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "any_not_hit",
    triggers: [
      { uuid: "triggerA" }, // hit
      { uuid: "triggerB" }, // hit -> fails because none is unhit
    ],
  },
];
const anyNotHitFailCtx = new ExecutionContext();
await BehaviorRunner.runSequence(anyNotHitFailPipeline, anyNotHitFailCtx);
assert.equal(anyNotHitFailCtx.stopped, true, "Halted because all triggers are hit (none unhit)");

// 9h. Test "custom" sequence mode
const customPassPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "custom",
    triggers: [
      { uuid: "triggerA", state: "hit" },      // Hit expected -> True
      { uuid: "triggerB", state: "hit" },      // Hit expected -> True
      { uuid: "triggerC", state: "not_hit" },  // Unhit expected -> True
    ],
  },
];
const customPassCtx = new ExecutionContext();
await BehaviorRunner.runSequence(customPassPipeline, customPassCtx);
assert.equal(customPassCtx.stopped, false, "Custom sequence passed matching all specified states");

// 9h. Test custom sequence with dynamic variable references
const dynamicTrigPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "custom",
    triggers: [
      { uuid: "$targetTrigVar", state: "hit" },
      { uuid: "triggerC", state: "not_hit" },
    ],
  },
];
const dynamicTrigCtx = new ExecutionContext({
  variables: { targetTrigVar: "Scene.1.Token.triggerA" },
});
await BehaviorRunner.runSequence(dynamicTrigPipeline, dynamicTrigCtx);
assert.equal(dynamicTrigCtx.stopped, false, "Dynamic variable trigger reference evaluated accurately");

// 10. Test ConditionalBehavior Else Flow
// 10a. Conditional Else summary
assert.equal(
  ConditionalBehavior.getSummary({
    left: "$gold",
    operator: ">=",
    right: "100",
    onFalse: "execute_else",
    elseBehaviors: [{ type: BEHAVIOR_TYPES.SET_VARIABLE }],
  }),
  "If: $gold >= 100 [Else: 1 action]"
);

// 10b. Conditional Else Execution when Condition Fails
const condElsePipeline = [
  {
    type: BEHAVIOR_TYPES.CONDITIONAL,
    left: "$playerKey",
    operator: "==",
    right: "gold_key",
    onFalse: "execute_else",
    elseBehaviors: [
      { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "alarmTriggered", value: true },
      { type: BEHAVIOR_TYPES.SET_FLAG, flagScope: "world", flagName: "dungeonAlert", value: "high" },
    ],
  },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "chestOpened", value: true },
];

const condElseCtx = new ExecutionContext({ variables: { playerKey: "wrong_key" } });
await BehaviorRunner.runSequence(condElsePipeline, condElseCtx);
assert.equal(condElseCtx.getVariable("alarmTriggered"), true, "Else behavior ran when condition failed");
assert.equal(sceneFlags["world.dungeonAlert"], "high", "Else SetFlag behavior saved to scene flags");
assert.equal(condElseCtx.getVariable("chestOpened"), undefined, "Main branch behavior was NOT executed");
assert.equal(condElseCtx.stopped, true, "Execution stopped after running Else flow");

// 10c. Conditional Else is NOT executed when Condition Passes
const condPassPipeline = [
  {
    type: BEHAVIOR_TYPES.CONDITIONAL,
    left: "$playerKey",
    operator: "==",
    right: "gold_key",
    onFalse: "execute_else",
    elseBehaviors: [
      { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "alarmTriggered", value: true },
    ],
  },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "chestOpened", value: true },
];

const condPassCtx = new ExecutionContext({ variables: { playerKey: "gold_key" } });
await BehaviorRunner.runSequence(condPassPipeline, condPassCtx);
assert.equal(condPassCtx.getVariable("alarmTriggered"), undefined, "Else behavior was NOT run when condition passed");
assert.equal(condPassCtx.getVariable("chestOpened"), true, "Main branch behavior was executed");
assert.equal(condPassCtx.stopped, false, "Execution completed successfully");

// 11. Test CheckTriggersBehavior Else Flow
// 11a. CheckTriggers Else summary
assert.equal(
  CheckTriggersBehavior.getSummary({
    matchMode: "all_hit",
    triggers: [{ uuid: "triggerA" }],
    onFalse: "execute_else",
    elseBehaviors: [{ type: BEHAVIOR_TYPES.SET_VARIABLE }, { type: BEHAVIOR_TYPES.DOOR }],
  }),
  "If All Hit: [triggerA] [Else: 2 actions]"
);

// 11b. CheckTriggers Else Execution on Failure
const checkTrigElsePipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "all_hit",
    triggers: [
      { uuid: "triggerA" }, // hit
      { uuid: "triggerC" }, // unhit -> fails check
    ],
    onFalse: "execute_else",
    elseBehaviors: [
      { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "puzzleReset", value: true },
      { type: BEHAVIOR_TYPES.SET_FLAG, flagScope: "world", flagName: "puzzleState", value: "failed" },
    ],
  },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "puzzleCompleted", value: true },
];

const checkTrigElseCtx = new ExecutionContext();
await BehaviorRunner.runSequence(checkTrigElsePipeline, checkTrigElseCtx);
assert.equal(checkTrigElseCtx.getVariable("puzzleReset"), true, "CheckTriggers Else behavior ran on check failure");
assert.equal(sceneFlags["world.puzzleState"], "failed", "CheckTriggers Else SetFlag ran");
assert.equal(checkTrigElseCtx.getVariable("puzzleCompleted"), undefined, "Main branch behavior was NOT run");
assert.equal(checkTrigElseCtx.stopped, true, "Execution stopped after CheckTriggers Else flow");

// 11c. CheckTriggers Else is NOT executed on Check Pass
const checkTrigPassPipeline = [
  {
    type: BEHAVIOR_TYPES.CHECK_TRIGGERS,
    matchMode: "all_hit",
    triggers: [
      { uuid: "triggerA" }, // hit
      { uuid: "triggerB" }, // hit -> passes check
    ],
    onFalse: "execute_else",
    elseBehaviors: [
      { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "puzzleReset", value: true },
    ],
  },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "puzzleCompleted", value: true },
];

const checkTrigPassCtx = new ExecutionContext();
await BehaviorRunner.runSequence(checkTrigPassPipeline, checkTrigPassCtx);
assert.equal(checkTrigPassCtx.getVariable("puzzleReset"), undefined, "CheckTriggers Else behavior was NOT run on pass");
assert.equal(checkTrigPassCtx.getVariable("puzzleCompleted"), true, "Main branch behavior executed successfully");
assert.equal(checkTrigPassCtx.stopped, false, "Execution completed successfully");

// 12. Test On Beam Hit Changed (hitChange) Action Type and Lifecycle
// 12a. Constants and Defaults
assert.equal(TRIGGER_EVENTS.HIT_CHANGE, "hitChange", "TRIGGER_EVENTS.HIT_CHANGE is defined");
assert.equal(FLAGS.BEHAVIORS_HIT_CHANGE, "behaviorsHitChange", "FLAGS.BEHAVIORS_HIT_CHANGE is defined");
assert.equal(FLAGS.ON_BEAM_HIT_CHANGE, "onBeamHitChange", "FLAGS.ON_BEAM_HIT_CHANGE is defined");
assert.deepEqual(TRIGGER_DEFAULTS.behaviorsHitChange, [], "TRIGGER_DEFAULTS includes behaviorsHitChange array");
assert.equal(TRIGGER_DEFAULTS.onBeamHitChange, "", "TRIGGER_DEFAULTS includes onBeamHitChange string");

// 12b. ExecutionContext with hitChange event type and isHit
const enterHitCtx = new ExecutionContext({
  token: { id: "trigTest1", uuid: "Scene.1.Token.trigTest1" },
  eventType: TRIGGER_EVENTS.HIT_CHANGE,
  isHit: true,
});
assert.equal(enterHitCtx.eventType, "hitChange");
assert.equal(enterHitCtx.getVariable("isHit"), true, "isHit variable is true on hit");
assert.equal(enterHitCtx.getVariable("isTriggerHit"), true, "isTriggerHit variable is true on hit");
assert.equal(enterHitCtx.getVariable("eventType"), "hitChange");

const exitHitCtx = new ExecutionContext({
  token: { id: "trigTest1", uuid: "Scene.1.Token.trigTest1" },
  eventType: TRIGGER_EVENTS.HIT_CHANGE,
  isHit: false,
});
assert.equal(exitHitCtx.eventType, "hitChange");
assert.equal(exitHitCtx.getVariable("isHit"), false, "isHit variable is false on unhit");
assert.equal(exitHitCtx.getVariable("isTriggerHit"), false, "isTriggerHit variable is false on unhit");

// 12c. Behavior execution with hitChange event and condition checking $isHit
const hitChangeBehaviors = [
  {
    type: BEHAVIOR_TYPES.CONDITIONAL,
    mode: "clause",
    left: "$isHit",
    operator: "==",
    right: "true",
    onFalse: "execute_else",
    elseBehaviors: [
      { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "lightStatus", value: "OFF" },
    ],
  },
  { type: BEHAVIOR_TYPES.SET_VARIABLE, name: "lightStatus", value: "ON" },
];

// Test entering hit state
const hitPipelineCtx = new ExecutionContext({
  token: { id: "trigTest1" },
  eventType: TRIGGER_EVENTS.HIT_CHANGE,
  isHit: true,
});
await BehaviorRunner.runSequence(hitChangeBehaviors, hitPipelineCtx, TRIGGER_EVENTS.HIT_CHANGE);
assert.equal(hitPipelineCtx.getVariable("lightStatus"), "ON", "Hit changed to true activated ON state");

// Test exiting hit state
const unhitPipelineCtx = new ExecutionContext({
  token: { id: "trigTest1" },
  eventType: TRIGGER_EVENTS.HIT_CHANGE,
  isHit: false,
});
await BehaviorRunner.runSequence(hitChangeBehaviors, unhitPipelineCtx, TRIGGER_EVENTS.HIT_CHANGE);
assert.equal(unhitPipelineCtx.getVariable("lightStatus"), "OFF", "Hit changed to false activated OFF state in else branch");

// 12d. BeamLayer lifecycle fires hitChange on enter and exit
const firedEvents = [];
const testLayer = new (beamLayer.constructor)();
testLayer._fireTriggerEvent = async (hit, eventType) => {
  firedEvents.push({
    id: hit.triggerToken?.id,
    eventType,
    isHit: hit.isHit,
  });
};

// Beam hits trigger1
const beamHitResult = [
  {
    hitTriggers: [
      {
        triggerToken: { id: "dynTrigger1" },
        triggerData: {
          behaviorsEnter: [{ type: "test" }],
          behaviorsHitChange: [{ type: "test" }],
        },
        beamData: {},
      },
    ],
  },
];

testLayer._processTriggers(beamHitResult);
assert.equal(firedEvents.length, 2, "2 events fired on beam hit (enter + hitChange)");
assert.equal(firedEvents[0].eventType, "enter");
assert.equal(firedEvents[1].eventType, "hitChange");
assert.equal(firedEvents[1].isHit, true);

// Beam is removed (0 hits)
firedEvents.length = 0;
testLayer._processTriggers([]);
assert.equal(firedEvents.length, 2, "2 events fired on beam lost (exit + hitChange)");
assert.equal(firedEvents[0].eventType, "exit");
assert.equal(firedEvents[1].eventType, "hitChange");
assert.equal(firedEvents[1].isHit, false);

console.log("All behavior unit tests passed successfully!");

