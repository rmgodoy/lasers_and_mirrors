import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";

/**
 * Behavior: Change Light Property
 * Updates one or more properties on an AmbientLight document.
 */
export class ChangeLightPropertyBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.LIGHT;
  static label = "LAM.behaviors.light.label";
  static icon = "fa-solid fa-lightbulb";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-light.hbs";

  /**
   * Predefined list of commonly modified light properties.
   */
  static PROPERTY_OPTIONS = [
    { value: "config.dim", label: "LAM.behaviors.light.props.dim" },
    { value: "config.bright", label: "LAM.behaviors.light.props.bright" },
    { value: "config.color", label: "LAM.behaviors.light.props.color" },
    { value: "config.alpha", label: "LAM.behaviors.light.props.alpha" },
    { value: "config.angle", label: "LAM.behaviors.light.props.angle" },
    { value: "config.animation.type", label: "LAM.behaviors.light.props.animType" },
    { value: "config.animation.speed", label: "LAM.behaviors.light.props.animSpeed" },
    { value: "config.animation.intensity", label: "LAM.behaviors.light.props.animIntensity" },
    { value: "config.darkness.min", label: "LAM.behaviors.light.props.darknessMin" },
    { value: "config.darkness.max", label: "LAM.behaviors.light.props.darknessMax" },
    { value: "config.luminosity", label: "LAM.behaviors.light.props.luminosity" },
    { value: "hidden", label: "LAM.behaviors.light.props.hidden" },
  ];

  /** @override */
  static createDefault() {
    return {
      ...super.createDefault(),
      type: this.type,
      uuid: "",
      properties: [
        { property: "hidden", value: "false" },
      ],
    };
  }

  /** @override */
  static getSummary(config) {
    const target = config?.uuid ? config.uuid.split(".").pop() : "No target";
    const count = Array.isArray(config?.properties) ? config.properties.length : 0;
    if (count === 1 && config.properties[0]) {
      const p = config.properties[0];
      return `Light [${target}] → ${p.property}: ${p.value}`;
    }
    return `Light [${target}] (${count} properties)`;
  }

  /** @override */
  static async execute(config, context) {
    if (!config?.uuid || !Array.isArray(config.properties) || config.properties.length === 0) {
      return;
    }

    const doc = await this.resolveDocument(config.uuid, "lights");
    if (!doc) {
      console.warn(`LasersAndMirrors | Light document not found for UUID: "${config.uuid}"`);
      return;
    }

    const updates = {};
    for (const propEntry of config.properties) {
      if (!propEntry?.property) continue;
      const propPath = propEntry.property.trim();
      const resolvedValue = this.resolveValue(propEntry.value, context);
      updates[propPath] = resolvedValue;
    }

    if (Object.keys(updates).length > 0) {
      await doc.update(updates);
    }
  }
}
