import { MODULE_ID } from "../constants.mjs";
import { BeamRenderer } from "./beam-renderer.mjs";
import { traceAllBeams } from "../physics/ray-caster.mjs";
import { laserLightManager } from "./beam-lights.mjs";

const CanvasLayer = foundry.canvas.layers?.CanvasLayer ?? globalThis.CanvasLayer ?? PIXI.Container;

/**
 * Custom CanvasLayer that renders all laser beams.
 * Mounted in canvas.effects so beam graphics are masked by Fog of War
 * without incurring PrimaryCanvasGroup depth buffer snapshot overhead.
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

  /**
   * Set of trigger token IDs currently being hit by beams.
   * Used to detect state transitions (hit → lost).
   * @type {Set<string>}
   */
  _previouslyHitTriggers = new Set();

  /**
   * Map of trigger token IDs → setInterval IDs for onBeamStay loops.
   * @type {Map<string, { intervalId: number, triggerToken: Token, triggerData: object, beamData: object }>}
   */
  _triggerIntervals = new Map();

  /** @override */
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions ?? {}, {
      name: "beams",
      zIndex: 500
    });
  }

  /** @override */
  async _draw(options) {
    if (typeof super._draw === "function") await super._draw(options);

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
    // Clear all trigger stay intervals
    this._clearAllTriggerIntervals();
    this._previouslyHitTriggers.clear();

    if (this.beamContainer) {
      this.beamContainer.destroy({ children: true });
      this.beamContainer = null;
    }

    // Clean up laser light sources
    laserLightManager.clearAll();

    this.renderer = null;
    if (typeof super._tearDown === "function") await super._tearDown(options);
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
    if (!this.renderer) return;
    const maxBounces = game.settings?.get(MODULE_ID, "maxBounces") ?? 10;
    const beamResults = traceAllBeams(maxBounces);

    // Extract segments for rendering
    const beamGroups = beamResults.map(r => r.segments);
    const opacity = game.settings?.get(MODULE_ID, "beamOpacity") ?? 0.8;
    const glow = game.settings?.get(MODULE_ID, "glowEffect") ?? true;
    this.renderer.draw(beamGroups, { opacity, glow });

    // Update emitted lights along the laser beams
    laserLightManager.updateLights(beamResults);

    // Process trigger macro lifecycle (GM only)
    if (game.user?.isGM) {
      this._processTriggers(beamResults);
    }
  }

  /**
   * Process trigger hit/stay/lost lifecycle.
   * Compares current hits against previous state to fire appropriate macros.
   * @param {BeamTraceResult[]} beamResults
   */
  _processTriggers(beamResults) {
    // Collect all currently-hit trigger IDs and their data
    const currentHits = new Map();
    for (const result of beamResults) {
      for (const hit of result.hitTriggers) {
        const id = hit.triggerToken.id;
        if (!currentHits.has(id)) {
          currentHits.set(id, hit);
        }
      }
    }

    const currentIds = new Set(currentHits.keys());

    // Newly hit triggers → fire onBeamHit + start onBeamStay interval
    for (const [id, hit] of currentHits) {
      if (!this._previouslyHitTriggers.has(id)) {
        this._executeTriggerMacro(hit.triggerData.onBeamHit, hit);
        this._startStayInterval(id, hit);
      }
    }

    // Newly lost triggers → clear interval + fire onBeamLost
    for (const id of this._previouslyHitTriggers) {
      if (!currentIds.has(id)) {
        // _stopStayInterval fires onBeamLost and clears the interval
        this._stopStayInterval(id);
      }
    }

    this._previouslyHitTriggers = currentIds;
  }

  /**
   * Start an onBeamStay interval for a trigger.
   * @param {string} triggerId
   * @param {TriggerHitInfo} hit
   */
  _startStayInterval(triggerId, hit) {
    if (this._triggerIntervals.has(triggerId)) return; // Already running

    const stayCode = hit.triggerData.onBeamStay;
    if (!stayCode || stayCode.trim() === "") {
      // No stay macro, but still store info for onBeamLost
      this._triggerIntervals.set(triggerId, {
        intervalId: null,
        triggerToken: hit.triggerToken,
        triggerData: hit.triggerData,
        beamData: hit.beamData,
      });
      return;
    }

    const intervalId = setInterval(() => {
      this._executeTriggerMacro(stayCode, hit);
    }, 500);

    this._triggerIntervals.set(triggerId, {
      intervalId,
      triggerToken: hit.triggerToken,
      triggerData: hit.triggerData,
      beamData: hit.beamData,
    });
  }

  /**
   * Stop an onBeamStay interval and fire onBeamLost for a trigger.
   * @param {string} triggerId
   */
  _stopStayInterval(triggerId) {
    const info = this._triggerIntervals.get(triggerId);
    if (!info) return;

    if (info.intervalId !== null) {
      clearInterval(info.intervalId);
    }

    // Fire onBeamLost macro
    const lostCode = info.triggerData.onBeamLost;
    if (lostCode && lostCode.trim() !== "") {
      this._executeTriggerMacro(lostCode, {
        triggerToken: info.triggerToken,
        triggerData: info.triggerData,
        beamData: info.beamData,
      });
    }

    this._triggerIntervals.delete(triggerId);
  }

  /**
   * Clear all trigger stay intervals.
   */
  _clearAllTriggerIntervals() {
    for (const [id, info] of this._triggerIntervals) {
      if (info.intervalId !== null) {
        clearInterval(info.intervalId);
      }
    }
    this._triggerIntervals.clear();
  }

  /**
   * Execute a trigger macro code string.
   * Runs in standard Foundry macro context with full access to globals,
   * plus token, actor, and beamData variables.
   * @param {string} macroCode
   * @param {TriggerHitInfo} hit
   */
  _executeTriggerMacro(macroCode, hit) {
    if (!macroCode || macroCode.trim() === "") return;

    try {
      const tokenDoc = hit.triggerToken.document ?? hit.triggerToken;
      const actor = tokenDoc?.actor ?? hit.triggerToken.actor;
      const beamData = hit.beamData;

      const fn = new Function("token", "actor", "beamData", macroCode);
      fn.call(globalThis, tokenDoc, actor, beamData);
    } catch (err) {
      console.error(`${MODULE_ID} | Error executing trigger macro:`, err);
      ui.notifications.error(`Trigger macro error: ${err.message}`);
    }
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
  const parent = canvas.effects ?? canvas.interface;
  parent.addChild(beamLayer);
  await beamLayer.draw();
}

/**
 * Trigger a beam refresh if the layer exists.
 * Safe to call from any hook.
 */
export function refreshBeams() {
  if (beamLayer) beamLayer.refresh();
}

