import { MODULE_ID, FLAGS, TYPES, ACTOR_TYPES, TRIGGER_DEFAULTS } from "./constants.mjs";

/**
 * Check if a token is a trigger.
 * @param {TokenDocument} tokenDoc
 * @returns {boolean}
 */
export function isTrigger(tokenDoc) {
  if (!tokenDoc) return false;
  return tokenDoc.getFlag(MODULE_ID, FLAGS.TYPE) === TYPES.TRIGGER ||
         tokenDoc.actor?.type === ACTOR_TYPES.TRIGGER;
}

/**
 * Get all trigger data from a token (checking actor system or flags), merged with defaults.
 * @param {TokenDocument} tokenDoc
 * @returns {object} Full trigger data object with defaults applied
 */
export function getTriggerData(tokenDoc) {
  const flags = tokenDoc?.flags?.[MODULE_ID] ?? {};
  const actorSystem = tokenDoc?.actor?.system?.toObject?.() ?? tokenDoc?.actor?.system ?? {};
  return foundry.utils.mergeObject({ ...TRIGGER_DEFAULTS }, { ...actorSystem, ...flags }, { inplace: false });
}

/**
 * Update one or more trigger properties (syncing both flags and actor system if present).
 * @param {TokenDocument} tokenDoc
 * @param {object} changes - e.g. { enabled: false, onBeamHit: "..." }
 * @returns {Promise}
 */
export async function updateTriggerData(tokenDoc, changes) {
  const updateData = {};
  for (const [key, value] of Object.entries(changes)) {
    updateData[`flags.${MODULE_ID}.${key}`] = value;
  }
  await tokenDoc.update(updateData);

  if (tokenDoc.actor && tokenDoc.actor.type === ACTOR_TYPES.TRIGGER) {
    await tokenDoc.actor.update({ system: changes });
  }
}

/**
 * Get all trigger tokens in the current scene.
 * @returns {Token[]} Array of Token placeables that are triggers
 */
export function getAllTriggers() {
  return canvas.tokens.placeables.filter(t => isTrigger(t.document));
}
