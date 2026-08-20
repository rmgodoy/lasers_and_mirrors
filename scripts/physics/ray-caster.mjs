import { segmentIntersection, distance, getLineSegmentFromAngle, getSegmentNormal } from "../utils/geometry.mjs";
import { getTokenCenter, getTokenFacingVector } from "../utils/token-helpers.mjs";
import { reflect, isHittingFrontSide } from "./reflection.mjs";
import { getLaserData, getAllLasers } from "../laser-data.mjs";
import { getMirrorData, getAllMirrors } from "../mirror-data.mjs";
import { getTriggerData, getAllTriggers } from "../trigger-data.mjs";

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
 * Info about a trigger that was hit by a beam.
 * @typedef {Object} TriggerHitInfo
 * @property {Token} triggerToken - the trigger Token placeable
 * @property {object} triggerData - the trigger's data (enabled, passThrough, macros)
 * @property {object} beamData - info about the beam that hit it
 */

/**
 * Result from tracing a single beam.
 * @typedef {Object} BeamTraceResult
 * @property {BeamSegment[]} segments - the rendered beam segments
 * @property {TriggerHitInfo[]} hitTriggers - triggers hit by this beam
 */

/**
 * Trace all beams for all active lasers in the scene.
 * Returns an array of BeamTraceResults (one per laser).
 * @param {number} maxBounces - max reflections (from settings)
 * @returns {BeamTraceResult[]}
 */
export function traceAllBeams(maxBounces) {
  const lasers = getAllLasers();
  const results = [];
  for (const laserToken of lasers) {
    const laserData = getLaserData(laserToken.document ?? laserToken);
    if (!laserData.visible) continue;
    const result = traceSingleBeam(laserToken, laserData, maxBounces);
    results.push(result);
  }
  return results;
}

/**
 * Trace a single laser beam. Handles bouncing off mirrors, stopping at walls,
 * and detecting trigger intersections.
 * @param {Token|TokenDocument} laserToken
 * @param {object} laserData - laser flags data
 * @param {number} maxBounces
 * @returns {BeamTraceResult}
 */
function traceSingleBeam(laserToken, laserData, maxBounces) {
  let origin = getTokenCenter(laserToken);
  let direction = getTokenFacingVector(laserToken.document ?? laserToken);
  const gridSize = canvas?.grid?.size ?? 100;
  let remainingRange = laserData.range * gridSize;
  const color = laserData.color;
  const width = laserData.width;
  const intensity = laserData.intensity;

  const segments = [];
  const hitTriggers = [];
  let bounces = 0;
  let lastMirrorId = null;

  // Build beam data context for trigger macros
  const beamData = {
    color,
    width,
    intensity,
    laserTokenId: laserToken.id,
    laserActorId: (laserToken.actor ?? laserToken.document?.actor)?.id,
  };


  while (remainingRange > 0 && bounces <= maxBounces) {
    const rayEnd = {
      x: origin.x + direction.x * remainingRange,
      y: origin.y + direction.y * remainingRange
    };

    const wallHits = getWallIntersections(origin, rayEnd);
    const mirrorHits = getMirrorIntersections(origin, rayEnd, laserToken, lastMirrorId);
    const triggerHits = getTriggerIntersections(origin, rayEnd, gridSize);

    const nearestWall = wallHits.length > 0 ? wallHits[0] : null;
    const nearestMirror = mirrorHits.length > 0 ? mirrorHits[0] : null;

    // Find the nearest blocking obstacle (wall, mirror, or non-passthrough trigger)
    let hitType = null; // 'wall', 'mirror', 'trigger', or null
    let nearestHit = null;
    let nearestT = Infinity;

    if (nearestWall && nearestWall.t < nearestT) {
      hitType = "wall";
      nearestHit = nearestWall;
      nearestT = nearestWall.t;
    }
    if (nearestMirror && nearestMirror.t < nearestT) {
      hitType = "mirror";
      nearestHit = nearestMirror;
      nearestT = nearestMirror.t;
    }

    // Check triggers — collect all that the beam passes through up to the nearest blocking obstacle
    for (const trigHit of triggerHits) {
      if (trigHit.t >= nearestT) break; // Beyond the blocking obstacle

      // Record this trigger as hit
      hitTriggers.push({
        triggerToken: trigHit.triggerToken,
        triggerData: trigHit.triggerData,
        beamData: { ...beamData, direction: { ...direction } },
      });

      // If this trigger blocks the beam, it becomes the nearest obstacle
      if (!trigHit.triggerData.passThrough) {
        hitType = "trigger";
        nearestHit = trigHit;
        nearestT = trigHit.t;
        break;
      }
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
        intensity,
        hitMirrorToken: nearestHit.mirrorToken
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
    } else if (hitType === "trigger") {
      // Beam terminates at a non-passthrough trigger
      segments.push({
        start: { ...origin },
        end: { ...nearestHit.point },
        color,
        width,
        intensity,
        hitTriggerToken: nearestHit.triggerToken
      });
      break;
    } else {
      // No intersection -> beam travels full remaining distance
      // But still check for pass-through triggers along the full path
      for (const trigHit of triggerHits) {
        if (!hitTriggers.some(h => h.triggerToken.id === trigHit.triggerToken.id)) {
          hitTriggers.push({
            triggerToken: trigHit.triggerToken,
            triggerData: trigHit.triggerData,
            beamData: { ...beamData, direction: { ...direction } },
          });
        }
      }
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

  return { segments, hitTriggers, laserToken, laserData };
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

    const mirrorData = getMirrorData(mirrorToken.document ?? mirrorToken);
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

/**
 * Helper to find all trigger intersections along a ray segment.
 * Uses a point-to-segment distance check: the beam must pass through
 * the center point of the trigger token (within half grid size threshold).
 * @param {{ x: number, y: number }} origin
 * @param {{ x: number, y: number }} rayEnd
 * @param {number} gridSize - canvas grid size in pixels
 * @returns {Array<{ point: { x: number, y: number }, t: number, dist: number, triggerToken: Token, triggerData: object }>}
 */
function getTriggerIntersections(origin, rayEnd, gridSize) {
  const hits = [];
  const triggers = getAllTriggers();
  const threshold = gridSize / 2;

  for (const triggerToken of triggers) {
    const triggerData = getTriggerData(triggerToken.document ?? triggerToken);
    if (!triggerData.enabled) continue;

    const center = getTokenCenter(triggerToken);
    const closestInfo = pointToSegmentClosest(origin, rayEnd, center);

    if (closestInfo.distance <= threshold) {
      const dist = distance(origin, closestInfo.point);
      // Compute parametric t along the ray
      const rayLen = distance(origin, rayEnd);
      const t = rayLen > 0 ? dist / rayLen : 0;

      hits.push({
        point: { ...center }, // Use center as the hit point
        t,
        dist,
        triggerToken,
        triggerData,
      });
    }
  }

  hits.sort((a, b) => a.t - b.t);
  return hits;
}

/**
 * Compute the closest point on a line segment to a given point,
 * and the distance from the point to that closest point.
 * @param {{ x: number, y: number }} segStart - segment start
 * @param {{ x: number, y: number }} segEnd - segment end
 * @param {{ x: number, y: number }} point - the point to test
 * @returns {{ point: { x: number, y: number }, distance: number }}
 */
function pointToSegmentClosest(segStart, segEnd, point) {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Segment is a point
    const d = distance(segStart, point);
    return { point: { ...segStart }, distance: d };
  }

  // Parametric position of the projection
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closest = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };

  return { point: closest, distance: distance(closest, point) };
}

