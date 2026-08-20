import { MODULE_ID, ACTOR_TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS, TRIGGER_DEFAULTS } from "../constants.mjs";
import { isLaser, getLaserData, updateLaserData } from "../laser-data.mjs";
import { isMirror, getMirrorData, updateMirrorData } from "../mirror-data.mjs";

import { isTrigger } from "../trigger-data.mjs";
import { isModuleToken } from "../utils/token-helpers.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";
import { syncAttachedObjects, handleTokenDeletion } from "./attachment.mjs";

/**
 * Register all token-related hooks.
 * Call this once during module init.
 */
export function registerTokenHooks() {
  Hooks.on("preCreateToken", onPreCreateToken);
  Hooks.on("createToken", onCreateToken);
  Hooks.on("preUpdateToken", onPreUpdateToken);
  Hooks.on("updateToken", onUpdateToken);
  Hooks.on("deleteToken", onDeleteToken);
  Hooks.on("refreshToken", onRefreshToken);
  Hooks.on("controlToken", onControlToken);
}

/**
 * Pre-create hook for Token documents.
 * Ensures mirror, laser, and trigger tokens placed on canvas have correct defaults.
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
      rotation: data.rotation ?? sys.orientation ?? LASER_DEFAULTS.orientation,
      hidden: false,
    };
    if (!data.texture?.src || data.texture.src === "icons/svg/mystery-man.svg") {
      update["texture.src"] = actor.img && actor.img !== "icons/svg/mystery-man.svg" ? actor.img : defaultImg;
    }
    tokenDoc.updateSource(update);
  } else if (actor.type === ACTOR_TYPES.TRIGGER) {
    const sys = actor.system ?? TRIGGER_DEFAULTS;
    const defaultImg = `modules/${MODULE_ID}/assets/trigger.svg`;
    const flags = {
      ...TRIGGER_DEFAULTS,
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
  if (isMirror(tokenDoc) || isLaser(tokenDoc) || isTrigger(tokenDoc)) {
    refreshBeams();
  }
}

/**
 * Pre-update hook — block non-GM players from directly moving or rotating mirror tokens.
 * Updates initiated by GM (including socket-relayed updates) are permitted.
 * @param {TokenDocument} tokenDoc
 * @param {object} changes
 * @param {object} options
 * @param {string} userId
 * @returns {boolean} false to cancel the update
 */
function onPreUpdateToken(tokenDoc, changes, options, userId) {
  const user = game.users.get(userId);
  if (user?.isGM || game.user.isGM) return true;
  if (!isMirror(tokenDoc) && !isLaser(tokenDoc)) return true;

  // Block position and rotation changes for non-GM users
  const blocked = ("x" in changes) || ("y" in changes) || ("rotation" in changes);
  if (blocked) return false;

  return true;
}


/**
 * Called when any token document is updated.
 * @param {TokenDocument} tokenDoc
 * @param {object} changes - the update delta
 * @param {object} options
 * @param {string} userId
 */
async function onUpdateToken(tokenDoc, changes, options, userId) {
  // If a mirror or laser was rotated directly by a GM outside the module (e.g. quick rotation tool), sync its flag
  if (game.user.isGM && (isMirror(tokenDoc) || isLaser(tokenDoc)) && ("rotation" in changes) && !changes.flags?.[MODULE_ID]) {
    if (isMirror(tokenDoc)) {
      const currentData = getMirrorData(tokenDoc);
      if (currentData.orientation !== changes.rotation) {
        await updateMirrorData(tokenDoc, { orientation: changes.rotation });
        return;
      }
    } else if (isLaser(tokenDoc)) {
      const currentData = getLaserData(tokenDoc);
      if (currentData.orientation !== changes.rotation) {
        await updateLaserData(tokenDoc, { orientation: changes.rotation });
        return;
      }
    }
  }

  // Ensure mirror & laser token mesh visual angle is always in sync with rotation
  if ((isMirror(tokenDoc) || isLaser(tokenDoc)) && ("rotation" in changes || changes.flags?.[MODULE_ID])) {
    const token = tokenDoc.object ?? canvas.tokens?.get(tokenDoc.id);
    if (token) {
      const rot = changes.rotation ?? changes.flags?.[MODULE_ID]?.orientation ?? tokenDoc.rotation;
      if (token.mesh) {
        token.mesh.rotation = (rot * Math.PI) / 180;
      }
      if (token.renderFlags) {
        token.renderFlags.set({ refreshRotation: true });
      }
    }
  }


  // If a non-module token moved or rotated, sync any attached lasers and mirrors
  const posChanged = ("x" in changes) || ("y" in changes) || ("rotation" in changes);
  if (posChanged && !isLaser(tokenDoc) && !isMirror(tokenDoc)) {
    await syncAttachedObjects(tokenDoc, changes);
  }

  // Refresh beams if flags changed, position/rotation changed, or if it's any module token
  const hasModuleFlagChange = Boolean(changes.flags?.[MODULE_ID]);
  if (hasModuleFlagChange || posChanged || isModuleToken(tokenDoc)) {
    refreshBeams();
  }
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

/**
 * Control token hook — prevent non-GM users from selecting mirror tokens.
 * @param {Token} token
 * @param {boolean} controlled - whether the token is being selected
 * @returns {boolean} false to prevent selection
 */
function onControlToken(token, controlled) {
  if (game.user.isGM) return true;
  if (controlled && (isMirror(token.document) || isLaser(token.document))) return false;
  return true;
}



