import { MODULE_ID, FLAGS, TYPES, ACTOR_TYPES, LASER_DEFAULTS } from "./constants.mjs";
import { clampAngleToArc } from "./utils/angle-limits.mjs";

/**
 * Check if a token is a laser.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {boolean}
 */
export function isLaser(tokenDoc) {
  if (!tokenDoc) return false;
  const doc = tokenDoc.document ?? tokenDoc;
  return doc.getFlag?.(MODULE_ID, FLAGS.TYPE) === TYPES.LASER ||
         doc.flags?.[MODULE_ID]?.type === TYPES.LASER ||
         doc.actor?.type === ACTOR_TYPES.LASER;
}

/**
 * Get all laser data from a token (checking actor system or flags), merged with defaults.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {object} Full laser data object with defaults applied
 */
export function getLaserData(tokenDoc) {
  const doc = tokenDoc?.document ?? tokenDoc;
  const flags = doc?.flags?.[MODULE_ID] ?? {};
  const actorSystem = doc?.actor?.system?.toObject?.() ?? doc?.actor?.system ?? {};
  const merged = foundry.utils.mergeObject({ ...LASER_DEFAULTS }, { ...actorSystem, ...flags }, { inplace: false });
  if (flags.orientation === undefined && doc?.rotation !== undefined) {
    merged.orientation = doc.rotation;
  }
  return merged;
}

/**
 * Initialize a token as a laser with default values.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {Promise}
 */
export async function initLaser(tokenDoc) {
  const doc = tokenDoc.document ?? tokenDoc;
  await doc.update({ [`flags.${MODULE_ID}`]: { ...LASER_DEFAULTS } });
}

/**
 * Update one or more laser properties (syncing both flags and actor system if present).
 * @param {TokenDocument|Token} tokenDoc
 * @param {object} changes - e.g. { color: "#00ff00", visible: false }
 * @returns {Promise}
 */
export async function updateLaserData(tokenDoc, changes) {
  const doc = tokenDoc.document ?? tokenDoc;
  const currentData = getLaserData(doc);

  const effectiveLimits = {
    limitRotation: changes.limitRotation !== undefined ? Boolean(changes.limitRotation) : Boolean(currentData.limitRotation),
    minDeg: changes.minDeg !== undefined ? Number(changes.minDeg) : Number(currentData.minDeg ?? 0),
    maxDeg: changes.maxDeg !== undefined ? Number(changes.maxDeg) : Number(currentData.maxDeg ?? 360),
  };

  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }

  if ("orientation" in changes) {
    let ori = Number(changes.orientation);
    if (effectiveLimits.limitRotation) {
      ori = clampAngleToArc(ori, effectiveLimits.minDeg, effectiveLimits.maxDeg);
      changes.orientation = ori;
      updateData[`flags.${MODULE_ID}.orientation`] = ori;
    }
    updateData.rotation = ori;
  } else if (effectiveLimits.limitRotation) {
    const currentOri = Number(doc.rotation ?? currentData.orientation ?? 0);
    const clampedOri = clampAngleToArc(currentOri, effectiveLimits.minDeg, effectiveLimits.maxDeg);
    if (Math.abs(clampedOri - currentOri) > 1e-4) {
      changes.orientation = clampedOri;
      updateData[`flags.${MODULE_ID}.orientation`] = clampedOri;
      updateData.rotation = clampedOri;
    }
  }
  if (changes.visible !== undefined) {
    updateData["texture.src"] = changes.visible
      ? `modules/${MODULE_ID}/assets/laser-on.svg`
      : `modules/${MODULE_ID}/assets/laser-off.svg`;
  }
  await doc.update(updateData, { animate: false });

  if (doc.actor && doc.actor.type === ACTOR_TYPES.LASER) {
    if (doc.actor.isToken || doc.isLinked) {
      await doc.actor.update({ system: changes });
    }
  }
}



/**
 * Get all laser tokens in the current scene.
 * Returns Token placeables or TokenDocuments.
 * @returns {Array<Token|TokenDocument>}
 */
export function getAllLasers() {
  if (canvas?.scene?.tokens) {
    return canvas.scene.tokens
      .filter(tDoc => isLaser(tDoc))
      .map(tDoc => tDoc.object ?? tDoc)
      .filter(Boolean);
  }
  return canvas?.tokens?.placeables?.filter(t => isLaser(t.document)) ?? [];
}

