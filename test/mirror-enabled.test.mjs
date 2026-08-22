import assert from "node:assert/strict";
import { MODULE_ID, FLAGS, TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS, TRIGGER_DEFAULTS } from "../scripts/constants.mjs";
import { getMirrorData, updateMirrorData, isMirror } from "../scripts/mirror-data.mjs";
import { traceAllBeams } from "../scripts/physics/ray-caster.mjs";

console.log("Running mirror enable/disable unit tests...");

// Setup Foundry global mocks
globalThis.foundry = {
  utils: {
    mergeObject: (target, source, options = {}) => {
      return { ...target, ...source };
    }
  }
};

let mockTokens = [];

globalThis.canvas = {
  grid: {
    size: 100,
    distance: 5,
  },
  walls: {
    placeables: []
  },
  scene: {
    get tokens() {
      return mockTokens;
    },
    set tokens(val) {
      mockTokens = val;
    }
  },
  tokens: {
    get placeables() {
      return mockTokens.map(tDoc => tDoc.object ?? tDoc);
    }
  }
};

globalThis.game = {
  settings: {
    get: (module, setting) => {
      if (setting === "maxBounces") return 10;
      if (setting === "beamOpacity") return 0.8;
      if (setting === "glowEffect") return true;
      return null;
    }
  },
  user: {
    isGM: true
  }
};

const createMockToken = (id, gridX, gridY, type, extraFlags = {}, rotation = 0) => {
  const x = gridX * 100;
  const y = gridY * 100;
  const defaults = type === TYPES.LASER ? LASER_DEFAULTS : (type === TYPES.MIRROR ? MIRROR_DEFAULTS : TRIGGER_DEFAULTS);
  const flags = {
    [MODULE_ID]: {
      ...defaults,
      type,
      orientation: rotation,
      ...extraFlags,
    }
  };
  const tokenDoc = {
    id,
    x,
    y,
    width: 1,
    height: 1,
    rotation,
    flags,
    getFlag(scope, key) {
      return this.flags?.[scope]?.[key];
    },
    async update(changes) {
      for (const [k, v] of Object.entries(changes)) {
        if (k.startsWith("flags.")) {
          const parts = k.split(".");
          const scope = parts[1];
          const flagKey = parts[2];
          this.flags[scope] = this.flags[scope] || {};
          this.flags[scope][flagKey] = v;
        } else {
          this[k] = v;
        }
      }
    }
  };
  const tokenObj = {
    id,
    x,
    y,
    w: 100,
    h: 100,
    center: { x: x + 50, y: y + 50 },
    document: tokenDoc
  };
  tokenDoc.object = tokenObj;
  return tokenDoc;
};

// 1. Verify MIRROR_DEFAULTS
assert.equal(MIRROR_DEFAULTS.enabled, true, "MIRROR_DEFAULTS.enabled must be true by default");

// 2. Verify getMirrorData with defaults
const defaultMirrorDoc = createMockToken("m_default", 5, 0, TYPES.MIRROR);
const defaultData = getMirrorData(defaultMirrorDoc);
assert.equal(defaultData.enabled, true, "Default mirror should have enabled: true");

// 3. Verify getMirrorData with enabled: false
const disabledMirrorDoc = createMockToken("m_disabled", 5, 0, TYPES.MIRROR, { enabled: false });
const disabledData = getMirrorData(disabledMirrorDoc);
assert.equal(disabledData.enabled, false, "Disabled mirror should have enabled: false");

// 4. Test Ray Casting with Enabled Mirror (Reflects beam)
// Laser at (0, 0) facing East (270° in Foundry coords), range 10 grids
// Mirror at (4, 0) orientation 45°
const laserDoc = createMockToken("laser1", 0, 0, TYPES.LASER, { range: 10, visible: true }, 270);
const activeMirrorDoc = createMockToken("mirror1", 4, 0, TYPES.MIRROR, { enabled: true, orientation: 45, width: 1, twoSided: true }, 0);

canvas.scene.tokens = [laserDoc, activeMirrorDoc];

const resultsEnabled = traceAllBeams(10);
assert.equal(resultsEnabled.length, 1, "Should trace 1 laser beam");
const segmentsEnabled = resultsEnabled[0].segments;
assert.ok(segmentsEnabled.length >= 2, "Enabled mirror should reflect beam into at least 2 segments");
assert.equal(segmentsEnabled[0].hitMirrorToken?.id, "mirror1", "First segment should hit active mirror");

// 5. Test Ray Casting with Disabled Mirror (Passes straight through)
const inactiveMirrorDoc = createMockToken("mirror1", 4, 0, TYPES.MIRROR, { enabled: false, orientation: 45, width: 1, twoSided: true }, 0);
canvas.scene.tokens = [laserDoc, inactiveMirrorDoc];

const resultsDisabled = traceAllBeams(10);
assert.equal(resultsDisabled.length, 1, "Should trace 1 laser beam");
const segmentsDisabled = resultsDisabled[0].segments;
assert.equal(segmentsDisabled.length, 1, "Disabled mirror should NOT reflect beam (1 straight segment)");
assert.equal(segmentsDisabled[0].hitMirrorToken, undefined, "Segment should not hit disabled mirror");
assert.equal(Math.round(segmentsDisabled[0].end.x), 50 + 10 * 100, "Beam should travel full range 10 grids eastward to x=1050");

// 6. Test updateMirrorData toggling enabled
await updateMirrorData(inactiveMirrorDoc, { enabled: true });
assert.equal(getMirrorData(inactiveMirrorDoc).enabled, true, "Updating mirror to enabled: true should update data");

const resultsReenabled = traceAllBeams(10);
assert.ok(resultsReenabled[0].segments.length >= 2, "Re-enabled mirror should reflect beam again");

await updateMirrorData(inactiveMirrorDoc, { enabled: false });
assert.equal(getMirrorData(inactiveMirrorDoc).enabled, false, "Updating mirror to enabled: false should update data");

const resultsRedisabled = traceAllBeams(10);
assert.equal(resultsRedisabled[0].segments.length, 1, "Re-disabled mirror should allow beam to pass through");

console.log("All mirror enable/disable unit tests passed successfully!");
