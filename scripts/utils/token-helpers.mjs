import { MODULE_ID, TYPES, FLAGS } from "../constants.mjs";
import { isLaser, getLaserData } from "../laser-data.mjs";
import { isMirror, getMirrorData } from "../mirror-data.mjs";
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
 * Get the interaction range in grid squares configured on a token (laser or mirror).
 * Defaults to 1 if not set or not a module token.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {number}
 */
export function getTokenInteractionRange(tokenDoc) {
  if (!tokenDoc) return 1;
  const doc = tokenDoc?.document ?? tokenDoc;
  if (isLaser(doc)) {
    const data = getLaserData(doc);
    return Math.max(1, Number(data?.interactionRange) || 1);
  }
  if (isMirror(doc)) {
    const data = getMirrorData(doc);
    return Math.max(1, Number(data?.interactionRange) || 1);
  }
  return 1;
}

/**
 * Check if two tokens are within interaction range (alias for isTokenWithinRange).
 * Uses canvas.grid.measurePath for V14 compatibility.
 * @param {Token} tokenA - Token placeable
 * @param {Token} tokenB - Token placeable
 * @param {number} [maxRange] - Optional explicit range in grid units/squares
 * @returns {boolean}
 */
export function areTokensAdjacent(tokenA, tokenB, maxRange) {
  return isTokenWithinRange(tokenA, tokenB, maxRange);
}

/**
 * Check if two tokens are within interaction range.
 * @param {Token} tokenA - Token placeable
 * @param {Token} tokenB - Token placeable
 * @param {number} [maxRange] - Optional explicit range in grid units/squares
 * @returns {boolean}
 */
export function isTokenWithinRange(tokenA, tokenB, maxRange) {
  if (!tokenA || !tokenB) return false;
  const centerA = getTokenCenter(tokenA);
  const centerB = getTokenCenter(tokenB);
  const waypoints = [
    { x: centerA.x, y: centerA.y },
    { x: centerB.x, y: centerB.y }
  ];
  const result = canvas?.grid?.measurePath
    ? canvas.grid.measurePath(waypoints)
    : { distance: Math.hypot(centerB.x - centerA.x, centerB.y - centerA.y) };
  const range = maxRange !== undefined
    ? Number(maxRange)
    : Math.max(getTokenInteractionRange(tokenB), getTokenInteractionRange(tokenA));
  const gridDist = canvas?.grid?.distance || 1;

  if (result.spaces !== undefined) {
    return result.spaces <= range || result.distance <= (gridDist * range);
  }
  return result.distance <= (gridDist * range);
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
 * Foundry rotation: 0° = south (+Y), 90° = west (-X), 180° = north (-Y), 270° = east (+X).
 * @param {TokenDocument|Token} tokenDoc
 * @returns {{ x: number, y: number }}
 */
export function getTokenFacingVector(tokenDoc) {
  const doc = tokenDoc?.document ?? tokenDoc;
  const rotDeg = doc?.rotation ?? 0;
  const rad = (rotDeg * Math.PI) / 180;
  return {
    x: -Math.sin(rad),
    y: Math.cos(rad)
  };
}


/**
 * Get the center point of a token in canvas coordinates.
 * For module tokens (laser, mirror, trigger), if anchorRadius is set,
 * offsets the center in the direction the token is facing (in square grid units).
 * Handles both Token placeable and TokenDocument.
 * @param {Token|TokenDocument} token
 * @returns {{ x: number, y: number }}
 */
export function getTokenCenter(token) {
  const doc = token?.document ?? token;
  let baseCenter = { x: 0, y: 0 };
  if (token?.center) {
    baseCenter = { x: token.center.x, y: token.center.y };
  } else if (doc) {
    const gridSize = canvas?.grid?.size ?? 100;
    const width = (doc.width ?? 1) * gridSize;
    const height = (doc.height ?? 1) * gridSize;
    baseCenter = { x: (doc.x ?? 0) + width / 2, y: (doc.y ?? 0) + height / 2 };
  }

  if (doc && isModuleToken(doc)) {
    const data = isLaser(doc) ? getLaserData(doc) : (isMirror(doc) ? getMirrorData(doc) : getTriggerData(doc));
    const radius = Number(data?.anchorRadius ?? 0);
    if (radius !== 0) {
      const gridSize = canvas?.grid?.size ?? 100;
      const rotDeg = doc.rotation ?? data?.orientation ?? 0;
      const rad = (rotDeg * Math.PI) / 180;
      // Foundry rotation vector: 0° = south (+Y), 90° = west (-X), 180° = north (-Y), 270° = east (+X)
      const fx = -Math.sin(rad);
      const fy = Math.cos(rad);
      return {
        x: baseCenter.x + fx * radius * gridSize,
        y: baseCenter.y + fy * radius * gridSize
      };
    }
  }

  return baseCenter;
}

/**
 * Apply anchorRadius visual offset to a token's mesh position.
 * If anchorRadius is non-zero, moves the mesh in the direction the token is facing.
 * @param {Token} token
 */
export function applyTokenMeshOffset(token) {
  if (!token?.mesh || !token?.document) return;
  const doc = token.document;
  if (!isModuleToken(doc)) return;

  const data = isLaser(doc) ? getLaserData(doc) : (isMirror(doc) ? getMirrorData(doc) : getTriggerData(doc));
  const radius = Number(data?.anchorRadius ?? 0);
  const gridSize = canvas?.grid?.size ?? 100;
  const baseCenter = {
    x: (doc.x ?? 0) + ((doc.width ?? 1) * gridSize) / 2,
    y: (doc.y ?? 0) + ((doc.height ?? 1) * gridSize) / 2,
  };

  if (radius !== 0) {
    const rotDeg = doc.rotation ?? data?.orientation ?? 0;
    const rad = (rotDeg * Math.PI) / 180;
    const fx = -Math.sin(rad);
    const fy = Math.cos(rad);
    token.mesh.position.set(baseCenter.x + fx * radius * gridSize, baseCenter.y + fy * radius * gridSize);
  } else {
    token.mesh.position.set(baseCenter.x, baseCenter.y);
  }
}
