import { MODULE_ID, BEHAVIOR_TYPES } from "../constants.mjs";
import { BehaviorRegistry } from "../behaviors/behavior-registry.mjs";
import { ChangeLightPropertyBehavior } from "../behaviors/behavior-light.mjs";
import { ChangeDoorPropertyBehavior } from "../behaviors/behavior-door.mjs";
import { ChangeTilePropertyBehavior } from "../behaviors/behavior-tile.mjs";
import { ConditionalBehavior } from "../behaviors/behavior-conditional.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Modal dialog for configuring or creating a Trigger behavior.
 */
export class BehaviorEditorDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options
   * @param {object} options.config - Behavior configuration data
   * @param {Function} options.onSave - Callback when saved: (config) => void
   */
  constructor(options = {}) {
    super(options);
    this.config = foundry.utils.deepClone(options.config ?? BehaviorRegistry.createDefault(BEHAVIOR_TYPES.LIGHT));
    this.selectedType = this.config.type ?? BEHAVIOR_TYPES.LIGHT;
    this.onSave = options.onSave ?? (() => {});
  }

  static DEFAULT_OPTIONS = {
    id: "behavior-editor-dialog-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet", "lam-dialog-window"],
    position: { width: 500, height: "auto" },
    window: {
      title: "LAM.behaviors.editor.title",
      resizable: true,
    },
    form: {
      handler: BehaviorEditorDialog.onSubmit,
      closeOnSubmit: true,
      submitOnChange: false,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/behaviors/behavior-editor.hbs`,
    },
  };

  /** @override */
  get title() {
    return game.i18n.localize("LAM.behaviors.editor.title");
  }

  /** @override */
  async _prepareContext(options) {
    const type = this.selectedType;
    return {
      config: this.config,
      selectedType: type,
      typeOptions: BehaviorRegistry.getTypeOptions(),
      isLight: type === BEHAVIOR_TYPES.LIGHT,
      isDoor: type === BEHAVIOR_TYPES.DOOR,
      isTile: type === BEHAVIOR_TYPES.TILE,
      isMacro: type === BEHAVIOR_TYPES.MACRO,
      isReadFlag: type === BEHAVIOR_TYPES.READ_FLAG,
      isSetFlag: type === BEHAVIOR_TYPES.SET_FLAG,
      isSetVariable: type === BEHAVIOR_TYPES.SET_VARIABLE,
      isConditional: type === BEHAVIOR_TYPES.CONDITIONAL,
      propertyOptions: this._getPropertyOptions(type),
      operators: ConditionalBehavior.OPERATORS,
    };
  }

  _getPropertyOptions(type) {
    if (type === BEHAVIOR_TYPES.LIGHT) return ChangeLightPropertyBehavior.PROPERTY_OPTIONS;
    if (type === BEHAVIOR_TYPES.DOOR) return ChangeDoorPropertyBehavior.PROPERTY_OPTIONS;
    if (type === BEHAVIOR_TYPES.TILE) return ChangeTilePropertyBehavior.PROPERTY_OPTIONS;
    return [];
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Type switcher dropdown
    const typeSelect = this.element.querySelector(".lam-behavior-type-select");
    typeSelect?.addEventListener("change", (e) => {
      const newType = e.target.value;
      if (newType !== this.selectedType) {
        this.selectedType = newType;
        const fresh = BehaviorRegistry.createDefault(newType);
        this.config = { ...fresh, id: this.config.id, enabled: this.config.enabled };
        this.render();
      }
    });

    // Add property button
    const addPropBtn = this.element.querySelector(".lam-btn-add-prop");
    addPropBtn?.addEventListener("click", () => {
      if (!Array.isArray(this.config.properties)) {
        this.config.properties = [];
      }
      this.config.properties.push({ property: this._getDefaultPropertyForType(this.selectedType), value: "" });
      this._scrapeCurrentFormValues();
      this.render();
    });

    // Remove property buttons
    this.element.querySelectorAll(".lam-btn-remove-prop").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.dataset.index);
        if (Array.isArray(this.config.properties) && this.config.properties.length > 1) {
          this._scrapeCurrentFormValues();
          this.config.properties.splice(index, 1);
          this.render();
        }
      });
    });

    // Conditional mode radio buttons
    this.element.querySelectorAll(".lam-conditional-mode-toggle").forEach(radio => {
      radio.addEventListener("change", (e) => {
        const mode = e.target.value;
        this.config.mode = mode;
        const clausePanel = this.element.querySelector(".lam-clause-panel");
        const exprPanel = this.element.querySelector(".lam-expression-panel");
        if (mode === "expression") {
          clausePanel?.classList.add("lam-hidden");
          exprPanel?.classList.remove("lam-hidden");
        } else {
          clausePanel?.classList.remove("lam-hidden");
          exprPanel?.classList.add("lam-hidden");
        }
      });
    });

    // Cancel button
    const cancelBtn = this.element.querySelector('[data-action="cancel"]');
    cancelBtn?.addEventListener("click", () => this.close());
  }

  _getDefaultPropertyForType(type) {
    if (type === BEHAVIOR_TYPES.LIGHT) return "hidden";
    if (type === BEHAVIOR_TYPES.DOOR) return "ds";
    if (type === BEHAVIOR_TYPES.TILE) return "hidden";
    return "";
  }

  /**
   * Scrapes currently entered input values from the DOM to avoid losing user inputs on re-render.
   */
  _scrapeCurrentFormValues() {
    const form = this.element.querySelector("form") || this.element;
    const data = new FormDataExtended(form).object;

    if ("uuid" in data) this.config.uuid = data.uuid;
    if ("enabled" in data) this.config.enabled = Boolean(data.enabled);

    // Scrape properties list for multi-property behaviors
    if (Array.isArray(this.config.properties)) {
      for (let i = 0; i < this.config.properties.length; i++) {
        if (`prop_property_${i}` in data) {
          this.config.properties[i].property = data[`prop_property_${i}`];
        }
        if (`prop_value_${i}` in data) {
          this.config.properties[i].value = data[`prop_value_${i}`];
        }
      }
    }
  }

  /**
   * Form submit handler.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    const type = this.selectedType;
    const finalConfig = {
      id: this.config.id,
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
        finalConfig.properties.push({ property: this._getDefaultPropertyForType(type), value: "" });
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
    } else if (type === BEHAVIOR_TYPES.CONDITIONAL) {
      finalConfig.mode = data.mode ?? "clause";
      finalConfig.left = data.left ?? "";
      finalConfig.operator = data.operator ?? "==";
      finalConfig.right = data.right ?? "";
      finalConfig.expression = data.expression ?? "";
    }

    if (typeof this.onSave === "function") {
      await this.onSave(finalConfig);
    }
  }
}
