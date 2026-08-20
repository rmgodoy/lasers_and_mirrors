import { MODULE_ID } from "../constants.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Item sheet for Mirror items (opened from Items sidebar).
 * Reads/writes from item.system (the TypeDataModel).
 */
export class MirrorItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["lasers-and-mirrors-sheet"],
    position: { width: 380, height: "auto" },
    window: {
      resizable: true,
    },
    form: {
      handler: MirrorItemSheet.onSubmit,
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
    return `${game.i18n.localize("LAM.sheets.mirror.title")}: ${this.document.name}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    context.color = sys.color;
    context.width = sys.width;
    context.orientation = sys.orientation;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = e.target.name === "orientation"
            ? `${e.target.value}°`
            : e.target.value;
        }
      });
    });
  }

  /**
   * Handle form submission — save data to item.system.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.width = Number(data.width);
    data.orientation = Number(data.orientation);
    await this.document.update({ system: data });
  }
}
