import { MODULE_ID } from "../constants.mjs";
import { getMirrorData, updateMirrorData } from "../mirror-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const ItemSheetV2 = foundry.applications.sheets?.ItemSheetV2 ?? ApplicationV2;

export class MirrorSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /**
   * @param {TokenDocument|ItemDocument|object} docOrOptions
   * @param {object} options
   */
  constructor(docOrOptions = {}, options = {}) {
    let opts = options;
    if (docOrOptions instanceof foundry.abstract.Document) {
      opts = { ...options, document: docOrOptions };
    } else {
      opts = docOrOptions;
    }
    super(opts);
  }

  static DEFAULT_OPTIONS = {
    id: "mirror-sheet-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.mirror.title",
      resizable: true,
    },
    position: { width: 380, height: "auto" },
    form: {
      handler: MirrorSheet.onSubmit,
      closeOnSubmit: true,
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
    const data = getMirrorData(this.document);
    return {
      color: data.color,
      width: data.width,
      orientation: data.orientation,
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
   * Handle form submission — save mirror data back to document flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.width = Number(data.width);
    data.orientation = Number(data.orientation);
    await updateMirrorData(this.document, data);
    refreshBeams();
  }
}
