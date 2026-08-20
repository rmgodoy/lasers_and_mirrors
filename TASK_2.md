# TASK 2 — Data Helpers & Utilities

> **Goal:** Create helper functions for reading/writing laser & mirror flags, token utilities, and geometry math.  
> **Dependencies:** TASK_1 must be complete (needs `constants.mjs`).  
> **Read PLAN.md first** for data schemas and API patterns.

---

## FILES TO CREATE

### 1. `scripts/laser-data.mjs`

Helper functions for reading and writing laser data on token documents.

**Imports:** `MODULE_ID`, `FLAGS`, `TYPES`, `LASER_DEFAULTS` from `../constants.mjs`

**Must export these functions:**

```js
/**
 * Check if a token is a laser.
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function isLaser(tokenDoc) {
  return tokenDoc.getFlag(MODULE_ID, FLAGS.TYPE) === TYPES.LASER;
}

/**
 * Get all laser data from a token, merged with defaults.
 * @param {TokenDocument} tokenDoc
 * @returns {object} Full laser data object with defaults applied
 */
export function getLaserData(tokenDoc) {
  const flags = tokenDoc.flags?.[MODULE_ID] ?? {};
  return foundry.utils.mergeObject({ ...LASER_DEFAULTS }, flags, { inplace: false });
}

/**
 * Initialize a token as a laser with default values.
 * @param {TokenDocument} tokenDoc
 * @returns {Promise}
 */
export async function initLaser(tokenDoc) {
  await tokenDoc.update({ [`flags.${MODULE_ID}`]: { ...LASER_DEFAULTS } });
}

/**
 * Update one or more laser properties.
 * @param {TokenDocument} tokenDoc
 * @param {object} changes - e.g. { color: "#00ff00", visible: false }
 * @returns {Promise}
 */
export async function updateLaserData(tokenDoc, changes) {
  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }
  await tokenDoc.update(updateData);
}

/**
 * Get all laser tokens in the current scene.
 * @returns {Token[]} Array of Token placeables that are lasers
 */
export function getAllLasers() {
  return canvas.tokens.placeables.filter(t => isLaser(t.document));
}
```

---

### 2. `scripts/mirror-data.mjs`

Same pattern as laser-data but for mirrors.

**Imports:** `MODULE_ID`, `FLAGS`, `TYPES`, `MIRROR_DEFAULTS` from `../constants.mjs`

**Must export these functions:**

```js
/**
 * Check if a token is a mirror.
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function isMirror(tokenDoc) { ... }

/**
 * Get all mirror data from a token, merged with defaults.
 * @param {TokenDocument} tokenDoc
 * @returns {object}
 */
export function getMirrorData(tokenDoc) { ... }

/**
 * Initialize a token as a mirror with default values.
 * @param {TokenDocument} tokenDoc
 * @returns {Promise}
 */
export async function initMirror(tokenDoc) { ... }

/**
 * Update one or more mirror properties.
 * @param {TokenDocument} tokenDoc
 * @param {object} changes
 * @returns {Promise}
 */
export async function updateMirrorData(tokenDoc, changes) { ... }

/**
 * Get all mirror tokens in the current scene.
 * @returns {Token[]}
 */
export function getAllMirrors() { ... }
```

Implement these identically to the laser versions but using `MIRROR_DEFAULTS` and `TYPES.MIRROR`.

---

### 3. `scripts/utils/token-helpers.mjs`

Token utility functions used across the module.

**Imports:** `MODULE_ID`, `TYPES`, `FLAGS` from `../constants.mjs`

**Must export these functions:**

