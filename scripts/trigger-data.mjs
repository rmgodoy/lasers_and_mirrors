import { MODULE_ID, FLAGS, TYPES, ACTOR_TYPES, TRIGGER_DEFAULTS } from "./constants.mjs";

/**
 * Check if a token is a trigger.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {boolean}
 */
export function isTrigger(tokenDoc) {
  if (!tokenDoc) return false;
  const doc = tokenDoc.document ?? tokenDoc;
  return doc.getFlag?.(MODULE_ID, FLAGS.TYPE) === TYPES.TRIGGER ||
         doc.flags?.[MODULE_ID]?.type === TYPES.TRIGGER ||
         doc.actor?.type === ACTOR_TYPES.TRIGGER;
}

/**
 * Get all trigger data from a token (checking actor system or flags), merged with defaults.
 * @param {TokenDocument|Token} tokenDoc
 * @returns {object} Full trigger data object with defaults applied
 */
export function getTriggerData(tokenDoc) {
  const doc = tokenDoc?.document ?? tokenDoc;
  const flags = doc?.flags?.[MODULE_ID] ?? {};
  const actorSystem = doc?.actor?.system?.toObject?.() ?? doc?.actor?.system ?? {};
  return foundry.utils.mergeObject({ ...TRIGGER_DEFAULTS }, { ...actorSystem, ...flags }, { inplace: false });
}

/**
 * Update one or more trigger properties (syncing both flags and actor system if present).
 * @param {TokenDocument|Token} tokenDoc
 * @param {object} changes - e.g. { enabled: false, onBeamHit: "..." }
 * @returns {Promise}
 */
export async function updateTriggerData(tokenDoc, changes) {
  const doc = tokenDoc.document ?? tokenDoc;
  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }
  await doc.update(updateData);

  if (doc.actor && doc.actor.type === ACTOR_TYPES.TRIGGER) {
    if (doc.actor.isToken || doc.isLinked) {
      await doc.actor.update({ system: changes });
    }
  }
}


/**
 * Get all trigger tokens in the current scene.
 * Returns Token placeables or TokenDocuments.
 * @returns {Array<Token|TokenDocument>}
 */
export function getAllTriggers() {
  if (canvas?.scene?.tokens) {
    return canvas.scene.tokens
      .filter(tDoc => isTrigger(tDoc))
      .map(tDoc => tDoc.object ?? tDoc)
      .filter(Boolean);
  }
  return canvas?.tokens?.placeables?.filter(t => isTrigger(t.document)) ?? [];
}

