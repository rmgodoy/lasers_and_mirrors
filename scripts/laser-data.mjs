import { MODULE_ID, FLAGS, TYPES, ACTOR_TYPES, LASER_DEFAULTS } from "./constants.mjs";

/**
 * Check if a token is a laser.
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function isLaser(tokenDoc) {
  if (!tokenDoc) return false;
  return tokenDoc.getFlag(MODULE_ID, FLAGS.TYPE) === TYPES.LASER ||
         tokenDoc.actor?.type === ACTOR_TYPES.LASER;
}

/**
 * Get all laser data from a token (checking actor system or flags), merged with defaults.
 * @param {TokenDocument} tokenDoc
 * @returns {object} Full laser data object with defaults applied
 */
export function getLaserData(tokenDoc) {
  const flags = tokenDoc?.flags?.[MODULE_ID] ?? {};
  const actorSystem = tokenDoc?.actor?.system?.toObject?.() ?? tokenDoc?.actor?.system ?? {};
  return foundry.utils.mergeObject({ ...LASER_DEFAULTS }, { ...actorSystem, ...flags }, { inplace: false });
}

/**
 * Initialize a token as a laser with default values.
 * @param {TokenDocument} tokenDoc
 * @returns {Promise}
 */
export async function initLaser(tokenDoc) {
  await tokenDoc.update({ [`flags.${MODULE_ID}`]: { ...LASER_DEFAULTS } });
}

/**
 * Update one or more laser properties (syncing both flags and actor system if present).
 * @param {TokenDocument} tokenDoc
 * @param {object} changes - e.g. { color: "#00ff00", visible: false }
 * @returns {Promise}
 */
export async function updateLaserData(tokenDoc, changes) {
  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }
  if (changes.visible !== undefined) {
    updateData["texture.src"] = changes.visible
      ? `modules/${MODULE_ID}/assets/laser-on.svg`
      : `modules/${MODULE_ID}/assets/laser-off.svg`;
  }
  await tokenDoc.update(updateData);

  if (tokenDoc.actor && tokenDoc.actor.type === ACTOR_TYPES.LASER) {
    await tokenDoc.actor.update({ system: changes });
  }
}

/**
 * Get all laser tokens in the current scene.
 * @returns {Token[]} Array of Token placeables that are lasers
 */
export function getAllLasers() {
  return canvas.tokens.placeables.filter(t => isLaser(t.document));
}
