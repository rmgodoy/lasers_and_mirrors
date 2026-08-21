import { MODULE_ID } from "../constants.mjs";
import { getLaserData, updateLaserData } from "../laser-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";
import { getArcDescription } from "../utils/angle-limits.mjs";

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
    return game.i18n.localize("LAM.sheets.laser.title");
  }

  /** @override */
  async _prepareContext(options) {
    const data = getLaserData(this.tokenDoc);
    const minDeg = data.minDeg ?? 0;
    const maxDeg = data.maxDeg ?? 360;
    const currentOrientation = this.tokenDoc?.rotation ?? data.orientation ?? 0;
    return {
      color: data.color,
      width: data.width,
      range: data.range,
      intensity: data.intensity,
      orientation: currentOrientation,
      anchorRadius: data.anchorRadius ?? 0,
      visible: data.visible,
      emitLight: data.emitLight ?? true,
      lightRadius: data.lightRadius ?? 1,
      providesVision: data.providesVision ?? false,
      interactable: data.interactable,
      interactionRange: data.interactionRange ?? 1,
      attachable: data.attachable,
      limitRotation: data.limitRotation ?? false,
      minDeg,
      maxDeg,
      arcSummary: getArcDescription(minDeg, maxDeg),
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Live range value indicators
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = e.target.name === "orientation" ? `${e.target.value}°` : e.target.value;
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
      return this.tokenDoc?.rotation ?? getLaserData(this.tokenDoc).orientation ?? 0;
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
   * Handle form submission — save laser data back to token flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.visible = Boolean(data.visible);
    data.emitLight = Boolean(data.emitLight);
    data.providesVision = Boolean(data.providesVision);
    data.interactable = Boolean(data.interactable);
    if ("interactionRange" in data) data.interactionRange = Math.max(1, Number(data.interactionRange) || 1);
    data.attachable = Boolean(data.attachable);
    data.limitRotation = Boolean(data.limitRotation);
    data.width = Number(data.width);
    data.range = Number(data.range);
    data.intensity = Number(data.intensity);
    if ("lightRadius" in data) data.lightRadius = Number(data.lightRadius);
    if ("orientation" in data) data.orientation = Number(data.orientation);
    if ("anchorRadius" in data) data.anchorRadius = Number(data.anchorRadius) || 0;
    if ("minDeg" in data) data.minDeg = Number(data.minDeg);
    if ("maxDeg" in data) data.maxDeg = Number(data.maxDeg);

    await updateLaserData(this.tokenDoc, data);
    refreshBeams();
  }

}
