import { MODULE_ID } from "../constants.mjs";
import { getMirrorData, updateMirrorData } from "../mirror-data.mjs";
import { areTokensAdjacent, getPlayerToken } from "../utils/token-helpers.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MirrorPlayerSheet extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {TokenDocument} tokenDoc - the token document to configure
   * @param {object} options
   */
  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
  }

  static DEFAULT_OPTIONS = {
    id: "mirror-player-sheet-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.mirrorPlayer.title",
      resizable: false,
    },
    position: { width: 320, height: "auto" },
    form: {
      handler: MirrorPlayerSheet.onSubmit,
      closeOnSubmit: false,
      submitOnChange: true,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/mirror-player-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return game.i18n.localize("LAM.sheets.mirrorPlayer.title");
  }

  /** @override */
  async _prepareContext(options) {
    const data = getMirrorData(this.tokenDoc);
    return { orientation: data.orientation ?? this.tokenDoc?.rotation ?? 0 };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = `${e.target.value}°`;
        }
      });
    });
  }

  /**
   * Handle form submission — save orientation back to token flags and rotation.
   */
  static async onSubmit(event, form, formData) {
    const { orientation } = formData.object;
    const newOrientation = Number(orientation);

    // If non-GM, enforce adjacency requirement
    if (!game.user.isGM) {
      const playerToken = getPlayerToken();
      const mirrorToken = this.tokenDoc?.object ?? canvas.tokens?.get(this.tokenDoc?.id);
      if (!playerToken || (mirrorToken && !areTokensAdjacent(playerToken, mirrorToken))) {
        ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
        return;
      }
    }

    await updateMirrorData(this.tokenDoc, { orientation: newOrientation });
    refreshBeams();
  }
}