```js
/**
 * Get the module type of a token ("laser", "mirror", or null).
 * @param {TokenDocument} tokenDoc
 * @returns {string|null}
 */
export function getTokenType(tokenDoc) {
  return tokenDoc.getFlag(MODULE_ID, FLAGS.TYPE) ?? null;
}

/**
 * Check if a token is a module-managed token (laser or mirror).
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function isModuleToken(tokenDoc) {
  const type = getTokenType(tokenDoc);
  return type === TYPES.LASER || type === TYPES.MIRROR;
}

/**
 * Check if two tokens are adjacent (within 1 grid unit).
 * Uses canvas.grid.measurePath for V14 compatibility.
 * @param {Token} tokenA - Token placeable
 * @param {Token} tokenB - Token placeable
 * @returns {boolean}
 */
export function areTokensAdjacent(tokenA, tokenB) {
  if (!tokenA || !tokenB) return false;
  const waypoints = [
    { x: tokenA.center.x, y: tokenA.center.y },
    { x: tokenB.center.x, y: tokenB.center.y }
  ];
  const result = canvas.grid.measurePath(waypoints);
  return result.distance <= canvas.grid.distance;
}

/**
 * Get the player's owned token on the current scene.
 * Returns the first token the current user owns, or null.
 * @returns {Token|null}
 */
export function getPlayerToken() {
  return canvas.tokens.placeables.find(t => t.document.isOwner && t.actor?.hasPlayerOwner) ?? null;
}

/**
 * Get the facing direction of a token as a normalized {x, y} vector.
 * Foundry rotation: 0° = south, 90° = west, etc. (clockwise from south).
 * Convert to standard math angle: 0° = east, counter-clockwise.
 * @param {TokenDocument} tokenDoc
 * @returns {{ x: number, y: number }}
 */
export function getTokenFacingVector(tokenDoc) {
  // Foundry: 0° = south, rotation goes clockwise
  // Convert: mathAngle = (180 - rotation) in degrees, then to radians
  const rotDeg = tokenDoc.rotation ?? 0;
  const mathRad = ((180 - rotDeg) * Math.PI) / 180;
  return {
    x: Math.cos(mathRad),
    y: -Math.sin(mathRad)  // Y is inverted on canvas (down = positive)
  };
}

/**
 * Get the center point of a token in canvas coordinates.
 * @param {Token} token - Token placeable (not document)
 * @returns {{ x: number, y: number }}
 */
export function getTokenCenter(token) {
  return { x: token.center.x, y: token.center.y };
}
```

---

### 4. `scripts/utils/geometry.mjs`

Pure math functions — no Foundry API dependencies. Used by physics and rendering.

**Must export these functions:**

```js
/**
 * Normalize a 2D vector to unit length.
 * @param {{ x: number, y: number }} v
 * @returns {{ x: number, y: number }}
 */
export function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Dot product of two 2D vectors.
 * @returns {number}
 */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

/**
 * Scale a 2D vector by a scalar.
 * @returns {{ x: number, y: number }}
 */
export function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

/**
 * Subtract vector b from vector a.
 * @returns {{ x: number, y: number }}
 */
export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Add two vectors.
 * @returns {{ x: number, y: number }}
 */
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Distance between two points.
 * @returns {number}
 */
export function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Line-segment intersection test.
 * Segment 1: p1 → p2, Segment 2: p3 → p4.
 * Returns the intersection point or null if no intersection.
 * Uses parametric form: P = p1 + t*(p2-p1), Q = p3 + u*(p4-p3)
 * Intersection when 0 <= t <= 1 and 0 <= u <= 1.
 * @returns {{ x: number, y: number, t: number } | null}
 *   t is the parameter along segment 1 (0=start, 1=end)
 */
export function segmentIntersection(p1, p2, p3, p4) {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null; // parallel
  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
  const u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return {
    x: p1.x + t * dx1,
    y: p1.y + t * dy1,
    t
  };
}

/**
 * Get two endpoints of a line segment centered at a point,
 * given an angle (degrees) and a half-length.
 * Used to compute mirror surface geometry.
 * @param {{ x: number, y: number }} center
 * @param {number} angleDeg - orientation in degrees
 * @param {number} halfLength - half the mirror width in pixels
 * @returns {{ p1: {x,y}, p2: {x,y} }}
 */
export function getLineSegmentFromAngle(center, angleDeg, halfLength) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * halfLength;
  const dy = Math.sin(rad) * halfLength;
  return {
    p1: { x: center.x - dx, y: center.y - dy },
    p2: { x: center.x + dx, y: center.y + dy }
  };
}

/**
 * Get the normal vector of a line segment (perpendicular, normalized).
 * Always returns the "left" normal (consistent winding).
 * @param {{ x: number, y: number }} p1
 * @param {{ x: number, y: number }} p2
 * @returns {{ x: number, y: number }}
 */
export function getSegmentNormal(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return normalize({ x: -dy, y: dx });
}
```

---

## VERIFICATION

After creating all 4 files:

1. Open Foundry, enable the module, open browser console.
2. Test: manually set flags on a token via console:
   ```js
   const token = canvas.tokens.placeables[0];
   await token.document.update({ "flags.lasers-and-mirrors": { type: "laser", color: "#ff0000", width: 4, range: 30, intensity: 0.8, visible: true, interactable: false, attachable: false, attachedToTokenId: null } });
   ```
3. No console errors on module load.
4. Geometry functions are pure math — can be verified by adding `console.log` test calls in module.mjs temporarily.
