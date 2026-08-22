import assert from "node:assert/strict";
import "../scripts/behaviors/index.mjs";
import { BehaviorRegistry } from "../scripts/behaviors/behavior-registry.mjs";
import { BehaviorRunner, ExecutionContext } from "../scripts/behaviors/behavior-runner.mjs";
import { BEHAVIOR_TYPES } from "../scripts/constants.mjs";
import { isTriggerHit } from "../scripts/canvas/beam-layer.mjs";

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

// 1. Verify all 8 behaviors are registered
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.LIGHT), true, "Light behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.DOOR), true, "Door behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.TILE), true, "Tile behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.MACRO), true, "Macro behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.READ_FLAG), true, "ReadFlag behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.SET_FLAG), true, "SetFlag behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.SET_VARIABLE), true, "SetVariable behavior registered");
assert.equal(BehaviorRegistry.has(BEHAVIOR_TYPES.CONDITIONAL), true, "Conditional behavior registered");

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

console.log("All behavior unit tests passed successfully!");
