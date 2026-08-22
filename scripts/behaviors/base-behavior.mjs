import { MODULE_ID } from "../constants.mjs";
import { isTriggerHit } from "../canvas/beam-layer.mjs";

/**
 * Abstract base class for all Trigger behaviors.
 */
export class BaseBehavior {
  /**
   * Unique behavior type identifier matching BEHAVIOR_TYPES.
   * @type {string}
   */
  static type = "base";

  /**
   * Localization key for the behavior name.
   * @type {string}
   */
  static label = "LAM.behaviors.base.label";

  /**
   * FontAwesome icon class for UI representation.
   * @type {string}
   */
  static icon = "fa-solid fa-gear";

  /**
   * Template path for the behavior-specific edit form.
   * @type {string}
   */
  static template = "";

  /**
   * Generate a fresh default configuration object for this behavior.
   * @returns {object}
   */
  static createDefault() {
    return {
      id: BaseBehavior.generateId(),
      type: this.type,
      enabled: true,
    };
  }

  /**
   * Generate a human-readable summary string for displaying in lists.
   * @param {object} config
   * @returns {string}
   */
  static getSummary(config) {
    return config?.type ?? "Behavior";
  }

  /**
   * Execute the behavior within the given ExecutionContext.
   * @param {object} config - Configuration object for this behavior instance
   * @param {object} context - Execution context
   * @returns {Promise<void>}
   */
  static async execute(config, context) {
    // Override in subclass
  }

  /**
   * Generate a unique ID for a behavior instance.
   * @returns {string}
   */
  static generateId() {
    return typeof foundry !== "undefined" && foundry.utils?.randomID
      ? foundry.utils.randomID(16)
      : Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  }

  /**
   * Resolves a value from literals, variable references ($var or var:name),
   * scene flag references (flag:name), or booleans/numbers.
   * @param {*} raw - The raw input value
   * @param {object} [context] - Current execution context
   * @returns {*}
   */
  static resolveValue(raw, context = null) {
    if (raw === null || raw === undefined) return raw;
    if (typeof raw !== "string") return raw;

    const trimmed = raw.trim();

    // Variable reference: $varName or var:varName
    if (trimmed.startsWith("$")) {
      const varName = trimmed.slice(1);
      return context?.variables?.[varName] ?? undefined;
    }
    if (trimmed.startsWith("var:")) {
      const varName = trimmed.slice(4);
      return context?.variables?.[varName] ?? undefined;
    }

    // Flag reference: flag:flagName
    if (trimmed.startsWith("flag:")) {
      const flagName = trimmed.slice(5);
      return canvas?.scene?.getFlag?.("world", flagName) ?? undefined;
    }

    // Trigger hit state reference: trigger:tokenId or trigger:$var
    if (trimmed.startsWith("trigger:")) {
      let target = trimmed.slice(8).trim();
      if (target.startsWith("$")) {
        target = context?.variables?.[target.slice(1)] ?? target;
      }
      return isTriggerHit(target);
    }

    // Explicit string quotes: "text" or 'text' -> unquote literal string
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Boolean / Null literals
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (trimmed === "undefined") return undefined;

    // Number literal
    if (!Number.isNaN(Number(trimmed)) && trimmed !== "") {
      return Number(trimmed);
    }

    return raw;
  }

  /**
   * Resolve a Document from a UUID or ID on the current canvas.
   * Supports AmbientLight, Wall/Door, Tile, Token, Actor documents.
   * @param {string} uuid
   * @param {string} [collectionName] - e.g. "lights", "walls", "tiles"
   * @returns {Promise<Document|null>}
   */
  static async resolveDocument(uuid, collectionName = null) {
    if (!uuid || typeof uuid !== "string") return null;
    const cleanUuid = uuid.trim();
    if (!cleanUuid) return null;

    // Standard Foundry UUID resolution
    if (typeof fromUuid === "function") {
      try {
        const doc = await fromUuid(cleanUuid);
        if (doc) return doc;
      } catch (_) {
        // Continue to fallback search
      }
    }

    // Fallback search by ID on active scene
    if (canvas?.scene) {
      if (collectionName && canvas.scene[collectionName]) {
        const doc = canvas.scene[collectionName].get(cleanUuid);
        if (doc) return doc;
      }
      // Check common collections
      const collections = ["lights", "walls", "tiles", "tokens"];
      for (const col of collections) {
        if (canvas.scene[col]) {
          const doc = canvas.scene[col].get(cleanUuid);
          if (doc) return doc;
        }
      }
    }

    return null;
  }
}
