import { segmentIntersection, distance, getLineSegmentFromAngle, getSegmentNormal } from "../utils/geometry.mjs";
import { getTokenCenter, getTokenFacingVector } from "../utils/token-helpers.mjs";
import { reflect, isHittingFrontSide } from "./reflection.mjs";
import { getLaserData, getAllLasers } from "../laser-data.mjs";
import { getMirrorData, getAllMirrors } from "../mirror-data.mjs";

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
 * Trace a single laser beam. Handles bouncing off mirrors and stopping at walls.
 * @param {Token} laserToken
 * @param {object} laserData - laser flags data
 * @param {number} maxBounces
 * @returns {BeamSegment[]}
 */

function traceSingleBeam(laserToken, laserData, maxBounces) {
  let origin = getTokenCenter(laserToken);
  let direction = getTokenFacingVector(laserToken.document);
  const gridSize = canvas?.grid?.size ?? 100;
  let remainingRange = laserData.range * gridSize;
  const color = laserData.color;
  const width = laserData.width;
  const intensity = laserData.intensity;

  const segments = [];
  let bounces = 0;
  let lastMirrorId = null;

  while (remainingRange > 0 && bounces <= maxBounces) {
    const rayEnd = {
      x: origin.x + direction.x * remainingRange,
      y: origin.y + direction.y * remainingRange
    };

    const wallHits = getWallIntersections(origin, rayEnd);
    const mirrorHits = getMirrorIntersections(origin, rayEnd, laserToken, lastMirrorId);

    const nearestWall = wallHits.length > 0 ? wallHits[0] : null;
    const nearestMirror = mirrorHits.length > 0 ? mirrorHits[0] : null;

    let hitType = null; // 'wall', 'mirror', or null
    let nearestHit = null;

    if (nearestWall && nearestMirror) {
      if (nearestWall.t < nearestMirror.t) {
        hitType = "wall";
        nearestHit = nearestWall;
      } else {
        hitType = "mirror";
        nearestHit = nearestMirror;
      }
    } else if (nearestWall) {
      hitType = "wall";
      nearestHit = nearestWall;
    } else if (nearestMirror) {
      hitType = "mirror";
      nearestHit = nearestMirror;
    }

    if (hitType === "wall") {
      segments.push({
        start: { ...origin },
        end: { ...nearestHit.point },
        color,
        width,
        intensity
      });
      break;
    } else if (hitType === "mirror") {
      const segEnd = { ...nearestHit.point };
      const segDist = distance(origin, segEnd);
      segments.push({
        start: { ...origin },
        end: segEnd,
        color,
        width,
        intensity
      });

      if (isHittingFrontSide(direction, nearestHit.normal)) {
        direction = reflect(direction, nearestHit.normal);
        origin = {
          x: nearestHit.point.x + direction.x * 1,
          y: nearestHit.point.y + direction.y * 1
        };
        remainingRange -= segDist;
        lastMirrorId = nearestHit.mirrorToken.id;
        bounces++;
      } else {
        // Hitting mirror back side -> blocks beam without reflecting
        break;
      }
    } else {
      // No intersection -> beam travels full remaining distance
      segments.push({
        start: { ...origin },
        end: rayEnd,
        color,
        width,
        intensity
      });
      break;
    }
  }

  return segments;
}

/**
 * Helper to find all wall intersections along a ray segment.
 * @param {{ x: number, y: number }} origin
 * @param {{ x: number, y: number }} rayEnd
 * @returns {Array<{ point: { x: number, y: number }, t: number, dist: number }>}
 */

function getWallIntersections(origin, rayEnd) {
  const hits = [];
  if (!canvas?.walls?.placeables) return hits;

  for (const wall of canvas.walls.placeables) {
    const c = wall.document?.c;
    if (!c || c.length < 4) continue;

    const p3 = { x: c[0], y: c[1] };
    const p4 = { x: c[2], y: c[3] };
    const hit = segmentIntersection(origin, rayEnd, p3, p4);

    if (hit) {
      const hitPoint = { x: hit.x, y: hit.y };
      const dist = distance(origin, hitPoint);
      hits.push({ point: hitPoint, t: hit.t, dist });
    }
  }

  hits.sort((a, b) => a.t - b.t);
  return hits;
}

/**
 * Helper to find all mirror intersections along a ray segment.
 * @param {{ x: number, y: number }} origin
 * @param {{ x: number, y: number }} rayEnd
 * @param {Token} excludeLaserToken - do not hit laser token itself on first segment
 * @param {string|null} lastMirrorId - do not hit mirror token ray just bounced off
 * @returns {Array<{ point: { x: number, y: number }, t: number, dist: number, normal: { x: number, y: number }, mirrorToken: Token }>}
 */

function getMirrorIntersections(origin, rayEnd, excludeLaserToken, lastMirrorId) {
  const hits = [];
  const mirrors = getAllMirrors();
  const gridSize = canvas?.grid?.size ?? 100;

  for (const mirrorToken of mirrors) {
    if (excludeLaserToken && mirrorToken.id === excludeLaserToken.id) continue;
    if (lastMirrorId && mirrorToken.id === lastMirrorId) continue;

    const mirrorData = getMirrorData(mirrorToken.document);
    const center = getTokenCenter(mirrorToken);
    const halfWidth = (mirrorData.width * gridSize) / 2;
    const segment = getLineSegmentFromAngle(center, mirrorData.orientation, halfWidth);

    const hit = segmentIntersection(origin, rayEnd, segment.p1, segment.p2);
    if (hit) {
      const hitPoint = { x: hit.x, y: hit.y };
      const dist = distance(origin, hitPoint);
      const normal = getSegmentNormal(segment.p1, segment.p2);
      hits.push({
        point: hitPoint,
        t: hit.t,
        dist,
        normal,
        mirrorToken
      });
    }
  }

  hits.sort((a, b) => a.t - b.t);
  return hits;
}
