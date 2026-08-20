import { MODULE_ID, TRIGGER_DEFAULTS } from "../constants.mjs";
import { getTriggerData, updateTriggerData } from "../trigger-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Actor sheet for Trigger actors (opened from Actors sidebar or token double-click).
 * Reads/writes from actor.system (the TypeDataModel) and syncs to canvas tokens.
 */
export class TriggerActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["lasers-and-mirrors-sheet"],
    position: { width: 480, height: "auto" },
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
    context.enabled = data.enabled ?? TRIGGER_DEFAULTS.enabled;
    context.passThrough = data.passThrough ?? TRIGGER_DEFAULTS.passThrough;
    context.onBeamHit = data.onBeamHit ?? TRIGGER_DEFAULTS.onBeamHit;
    context.onBeamStay = data.onBeamStay ?? TRIGGER_DEFAULTS.onBeamStay;
    context.onBeamLost = data.onBeamLost ?? TRIGGER_DEFAULTS.onBeamLost;
    return context;
  }

  /**
   * Handle form submission — save data to actor.system and active token(s).
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.enabled = Boolean(data.enabled);
    data.passThrough = Boolean(data.passThrough);
    data.onBeamHit = data.onBeamHit ?? "";
    data.onBeamStay = data.onBeamStay ?? "";
    data.onBeamLost = data.onBeamLost ?? "";
    await this.document.update({ system: data });

    // Sync token(s) if this actor is a token synthetic actor or has a token on scene
    let tokenDoc = this.document.token;
    if (!tokenDoc) {
      const controlled = canvas.tokens?.controlled?.find(t => t.actor?.id === this.document.id);
      tokenDoc = controlled?.document ?? this.document.getActiveTokens(true, true)?.[0] ?? this.document.getActiveTokens()[0]?.document;
    }
    if (tokenDoc) {
      await updateTriggerData(tokenDoc, data);
    } else {
      const sceneTokens = canvas.scene?.tokens?.filter(t => t.actorId === this.document.id);
      if (sceneTokens) {
        for (const tDoc of sceneTokens) {
          await updateTriggerData(tDoc, data);
        }
      }
    }

    refreshBeams();
  }
}

