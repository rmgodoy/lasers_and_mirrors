import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * Register hooks for Wall documents and placeables.
 * Ensures laser beams re-cast and update when doors are opened/closed,
 * or walls are created, modified, or deleted.
 */
export function registerWallHooks() {
  Hooks.on("createWall", onWallChange);
  Hooks.on("updateWall", onUpdateWall);
  Hooks.on("deleteWall", onWallChange);
}

/**
 * Called when a wall is created or deleted.
 * @param {WallDocument} wallDoc
 * @param {object} options
 * @param {string} userId
 */
function onWallChange(wallDoc, options, userId) {
  refreshBeams();
}

/**
 * Called when a wall document is updated (e.g. door opened/closed, coordinates changed).
 * @param {WallDocument} wallDoc
 * @param {object} changes
 * @param {object} options
 * @param {string} userId
 */
function onUpdateWall(wallDoc, changes, options, userId) {
  // Re-cast beams if door state, coordinates, light sense, or door configuration changed
  const relevantKeys = ["ds", "c", "light", "door", "dir"];
  const hasRelevantChange = relevantKeys.some(k => k in changes);

  if (hasRelevantChange) {
    refreshBeams();
  }
}
