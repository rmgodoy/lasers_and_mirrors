import { MODULE_ID, BEHAVIOR_TYPES } from "../constants.mjs";
import { getTriggerData, updateTriggerData } from "../trigger-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";
import { BehaviorRegistry } from "../behaviors/behavior-registry.mjs";
import { BehaviorClipboard } from "../behaviors/behavior-clipboard.mjs";
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
    position: { width: 800, height: 600 },
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
    const hasClipboard = BehaviorClipboard.hasClipboard;
    const hasTriggerClipboard = BehaviorClipboard.hasTriggerClipboard;
    return {
      activeTab: this.activeTab ?? "general",
      anchorRadius: data.anchorRadius ?? 0,
      enabled: data.enabled,
      passThrough: data.passThrough,
      hasClipboard,
      clipboardSummary: hasClipboard ? BehaviorClipboard.getSummary() : "",
      clipboardIcon: hasClipboard ? BehaviorClipboard.getIcon() : "",
      clipboardTypeLabel: hasClipboard ? BehaviorClipboard.getTypeLabel() : "",
      hasTriggerClipboard,
      triggerClipboardSummary: hasTriggerClipboard ? BehaviorClipboard.getTriggerSummary() : "",
      behaviorsEnter: this._enrichBehaviors(data.behaviorsEnter),
      behaviorsStay: this._enrichBehaviors(data.behaviorsStay),
      behaviorsExit: this._enrichBehaviors(data.behaviorsExit),
      behaviorsHitChange: this._enrichBehaviors(data.behaviorsHitChange),
    };
  }

  _enrichBehaviors(list) {
    if (!Array.isArray(list)) return [];
    return list.map(b => {
      const isBranching = b.type === BEHAVIOR_TYPES.CONDITIONAL || b.type === BEHAVIOR_TYPES.CHECK_TRIGGERS;
      const elseBehaviors = Array.isArray(b.elseBehaviors) ? b.elseBehaviors : [];
      const hasElse = b.onFalse === "execute_else" && elseBehaviors.length > 0;
      const enrichedElseBehaviors = hasElse ? this._enrichBehaviors(elseBehaviors) : [];

      return {
        ...b,
        summary: BehaviorRegistry.getSummary(b),
        icon: BehaviorRegistry.getIcon(b.type),
        typeLabel: BehaviorRegistry.getLabel(b.type),
        isBranching,
        hasElse,
        isElseStop: (b.onFalse ?? "stop") === "stop",
        enrichedElseBehaviors,
      };
    });
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

    // Copy Full Trigger Config
    this.element.querySelectorAll('[data-action="copyTriggerConfig"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this._onCopyTriggerConfig();
      });
    });

    // Paste Full Trigger Config
    this.element.querySelectorAll('[data-action="pasteTriggerConfig"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this._onPasteTriggerConfig();
      });
    });

    // Add Behavior
    this.element.querySelectorAll('[data-action="addBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        this._onAddBehavior(tab);
      });
    });

    // Copy Behavior
    this.element.querySelectorAll('[data-action="copyBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        const index = Number(e.currentTarget.dataset.index);
        this._onCopyBehavior(tab, index);
      });
    });

    // Paste Behavior
    this.element.querySelectorAll('[data-action="pasteBehavior"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        this._onPasteBehavior(tab);
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
    if (tab === "hitChange" || tab === "hitChanged") return "behaviorsHitChange";
    return null;
  }

  async _saveChanges(changes) {
    await updateTriggerData(this.tokenDoc, changes);
    refreshBeams();
    this.render();
  }

  _onCopyTriggerConfig() {
    const data = getTriggerData(this.tokenDoc);
    BehaviorClipboard.copyTrigger(data);
    ui.notifications?.info?.(game.i18n.localize("LAM.notify.triggerConfigCopied"));
    this.render();
  }

  async _onPasteTriggerConfig() {
    const pasted = BehaviorClipboard.pasteTrigger();
    if (!pasted) {
      ui.notifications?.warn?.(game.i18n.localize("LAM.notify.noTriggerInClipboard"));
      return;
    }
    await this._saveChanges(pasted);
    ui.notifications?.info?.(game.i18n.localize("LAM.notify.triggerConfigPasted"));
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

  _onCopyBehavior(tab, index) {
    const listKey = this._getBehaviorListKey(tab);
    if (!listKey) return;
    const data = getTriggerData(this.tokenDoc);
    const currentList = Array.isArray(data[listKey]) ? data[listKey] : [];
    const target = currentList[index];
    if (!target) return;

    BehaviorClipboard.copy(target);
    const summary = BehaviorRegistry.getSummary(target) || BehaviorRegistry.getLabel(target.type);
    ui.notifications?.info?.(game.i18n.format("LAM.notify.behaviorCopied", { name: summary }));
    this.render();
  }

  async _onPasteBehavior(tab) {
    const listKey = this._getBehaviorListKey(tab);
    if (!listKey) return;
    const pasted = BehaviorClipboard.paste();
    if (!pasted) {
      ui.notifications?.warn?.(game.i18n.localize("LAM.notify.noBehaviorInClipboard"));
      return;
    }

    const data = getTriggerData(this.tokenDoc);
    const currentList = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
    currentList.push(pasted);
    await this._saveChanges({ [listKey]: currentList });

    const summary = BehaviorRegistry.getSummary(pasted) || BehaviorRegistry.getLabel(pasted.type);
    const tabLabel = game.i18n.localize(`LAM.tabs.${tab}`);
    ui.notifications?.info?.(game.i18n.format("LAM.notify.behaviorPasted", { name: summary, tab: tabLabel }));
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
