import { BaseBehavior } from "./base-behavior.mjs";
import { BehaviorRegistry } from "./behavior-registry.mjs";

/**
 * Global clipboard manager for copying and pasting trigger behaviors
 * across different triggers and events (enter, stay, exit, hitChange).
 */
export class BehaviorClipboard {
  static _clipboard = null;

  /**
   * Copy a behavior object into the clipboard.
   * @param {object} behavior - Behavior configuration object
   * @returns {object|null} Cloned copied behavior
   */
  static copy(behavior) {
    if (!behavior || typeof behavior !== "object") return null;

    const cloned = typeof foundry !== "undefined" && foundry.utils?.deepClone
      ? foundry.utils.deepClone(behavior)
      : JSON.parse(JSON.stringify(behavior));

    BehaviorClipboard._clipboard = cloned;

    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("LAM_BEHAVIOR_CLIPBOARD", JSON.stringify(cloned));
      }
    } catch (_) {
      // Storage unavailable or disabled
    }

    return cloned;
  }

  /**
   * Check if there is currently a behavior in the clipboard.
   * @type {boolean}
   */
  static get hasClipboard() {
    return !!BehaviorClipboard.get();
  }

  /**
   * Get the current raw clipboard content without changing its IDs.
   * @returns {object|null}
   */
  static get() {
    if (BehaviorClipboard._clipboard) return BehaviorClipboard._clipboard;
    try {
      if (typeof sessionStorage !== "undefined") {
        const item = sessionStorage.getItem("LAM_BEHAVIOR_CLIPBOARD");
        if (item) {
          BehaviorClipboard._clipboard = JSON.parse(item);
          return BehaviorClipboard._clipboard;
        }
      }
    } catch (_) {
      // Storage unavailable
    }
    return null;
  }

  /**
   * Paste a behavior from the clipboard with brand new unique IDs
   * assigned to the root behavior and any nested behaviors.
   * @returns {object|null} Freshly cloned behavior ready for insertion
   */
  static paste() {
    const item = BehaviorClipboard.get();
    if (!item) return null;

    const cloned = typeof foundry !== "undefined" && foundry.utils?.deepClone
      ? foundry.utils.deepClone(item)
      : JSON.parse(JSON.stringify(item));

    BehaviorClipboard._regenerateIds(cloned);
    return cloned;
  }

  /**
   * Recursively regenerate unique IDs on a behavior object and its children.
   * @param {object} behavior
   * @private
   */
  static _regenerateIds(behavior) {
    if (!behavior || typeof behavior !== "object") return;
    behavior.id = BaseBehavior.generateId();

    if (Array.isArray(behavior.elseBehaviors)) {
      for (const child of behavior.elseBehaviors) {
        BehaviorClipboard._regenerateIds(child);
      }
    }
  }

  /**
   * Get the localized summary of the item currently in the clipboard.
   * @returns {string}
   */
  static getSummary() {
    const item = BehaviorClipboard.get();
    if (!item) return "";
    return BehaviorRegistry.getSummary(item);
  }

  /**
   * Get the icon class of the item currently in the clipboard.
   * @returns {string}
   */
  static getIcon() {
    const item = BehaviorClipboard.get();
    if (!item) return "";
    return BehaviorRegistry.getIcon(item.type);
  }

  /**
   * Get the localization key or label of the item currently in the clipboard.
   * @returns {string}
   */
  static getTypeLabel() {
    const item = BehaviorClipboard.get();
    if (!item) return "";
    return BehaviorRegistry.getLabel(item.type);
  }

  /**
   * Clear the behavior clipboard contents.
   */
  static clear() {
    BehaviorClipboard._clipboard = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("LAM_BEHAVIOR_CLIPBOARD");
      }
    } catch (_) {
      // Storage unavailable
    }
  }

  // ==========================================================
  // Full Trigger Configuration Clipboard
  // ==========================================================

  static _triggerClipboard = null;

  /**
   * Copy an entire trigger configuration (general settings and all behavior event sequences).
   * @param {object} triggerData
   * @returns {object|null}
   */
  static copyTrigger(triggerData) {
    if (!triggerData || typeof triggerData !== "object") return null;

    const payload = {
      enabled: triggerData.enabled ?? true,
      anchorRadius: triggerData.anchorRadius ?? 0,
      passThrough: triggerData.passThrough ?? false,
      onBeamHit: triggerData.onBeamHit ?? "",
      onBeamStay: triggerData.onBeamStay ?? "",
      onBeamLost: triggerData.onBeamLost ?? "",
      onBeamHitChange: triggerData.onBeamHitChange ?? "",
      behaviorsEnter: Array.isArray(triggerData.behaviorsEnter) ? triggerData.behaviorsEnter : [],
      behaviorsStay: Array.isArray(triggerData.behaviorsStay) ? triggerData.behaviorsStay : [],
      behaviorsExit: Array.isArray(triggerData.behaviorsExit) ? triggerData.behaviorsExit : [],
      behaviorsHitChange: Array.isArray(triggerData.behaviorsHitChange) ? triggerData.behaviorsHitChange : [],
    };

    const cloned = typeof foundry !== "undefined" && foundry.utils?.deepClone
      ? foundry.utils.deepClone(payload)
      : JSON.parse(JSON.stringify(payload));

    BehaviorClipboard._triggerClipboard = cloned;

    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("LAM_TRIGGER_CONFIG_CLIPBOARD", JSON.stringify(cloned));
      }
    } catch (_) {
      // Storage unavailable
    }

    return cloned;
  }

  /**
   * Check if there is currently a full trigger configuration in the clipboard.
   * @type {boolean}
   */
  static get hasTriggerClipboard() {
    return !!BehaviorClipboard.getTrigger();
  }

  /**
   * Get the raw full trigger clipboard without regenerating IDs.
   * @returns {object|null}
   */
  static getTrigger() {
    if (BehaviorClipboard._triggerClipboard) return BehaviorClipboard._triggerClipboard;
    try {
      if (typeof sessionStorage !== "undefined") {
        const item = sessionStorage.getItem("LAM_TRIGGER_CONFIG_CLIPBOARD");
        if (item) {
          BehaviorClipboard._triggerClipboard = JSON.parse(item);
          return BehaviorClipboard._triggerClipboard;
        }
      }
    } catch (_) {
      // Storage unavailable
    }
    return null;
  }

  /**
   * Paste the trigger configuration from the clipboard with brand new unique IDs
   * recursively generated across all behavior lists.
   * @returns {object|null} Freshly cloned trigger config ready to be saved
   */
  static pasteTrigger() {
    const item = BehaviorClipboard.getTrigger();
    if (!item) return null;

    const cloned = typeof foundry !== "undefined" && foundry.utils?.deepClone
      ? foundry.utils.deepClone(item)
      : JSON.parse(JSON.stringify(item));

    const listKeys = ["behaviorsEnter", "behaviorsStay", "behaviorsExit", "behaviorsHitChange"];
    for (const key of listKeys) {
      if (Array.isArray(cloned[key])) {
        for (const behavior of cloned[key]) {
          BehaviorClipboard._regenerateIds(behavior);
        }
      }
    }

    return cloned;
  }

  /**
   * Get summary description of the trigger configuration in the clipboard.
   * @returns {string}
   */
  static getTriggerSummary() {
    const item = BehaviorClipboard.getTrigger();
    if (!item) return "";
    const counts = [
      `Enter: ${item.behaviorsEnter?.length ?? 0}`,
      `Stay: ${item.behaviorsStay?.length ?? 0}`,
      `Exit: ${item.behaviorsExit?.length ?? 0}`,
      `Change: ${item.behaviorsHitChange?.length ?? 0}`,
    ];
    return counts.join(", ");
  }

  /**
   * Clear the full trigger configuration clipboard.
   */
  static clearTrigger() {
    BehaviorClipboard._triggerClipboard = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("LAM_TRIGGER_CONFIG_CLIPBOARD");
      }
    } catch (_) {
      // Storage unavailable
    }
  }
}
