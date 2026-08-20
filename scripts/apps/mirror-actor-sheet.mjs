import { MODULE_ID, MIRROR_DEFAULTS } from "../constants.mjs";
import { getMirrorData, updateMirrorData } from "../mirror-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Actor sheet for Mirror actors (opened from Actors sidebar or token double-click).
 * Reads/writes from actor.system (the TypeDataModel) and syncs to canvas tokens.
 */
export class MirrorActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["lasers-and-mirrors-sheet"],
    position: { width: 380, height: "auto" },
    window: {
      resizable: true,
    },
    form: {
      handler: MirrorActorSheet.onSubmit,
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
    return `${game.i18n.localize(game.user.isGM ? "LAM.sheets.mirror.title" : "LAM.sheets.mirrorPlayer.title")}: ${this.document.name}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const tokenDoc = this.document.token;
    const data = tokenDoc ? getMirrorData(tokenDoc) : (this.document.system ?? {});
    context.isGM = game.user.isGM;
    context.color = data.color ?? MIRROR_DEFAULTS.color;
    context.width = data.width ?? MIRROR_DEFAULTS.width;
    context.orientation = data.orientation ?? MIRROR_DEFAULTS.orientation;
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
   * Handle form submission — save data to actor.system and active token(s).
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    if ("width" in data) data.width = Number(data.width);
    const newOrientation = Number(data.orientation);
    data.orientation = newOrientation;
    await this.document.update({ system: data });

    // Sync token rotation if this actor is a token synthetic actor or has a token on scene
    let tokenDoc = this.document.token;
    if (!tokenDoc) {
      const controlled = canvas.tokens?.controlled?.find(t => t.actor?.id === this.document.id);
      tokenDoc = controlled?.document ?? this.document.getActiveTokens(true, true)?.[0] ?? this.document.getActiveTokens()[0]?.document;
    }
    if (tokenDoc) {
      await updateMirrorData(tokenDoc, data);
    } else {
      const sceneTokens = canvas.scene?.tokens?.filter(t => t.actorId === this.document.id);
      if (sceneTokens) {
        for (const tDoc of sceneTokens) {
          await updateMirrorData(tDoc, data);
        }
      }
    }

    refreshBeams();
  }
}

