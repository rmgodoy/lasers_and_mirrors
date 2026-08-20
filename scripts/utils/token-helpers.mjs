import { MODULE_ID, TYPES, FLAGS } from "../constants.mjs";

/**
 * Get the module type of a token ("laser", "mirror", or null).
 * @param {TokenDocument} tokenDoc
 * @returns {string|null}
 */
export function getTokenType(tokenDoc) {
  return tokenDoc?.getFlag(MODULE_ID, FLAGS.TYPE) ?? null;
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
  const rotDeg = tokenDoc?.rotation ?? 0;
  const mathRad = ((180 - rotDeg) * Math.PI) / 180;
  return {
    x: Math.cos(mathRad),
    y: -Math.sin(mathRad) // Y is inverted on canvas (down = positive)
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
