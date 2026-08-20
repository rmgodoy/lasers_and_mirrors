import { MODULE_ID, LASER_DEFAULTS } from "../constants.mjs";
import { getLaserData, updateLaserData } from "../laser-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Actor sheet for Laser actors (opened from Actors sidebar or token double-click).
 * Reads/writes from actor.system (the TypeDataModel) and syncs to canvas tokens.
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
    const tokenDoc = this.document.token;
    const data = tokenDoc ? getLaserData(tokenDoc) : (this.document.system ?? {});
    context.color = data.color ?? LASER_DEFAULTS.color;
    context.width = data.width ?? LASER_DEFAULTS.width;
    context.range = data.range ?? LASER_DEFAULTS.range;
    context.intensity = data.intensity ?? LASER_DEFAULTS.intensity;
    context.visible = data.visible ?? LASER_DEFAULTS.visible;
    context.interactable = data.interactable ?? LASER_DEFAULTS.interactable;
    context.attachable = data.attachable ?? LASER_DEFAULTS.attachable;
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
   * Handle form submission — save data to actor.system and active token(s).
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

    // Sync token(s) if this actor is a token synthetic actor or has a token on scene
    let tokenDoc = this.document.token;
    if (!tokenDoc) {
      const controlled = canvas.tokens?.controlled?.find(t => t.actor?.id === this.document.id);
      tokenDoc = controlled?.document ?? this.document.getActiveTokens(true, true)?.[0] ?? this.document.getActiveTokens()[0]?.document;
    }
    if (tokenDoc) {
      await updateLaserData(tokenDoc, data);
    } else {
      const sceneTokens = canvas.scene?.tokens?.filter(t => t.actorId === this.document.id);
      if (sceneTokens) {
        for (const tDoc of sceneTokens) {
          await updateLaserData(tDoc, data);
        }
      }
    }

    refreshBeams();
  }
}

