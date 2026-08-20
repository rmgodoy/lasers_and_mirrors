/**
 * Utility functions for handling circular angle limits, arc containment,
 * clamping, and arc flipping for tokens (mirrors, lasers).
 */

/**
 * Normalize an angle in degrees to the [0, 360) range.
 * @param {number} deg
 * @returns {number} Normalized angle between 0 (inclusive) and 360 (exclusive)
 */
export function normalizeAngle(deg) {
  let a = deg % 360;
  if (a < 0) a += 360;
  // Handle precision floating point edge cases (e.g. 359.99999999999995 -> 0 if rounded)
  if (Math.abs(a - 360) < 1e-7 || Math.abs(a) < 1e-7) return 0;
  return a;
}

/**
 * Calculate the shortest angular distance between two angles on a circle (0 to 180 degrees).
 * @param {number} a
 * @param {number} b
 * @returns {number} Angular distance in degrees [0, 180]
 */
export function angularDistance(a, b) {
  const normA = normalizeAngle(a);
  const normB = normalizeAngle(b);
  const diff = Math.abs(normA - normB);
  return Math.min(diff, 360 - diff);
}

/**
 * Determine whether a given angle falls within the clockwise allowed arc from minDeg to maxDeg.
 *
 * Arc definitions (Clockwise from minDeg to maxDeg):
 * - If minDeg < maxDeg: arc is [minDeg, maxDeg]
 * - If minDeg > maxDeg: arc wraps around 0° -> [minDeg, 360) U [0, maxDeg]
 * - If minDeg == maxDeg: full circle (360°)
 *
 * @param {number} deg - Target angle in degrees
 * @param {number} minDeg - Start angle in degrees
 * @param {number} maxDeg - End angle in degrees
 * @returns {boolean} True if the angle is within the allowed arc
 */
export function isAngleInArc(deg, minDeg, maxDeg) {
  const a = normalizeAngle(deg);
  const min = normalizeAngle(minDeg);
  const max = normalizeAngle(maxDeg);

  if (Math.abs(min - max) < 1e-5) {
    return true;
  }

  if (min < max) {
    return a >= (min - 1e-7) && a <= (max + 1e-7);
  } else {
    return a >= (min - 1e-7) || a <= (max + 1e-7);
  }
}

/**
 * Clamp an angle to the closest boundary (minDeg or maxDeg) if it is outside the allowed clockwise arc.
 *
 * @param {number} deg - Target angle in degrees
 * @param {number} minDeg - Start angle in degrees
 * @param {number} maxDeg - End angle in degrees
 * @returns {number} Clamped angle in degrees
 */
export function clampAngleToArc(deg, minDeg, maxDeg) {
  const normDeg = normalizeAngle(deg);
  const normMin = normalizeAngle(minDeg);
  const normMax = normalizeAngle(maxDeg);

  if (isAngleInArc(normDeg, normMin, normMax)) {
    return normDeg;
  }

  const distToMin = angularDistance(normDeg, normMin);
  const distToMax = angularDistance(normDeg, normMax);

  return distToMin <= distToMax ? normMin : normMax;
}

/**
 * Calculate the total angular span (in degrees) of the allowed clockwise arc.
 *
 * @param {number} minDeg
 * @param {number} maxDeg
 * @returns {number} Span in degrees (0 to 360)
 */
export function getArcSpan(minDeg, maxDeg) {
  const min = normalizeAngle(minDeg);
  const max = normalizeAngle(maxDeg);

  if (Math.abs(min - max) < 1e-5) {
    return 360;
  }

  if (min < max) {
    return max - min;
  } else {
    return (360 - min) + max;
  }
}

/**
 * Get human-readable description of the allowed rotation arc.
 *
 * @param {number} minDeg
 * @param {number} maxDeg
 * @returns {string} e.g. "215° → 315° (100° span)" or "315° → 215° (260° span)"
 */
export function getArcDescription(minDeg, maxDeg) {
  const min = normalizeAngle(minDeg);
  const max = normalizeAngle(maxDeg);
  const span = getArcSpan(min, max);

  const roundedMin = Number(min.toFixed(1));
  const roundedMax = Number(max.toFixed(1));
  const roundedSpan = Number(span.toFixed(1));

  return `${roundedMin}° → ${roundedMax}° (${roundedSpan}° span)`;
}

