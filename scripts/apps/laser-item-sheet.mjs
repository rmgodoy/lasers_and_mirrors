import { MODULE_ID } from "../constants.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Item sheet for Laser items (opened from Items sidebar).
 * Reads/writes from item.system (the TypeDataModel).
 */
export class LaserItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["lasers-and-mirrors-sheet"],
    position: { width: 380, height: "auto" },
    window: {
      resizable: true,
    },
    form: {
      handler: LaserItemSheet.onSubmit,
      closeOnSubmit: false,
      submitOnChange: true,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/laser-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return `${game.i18n.localize("LAM.sheets.laser.title")}: ${this.document.name}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    context.color = sys.color;
    context.width = sys.width;
    context.range = sys.range;
    context.intensity = sys.intensity;
    context.visible = sys.visible;
    context.interactable = sys.interactable;
    context.attachable = sys.attachable;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = e.target.value;
        }
      });
    });
  }

  /**
   * Handle form submission — save data to item.system.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.visible = Boolean(data.visible);
    data.interactable = Boolean(data.interactable);
    data.attachable = Boolean(data.attachable);
    data.width = Number(data.width);
    data.range = Number(data.range);
    data.intensity = Number(data.intensity);
    await this.document.update({ system: data });
  }
}
