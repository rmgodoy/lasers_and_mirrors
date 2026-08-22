import { MODULE_ID, BEHAVIOR_TYPES } from "../constants.mjs";
import { BehaviorRegistry } from "../behaviors/behavior-registry.mjs";
import { BehaviorClipboard } from "../behaviors/behavior-clipboard.mjs";
import { ConditionalBehavior } from "../behaviors/behavior-conditional.mjs";
import { CheckTriggersBehavior } from "../behaviors/behavior-check-triggers.mjs";
import {
  getPropertyOptions,
  getDefaultPropertyForType,
  scrapeCurrentFormValues,
  extractSubmittedConfig,
} from "./behavior-editor-helpers.mjs";

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
    position: { width: 520, height: "auto" },
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
  async _renderHTML(context, options) {
    const templatePaths = [
      `modules/${MODULE_ID}/templates/behaviors/behavior-editor.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-light.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-door.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-tile.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-macro.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-flag-read.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-flag-set.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-set-variable.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-trigger-read.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-conditional.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-check-triggers.hbs`,
      `modules/${MODULE_ID}/templates/behaviors/behavior-else-section.hbs`,
    ];
    const loadTpls = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
    if (typeof loadTpls === "function") {
      await loadTpls(templatePaths);
    }
    return super._renderHTML(context, options);
  }

  /** @override */
  async _prepareContext(options) {
    const type = this.selectedType;
    const propOptions = getPropertyOptions(type);
    const properties = Array.isArray(this.config.properties) ? this.config.properties : [];

    const enrichedProperties = properties.map(p => ({
      ...p,
      options: propOptions.map(opt => ({
        ...opt,
        selected: opt.value === p.property,
      })),
    }));

    const triggers = Array.isArray(this.config.triggers) ? this.config.triggers : [];
    const matchMode = this.config.matchMode || "all_hit";
    const enrichedTriggers = triggers.map(t => ({
      ...t,
      stateOptions: CheckTriggersBehavior.TRIGGER_STATES.map(opt => ({
        ...opt,
        selected: opt.value === (t.state ?? "hit"),
      })),
    }));

    const elseBehaviors = Array.isArray(this.config.elseBehaviors) ? this.config.elseBehaviors : [];
    const enrichedElseBehaviors = elseBehaviors.map(b => ({
      ...b,
      summary: BehaviorRegistry.getSummary(b),
      icon: BehaviorRegistry.getIcon(b.type),
      typeLabel: BehaviorRegistry.getLabel(b.type),
    }));

    const onFalseMode = this.config.onFalse ?? "stop";
    const clipboardItem = BehaviorClipboard.get();
    const canPasteElse = Boolean(
      clipboardItem &&
      clipboardItem.type !== BEHAVIOR_TYPES.CONDITIONAL &&
      clipboardItem.type !== BEHAVIOR_TYPES.CHECK_TRIGGERS
    );

    return {
      config: this.config,
      selectedType: type,
      typeOptions: BehaviorRegistry.getTypeOptions().map(opt => ({
        ...opt,
        selected: opt.type === type,
      })),
      isLight: type === BEHAVIOR_TYPES.LIGHT,
      isDoor: type === BEHAVIOR_TYPES.DOOR,
      isTile: type === BEHAVIOR_TYPES.TILE,
      isMacro: type === BEHAVIOR_TYPES.MACRO,
      isReadFlag: type === BEHAVIOR_TYPES.READ_FLAG,
      isSetFlag: type === BEHAVIOR_TYPES.SET_FLAG,
      isSetVariable: type === BEHAVIOR_TYPES.SET_VARIABLE,
      isReadTrigger: type === BEHAVIOR_TYPES.READ_TRIGGER,
      isConditional: type === BEHAVIOR_TYPES.CONDITIONAL,
      isCheckTriggers: type === BEHAVIOR_TYPES.CHECK_TRIGGERS,
      isClauseMode: this.config.mode !== "expression",
      isExpressionMode: this.config.mode === "expression",
      isSingleProp: properties.length <= 1,
      enrichedProperties,
      operators: ConditionalBehavior.OPERATORS.map(op => ({
        ...op,
        selected: op.value === this.config.operator,
      })),
      matchModes: CheckTriggersBehavior.MATCH_MODES.map(opt => ({
        ...opt,
        selected: opt.value === matchMode,
      })),
      isCustomMode: matchMode === "custom",
      isSingleTrigger: triggers.length <= 1,
      enrichedTriggers,
      isElseStop: onFalseMode === "stop",
      isElseExecute: onFalseMode === "execute_else",
      enrichedElseBehaviors,
      canPasteElse,
      clipboardSummary: BehaviorClipboard.hasClipboard ? BehaviorClipboard.getSummary() : "",
      elseTypeOptions: BehaviorRegistry.getTypeOptions().filter(
        opt => opt.type !== BEHAVIOR_TYPES.CONDITIONAL && opt.type !== BEHAVIOR_TYPES.CHECK_TRIGGERS
      ),
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Type switcher dropdown
    this.element.querySelector(".lam-behavior-type-select")?.addEventListener("change", (e) => {
      const newType = e.target.value;
      if (newType !== this.selectedType) {
        this.selectedType = newType;
        const fresh = BehaviorRegistry.createDefault(newType);
        this.config = { ...fresh, id: this.config.id, enabled: this.config.enabled };
        this.render();
      }
    });

    // Add property button
    this.element.querySelector(".lam-btn-add-prop")?.addEventListener("click", () => {
      if (!Array.isArray(this.config.properties)) this.config.properties = [];
      this.config.properties.push({ property: getDefaultPropertyForType(this.selectedType), value: "" });
      scrapeCurrentFormValues(this.element, this.config);
      this.render();
    });

    // Remove property buttons
    this.element.querySelectorAll(".lam-btn-remove-prop").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.dataset.index);
        if (Array.isArray(this.config.properties) && this.config.properties.length > 1) {
          scrapeCurrentFormValues(this.element, this.config);
          this.config.properties.splice(index, 1);
          this.render();
        }
      });
    });

    // Add trigger button (for CheckTriggers)
    this.element.querySelector(".lam-btn-add-trigger")?.addEventListener("click", () => {
      if (!Array.isArray(this.config.triggers)) this.config.triggers = [];
      this.config.triggers.push({ uuid: "", state: "hit" });
      scrapeCurrentFormValues(this.element, this.config);
      this.render();
    });

    // Remove trigger buttons (for CheckTriggers)
    this.element.querySelectorAll(".lam-btn-remove-trigger").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.dataset.index);
        if (Array.isArray(this.config.triggers) && this.config.triggers.length > 1) {
          scrapeCurrentFormValues(this.element, this.config);
          this.config.triggers.splice(index, 1);
          this.render();
        }
      });
    });

    // Match mode switcher (for CheckTriggers)
    this.element.querySelector(".lam-match-mode-select")?.addEventListener("change", (e) => {
      this.config.matchMode = e.target.value;
      scrapeCurrentFormValues(this.element, this.config);
      this.render();
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

    // Else mode radio buttons (Failure action)
    this.element.querySelectorAll(".lam-else-mode-toggle").forEach(radio => {
      radio.addEventListener("change", (e) => {
        const mode = e.target.value;
        this.config.onFalse = mode;
        const elseBody = this.element.querySelector(".lam-else-body");
        if (mode === "execute_else") {
          elseBody?.classList.remove("lam-hidden");
        } else {
          elseBody?.classList.add("lam-hidden");
        }
      });
    });

    // Add Else Behavior button
    this.element.querySelector('[data-action="addElseBehavior"]')?.addEventListener("click", () => {
      const elseType = this.element.querySelector(".lam-else-type-select")?.value || BEHAVIOR_TYPES.LIGHT;
      scrapeCurrentFormValues(this.element, this.config);
      new BehaviorEditorDialog({
        config: BehaviorRegistry.createDefault(elseType),
        onSave: async (savedBehavior) => {
          if (!Array.isArray(this.config.elseBehaviors)) this.config.elseBehaviors = [];
          this.config.elseBehaviors.push(savedBehavior);
          this.render();
        },
      }).render(true);
    });

    // Copy Else Behavior buttons
    this.element.querySelectorAll('[data-action="copyElseBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.dataset.index);
        const target = this.config.elseBehaviors?.[index];
        if (target) {
          scrapeCurrentFormValues(this.element, this.config);
          BehaviorClipboard.copy(target);
          const summary = BehaviorRegistry.getSummary(target) || BehaviorRegistry.getLabel(target.type);
          ui.notifications?.info?.(game.i18n.format("LAM.notify.behaviorCopied", { name: summary }));
          this.render();
        }
      });
    });

    // Paste Else Behavior button
    this.element.querySelector('[data-action="pasteElseBehavior"]')?.addEventListener("click", () => {
      scrapeCurrentFormValues(this.element, this.config);
      const clipboardItem = BehaviorClipboard.get();
      if (!clipboardItem) {
        ui.notifications?.warn?.(game.i18n.localize("LAM.notify.noBehaviorInClipboard"));
        return;
      }
      if (clipboardItem.type === BEHAVIOR_TYPES.CONDITIONAL || clipboardItem.type === BEHAVIOR_TYPES.CHECK_TRIGGERS) {
        ui.notifications?.warn?.(game.i18n.localize("LAM.notify.cannotPasteBranchingInElse"));
        return;
      }
      const pasted = BehaviorClipboard.paste();
      if (!pasted) return;

      if (!Array.isArray(this.config.elseBehaviors)) this.config.elseBehaviors = [];
      this.config.elseBehaviors.push(pasted);
      const summary = BehaviorRegistry.getSummary(pasted) || BehaviorRegistry.getLabel(pasted.type);
      ui.notifications?.info?.(game.i18n.format("LAM.notify.elseBehaviorPasted", { name: summary }));
      this.render();
    });

    // Edit Else Behavior buttons
    this.element.querySelectorAll('[data-action="editElseBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.dataset.index);
        const target = this.config.elseBehaviors?.[index];
        if (target) {
          scrapeCurrentFormValues(this.element, this.config);
          new BehaviorEditorDialog({
            config: target,
            onSave: async (savedBehavior) => {
              this.config.elseBehaviors[index] = savedBehavior;
              this.render();
            },
          }).render(true);
        }
      });
    });

    // Delete Else Behavior buttons
    this.element.querySelectorAll('[data-action="deleteElseBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.dataset.index);
        if (Array.isArray(this.config.elseBehaviors)) {
          scrapeCurrentFormValues(this.element, this.config);
          this.config.elseBehaviors.splice(index, 1);
          this.render();
        }
      });
    });

    // Move Else Behavior buttons
    this.element.querySelectorAll('[data-action="moveElseBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.dataset.index);
        const direction = e.currentTarget.dataset.direction;
        const targetIdx = direction === "up" ? index - 1 : index + 1;
        if (Array.isArray(this.config.elseBehaviors) && targetIdx >= 0 && targetIdx < this.config.elseBehaviors.length) {
          scrapeCurrentFormValues(this.element, this.config);
          const temp = this.config.elseBehaviors[index];
          this.config.elseBehaviors[index] = this.config.elseBehaviors[targetIdx];
          this.config.elseBehaviors[targetIdx] = temp;
          this.render();
        }
      });
    });

    // Cancel button
    this.element.querySelector('[data-action="cancel"]')?.addEventListener("click", () => this.close());
  }

  static async onSubmit(event, form, formData) {
    const data = formData.object;
    const finalConfig = extractSubmittedConfig(data, this.selectedType, this.config);
    if (typeof this.onSave === "function") {
      await this.onSave(finalConfig);
    }
  }
}
