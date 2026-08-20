import { MODULE_ID, FLAGS, TYPES, ACTOR_TYPES, MIRROR_DEFAULTS } from "./constants.mjs";

/**
 * Check if a token is a mirror.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {boolean}
 */
export function isMirror(tokenDoc) {
  if (!tokenDoc) return false;
  const doc = tokenDoc.document ?? tokenDoc;
  return doc.getFlag?.(MODULE_ID, FLAGS.TYPE) === TYPES.MIRROR ||
         doc.flags?.[MODULE_ID]?.type === TYPES.MIRROR ||
         doc.actor?.type === ACTOR_TYPES.MIRROR;
}

/**
 * Get all mirror data from a token (checking actor system or flags), merged with defaults.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {object} Full mirror data object with defaults applied
 */
export function getMirrorData(tokenDoc) {
  const doc = tokenDoc?.document ?? tokenDoc;
  const flags = doc?.flags?.[MODULE_ID] ?? {};
  const actorSystem = doc?.actor?.system?.toObject?.() ?? doc?.actor?.system ?? {};
  return foundry.utils.mergeObject({ ...MIRROR_DEFAULTS }, { ...actorSystem, ...flags }, { inplace: false });
}

/**
 * Initialize a token as a mirror with default values.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {Promise}
 */
export async function initMirror(tokenDoc) {
  const doc = tokenDoc.document ?? tokenDoc;
  await doc.update({ [`flags.${MODULE_ID}`]: { ...MIRROR_DEFAULTS } });
}

/**
 * Update one or more mirror properties (syncing both flags and actor system if present).
 * @param {TokenDocument|Token} tokenDoc
 * @param {object} changes - e.g. { orientation: 45 }
 * @returns {Promise}
 */
export async function updateMirrorData(tokenDoc, changes) {
  const doc = tokenDoc.document ?? tokenDoc;
  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }
  if ("orientation" in changes) {
    updateData.rotation = Number(changes.orientation);
  }
  await doc.update(updateData, { animate: false });

  if (doc.actor && doc.actor.type === ACTOR_TYPES.MIRROR) {
    await doc.actor.update({ system: changes });
  }
}

/**
 * Get all mirror tokens in the current scene.
 * Returns Token placeables or TokenDocuments.
 * @returns {Array<Token|TokenDocument>}
 */
export function getAllMirrors() {
  if (canvas?.scene?.tokens) {
    return canvas.scene.tokens
      .filter(tDoc => isMirror(tDoc))
      .map(tDoc => tDoc.object ?? tDoc)
      .filter(Boolean);
  }
  return canvas?.tokens?.placeables?.filter(t => isMirror(t.document)) ?? [];
}

