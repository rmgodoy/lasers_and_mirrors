import assert from "node:assert/strict";
import {
  normalizeAngle,
  angularDistance,
  isAngleInArc,
  clampAngleToArc,
  getArcSpan,
  getArcDescription,
} from "../scripts/utils/angle-limits.mjs";

console.log("Running angle-limits unit tests (Clockwise Arc Model)...");

// 1. Normalization
assert.equal(normalizeAngle(0), 0);
assert.equal(normalizeAngle(360), 0);
assert.equal(normalizeAngle(720), 0);
assert.equal(normalizeAngle(-90), 270);
assert.equal(normalizeAngle(450), 90);

// 2. Angular distance
assert.equal(angularDistance(10, 20), 10);
assert.equal(angularDistance(350, 10), 20);
assert.equal(angularDistance(0, 180), 180);
assert.equal(angularDistance(0, 270), 90);

// 3. Normal range [30, 90] (clockwise from 30 to 90: 60° span)
assert.equal(isAngleInArc(30, 30, 90), true);
assert.equal(isAngleInArc(90, 30, 90), true);
assert.equal(isAngleInArc(60, 30, 90), true);
assert.equal(isAngleInArc(20, 30, 90), false);
assert.equal(isAngleInArc(100, 30, 90), false);
assert.equal(isAngleInArc(270, 30, 90), false);
assert.equal(getArcSpan(30, 90), 60);
assert.equal(getArcDescription(30, 90), "30° → 90° (60° span)");

// 4. Clamping normal range [30, 90]
assert.equal(clampAngleToArc(20, 30, 90), 30);
assert.equal(clampAngleToArc(100, 30, 90), 90);
assert.equal(clampAngleToArc(60, 30, 90), 60);
assert.equal(clampAngleToArc(200, 30, 90), 90); // closer to 90 than 30 (110 vs 170)

// 5. Flipped range [90, 30] (clockwise from 90 through 0 to 30: 300° span)
assert.equal(isAngleInArc(60, 90, 30), false);
assert.equal(isAngleInArc(20, 90, 30), true);
assert.equal(isAngleInArc(100, 90, 30), true);
assert.equal(isAngleInArc(0, 90, 30), true);
assert.equal(getArcSpan(90, 30), 300);
assert.equal(getArcDescription(90, 30), "90° → 30° (300° span)");

// 6. User's specific scenario:
// Min 215, Max 315 (Green Arc: 215° to 315° along East, 100° span)
assert.equal(isAngleInArc(270, 215, 315), true); // East (Green)
assert.equal(isAngleInArc(90, 215, 315), false);  // West (Red)
assert.equal(getArcSpan(215, 315), 100);
assert.equal(getArcDescription(215, 315), "215° → 315° (100° span)");

// User clicks Flip -> Swaps Min and Max:
// Min 315, Max 215 (Red Arc: 315° through 0° to 215° along West, 260° span)
assert.equal(isAngleInArc(270, 315, 215), false); // East (Green is now forbidden)
assert.equal(isAngleInArc(90, 315, 215), true);   // West (Red is now allowed)
assert.equal(isAngleInArc(0, 315, 215), true);    // South
assert.equal(isAngleInArc(180, 315, 215), true);  // North
assert.equal(getArcSpan(315, 215), 260);
assert.equal(getArcDescription(315, 215), "315° → 215° (260° span)");

// 7. Clamping flipped range [315, 215]
assert.equal(clampAngleToArc(270, 315, 215), 315); // in forbidden green arc, closer to 315
assert.equal(clampAngleToArc(240, 315, 215), 215); // closer to 215

// 8. Setting current angle as min or max
// When current position is 135° and min is set to current position (135°), with max at default 360° (0°):
assert.equal(isAngleInArc(135, 135, 360), true);
assert.equal(clampAngleToArc(135, 135, 360), 135);
assert.equal(getArcSpan(135, 360), 225);

// When current position is 135° and max is set to current position (135°), with min at default 0°:
assert.equal(isAngleInArc(135, 0, 135), true);
assert.equal(clampAngleToArc(135, 0, 135), 135);
assert.equal(getArcSpan(0, 135), 135);

// When current position is 215° and min is set to current position (215°), with max at 315°:
assert.equal(isAngleInArc(215, 215, 315), true);
assert.equal(clampAngleToArc(215, 215, 315), 215);

// When current position is 315° and max is set to current position (315°), with min at 215°:
assert.equal(isAngleInArc(315, 215, 315), true);
assert.equal(clampAngleToArc(315, 215, 315), 315);

console.log("All angle-limits unit tests passed successfully!");
