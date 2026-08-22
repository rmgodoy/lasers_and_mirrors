import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";

/**
 * Behavior: Change Door Property
 * Updates door state (open/closed/locked) or door configuration on a Wall document.
 */
export class ChangeDoorPropertyBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.DOOR;
  static label = "LAM.behaviors.door.label";
  static icon = "fa-solid fa-door-open";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-door.hbs";

  /**
   * Predefined door properties.
   */
  static PROPERTY_OPTIONS = [
    { value: "ds", label: "LAM.behaviors.door.props.doorState" },
    { value: "door", label: "LAM.behaviors.door.props.doorType" },
    { value: "doorSound", label: "LAM.behaviors.door.props.doorSound" },
  ];

  /**
   * Door state helper constants.
   */
  static DOOR_STATES = {
    CLOSED: 0,
    OPEN: 1,
    LOCKED: 2,
  };

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      uuid: "",
      properties: [
        { property: "ds", value: "1" },
      ],
    };
  }

  /** @override */
  static getSummary(config) {
    const target = config?.uuid ? config.uuid.split(".").pop() : "No target";
    const count = Array.isArray(config?.properties) ? config.properties.length : 0;
    if (count === 1 && config.properties[0]) {
      const p = config.properties[0];
      let valDesc = p.value;
      if (p.property === "ds") {
        if (p.value === "0" || p.value === 0) valDesc = "Closed";
        else if (p.value === "1" || p.value === 1) valDesc = "Open";
        else if (p.value === "2" || p.value === 2) valDesc = "Locked";
      }
      return `Door [${target}] → ${p.property}: ${valDesc}`;
    }
    return `Door [${target}] (${count} properties)`;
  }

  /** @override */
  static async execute(config, context) {
    if (!config?.uuid || !Array.isArray(config.properties) || config.properties.length === 0) {
      return;
    }

    const doc = await this.resolveDocument(config.uuid, "walls");
    if (!doc) {
      console.warn(`LasersAndMirrors | Door document not found for UUID: "${config.uuid}"`);
      return;
    }

    const updates = {};
    for (const propEntry of config.properties) {
      if (!propEntry?.property) continue;
      const propPath = propEntry.property.trim();
      let resolvedValue = this.resolveValue(propEntry.value, context);

      // Normalize door state aliases (e.g. "open" -> 1, "closed" -> 0, "locked" -> 2)
      if (propPath === "ds") {
        if (typeof resolvedValue === "string") {
          const lower = resolvedValue.toLowerCase();
          if (lower === "open") resolvedValue = 1;
          else if (lower === "closed") resolvedValue = 0;
          else if (lower === "locked") resolvedValue = 2;
          else resolvedValue = Number(resolvedValue) || 0;
        }
      }

      updates[propPath] = resolvedValue;
    }

    if (Object.keys(updates).length > 0) {
      await doc.update(updates);
    }
  }
}
