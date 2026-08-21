import { MODULE_ID, MIRROR_DEFAULTS } from "../constants.mjs";
import { getMirrorData, updateMirrorData } from "../mirror-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";
import { getArcDescription } from "../utils/angle-limits.mjs";

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
    const minDeg = data.minDeg ?? MIRROR_DEFAULTS.minDeg;
    const maxDeg = data.maxDeg ?? MIRROR_DEFAULTS.maxDeg;
    const currentOrientation = tokenDoc?.rotation ?? this.document.prototypeToken?.rotation ?? data.orientation ?? MIRROR_DEFAULTS.orientation;

    context.isGM = game.user.isGM;
    context.color = data.color ?? MIRROR_DEFAULTS.color;
    context.width = data.width ?? MIRROR_DEFAULTS.width;
    context.orientation = currentOrientation;
    context.anchorRadius = data.anchorRadius ?? MIRROR_DEFAULTS.anchorRadius;
    context.twoSided = data.twoSided ?? MIRROR_DEFAULTS.twoSided;
    context.interactable = data.interactable ?? MIRROR_DEFAULTS.interactable;
    context.interactionRange = data.interactionRange ?? MIRROR_DEFAULTS.interactionRange;
    context.attachable = data.attachable ?? MIRROR_DEFAULTS.attachable;
    context.limitRotation = data.limitRotation ?? MIRROR_DEFAULTS.limitRotation;
    context.minDeg = minDeg;
    context.maxDeg = maxDeg;
    context.arcSummary = getArcDescription(minDeg, maxDeg);
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Live range value indicators
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

    // Arc summary updater
    const arcSummarySpan = this.element.querySelector(".lam-arc-summary");
    const minInput = this.element.querySelector('input[name="minDeg"]');
    const maxInput = this.element.querySelector('input[name="maxDeg"]');

    const updateArcSummary = () => {
      if (!arcSummarySpan || !minInput || !maxInput) return;
      const min = Number(minInput.value || 0);
      const max = Number(maxInput.value || 0);
      arcSummarySpan.textContent = getArcDescription(min, max);
    };

    minInput?.addEventListener("input", updateArcSummary);
    maxInput?.addEventListener("input", updateArcSummary);

    const getCurrentOrientation = () => {
      const oriInput = this.element.querySelector('input[name="orientation"]');
      if (oriInput && oriInput.value !== "") {
        return Number(oriInput.value);
      }
      const tDoc = this.document.token;
      return tDoc?.rotation ?? this.document.prototypeToken?.rotation ?? (tDoc ? getMirrorData(tDoc).orientation : (this.document.system?.orientation ?? 0));
    };

    // Set Current as Min Button
    this.element.querySelector('[data-action="setCurrentMin"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentOri = getCurrentOrientation();
      if (minInput) {
        minInput.value = currentOri;
        updateArcSummary();
        this.element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    // Set Current as Max Button
    this.element.querySelector('[data-action="setCurrentMax"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentOri = getCurrentOrientation();
      if (maxInput) {
        maxInput.value = currentOri;
        updateArcSummary();
        this.element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    // Flip Allowed Side Button (swaps Min and Max angles)
    this.element.querySelector('[data-action="flipLimits"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (minInput && maxInput) {
        const temp = minInput.value;
        minInput.value = maxInput.value;
        maxInput.value = temp;
        updateArcSummary();
        this.element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  /**
   * Handle form submission — save data to actor.system and active token(s).
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    if ("width" in data) data.width = Number(data.width);
    if ("orientation" in data) data.orientation = Number(data.orientation);
    if ("anchorRadius" in data) data.anchorRadius = Number(data.anchorRadius) || 0;
    data.twoSided = Boolean(data.twoSided);
    data.interactable = Boolean(data.interactable);
    if ("interactionRange" in data) data.interactionRange = Math.max(1, Number(data.interactionRange) || 1);
    data.attachable = Boolean(data.attachable);
    data.limitRotation = Boolean(data.limitRotation);
    if ("minDeg" in data) data.minDeg = Number(data.minDeg);
    if ("maxDeg" in data) data.maxDeg = Number(data.maxDeg);

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


