import { MODULE_ID } from "../constants.mjs";
import { isLaser } from "../laser-data.mjs";
import { isMirror, getMirrorData, updateMirrorData } from "../mirror-data.mjs";
import { isModuleToken } from "../utils/token-helpers.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";
import { syncAttachedLasers, handleTokenDeletion } from "./attachment.mjs";

/**
 * Register all token-related hooks.
 * Call this once during module init.
 */
export function registerTokenHooks() {
  Hooks.on("updateToken", onUpdateToken);
  Hooks.on("deleteToken", onDeleteToken);
  Hooks.on("refreshToken", onRefreshToken);
}

/**
 * Called when any token document is updated.
 * @param {TokenDocument} tokenDoc
 * @param {object} changes - the update delta
 * @param {object} options
 * @param {string} userId
 */
async function onUpdateToken(tokenDoc, changes, options, userId) {
  // If a mirror was rotated directly (e.g. via UI), sync its orientation flag
  if (isMirror(tokenDoc) && "rotation" in changes) {
    const currentData = getMirrorData(tokenDoc);
    if (currentData.orientation !== changes.rotation) {
      // Don't trigger an infinite loop if the change was initiated by our own scripts
      // updateMirrorData will trigger another updateToken, but it will have flags
      await updateMirrorData(tokenDoc, { orientation: changes.rotation });
      return; // The next updateToken event will refresh beams
    }
  }

  // If flags changed on a module token → refresh beams
  if (changes.flags?.[MODULE_ID]) {
    refreshBeams();
    return;
  }

  // If position or rotation changed → refresh beams + sync attachments
  const posChanged = ("x" in changes) || ("y" in changes) || ("rotation" in changes);
  if (!posChanged) return;

  // If a non-laser token moved, sync any attached lasers
  if (!isLaser(tokenDoc)) {
    await syncAttachedLasers(tokenDoc, changes);
  }

  // Always refresh beams when any position changes
  refreshBeams();
}

/**
 * Called when a token is deleted.
 * @param {TokenDocument} tokenDoc
 * @param {object} options
 * @param {string} userId
 */
async function onDeleteToken(tokenDoc, options, userId) {
  await handleTokenDeletion(tokenDoc);
  refreshBeams();
}

/**
 * Called when a token's visual state is refreshed (e.g., during drag).
 * Use this for real-time beam updates while dragging.
 * @param {Token} token
 * @param {object} flags
 */
function onRefreshToken(token, flags) {
  if (isModuleToken(token.document)) {
    refreshBeams();
  }
}
