import assert from "node:assert/strict";
import { MODULE_ID, FLAGS, TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS } from "../scripts/constants.mjs";
import { getTokenInteractionRange, isTokenWithinRange, areTokensAdjacent } from "../scripts/utils/token-helpers.mjs";

console.log("Running token-range unit tests...");

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
    measurePath: (waypoints) => {
      const p1 = waypoints[0];
      const p2 = waypoints[1];
      const dx = Math.abs(p2.x - p1.x) / 100;
      const dy = Math.abs(p2.y - p1.y) / 100;
      // Chebyshev distance in squares
      const spaces = Math.max(dx, dy);
      return {
        distance: spaces * 5,
        spaces: spaces
      };
    }
  }
};

// 1. Test getTokenInteractionRange
assert.equal(getTokenInteractionRange(null), 1, "Null token should default to range 1");
assert.equal(getTokenInteractionRange({}), 1, "Non-module token should default to range 1");

// Laser token default
const defaultLaserToken = {
  document: {
    flags: {
      [MODULE_ID]: {
        type: TYPES.LASER,
      }
    }
  }
};
assert.equal(getTokenInteractionRange(defaultLaserToken), 1, "Default laser should have range 1");

// Mirror token default
const defaultMirrorToken = {
  document: {
    flags: {
      [MODULE_ID]: {
        type: TYPES.MIRROR,
      }
    }
  }
};
assert.equal(getTokenInteractionRange(defaultMirrorToken), 1, "Default mirror should have range 1");

// Custom Laser with interactionRange = 3
const customLaserToken = {
  document: {
    flags: {
      [MODULE_ID]: {
        type: TYPES.LASER,
        interactionRange: 3,
      }
    }
  }
};
assert.equal(getTokenInteractionRange(customLaserToken), 3, "Laser with interactionRange 3 should return 3");

// Custom Mirror with interactionRange = 5
const customMirrorToken = {
  document: {
    flags: {
      [MODULE_ID]: {
        type: TYPES.MIRROR,
        interactionRange: 5,
      }
    }
  }
};
assert.equal(getTokenInteractionRange(customMirrorToken), 5, "Mirror with interactionRange 5 should return 5");

// 2. Test isTokenWithinRange & areTokensAdjacent
const createMockToken = (gridX, gridY, moduleFlags = null) => {
  const x = gridX * 100;
  const y = gridY * 100;
  return {
    center: { x: x + 50, y: y + 50 },
    x,
    y,
    w: 100,
    h: 100,
    document: {
      x,
      y,
      width: 1,
      height: 1,
      flags: moduleFlags ? { [MODULE_ID]: moduleFlags } : {}
    }
  };
};

const playerToken = createMockToken(0, 0); // At (0,0)
const adjacentMirror = createMockToken(1, 0, { type: TYPES.MIRROR, interactionRange: 1 }); // 1 square away
const diagLaser = createMockToken(1, 1, { type: TYPES.LASER, interactionRange: 1 }); // 1 square diagonal
const distantMirror = createMockToken(3, 0, { type: TYPES.MIRROR, interactionRange: 1 }); // 3 squares away
const range3Mirror = createMockToken(3, 0, { type: TYPES.MIRROR, interactionRange: 3 }); // 3 squares away, range 3
const range5Laser = createMockToken(4, 3, { type: TYPES.LASER, interactionRange: 5 }); // 4 squares away, range 5
const tooFarLaser = createMockToken(6, 0, { type: TYPES.LASER, interactionRange: 5 }); // 6 squares away, range 5

// Default range 1 checks
assert.equal(areTokensAdjacent(playerToken, adjacentMirror), true, "Adjacent orthogonal token should be in range");
assert.equal(areTokensAdjacent(playerToken, diagLaser), true, "Adjacent diagonal token should be in range");
assert.equal(areTokensAdjacent(playerToken, distantMirror), false, "Token 3 squares away should NOT be in range for default range 1");

// Custom range checks (reading from token data)
assert.equal(areTokensAdjacent(playerToken, range3Mirror), true, "Token 3 squares away should be in range when token range is 3");
assert.equal(areTokensAdjacent(playerToken, range5Laser), true, "Token 4 squares away should be in range when token range is 5");
assert.equal(areTokensAdjacent(playerToken, tooFarLaser), false, "Token 6 squares away should NOT be in range when token range is 5");

// Explicit override range checks
assert.equal(isTokenWithinRange(playerToken, distantMirror, 3), true, "Explicit maxRange 3 should allow 3 squares away");
assert.equal(isTokenWithinRange(playerToken, distantMirror, 2), false, "Explicit maxRange 2 should NOT allow 3 squares away");

// Invalid token handling
assert.equal(areTokensAdjacent(null, adjacentMirror), false, "Null tokenA should return false");
assert.equal(areTokensAdjacent(playerToken, null), false, "Null tokenB should return false");

console.log("All token-range unit tests passed successfully!");
