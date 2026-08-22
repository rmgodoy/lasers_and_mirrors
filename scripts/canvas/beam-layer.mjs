import { MODULE_ID } from "../constants.mjs";
import { BeamRenderer } from "./beam-renderer.mjs";
import { traceAllBeams } from "../physics/ray-caster.mjs";
import { laserLightManager } from "./beam-lights.mjs";
import { BehaviorRunner } from "../behaviors/behavior-runner.mjs";

const CanvasLayer = globalThis.foundry?.canvas?.layers?.CanvasLayer ?? globalThis.CanvasLayer ?? globalThis.PIXI?.Container ?? class DummyLayer {
  addChild() {}
  destroy() {}
};

/**
 * Custom CanvasLayer that renders all laser beams.
 */
export class BeamLayer extends CanvasLayer {
  beamContainer = null;
  renderer = null;
  _refreshTimer = null;
  _previouslyHitTriggers = new Set();
  _triggerIntervals = new Map();

  /** @override */
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions ?? {}, { name: "beams", zIndex: 500 });
  }

  /** @override */
  async _draw(options) {
    if (typeof super._draw === "function") await super._draw(options);
    if (typeof PIXI !== "undefined" && PIXI.Container) {
      try {
        this.beamContainer = new PIXI.Container();
        this.addChild?.(this.beamContainer);
        this.renderer = new BeamRenderer(this.beamContainer);
      } catch (_) {
        // Mock or non-PIXI testing environment
      }
    }
    this.refresh();
  }

  /** @override */
  async _tearDown(options) {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
    this._clearAllTriggerIntervals();
    this._previouslyHitTriggers.clear();
    if (this.beamContainer) {
      this.beamContainer.destroy({ children: true });
      this.beamContainer = null;
    }
    laserLightManager.clearAll();
    this.renderer = null;
    if (typeof super._tearDown === "function") await super._tearDown(options);
  }

  /** Refresh all beam rendering (debounced). */
  refresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this._doRefresh(), 16);
  }

  _doRefresh() {
    if (!this.renderer) return;
    const maxBounces = globalThis.game?.settings?.get?.(MODULE_ID, "maxBounces") ?? 10;
    const beamResults = traceAllBeams(maxBounces);

    const beamGroups = beamResults.map(r => r.segments);
    const opacity = globalThis.game?.settings?.get?.(MODULE_ID, "beamOpacity") ?? 0.8;
    const glow = globalThis.game?.settings?.get?.(MODULE_ID, "glowEffect") ?? true;
    this.renderer.draw(beamGroups, { opacity, glow });

    laserLightManager.updateLights(beamResults);

    if (globalThis.game?.user?.isGM) {
      this._processTriggers(beamResults);
    }
  }

  /**
   * Process trigger hit/stay/lost lifecycle.
   */
  _processTriggers(beamResults) {
    const currentHits = new Map();
    for (const result of beamResults) {
      for (const hit of result.hitTriggers) {
        const id = hit.triggerToken.id;
        if (!currentHits.has(id)) currentHits.set(id, hit);
      }
    }

    const currentIds = new Set(currentHits.keys());
    const previousIds = this._previouslyHitTriggers;
    this._previouslyHitTriggers = currentIds;

    // Newly hit triggers → fire Enter behaviors + start stay interval
    for (const [id, hit] of currentHits) {
      if (!previousIds.has(id)) {
        this._fireTriggerEvent(hit, "enter");
        this._startStayInterval(id, hit);
      }
    }

    // Newly lost triggers → clear interval + fire Exit behaviors
    for (const id of previousIds) {
      if (!currentIds.has(id)) {
        this._stopStayInterval(id);
      }
    }
  }

  /**
   * Fire trigger behaviors and legacy macro for a given event.
   */
  async _fireTriggerEvent(hit, eventType) {
    const triggerData = hit.triggerData ?? {};

    let behaviorList = [];
    let legacyCode = "";

    if (eventType === "enter") {
      behaviorList = triggerData.behaviorsEnter;
      legacyCode = triggerData.onBeamHit;
    } else if (eventType === "stay") {
      behaviorList = triggerData.behaviorsStay;
      legacyCode = triggerData.onBeamStay;
    } else if (eventType === "exit") {
      behaviorList = triggerData.behaviorsExit;
      legacyCode = triggerData.onBeamLost;
    }

    if (Array.isArray(behaviorList) && behaviorList.length > 0) {
      await BehaviorRunner.runSequence(behaviorList, hit, eventType);
    }

    if (legacyCode && legacyCode.trim() !== "") {
      this._executeTriggerMacro(legacyCode, hit);
    }
  }

  /**
   * Start an onBeamStay interval for a trigger.
   */
  _startStayInterval(triggerId, hit) {
    if (this._triggerIntervals.has(triggerId)) return;

    const hasStayBehaviors = Array.isArray(hit.triggerData?.behaviorsStay) && hit.triggerData.behaviorsStay.length > 0;
    const hasStayMacro = Boolean(hit.triggerData?.onBeamStay && hit.triggerData.onBeamStay.trim() !== "");

    if (!hasStayBehaviors && !hasStayMacro) {
      this._triggerIntervals.set(triggerId, {
        intervalId: null,
        triggerToken: hit.triggerToken,
        triggerData: hit.triggerData,
        beamData: hit.beamData,
      });
      return;
    }

    const intervalId = setInterval(() => {
      this._fireTriggerEvent(hit, "stay");
    }, 500);

    this._triggerIntervals.set(triggerId, {
      intervalId,
      triggerToken: hit.triggerToken,
      triggerData: hit.triggerData,
      beamData: hit.beamData,
    });
  }

  /**
   * Stop an onBeamStay interval and fire exit behaviors for a trigger.
   */
  _stopStayInterval(triggerId) {
    const info = this._triggerIntervals.get(triggerId);
    if (!info) return;

    if (info.intervalId !== null) clearInterval(info.intervalId);

    this._fireTriggerEvent({
      triggerToken: info.triggerToken,
      triggerData: info.triggerData,
      beamData: info.beamData,
    }, "exit");

    this._triggerIntervals.delete(triggerId);
  }

  _clearAllTriggerIntervals() {
    for (const [, info] of this._triggerIntervals) {
      if (info.intervalId !== null) clearInterval(info.intervalId);
    }
    this._triggerIntervals.clear();
  }

  _executeTriggerMacro(macroCode, hit) {
    if (!macroCode || macroCode.trim() === "") return;
    try {
      const tokenDoc = hit.triggerToken?.document ?? hit.triggerToken;
      const actor = tokenDoc?.actor ?? hit.triggerToken?.actor;
      const fn = new Function("token", "actor", "beamData", macroCode);
      fn.call(globalThis, tokenDoc, actor, hit.beamData);
    } catch (err) {
      console.error(`${MODULE_ID} | Trigger macro error:`, err);
      ui?.notifications?.error?.(`Trigger macro error: ${err.message}`);
    }
  }
}

export let beamLayer = null;

export async function initBeamLayer() {
  if (beamLayer) {
    beamLayer.destroy?.({ children: true });
  }
  beamLayer = new BeamLayer();
  const parent = canvas.effects ?? canvas.interface;
  parent?.addChild?.(beamLayer);
  if (typeof beamLayer.draw === "function") {
    await beamLayer.draw();
  } else if (typeof beamLayer._draw === "function") {
    await beamLayer._draw();
  }
}

export function refreshBeams() {
  if (beamLayer) beamLayer.refresh();
}

/**
 * Check if a trigger token is currently hit by any laser beam.
 * @param {string|Token|TokenDocument} target - Token, TokenDoc, ID, or UUID
 * @returns {boolean}
 */
export function isTriggerHit(target) {
  if (!target) return false;
  let id = target;
  if (typeof target === "object") {
    id = target.id ?? target.document?.id ?? target._id;
  } else if (typeof target === "string") {
    const trimmed = target.trim();
    id = trimmed.includes(".") ? trimmed.split(".").pop() : trimmed;
  }
  return Boolean(beamLayer?._previouslyHitTriggers?.has(id));
}
