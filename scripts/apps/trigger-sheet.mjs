import { MODULE_ID, BEHAVIOR_TYPES } from "../constants.mjs";
import { getTriggerData, updateTriggerData } from "../trigger-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";
import { BehaviorRegistry } from "../behaviors/behavior-registry.mjs";
import { BehaviorEditorDialog } from "./behavior-editor-dialog.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token config popup for Trigger tokens (opened from Token HUD).
 * Reads/writes token flags with full tabbed behavior support.
 */
export class TriggerTokenConfigSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {TokenDocument} tokenDoc - the token document to configure
   * @param {object} options
   */
  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
    this.activeTab = "general";
  }

  static DEFAULT_OPTIONS = {
    id: "trigger-token-config-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.trigger.title",
      resizable: true,
    },
    position: { width: 520, height: "auto" },
    form: {
      handler: TriggerTokenConfigSheet.onSubmit,
      closeOnSubmit: false,
      submitOnChange: true,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/trigger-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return game.i18n.localize("LAM.sheets.trigger.title");
  }

  /** @override */
  async _prepareContext(options) {
    const data = getTriggerData(this.tokenDoc);
    return {
      activeTab: this.activeTab ?? "general",
      anchorRadius: data.anchorRadius ?? 0,
      enabled: data.enabled,
      passThrough: data.passThrough,
      behaviorsEnter: this._enrichBehaviors(data.behaviorsEnter),
      behaviorsStay: this._enrichBehaviors(data.behaviorsStay),
      behaviorsExit: this._enrichBehaviors(data.behaviorsExit),
    };
  }

  _enrichBehaviors(list) {
    if (!Array.isArray(list)) return [];
    return list.map(b => ({
      ...b,
      summary: BehaviorRegistry.getSummary(b),
      icon: BehaviorRegistry.getIcon(b.type),
      typeLabel: BehaviorRegistry.getLabel(b.type),
    }));
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Tab navigation
    this.element.querySelectorAll(".sheet-tabs [data-tab]").forEach(tabEl => {
      tabEl.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = e.currentTarget.dataset.tab;
        if (tab && tab !== this.activeTab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    // Add Behavior
    this.element.querySelectorAll('[data-action="addBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        this._onAddBehavior(tab);
      });
    });

    // Edit Behavior
    this.element.querySelectorAll('[data-action="editBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        const index = Number(e.currentTarget.dataset.index);
        this._onEditBehavior(tab, index);
      });
    });

    // Delete Behavior
    this.element.querySelectorAll('[data-action="deleteBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        const index = Number(e.currentTarget.dataset.index);
        this._onDeleteBehavior(tab, index);
      });
    });

    // Move Behavior Up / Down
    this.element.querySelectorAll('[data-action="moveBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        const index = Number(e.currentTarget.dataset.index);
        const direction = e.currentTarget.dataset.direction;
        this._onMoveBehavior(tab, index, direction);
      });
    });
  }

  _getBehaviorListKey(tab) {
    if (tab === "enter") return "behaviorsEnter";
    if (tab === "stay") return "behaviorsStay";
    if (tab === "exit") return "behaviorsExit";
    return null;
  }

  async _saveChanges(changes) {
    await updateTriggerData(this.tokenDoc, changes);
    refreshBeams();
    this.render();
  }

  _onAddBehavior(tab) {
    const listKey = this._getBehaviorListKey(tab);
    if (!listKey) return;

    new BehaviorEditorDialog({
      config: BehaviorRegistry.createDefault(BEHAVIOR_TYPES.LIGHT),
      onSave: async (newBehavior) => {
        const data = getTriggerData(this.tokenDoc);
        const currentList = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
        currentList.push(newBehavior);
        await this._saveChanges({ [listKey]: currentList });
      },
    }).render(true);
  }

  _onEditBehavior(tab, index) {
    const listKey = this._getBehaviorListKey(tab);
    if (!listKey) return;
    const data = getTriggerData(this.tokenDoc);
    const currentList = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
    const target = currentList[index];
    if (!target) return;

    new BehaviorEditorDialog({
      config: target,
      onSave: async (updated) => {
        currentList[index] = updated;
        await this._saveChanges({ [listKey]: currentList });
      },
    }).render(true);
  }

  async _onDeleteBehavior(tab, index) {
    const listKey = this._getBehaviorListKey(tab);
    if (!listKey) return;
    const data = getTriggerData(this.tokenDoc);
    const currentList = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
    currentList.splice(index, 1);
    await this._saveChanges({ [listKey]: currentList });
  }

  async _onMoveBehavior(tab, index, direction) {
    const listKey = this._getBehaviorListKey(tab);
    if (!listKey) return;
    const data = getTriggerData(this.tokenDoc);
    const currentList = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;

    const temp = currentList[index];
    currentList[index] = currentList[targetIdx];
    currentList[targetIdx] = temp;

    await this._saveChanges({ [listKey]: currentList });
  }

  /**
   * Handle form submission — save general trigger settings back to token flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    const changes = {};
    if ("anchorRadius" in data) changes.anchorRadius = Number(data.anchorRadius) || 0;
    if ("enabled" in data) changes.enabled = Boolean(data.enabled);
    if ("passThrough" in data) changes.passThrough = Boolean(data.passThrough);
    await this._saveChanges(changes);
  }
}
