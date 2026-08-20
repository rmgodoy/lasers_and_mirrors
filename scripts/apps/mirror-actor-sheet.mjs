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
    context.twoSided = data.twoSided ?? MIRROR_DEFAULTS.twoSided;
    context.interactable = data.interactable ?? MIRROR_DEFAULTS.interactable;
    context.attachable = data.attachable ?? MIRROR_DEFAULTS.attachable;
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
    if ("orientation" in data) data.orientation = Number(data.orientation);
    data.twoSided = Boolean(data.twoSided);
    data.interactable = Boolean(data.interactable);
    data.attachable = Boolean(data.attachable);

    if (this.document.isToken && this.document.token) {
      // Unlinked synthetic token sheet: update ONLY this token
      await updateMirrorData(this.document.token, data);
    } else {
      // Base World Actor sheet (sidebar): update actor system & prototypeToken defaults
      const updatePayload = {
        system: data,
        [`prototypeToken.flags.${MODULE_ID}`]: { ...MIRROR_DEFAULTS, ...data },
      };
      const currentActorImg = this.document.img ?? "";
      const isDefaultActorImg = !currentActorImg ||
        currentActorImg.endsWith("/assets/mirror.svg") ||
        currentActorImg.endsWith("/assets/mirror-two-sided.svg") ||
        currentActorImg === "icons/svg/mystery-man.svg";
      if (isDefaultActorImg) {
        const newImg = data.twoSided
          ? `modules/${MODULE_ID}/assets/mirror-two-sided.svg`
          : `modules/${MODULE_ID}/assets/mirror.svg`;
        updatePayload.img = newImg;
        updatePayload["prototypeToken.texture.src"] = newImg;
      }
      await this.document.update(updatePayload);
      // Only sync linked tokens on scene
      const linkedTokens = canvas.scene?.tokens?.filter(t => t.actorId === this.document.id && t.isLinked);
      if (linkedTokens) {
        for (const tDoc of linkedTokens) {
          await updateMirrorData(tDoc, data);
        }
      }
    }

    refreshBeams();
  }
}


