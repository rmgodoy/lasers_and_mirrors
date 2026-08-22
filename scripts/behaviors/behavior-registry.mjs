import { BEHAVIOR_TYPES } from "../constants.mjs";

/**
 * Central registry for trigger behavior types and descriptors.
 */
export class BehaviorRegistry {
  /**
   * Internal map of behavior types to behavior class implementations.
   * @type {Map<string, typeof import("./base-behavior.mjs").BaseBehavior>}
   * @private
   */
  static _types = new Map();

  /**
   * Register a behavior class implementation.
   * @param {typeof import("./base-behavior.mjs").BaseBehavior} behaviorClass
   */
  static register(behaviorClass) {
    if (!behaviorClass?.type) {
      throw new Error("Cannot register behavior without a static 'type' property.");
    }
    this._types.set(behaviorClass.type, behaviorClass);
  }

  /**
   * Get a registered behavior class by type.
   * @param {string} type
   * @returns {typeof import("./base-behavior.mjs").BaseBehavior|undefined}
   */
  static get(type) {
    return this._types.get(type);
  }

  /**
   * Check if a behavior type is registered.
   * @param {string} type
   * @returns {boolean}
   */
  static has(type) {
    return this._types.has(type);
  }

  /**
   * Get all registered behavior classes.
   * @returns {Array<typeof import("./base-behavior.mjs").BaseBehavior>}
   */
  static getAll() {
    return Array.from(this._types.values());
  }

  /**
   * Get an array of behavior type options for dropdowns.
   * @returns {Array<{ type: string, label: string, icon: string }>}
   */
  static getTypeOptions() {
    return this.getAll().map(cls => ({
      type: cls.type,
      label: cls.label,
      icon: cls.icon,
    }));
  }

  /**
   * Create a default configuration object for a behavior type.
   * @param {string} type
   * @returns {object}
   */
  static createDefault(type) {
    const cls = this.get(type);
    if (cls?.createDefault) {
      return cls.createDefault();
    }
    return {
      id: Math.random().toString(36).substring(2, 10),
      type: type ?? BEHAVIOR_TYPES.MACRO,
      enabled: true,
    };
  }

  /**
   * Get a human-readable summary of a behavior config.
   * @param {object} config
   * @returns {string}
   */
  static getSummary(config) {
    if (!config) return "";
    const cls = this.get(config.type);
    if (cls?.getSummary) {
      return cls.getSummary(config);
    }
    return config.type ?? "Behavior";
  }

  /**
   * Get the icon class for a behavior type.
   * @param {string} type
   * @returns {string}
   */
  static getIcon(type) {
    return this.get(type)?.icon ?? "fa-solid fa-gear";
  }

  /**
   * Get the label for a behavior type.
   * @param {string} type
   * @returns {string}
   */
  static getLabel(type) {
    return this.get(type)?.label ?? type;
  }
}
