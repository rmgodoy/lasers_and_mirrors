import { BEHAVIOR_TYPES } from "../constants.mjs";
import { BaseBehavior } from "./base-behavior.mjs";

/**
 * Behavior: Change Tile Property
 * Updates visibility, alpha, texture, position, or elevation on a Tile document.
 */
export class ChangeTilePropertyBehavior extends BaseBehavior {
  static type = BEHAVIOR_TYPES.TILE;
  static label = "LAM.behaviors.tile.label";
  static icon = "fa-solid fa-cube";
  static template = "modules/LasersAndMirrors/templates/behaviors/behavior-tile.hbs";

  /**
   * Predefined tile properties.
   */
  static PROPERTY_OPTIONS = [
    { value: "hidden", label: "LAM.behaviors.tile.props.hidden" },
    { value: "alpha", label: "LAM.behaviors.tile.props.alpha" },
    { value: "texture.src", label: "LAM.behaviors.tile.props.textureSrc" },
    { value: "texture.tint", label: "LAM.behaviors.tile.props.textureTint" },
    { value: "width", label: "LAM.behaviors.tile.props.width" },
    { value: "height", label: "LAM.behaviors.tile.props.height" },
    { value: "x", label: "LAM.behaviors.tile.props.x" },
    { value: "y", label: "LAM.behaviors.tile.props.y" },
    { value: "rotation", label: "LAM.behaviors.tile.props.rotation" },
    { value: "overhead", label: "LAM.behaviors.tile.props.overhead" },
    { value: "elevation", label: "LAM.behaviors.tile.props.elevation" },
    { value: "occlusion.mode", label: "LAM.behaviors.tile.props.occlusionMode" },
    { value: "occlusion.alpha", label: "LAM.behaviors.tile.props.occlusionAlpha" },
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
      return `Tile [${target}] → ${p.property}: ${p.value}`;
    }
    return `Tile [${target}] (${count} properties)`;
  }

  /** @override */
  static async execute(config, context) {
    if (!config?.uuid || !Array.isArray(config.properties) || config.properties.length === 0) {
      return;
    }

    const doc = await this.resolveDocument(config.uuid, "tiles");
    if (!doc) {
      console.warn(`LasersAndMirrors | Tile document not found for UUID: "${config.uuid}"`);
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
