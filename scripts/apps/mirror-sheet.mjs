import { MODULE_ID } from "../constants.mjs";
import { getMirrorData, updateMirrorData } from "../mirror-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token config popup for Mirror tokens (opened from Token HUD).
 * Reads/writes token flags — NOT an Item sheet.
 */
export class MirrorTokenConfigSheet extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {TokenDocument} tokenDoc - the token document to configure
   * @param {object} options
   */
  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
  }

  static DEFAULT_OPTIONS = {
    id: "mirror-token-config-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.mirror.title",
      resizable: true,
    },
    position: { width: 380, height: "auto" },
    form: {
      handler: MirrorTokenConfigSheet.onSubmit,
      closeOnSubmit: false,
      submitOnChange: true,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/mirror-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return game.i18n.localize("LAM.sheets.mirror.title");
  }

  /** @override */
  async _prepareContext(options) {
    const data = getMirrorData(this.tokenDoc);
    return {
      isGM: true,
      color: data.color,
      width: data.width,
      orientation: data.orientation ?? this.tokenDoc?.rotation ?? 0,
      interactable: data.interactable ?? true,
      attachable: data.attachable ?? false,
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
   * Handle form submission — save mirror data back to token flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    if ("width" in data) data.width = Number(data.width);
    if ("orientation" in data) data.orientation = Number(data.orientation);
    data.interactable = Boolean(data.interactable);
    data.attachable = Boolean(data.attachable);
    await updateMirrorData(this.tokenDoc, data);
    refreshBeams();
  }
}
