import { MODULE_ID } from "../constants.mjs";
import { getTriggerData, updateTriggerData } from "../trigger-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token config popup for Trigger tokens (opened from Token HUD).
 * Reads/writes token flags — NOT an Item sheet.
 */
export class TriggerTokenConfigSheet extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {TokenDocument} tokenDoc - the token document to configure
   * @param {object} options
   */
  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
  }

  static DEFAULT_OPTIONS = {
    id: "trigger-token-config-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.trigger.title",
      resizable: true,
    },
    position: { width: 480, height: "auto" },
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
      enabled: data.enabled,
      passThrough: data.passThrough,
      onBeamHit: data.onBeamHit,
      onBeamStay: data.onBeamStay,
      onBeamLost: data.onBeamLost,
    };
  }

  /**
   * Handle form submission — save trigger data back to token flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.enabled = Boolean(data.enabled);
    data.passThrough = Boolean(data.passThrough);
    data.onBeamHit = data.onBeamHit ?? "";
    data.onBeamStay = data.onBeamStay ?? "";
    data.onBeamLost = data.onBeamLost ?? "";
    await updateTriggerData(this.tokenDoc, data);
    refreshBeams();
  }
}
