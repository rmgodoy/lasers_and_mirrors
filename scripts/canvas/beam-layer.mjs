import { MODULE_ID } from "../constants.mjs";
import { BeamRenderer } from "./beam-renderer.mjs";
import { traceAllBeams } from "../physics/ray-caster.mjs";
import { getAllMirrors, getMirrorData } from "../mirror-data.mjs";
import { getTokenCenter } from "../utils/token-helpers.mjs";
const CanvasLayer = foundry.canvas.layers.CanvasLayer ?? globalThis.CanvasLayer;

/**
 * Custom CanvasLayer that renders all laser beams.
 * Added to canvas.interface so beams draw above tokens.
 */
export class BeamLayer extends CanvasLayer {

  /**
   * PIXI container holding all beam graphics.
   * @type {PIXI.Container|null}
   */
  beamContainer = null;

  /**
   * The renderer instance that draws PIXI graphics.
   * @type {BeamRenderer|null}
   */
  renderer = null;

  /**
   * Debounce timer ID for refresh calls.
   * @type {number|null}
   */
  _refreshTimer = null;

  /** @override */
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: "beams",
      zIndex: 500
    });
  }

  /** @override */
  async _draw(options) {
    await super._draw(options);
    this.beamContainer = new PIXI.Container();
    this.addChild(this.beamContainer);
    this.renderer = new BeamRenderer(this.beamContainer);
    this.refresh();
  }

  /** @override */
  async _tearDown(options) {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this.beamContainer) {
      this.beamContainer.destroy({ children: true });
      this.beamContainer = null;
    }
    this.renderer = null;
    await super._tearDown(options);
  }

  /**
   * Refresh all beam rendering. Debounced to avoid excessive redraws.
   * Call this whenever tokens move, rotate, or flags change.
   */
  refresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this._doRefresh(), 16);
  }

  /**
   * Internal: perform the actual refresh.
   */
  _doRefresh() {
    if (!this.renderer || !this.beamContainer) return;
    const maxBounces = game.settings.get(MODULE_ID, "maxBounces");
    const beamGroups = traceAllBeams(maxBounces);
    const opacity = game.settings.get(MODULE_ID, "beamOpacity");
    const glow = game.settings.get(MODULE_ID, "glowEffect");
    this.renderer.draw(beamGroups, { opacity, glow });

    const mirrorTokens = getAllMirrors();
    const mirrorsInfo = mirrorTokens.map(t => {
      const data = getMirrorData(t.document);
      return {
        center: getTokenCenter(t),
        orientation: data.orientation,
        width: data.width
      };
    });
    this.renderer.drawMirrors(mirrorsInfo);
  }
}

/**
 * The singleton BeamLayer instance. Set when the layer is created.
 * @type {BeamLayer|null}
 */
export let beamLayer = null;

/**
 * Initialize the beam layer and add it to the canvas.
 * Call this from the `canvasReady` hook.
 */
export async function initBeamLayer() {
  if (beamLayer) {
    beamLayer.destroy({ children: true });
  }
  beamLayer = new BeamLayer();
  canvas.interface.addChild(beamLayer);
  await beamLayer.draw();
}

/**
 * Trigger a beam refresh if the layer exists.
 * Safe to call from any hook.
 */
export function refreshBeams() {
  if (beamLayer) beamLayer.refresh();
}
