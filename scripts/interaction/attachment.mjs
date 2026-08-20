import { MODULE_ID, FLAGS } from "../constants.mjs";
import { isLaser, getLaserData, updateLaserData, getAllLasers } from "../laser-data.mjs";
import { isMirror, getMirrorData, updateMirrorData, getAllMirrors } from "../mirror-data.mjs";

/**
 * Attach a laser to a target token.
 * @param {TokenDocument} laserDoc - the laser token document
 * @param {TokenDocument} targetDoc - the token to attach to
 */
export async function attachLaser(laserDoc, targetDoc) {
  await updateLaserData(laserDoc, {
    attachedToTokenId: targetDoc.id,
    orientation: targetDoc.rotation ?? 0,
  });
  // Move the laser to the target's position and orientation
  await laserDoc.update({
    x: targetDoc.x,
    y: targetDoc.y,
    rotation: targetDoc.rotation ?? 0,
  });
  ui.notifications.info(game.i18n.localize("LAM.notify.laserAttached"));
}

/**
 * Detach a laser from its attached token.
 * @param {TokenDocument} laserDoc
 */
export async function detachLaser(laserDoc) {
  await updateLaserData(laserDoc, { attachedToTokenId: null });
  ui.notifications.info(game.i18n.localize("LAM.notify.laserDetached"));
}

/**
 * Check if a laser is attached to a specific token.
 * @param {TokenDocument} laserDoc
 * @param {TokenDocument} targetDoc
 * @returns {boolean}
 */
export function isLaserAttachedTo(laserDoc, targetDoc) {
  const data = getLaserData(laserDoc);
  return data.attachedToTokenId === targetDoc.id;
}

/**
 * Attach a mirror to a target token.
 * @param {TokenDocument} mirrorDoc - the mirror token document
 * @param {TokenDocument} targetDoc - the token to attach to
 */
export async function attachMirror(mirrorDoc, targetDoc) {
  await updateMirrorData(mirrorDoc, {
    attachedToTokenId: targetDoc.id,
    orientation: targetDoc.rotation ?? 0,
  });
  // Move the mirror to the target's position and orientation
  await mirrorDoc.update({
    x: targetDoc.x,
    y: targetDoc.y,
    rotation: targetDoc.rotation ?? 0,
  });
  ui.notifications.info(game.i18n.localize("LAM.notify.mirrorAttached"));
}

/**
 * Detach a mirror from its attached token.
 * @param {TokenDocument} mirrorDoc
 */
export async function detachMirror(mirrorDoc) {
  await updateMirrorData(mirrorDoc, { attachedToTokenId: null });
  ui.notifications.info(game.i18n.localize("LAM.notify.mirrorDetached"));
}

/**
 * Check if a mirror is attached to a specific token.
 * @param {TokenDocument} mirrorDoc
 * @param {TokenDocument} targetDoc
 * @returns {boolean}
 */
export function isMirrorAttachedTo(mirrorDoc, targetDoc) {
  const data = getMirrorData(mirrorDoc);
  return data.attachedToTokenId === targetDoc.id;
}

/**
 * Check if a token (laser or mirror) is attached to a specific token.
 * @param {TokenDocument} doc
 * @param {TokenDocument} targetDoc
 * @returns {boolean}
 */
export function isAttachedTo(doc, targetDoc) {
  if (isLaser(doc)) return isLaserAttachedTo(doc, targetDoc);
  if (isMirror(doc)) return isMirrorAttachedTo(doc, targetDoc);
  return false;
}

/**
 * Sync all lasers attached to a moved token.
 * Called from the updateToken hook when a token moves or rotates.
 * @param {TokenDocument} movedTokenDoc - the token that was moved/rotated
 * @param {object} changes - the update delta (contains x, y, rotation, etc.)
 */
export async function syncAttachedLasers(movedTokenDoc, changes) {
  if (!game.user.isGM) return;
  const lasers = getAllLasers();
  for (const laserToken of lasers) {
    const laserDoc = laserToken.document ?? laserToken;
    const data = getLaserData(laserDoc);
    if (data.attachedToTokenId !== movedTokenDoc.id) continue;

    // Build update: sync position and/or rotation if they changed
    const update = {};
    if ("x" in changes) update.x = changes.x;
    if ("y" in changes) update.y = changes.y;
    if ("rotation" in changes) {
      update.rotation = changes.rotation;
      update[`flags.${MODULE_ID}.orientation`] = changes.rotation;
    }

    if (Object.keys(update).length > 0) {
      await laserDoc.update(update);
    }
  }
}

/**
 * Sync all mirrors attached to a moved token.
 * Called from the updateToken hook when a token moves or rotates.
 * @param {TokenDocument} movedTokenDoc - the token that was moved/rotated
 * @param {object} changes - the update delta (contains x, y, rotation, etc.)
 */
export async function syncAttachedMirrors(movedTokenDoc, changes) {
  if (!game.user.isGM) return;
  const mirrors = getAllMirrors();
  for (const mirrorToken of mirrors) {
    const mirrorDoc = mirrorToken.document ?? mirrorToken;
    const data = getMirrorData(mirrorDoc);
    if (data.attachedToTokenId !== movedTokenDoc.id) continue;

    // Build update: sync position and/or rotation if they changed
    const update = {};
    if ("x" in changes) update.x = changes.x;
    if ("y" in changes) update.y = changes.y;
    if ("rotation" in changes) {
      update.rotation = changes.rotation;
      update[`flags.${MODULE_ID}.orientation`] = changes.rotation;
    }

    if (Object.keys(update).length > 0) {
      await mirrorDoc.update(update);
    }
  }
}

/**
 * Sync all attached objects (lasers and mirrors) to a moved token.
 * @param {TokenDocument} movedTokenDoc
 * @param {object} changes
 */
export async function syncAttachedObjects(movedTokenDoc, changes) {
  await syncAttachedLasers(movedTokenDoc, changes);
  await syncAttachedMirrors(movedTokenDoc, changes);
}

/**
 * Handle deletion of a token — detach any lasers or mirrors attached to it.
 * @param {TokenDocument} deletedDoc
 */
export async function handleTokenDeletion(deletedDoc) {
  if (!game.user.isGM) return;
  // Detach any lasers attached to the deleted token
  const lasers = getAllLasers();
  for (const laserToken of lasers) {
    const laserDoc = laserToken.document ?? laserToken;
    const data = getLaserData(laserDoc);
    if (data.attachedToTokenId === deletedDoc.id) {
      await detachLaser(laserDoc);
    }
  }

  // Detach any mirrors attached to the deleted token
  const mirrors = getAllMirrors();
  for (const mirrorToken of mirrors) {
    const mirrorDoc = mirrorToken.document ?? mirrorToken;
    const data = getMirrorData(mirrorDoc);
    if (data.attachedToTokenId === deletedDoc.id) {
      await detachMirror(mirrorDoc);
    }
  }
}
