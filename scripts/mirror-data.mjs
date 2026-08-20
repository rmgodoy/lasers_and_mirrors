import { MODULE_ID, FLAGS, TYPES, MIRROR_DEFAULTS } from "./constants.mjs";

/**
 * Check if a token is a mirror.
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function isMirror(tokenDoc) {
  return tokenDoc?.getFlag(MODULE_ID, FLAGS.TYPE) === TYPES.MIRROR;
}

/**
 * Get all mirror data from a token, merged with defaults.
 * @param {TokenDocument} tokenDoc
 * @returns {object} Full mirror data object with defaults applied
 */
export function getMirrorData(tokenDoc) {
  const flags = tokenDoc?.flags?.[MODULE_ID] ?? {};
  return foundry.utils.mergeObject({ ...MIRROR_DEFAULTS }, flags, { inplace: false });
}

/**
 * Initialize a token as a mirror with default values.
 * @param {TokenDocument} tokenDoc
 * @returns {Promise}
 */
export async function initMirror(tokenDoc) {
  await tokenDoc.update({ [`flags.${MODULE_ID}`]: { ...MIRROR_DEFAULTS } });
}

/**
 * Update one or more mirror properties.
 * @param {TokenDocument} tokenDoc
 * @param {object} changes - e.g. { orientation: 45 }
 * @returns {Promise}
 */
export async function updateMirrorData(tokenDoc, changes) {
  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }
  await tokenDoc.update(updateData);
}

/**
 * Get all mirror tokens in the current scene.
 * @returns {Token[]} Array of Token placeables that are mirrors
 */
export function getAllMirrors() {
  return canvas.tokens.placeables.filter(t => isMirror(t.document));
}
