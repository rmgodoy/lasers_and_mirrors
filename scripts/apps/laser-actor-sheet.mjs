import { MODULE_ID } from "../constants.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Actor sheet for Laser actors (opened from Actors sidebar or token double-click).
 * Reads/writes from actor.system (the TypeDataModel).
 */
export class LaserActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["lasers-and-mirrors-sheet"],
    position: { width: 380, height: "auto" },
    window: {
      resizable: true,
    },
    form: {
      handler: LaserActorSheet.onSubmit,
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
   * Handle form submission — save data to actor.system.
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
    refreshBeams();
  }
}
