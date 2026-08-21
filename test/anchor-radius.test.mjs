import assert from "node:assert/strict";
import { MODULE_ID, FLAGS, TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS, TRIGGER_DEFAULTS } from "../scripts/constants.mjs";
import { getTokenCenter, getTokenFacingVector, applyTokenMeshOffset } from "../scripts/utils/token-helpers.mjs";
import { getLineSegmentFromAngle, segmentIntersection } from "../scripts/utils/geometry.mjs";
import { traceAllBeams } from "../scripts/physics/ray-caster.mjs";

console.log("Running anchor-radius directional offset unit tests...");

// Setup Foundry global mocks
globalThis.foundry = {
  utils: {
    mergeObject: (target, source, options = {}) => {
      return { ...target, ...source };
    }
  }
};

globalThis.canvas = {
  grid: {
    size: 100,
    distance: 5,
  },
  walls: {
    placeables: []
  },
  scene: {
    tokens: []
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
    rotation,
    width: 1,
    height: 1,
    flags,
    getFlag: (mod, key) => flags[mod]?.[key],
  };
  const token = {
    id,
    x,
    y,
    w: 100,
    h: 100,
    center: { x: x + 50, y: y + 50 },
    document: tokenDoc,
    mesh: {
      position: {
        x: x + 50,
        y: y + 50,
        set(newX, newY) {
          this.x = newX;
          this.y = newY;
        }
      }
    }
  };
  tokenDoc.object = token;
  return token;
};

// 1. Test radius 0 (default center)
const laserCenter = createMockToken("laser1", 0, 0, TYPES.LASER, { anchorRadius: 0 }, 0);
const centerPos = getTokenCenter(laserCenter);
assert.equal(centerPos.x, 50, "Radius 0 X should be 50");
assert.equal(centerPos.y, 50, "Radius 0 Y should be 50");

// 2. Test radius 0.5 facing South (0°) -> offset +50 in Y
const laserSouth = createMockToken("laser2", 0, 0, TYPES.LASER, { anchorRadius: 0.5 }, 0);
const southPos = getTokenCenter(laserSouth);
assert.equal(Math.round(southPos.x), 50, "South facing offset X should stay 50");
assert.equal(Math.round(southPos.y), 100, "South facing offset Y should be 100 (50 + 0.5*100)");

// 3. Test radius 0.5 facing West (90°) -> offset -50 in X
const laserWest = createMockToken("laser3", 0, 0, TYPES.LASER, { anchorRadius: 0.5 }, 90);
const westPos = getTokenCenter(laserWest);
assert.equal(Math.round(westPos.x), 0, "West facing offset X should be 0 (50 - 0.5*100)");
assert.equal(Math.round(westPos.y), 50, "West facing offset Y should stay 50");

// 4. Test radius 0.5 facing North (180°) -> offset -50 in Y
const laserNorth = createMockToken("laser4", 0, 0, TYPES.LASER, { anchorRadius: 0.5 }, 180);
const northPos = getTokenCenter(laserNorth);
assert.equal(Math.round(northPos.x), 50, "North facing offset X should stay 50");
assert.equal(Math.round(northPos.y), 0, "North facing offset Y should be 0 (50 - 0.5*100)");

// 5. Test radius 0.5 facing East (270°) -> offset +50 in X
const laserEast = createMockToken("laser5", 0, 0, TYPES.LASER, { anchorRadius: 0.5 }, 270);
const eastPos = getTokenCenter(laserEast);
assert.equal(Math.round(eastPos.x), 100, "East facing offset X should be 100 (50 + 0.5*100)");
assert.equal(Math.round(eastPos.y), 50, "East facing offset Y should stay 50");

// 6. Test float radius 1.25 on Mirror
const mirrorCustom = createMockToken("mirror1", 2, 2, TYPES.MIRROR, { anchorRadius: 1.25 }, 270); // at (200, 200), facing East
const mirrorPos = getTokenCenter(mirrorCustom);
// Base center: 250, 250. East (+X): 250 + 1.25 * 100 = 375
assert.equal(Math.round(mirrorPos.x), 375, "Mirror with anchorRadius 1.25 facing East X should be 375");
assert.equal(Math.round(mirrorPos.y), 250, "Mirror with anchorRadius 1.25 facing East Y should be 250");

// 7. Test Mirror line segment calculation with offset center
const halfWidth = (1 * 100) / 2; // 50px
const segment = getLineSegmentFromAngle(mirrorPos, 270, halfWidth);
// Segment oriented along angle 270° (-Y direction): dx = cos(270)*50 = 0, dy = sin(270)*50 = -50
assert.equal(Math.round(segment.p1.x), 375);
assert.equal(Math.round(segment.p2.x), 375);
assert.equal(Math.round(segment.p1.y), 300); // 250 - (-50) = 300
assert.equal(Math.round(segment.p2.y), 200); // 250 + (-50) = 200

// 8. Test visual mesh position update via applyTokenMeshOffset
applyTokenMeshOffset(mirrorCustom);
assert.equal(Math.round(mirrorCustom.mesh.position.x), 375, "Token mesh position X should match offset");
assert.equal(Math.round(mirrorCustom.mesh.position.y), 250, "Token mesh position Y should match offset");

// 9. Test Raycaster trace with offset Laser and offset Mirror
// Laser at (0, 0), facing East (270°), offset radius 0.5 -> origin at (100, 50)
const rayLaser = createMockToken("rayLaser", 0, 0, TYPES.LASER, { anchorRadius: 0.5, range: 10, visible: true }, 270);
// Mirror at (4, 0), facing West (90°), orientation 45°, offset radius 0.5 -> center at (450 - 50, 50) = (400, 50), orientation 45°
const rayMirror = createMockToken("rayMirror", 4, 0, TYPES.MIRROR, { anchorRadius: 0.5, orientation: 45, width: 1, twoSided: true }, 90);

canvas.scene.tokens = [rayLaser.document, rayMirror.document];

const results = traceAllBeams(5);
assert.equal(results.length, 1, "Should trace 1 laser beam");
const segments = results[0].segments;
assert.ok(segments.length >= 2, "Beam should reflect off offset mirror creating at least 2 segments");

// First segment should start at laser offset origin (100, 50) and end at mirror offset hit point (400, 50)
assert.equal(Math.round(segments[0].start.x), 100, "Segment 0 start X should be at offset laser origin (100)");
assert.equal(Math.round(segments[0].start.y), 50, "Segment 0 start Y should be at offset laser origin (50)");
assert.equal(Math.round(segments[0].end.x), 400, "Segment 0 end X should hit mirror at (400)");
assert.equal(Math.round(segments[0].end.y), 50, "Segment 0 end Y should hit mirror at (50)");

console.log("All anchor-radius directional offset unit tests passed successfully!");
