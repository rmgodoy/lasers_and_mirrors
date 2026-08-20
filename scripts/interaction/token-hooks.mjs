import { MODULE_ID, ACTOR_TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS } from "../constants.mjs";
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
  Hooks.on("preCreateToken", onPreCreateToken);
  Hooks.on("createToken", onCreateToken);
  Hooks.on("updateToken", onUpdateToken);
  Hooks.on("deleteToken", onDeleteToken);
  Hooks.on("refreshToken", onRefreshToken);
}

/**
 * Pre-create hook for Token documents.
 * Ensures mirror and laser tokens placed on canvas have correct defaults.
 * @param {TokenDocument} tokenDoc
 * @param {object} data
 * @param {object} options
 * @param {string} userId
 */
function onPreCreateToken(tokenDoc, data, options, userId) {
  const actor = tokenDoc.actor;
  if (!actor) return;

  if (actor.type === ACTOR_TYPES.MIRROR) {
    const sys = actor.system ?? MIRROR_DEFAULTS;
    const defaultImg = `modules/${MODULE_ID}/assets/mirror.svg`;
    const flags = {
      ...MIRROR_DEFAULTS,
      ...sys,
      ...(data.flags?.[MODULE_ID] ?? {})
    };
    const update = {
      [`flags.${MODULE_ID}`]: flags,
      rotation: data.rotation ?? sys.orientation ?? MIRROR_DEFAULTS.orientation,
    };
    if (!data.texture?.src || data.texture.src === "icons/svg/mystery-man.svg") {
      update["texture.src"] = actor.img && actor.img !== "icons/svg/mystery-man.svg" ? actor.img : defaultImg;
    }
    tokenDoc.updateSource(update);
  } else if (actor.type === ACTOR_TYPES.LASER) {
    const sys = actor.system ?? LASER_DEFAULTS;
    const defaultImg = `modules/${MODULE_ID}/assets/laser-on.svg`;
    const flags = {
      ...LASER_DEFAULTS,
      ...sys,
      ...(data.flags?.[MODULE_ID] ?? {})
    };
    const update = {
      [`flags.${MODULE_ID}`]: flags,
      hidden: true,
    };
    if (!data.texture?.src || data.texture.src === "icons/svg/mystery-man.svg") {
      update["texture.src"] = actor.img && actor.img !== "icons/svg/mystery-man.svg" ? actor.img : defaultImg;
    }
    tokenDoc.updateSource(update);
  }
}

/**
 * Called when any token document is created on canvas.
 * @param {TokenDocument} tokenDoc
 * @param {object} options
 * @param {string} userId
 */
function onCreateToken(tokenDoc, options, userId) {
  if (isMirror(tokenDoc) || isLaser(tokenDoc)) {
    refreshBeams();
  }
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
      await updateMirrorData(tokenDoc, { orientation: changes.rotation });
      return; // updateMirrorData will handle refreshing beams
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
