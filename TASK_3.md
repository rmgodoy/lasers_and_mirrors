# TASK 3 — Physics Engine

> **Goal:** Create the 2D reflection math and ray caster that traces beams through the scene.  
> **Dependencies:** TASK_1, TASK_2 must be complete (needs `constants.mjs`, `geometry.mjs`, `mirror-data.mjs`).  
> **Read PLAN.md first** for the reflection formula and wall collision details.

---

## FILES TO CREATE

### 1. `scripts/physics/reflection.mjs`

Pure 2D reflection math. No Foundry API calls — only imports from `geometry.mjs`.

**Imports:** `dot`, `scale`, `subtract`, `normalize` from `../utils/geometry.mjs`

**Must export:**

```js
/**
 * Reflect an incoming direction vector off a surface defined by its normal.
 * Formula: R = D - 2 * dot(D, N) * N
 * @param {{ x: number, y: number }} direction - normalized incoming direction
 * @param {{ x: number, y: number }} normal - normalized surface normal
 * @returns {{ x: number, y: number }} - normalized reflected direction
 */
export function reflect(direction, normal) {
  const d = dot(direction, normal);
  return normalize(subtract(direction, scale(normal, 2 * d)));
}

/**
 * Check if a ray is hitting the "front" side of a mirror.
 * The ray must be traveling toward the mirror surface (dot product < 0 with normal).
 * If hitting from behind, the mirror blocks the beam but doesn't reflect.
 * @param {{ x: number, y: number }} direction - incoming ray direction
 * @param {{ x: number, y: number }} normal - mirror surface normal
 * @returns {boolean} true if hitting the reflective side
 */
export function isHittingFrontSide(direction, normal) {
  return dot(direction, normal) < 0;
}
```

That's the entire file — it should be very short (~30 lines including comments/imports).

---

### 2. `scripts/physics/ray-caster.mjs`

The core beam tracing engine. Casts a ray from a laser's position in its facing direction, checks for wall and mirror intersections, handles reflections, and returns an array of beam segments.

**Imports:**
- `{ segmentIntersection, distance, getLineSegmentFromAngle, getSegmentNormal }` from `../utils/geometry.mjs`
- `{ getTokenCenter, getTokenFacingVector }` from `../utils/token-helpers.mjs`
- `{ reflect, isHittingFrontSide }` from `./reflection.mjs`
- `{ getLaserData, getAllLasers }` from `../laser-data.mjs`
- `{ getMirrorData, getAllMirrors }` from `../mirror-data.mjs`
- `{ MODULE_ID }` from `../constants.mjs`

**Must export:**

```js
/**
 * A single beam segment.
 * @typedef {Object} BeamSegment
 * @property {{ x: number, y: number }} start
 * @property {{ x: number, y: number }} end
 * @property {string} color - hex color string
 * @property {number} width - pixel width
 * @property {number} intensity - 0 to 1
 */

/**
 * Trace all beams for all active lasers in the scene.
 * Returns an array of BeamSegment arrays (one per laser).
 * @param {number} maxBounces - max reflections (from settings)
 * @returns {BeamSegment[][]}
 */
export function traceAllBeams(maxBounces) {
  const lasers = getAllLasers();
  const results = [];
  for (const laserToken of lasers) {
    const laserData = getLaserData(laserToken.document);
    if (!laserData.visible) continue;
    const segments = traceSingleBeam(laserToken, laserData, maxBounces);
    results.push(segments);
  }
  return results;
}

/**
 * Trace a single laser beam. Handles bouncing off mirrors.
 * @param {Token} laserToken
 * @param {object} laserData - laser flags data
 * @param {number} maxBounces
 * @returns {BeamSegment[]}
 */
function traceSingleBeam(laserToken, laserData, maxBounces) { ... }
```

**Implementation details for `traceSingleBeam`:**

1. Get the laser's center point: `getTokenCenter(laserToken)`
2. Get the laser's facing direction: `getTokenFacingVector(laserToken.document)`
3. Convert `laserData.range` from grid units to pixels: `laserData.range * canvas.grid.size`
4. Initialize: `origin = center`, `direction = facingVector`, `remainingRange = totalRange`, `segments = []`, `bounces = 0`
5. **Loop** (while `remainingRange > 0` and `bounces <= maxBounces`):
   a. Compute `rayEnd = { x: origin.x + direction.x * remainingRange, y: origin.y + direction.y * remainingRange }`
   b. Find the **nearest intersection** among:
      - All walls: call `getWallIntersections(origin, rayEnd)` — helper function (see below)
      - All mirrors: call `getMirrorIntersections(origin, rayEnd, laserToken)` — helper function (see below)
   c. If nearest hit is a **wall**:
      - Add segment `{ start: origin, end: hitPoint, color, width, intensity }`
      - **Stop** — beam terminates at wall.
   d. If nearest hit is a **mirror**:
      - Add segment `{ start: origin, end: hitPoint, color, width, intensity }`
      - If `isHittingFrontSide(direction, mirrorNormal)` → reflect:
        - `direction = reflect(direction, mirrorNormal)`
        - `origin = hitPoint` (offset slightly: `origin + direction * 1` to avoid self-intersection)
        - `remainingRange -= distance(segment.start, segment.end)`
        - `bounces++`
      - Else → beam is blocked, stop.
   e. If **no intersection**:
      - Add segment `{ start: origin, end: rayEnd, color, width, intensity }`
      - **Stop** — beam reaches max range.
6. Return `segments`.

**Helper function `getWallIntersections(origin, rayEnd)`:**
- Iterate `canvas.walls.placeables`
- For each wall, get coordinates: `const [x1, y1, x2, y2] = wall.document.c;`
- Call `segmentIntersection(origin, rayEnd, {x:x1,y:y1}, {x:x2,y:y2})`
- Collect all hits with their distance from origin
- Return array sorted by distance (nearest first)

**Helper function `getMirrorIntersections(origin, rayEnd, excludeToken)`:**
- Iterate `getAllMirrors()`, skip `excludeToken` (avoid laser hitting itself) and skip the mirror the beam just bounced off (pass its ID to exclude)
- For each mirror token:
  - Get mirror data: `getMirrorData(mirrorToken.document)`
  - Get mirror center: `getTokenCenter(mirrorToken)`
  - Compute mirror surface line segment: `getLineSegmentFromAngle(center, mirrorData.orientation, halfWidth)`
    - `halfWidth = (mirrorData.width * canvas.grid.size) / 2`
  - Call `segmentIntersection(origin, rayEnd, segment.p1, segment.p2)`
  - If hit, also compute the surface normal: `getSegmentNormal(segment.p1, segment.p2)`
- Collect all hits with distance, normal, and mirror token reference
- Return sorted by distance

**IMPORTANT edge cases:**
- After reflection, offset the new origin by `1` pixel in the reflection direction to prevent the ray from immediately re-intersecting the same mirror.
- A mirror that the beam just bounced off should be excluded from the next intersection check. Pass `lastMirrorId` through the loop.

---

## VERIFICATION

1. Create a scene, place two tokens, set one as laser via console:
   ```js
   const t = canvas.tokens.placeables[0];
   await t.document.update({"flags.lasers-and-mirrors": {type:"laser",color:"#ff0000",width:4,range:30,intensity:0.8,visible:true}});
   ```
2. Import and run in console:
   ```js
   // After module loads, test from console:
   const mod = await import("modules/lasers-and-mirrors/scripts/physics/ray-caster.mjs");
   console.log(mod.traceAllBeams(10));
   ```
3. Should return an array of segment arrays. Segments should have `start`, `end`, `color`, `width`, `intensity`.
4. No console errors.
