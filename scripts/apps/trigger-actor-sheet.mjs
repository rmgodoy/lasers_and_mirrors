import { MODULE_ID } from "../constants.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Actor sheet for Trigger actors (opened from Actors sidebar or token double-click).
 * Reads/writes from actor.system (the TypeDataModel).
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
    const sys = this.document.system;
    context.enabled = sys.enabled;
    context.passThrough = sys.passThrough;
    context.onBeamHit = sys.onBeamHit;
    context.onBeamStay = sys.onBeamStay;
    context.onBeamLost = sys.onBeamLost;
    return context;
  }

  /**
   * Handle form submission — save data to actor.system.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.enabled = Boolean(data.enabled);
    data.passThrough = Boolean(data.passThrough);
    data.onBeamHit = data.onBeamHit ?? "";
    data.onBeamStay = data.onBeamStay ?? "";
    data.onBeamLost = data.onBeamLost ?? "";
    await this.document.update({ system: data });
    refreshBeams();
  }
}
