import { dot, scale, subtract, normalize } from "../utils/geometry.mjs";

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
