import { MODULE_ID, FLAGS, TYPES, ACTOR_TYPES, LASER_DEFAULTS } from "./constants.mjs";

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
  return foundry.utils.mergeObject({ ...LASER_DEFAULTS }, { ...actorSystem, ...flags }, { inplace: false });
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
  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }
  if (changes.visible !== undefined) {
    updateData["texture.src"] = changes.visible
      ? `modules/${MODULE_ID}/assets/laser-on.svg`
      : `modules/${MODULE_ID}/assets/laser-off.svg`;
  }
  await doc.update(updateData);

  if (doc.actor && doc.actor.type === ACTOR_TYPES.LASER) {
    await doc.actor.update({ system: changes });
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

