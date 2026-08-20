import { MODULE_ID, FLAGS } from "../constants.mjs";
import { isLaser, getLaserData, updateLaserData, getAllLasers } from "../laser-data.mjs";

/**
 * Attach a laser to a target token.
 * @param {TokenDocument} laserDoc - the laser token document
 * @param {TokenDocument} targetDoc - the token to attach to
 */
export async function attachLaser(laserDoc, targetDoc) {
  await updateLaserData(laserDoc, { attachedToTokenId: targetDoc.id });
  // Move the laser to the target's position
  await laserDoc.update({
    x: targetDoc.x,
    y: targetDoc.y,
    rotation: targetDoc.rotation
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
 * Sync all lasers attached to a moved token.
 * Called from the updateToken hook when a non-laser token moves.
 * @param {TokenDocument} movedTokenDoc - the token that was moved/rotated
 * @param {object} changes - the update delta (contains x, y, rotation, etc.)
 */
export async function syncAttachedLasers(movedTokenDoc, changes) {
  const lasers = getAllLasers();
  for (const laserToken of lasers) {
    const data = getLaserData(laserToken.document);
    if (data.attachedToTokenId !== movedTokenDoc.id) continue;

    // Build update: sync position and/or rotation if they changed
    const update = {};
    if ("x" in changes) update.x = changes.x;
    if ("y" in changes) update.y = changes.y;
    if ("rotation" in changes) update.rotation = changes.rotation;

    if (Object.keys(update).length > 0) {
      await laserToken.document.update(update);
    }
  }
}

/**
 * Handle deletion of a token — detach any lasers attached to it.
 * @param {TokenDocument} deletedDoc
 */
export async function handleTokenDeletion(deletedDoc) {
  // If a laser is deleted, nothing extra needed.
  // If a non-laser token is deleted, detach any lasers attached to it.
  const lasers = getAllLasers();
  for (const laserToken of lasers) {
    const data = getLaserData(laserToken.document);
    if (data.attachedToTokenId === deletedDoc.id) {
      await detachLaser(laserToken.document);
    }
  }
}
