import { MODULE_ID, TYPES, FLAGS } from "../constants.mjs";
import { isLaser } from "../laser-data.mjs";
import { isMirror } from "../mirror-data.mjs";
import { isTrigger } from "../trigger-data.mjs";

/**
 * Get the module type of a token ("laser", "mirror", "trigger", or null).
 * @param {TokenDocument|Token} tokenDoc
 * @returns {string|null}
 */
export function getTokenType(tokenDoc) {
  const doc = tokenDoc?.document ?? tokenDoc;
  return doc?.getFlag?.(MODULE_ID, FLAGS.TYPE) ?? doc?.flags?.[MODULE_ID]?.type ?? null;
}

/**
 * Check if a token is a module-managed token (laser, mirror, or trigger).
 * @param {TokenDocument|Token} tokenDoc
 * @returns {boolean}
 */
export function isModuleToken(tokenDoc) {
  return isLaser(tokenDoc) || isMirror(tokenDoc) || isTrigger(tokenDoc);
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
  const centerA = getTokenCenter(tokenA);
  const centerB = getTokenCenter(tokenB);
  const waypoints = [
    { x: centerA.x, y: centerA.y },
    { x: centerB.x, y: centerB.y }
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
  if (game.user.character) {
    const charToken = game.user.character.getActiveTokens()[0];
    if (charToken) return charToken;
  }
  return canvas.tokens.controlled.find(t => !isModuleToken(t.document)) ??
         canvas.tokens.placeables.find(t => t.document.isOwner && !isModuleToken(t.document)) ??
         null;
}

/**
 * Get the facing direction of a token as a normalized {x, y} vector.
 * Foundry rotation: 0° = south, 90° = west, etc. (clockwise from south).
 * Convert to standard math angle: 0° = east, counter-clockwise.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {{ x: number, y: number }}
 */
export function getTokenFacingVector(tokenDoc) {
  const doc = tokenDoc?.document ?? tokenDoc;
  const rotDeg = doc?.rotation ?? 0;
  const mathRad = ((180 - rotDeg) * Math.PI) / 180;
  return {
    x: Math.cos(mathRad),
    y: -Math.sin(mathRad) // Y is inverted on canvas (down = positive)
  };
}

/**
 * Get the center point of a token in canvas coordinates.
 * Handles both Token placeable and TokenDocument.
 * @param {Token|TokenDocument} token
 * @returns {{ x: number, y: number }}
 */
export function getTokenCenter(token) {
  if (token?.center) return { x: token.center.x, y: token.center.y };
  const doc = token?.document ?? token;
  if (doc) {
    const gridSize = canvas?.grid?.size ?? 100;
    const width = (doc.width ?? 1) * gridSize;
    const height = (doc.height ?? 1) * gridSize;
    return { x: (doc.x ?? 0) + width / 2, y: (doc.y ?? 0) + height / 2 };
  }
  return { x: 0, y: 0 };
}

