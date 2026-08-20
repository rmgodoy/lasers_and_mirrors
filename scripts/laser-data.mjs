import { MODULE_ID, FLAGS, TYPES, LASER_DEFAULTS } from "./constants.mjs";

/**
 * Check if a token is a laser.
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function isLaser(tokenDoc) {
  return tokenDoc?.getFlag(MODULE_ID, FLAGS.TYPE) === TYPES.LASER;
}

/**
 * Get all laser data from a token, merged with defaults.
 * @param {TokenDocument} tokenDoc
 * @returns {object} Full laser data object with defaults applied
 */
export function getLaserData(tokenDoc) {
  const flags = tokenDoc?.flags?.[MODULE_ID] ?? {};
  return foundry.utils.mergeObject({ ...LASER_DEFAULTS }, flags, { inplace: false });
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
 * Update one or more laser properties.
 * @param {TokenDocument} tokenDoc
 * @param {object} changes - e.g. { color: "#00ff00", visible: false }
 * @returns {Promise}
 */
export async function updateLaserData(tokenDoc, changes) {
  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }
  await tokenDoc.update(updateData);
}

/**
 * Get all laser tokens in the current scene.
 * @returns {Token[]} Array of Token placeables that are lasers
 */
export function getAllLasers() {
  return canvas.tokens.placeables.filter(t => isLaser(t.document));
}
