import { MODULE_ID } from "../constants.mjs";
import { getLaserData, updateLaserData } from "../laser-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token config popup for Laser tokens (opened from Token HUD).
 * Reads/writes token flags — NOT an Item sheet.
 */
export class LaserTokenConfigSheet extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {TokenDocument} tokenDoc - the token document to configure
   * @param {object} options
   */
  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
  }

  static DEFAULT_OPTIONS = {
    id: "laser-token-config-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.laser.title",
      resizable: true,
    },
    position: { width: 380, height: "auto" },
    form: {
      handler: LaserTokenConfigSheet.onSubmit,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/laser-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return game.i18n.localize("LAM.sheets.laser.title");
  }

  /** @override */
  async _prepareContext(options) {
    const data = getLaserData(this.tokenDoc);
    return {
      color: data.color,
      width: data.width,
      range: data.range,
      intensity: data.intensity,
      visible: data.visible,
      interactable: data.interactable,
      attachable: data.attachable,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = e.target.name === "orientation" ? `${e.target.value}°` : e.target.value;
        }
      });
    });
  }

  /**
   * Handle form submission — save laser data back to token flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.visible = Boolean(data.visible);
    data.interactable = Boolean(data.interactable);
    data.attachable = Boolean(data.attachable);
    data.width = Number(data.width);
    data.range = Number(data.range);
    data.intensity = Number(data.intensity);
    await updateLaserData(this.tokenDoc, data);
    refreshBeams();
  }
}
