import { BEHAVIOR_TYPES } from "../constants.mjs";
import { ChangeLightPropertyBehavior } from "../behaviors/behavior-light.mjs";
import { ChangeDoorPropertyBehavior } from "../behaviors/behavior-door.mjs";
import { ChangeTilePropertyBehavior } from "../behaviors/behavior-tile.mjs";

const FormDataExtended = foundry.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;

/**
 * Get available property options for a given behavior type.
 * @param {string} type
 * @returns {Array<object>}
 */
export function getPropertyOptions(type) {
  if (type === BEHAVIOR_TYPES.LIGHT) return ChangeLightPropertyBehavior.PROPERTY_OPTIONS;
  if (type === BEHAVIOR_TYPES.DOOR) return ChangeDoorPropertyBehavior.PROPERTY_OPTIONS;
  if (type === BEHAVIOR_TYPES.TILE) return ChangeTilePropertyBehavior.PROPERTY_OPTIONS;
  return [];
}

/**
 * Get default property name for a newly added property row.
 * @param {string} type
 * @returns {string}
 */
export function getDefaultPropertyForType(type) {
  if (type === BEHAVIOR_TYPES.LIGHT) return "hidden";
  if (type === BEHAVIOR_TYPES.DOOR) return "ds";
  if (type === BEHAVIOR_TYPES.TILE) return "hidden";
  return "";
}

/**
 * Scrapes current input values from a form element and updates config in place.
 * @param {HTMLElement} element
 * @param {object} config
 */
export function scrapeCurrentFormValues(element, config) {
  const form = element.querySelector("form") || element;
  const data = new FormDataExtended(form).object;

  if ("uuid" in data) config.uuid = data.uuid;
  if ("enabled" in data) config.enabled = Boolean(data.enabled);
  if ("matchMode" in data) config.matchMode = data.matchMode;
  if ("storeVariable" in data) config.storeVariable = data.storeVariable;
  if ("onFalse" in data) config.onFalse = data.onFalse;

  if (Array.isArray(config.properties)) {
    for (let i = 0; i < config.properties.length; i++) {
      if (`prop_property_${i}` in data) {
        config.properties[i].property = data[`prop_property_${i}`];
      }
      if (`prop_value_${i}` in data) {
        config.properties[i].value = data[`prop_value_${i}`];
      }
    }
  }

  if (Array.isArray(config.triggers)) {
    for (let i = 0; i < config.triggers.length; i++) {
      if (`trigger_uuid_${i}` in data) {
        config.triggers[i].uuid = data[`trigger_uuid_${i}`];
      }
      if (`trigger_state_${i}` in data) {
        config.triggers[i].state = data[`trigger_state_${i}`];
      }
    }
  }
}

/**
 * Builds the final saved config object from submitted form data.
 * @param {object} data
 * @param {string} type
 * @param {object} currentConfig
 * @returns {object}
 */
export function extractSubmittedConfig(data, type, currentConfig) {
  const finalConfig = {
    id: currentConfig.id,
    type: type,
    enabled: Boolean(data.enabled),
  };

  if (type === BEHAVIOR_TYPES.LIGHT || type === BEHAVIOR_TYPES.DOOR || type === BEHAVIOR_TYPES.TILE) {
    finalConfig.uuid = (data.uuid ?? "").trim();
    finalConfig.properties = [];
    const keys = Object.keys(data);
    const propIndices = new Set();
    for (const k of keys) {
      const match = k.match(/^prop_property_(\d+)$/);
      if (match) propIndices.add(Number(match[1]));
    }
    for (const idx of Array.from(propIndices).sort((a, b) => a - b)) {
      finalConfig.properties.push({
        property: data[`prop_property_${idx}`],
        value: data[`prop_value_${idx}`] ?? "",
      });
    }
    if (finalConfig.properties.length === 0) {
      finalConfig.properties.push({ property: getDefaultPropertyForType(type), value: "" });
    }
  } else if (type === BEHAVIOR_TYPES.MACRO) {
    finalConfig.command = data.command ?? "";
  } else if (type === BEHAVIOR_TYPES.READ_FLAG) {
    finalConfig.flagScope = (data.flagScope ?? "world").trim();
    finalConfig.flagName = (data.flagName ?? "").trim();
    finalConfig.variableName = (data.variableName ?? "").trim();
  } else if (type === BEHAVIOR_TYPES.SET_FLAG) {
    finalConfig.flagScope = (data.flagScope ?? "world").trim();
    finalConfig.flagName = (data.flagName ?? "").trim();
    finalConfig.value = data.value ?? "";
  } else if (type === BEHAVIOR_TYPES.SET_VARIABLE) {
    finalConfig.name = (data.name ?? "").trim();
    finalConfig.value = data.value ?? "";
  } else if (type === BEHAVIOR_TYPES.READ_TRIGGER) {
    finalConfig.uuid = (data.uuid ?? "").trim();
    finalConfig.variableName = (data.variableName ?? "").trim();
  } else if (type === BEHAVIOR_TYPES.CONDITIONAL) {
    finalConfig.mode = data.mode ?? "clause";
    finalConfig.left = data.left ?? "";
    finalConfig.operator = data.operator ?? "==";
    finalConfig.right = data.right ?? "";
    finalConfig.expression = data.expression ?? "";
    finalConfig.onFalse = data.onFalse ?? currentConfig.onFalse ?? "stop";
    finalConfig.elseBehaviors = foundry.utils.deepClone(currentConfig.elseBehaviors ?? []);
  } else if (type === BEHAVIOR_TYPES.CHECK_TRIGGERS) {
    finalConfig.matchMode = data.matchMode ?? "all_hit";
    finalConfig.storeVariable = (data.storeVariable ?? "").trim();
    finalConfig.onFalse = data.onFalse ?? currentConfig.onFalse ?? "stop";
    finalConfig.elseBehaviors = foundry.utils.deepClone(currentConfig.elseBehaviors ?? []);
    finalConfig.triggers = [];
    const keys = Object.keys(data);
    const trigIndices = new Set();
    for (const k of keys) {
      const match = k.match(/^trigger_uuid_(\d+)$/);
      if (match) trigIndices.add(Number(match[1]));
    }
    for (const idx of Array.from(trigIndices).sort((a, b) => a - b)) {
      finalConfig.triggers.push({
        uuid: (data[`trigger_uuid_${idx}`] ?? "").trim(),
        state: data[`trigger_state_${idx}`] ?? "hit",
      });
    }
    if (finalConfig.triggers.length === 0) {
      finalConfig.triggers.push({ uuid: "", state: "hit" });
    }
  }

  return finalConfig;
}
