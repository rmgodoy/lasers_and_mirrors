import { MODULE_ID, TRIGGER_DEFAULTS, BEHAVIOR_TYPES } from "../constants.mjs";
import { getTriggerData, updateTriggerData } from "../trigger-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";
import { BehaviorRegistry } from "../behaviors/behavior-registry.mjs";
import { BehaviorClipboard } from "../behaviors/behavior-clipboard.mjs";
import { BehaviorEditorDialog } from "./behavior-editor-dialog.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Actor sheet for Trigger actors with tabbed interface and behavior management.
 */
export class TriggerActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  constructor(options = {}) {
    super(options);
    this.activeTab = "general";
  }

  static DEFAULT_OPTIONS = {
    classes: ["lasers-and-mirrors-sheet"],
    position: { width: 800, height: 600 },
    window: {
      resizable: true,
    },
    form: {
      handler: TriggerActorSheet.onSubmit,
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
    return `${game.i18n.localize("LAM.sheets.trigger.title")}: ${this.document.name}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const tokenDoc = this.document.token;
    const data = tokenDoc ? getTriggerData(tokenDoc) : (this.document.system ?? {});
    const hasClipboard = BehaviorClipboard.hasClipboard;

    context.activeTab = this.activeTab ?? "general";
    context.anchorRadius = data.anchorRadius ?? TRIGGER_DEFAULTS.anchorRadius;
    context.enabled = data.enabled ?? TRIGGER_DEFAULTS.enabled;
    context.passThrough = data.passThrough ?? TRIGGER_DEFAULTS.passThrough;
    context.hasClipboard = hasClipboard;
    context.clipboardSummary = hasClipboard ? BehaviorClipboard.getSummary() : "";
    context.clipboardIcon = hasClipboard ? BehaviorClipboard.getIcon() : "";
    context.clipboardTypeLabel = hasClipboard ? BehaviorClipboard.getTypeLabel() : "";
    context.hasTriggerClipboard = BehaviorClipboard.hasTriggerClipboard;
    context.triggerClipboardSummary = BehaviorClipboard.hasTriggerClipboard ? BehaviorClipboard.getTriggerSummary() : "";

    // Prepare behavior cards with summaries and icons
    context.behaviorsEnter = this._enrichBehaviors(data.behaviorsEnter);
    context.behaviorsStay = this._enrichBehaviors(data.behaviorsStay);
    context.behaviorsExit = this._enrichBehaviors(data.behaviorsExit);
    context.behaviorsHitChange = this._enrichBehaviors(data.behaviorsHitChange);

    return context;
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
        const tab = e.currentTarget.dataset.tab; // "enter", "stay", "exit", or "hitChange"
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
        const direction = e.currentTarget.dataset.direction; // "up" or "down"
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

  _getTriggerData() {
    const tokenDoc = this.document.token;
    return tokenDoc ? getTriggerData(tokenDoc) : (this.document.system ?? {});
  }

  async _saveChanges(changes) {
    if (this.document.isToken && this.document.token) {
      await updateTriggerData(this.document.token, changes);
    } else {
      await this.document.update({
        system: changes,
        [`prototypeToken.flags.${MODULE_ID}`]: { ...TRIGGER_DEFAULTS, ...changes },
      });
      const linkedTokens = canvas.scene?.tokens?.filter(t => t.actorId === this.document.id && t.isLinked);
      if (linkedTokens) {
        for (const tDoc of linkedTokens) {
          await updateTriggerData(tDoc, changes);
        }
      }
    }
    refreshBeams();
    this.render();
  }

  _onCopyTriggerConfig() {
    const data = this._getTriggerData();
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
        const data = this._getTriggerData();
        const currentList = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
        currentList.push(newBehavior);
        await this._saveChanges({ [listKey]: currentList });
      },
    }).render(true);
  }

  _onCopyBehavior(tab, index) {
    const listKey = this._getBehaviorListKey(tab);
    if (!listKey) return;
    const data = this._getTriggerData();
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

    const data = this._getTriggerData();
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
    const data = this._getTriggerData();
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
    const data = this._getTriggerData();
    const currentList = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
    currentList.splice(index, 1);
    await this._saveChanges({ [listKey]: currentList });
  }

  async _onMoveBehavior(tab, index, direction) {
    const listKey = this._getBehaviorListKey(tab);
    if (!listKey) return;
    const data = this._getTriggerData();
    const currentList = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;

    const temp = currentList[index];
    currentList[index] = currentList[targetIdx];
    currentList[targetIdx] = temp;

    await this._saveChanges({ [listKey]: currentList });
  }

  /**
   * Handle form submission — save general settings.
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
