import { MODULE_ID } from "../constants.mjs";
import { getTokenCenter } from "../utils/token-helpers.mjs";

/**
 * Manages clean, focused PointLightSource instances for laser beams:
 * - At the laser emitter token
 * - At each mirror token reflection point
 * - At the terminal beam impact/trigger point
 *
 * Fully respects scene walls (walls: true) with interior insets to prevent
 * light from bleeding through walls into outside/unexplored areas.
 */
export class LaserLightManager {

  /**
   * Active light sources keyed by unique sourceId.
   * @type {Map<string, foundry.canvas.sources.PointLightSource>}
   */
  sources = new Map();

  /**
   * Fingerprint cache to skip redundant calculations.
   * @type {string}
   * @private
   */
  _lastFingerprint = "";

  /**
   * Update laser light sources at key impact, bounce, and emitter points.
   * @param {BeamTraceResult[]} beamResults - results from ray-caster traceAllBeams()
   */
  updateLights(beamResults) {
    if (!canvas?.effects?.lightSources) return;

    const globalEnabled = game.settings?.get(MODULE_ID, "enableLaserLight") ?? true;

    // Build fingerprint for change detection
    let fingerprint = `${globalEnabled};`;
    if (globalEnabled && beamResults) {
      for (const res of beamResults) {
        if (!res.laserData?.visible || res.laserData?.emitLight === false) continue;
        const d = res.laserData;
        fingerprint += `${res.laserToken?.id}:${d.color}:${d.intensity}:${d.lightRadius}:${d.providesVision}:${res.laserToken?.document?.elevation};`;
        if (res.segments) {
          for (const s of res.segments) {
            fingerprint += `${Math.round(s.start.x)},${Math.round(s.start.y)}-${Math.round(s.end.x)},${Math.round(s.end.y)}:${s.hitMirrorToken?.id ?? ""}:${s.hitTriggerToken?.id ?? ""};`;
          }
        }
      }
    }

    if (fingerprint === this._lastFingerprint) return;
    this._lastFingerprint = fingerprint;

    const activeSourceIds = new Set();
    let lightsChanged = false;

    if (globalEnabled && beamResults && beamResults.length > 0) {
      const LightSourceClass = CONFIG.Canvas?.lightSourceClass ?? foundry.canvas.sources.PointLightSource;
      const gridSize = canvas.grid?.size ?? 100;
      const defaultLightRadius = game.settings?.get(MODULE_ID, "laserLightRadius") ?? 1.0;

      for (const result of beamResults) {
        const { segments, laserToken, laserData } = result;
        if (!laserData || !laserData.visible || laserData.emitLight === false) continue;
        if (!segments || segments.length === 0) continue;

        const lightRadiusUnits = laserData.lightRadius ?? defaultLightRadius;
        const dimPixels = Math.max(gridSize * 0.75, lightRadiusUnits * gridSize);
        const brightPixels = dimPixels * 0.5;
        const color = laserData.color || "#ff0000";
        const intensity = laserData.intensity ?? 0.8;
        const alpha = Math.min(1.0, intensity * 0.9);
        const elevation = laserToken?.document?.elevation ?? 0;
        const providesVision = Boolean(laserData.providesVision);
        const tokenId = laserToken?.id ?? "unknown";

        // Collect key illumination points
        const keyPoints = [];

        // 1. Emitter origin (inset slightly forward along the beam)
        const firstSeg = segments[0];
        const fdx = firstSeg.end.x - firstSeg.start.x;
        const fdy = firstSeg.end.y - firstSeg.start.y;
        const flen = Math.hypot(fdx, fdy) || 1;
        const emitterPos = {
          x: firstSeg.start.x + (fdx / flen) * Math.min(4, flen / 2),
          y: firstSeg.start.y + (fdy / flen) * Math.min(4, flen / 2)
        };
        keyPoints.push({
          point: emitterPos,
          token: laserToken,
          type: "emitter",
          idSuffix: "emitter"
        });

        // 2. Bounce points between segments (mirrors, inset slightly back into the room)
        for (let i = 0; i < segments.length - 1; i++) {
          const seg = segments[i];
          const mirrorToken = seg.hitMirrorToken;
          const idx = seg.end.x - seg.start.x;
          const idy = seg.end.y - seg.start.y;
          const ilen = Math.hypot(idx, idy) || 1;
          const bouncePos = {
            x: seg.end.x - (idx / ilen) * Math.min(4, ilen / 4),
            y: seg.end.y - (idy / ilen) * Math.min(4, ilen / 4)
          };
          keyPoints.push({
            point: bouncePos,
            token: mirrorToken,
            type: "bounce",
            idSuffix: `bounce_${i}`
          });
        }

        // 3. Final impact point (wall or trigger, inset back into the room away from the wall)
        const lastSeg = segments[segments.length - 1];
        const triggerToken = lastSeg.hitTriggerToken;
        const ldx = lastSeg.end.x - lastSeg.start.x;
        const ldy = lastSeg.end.y - lastSeg.start.y;
        const llen = Math.hypot(ldx, ldy) || 1;
        const impactPos = {
          x: lastSeg.end.x - (ldx / llen) * Math.min(4, llen / 4),
          y: lastSeg.end.y - (ldy / llen) * Math.min(4, llen / 4)
        };
        keyPoints.push({
          point: impactPos,
          token: triggerToken,
          type: "impact",
          idSuffix: "impact"
        });

        for (const kp of keyPoints) {
          const sourceId = `LasersAndMirrors.laser.${tokenId}.${kp.idSuffix}`;
          activeSourceIds.add(sourceId);

          const configData = {
            x: Math.round(kp.point.x),
            y: Math.round(kp.point.y),
            dim: dimPixels,
            bright: brightPixels,
            color,
            alpha,
            walls: true, // Respect scene walls and block light bleeding
            vision: providesVision,
            elevation,
            disabled: false,
          };

          let source = this.sources.get(sourceId);
          if (!source || source.destroyed) {
            source = new LightSourceClass({ sourceId, object: kp.token ?? laserToken });
            source.initialize(configData);
            source.add();
            this.sources.set(sourceId, source);
            lightsChanged = true;
          } else {
            const cur = source.data;
            if (cur.x !== configData.x || cur.y !== configData.y || cur.dim !== dimPixels || cur.color !== color || cur.alpha !== alpha || cur.vision !== providesVision || cur.walls !== true) {
              source.initialize(configData);
              lightsChanged = true;
            }
          }
        }
      }
    }

    // Clean up unneeded light sources
    for (const [sourceId, source] of this.sources.entries()) {
      if (!activeSourceIds.has(sourceId)) {
        source.destroy();
        this.sources.delete(sourceId);
        lightsChanged = true;
      }
    }

    if (lightsChanged) {
      canvas.perception?.update({ refreshLighting: true, refreshVision: true });
    }
  }

  /**
   * Destroy and clean up all active laser light sources.
   */
  clearAll() {
    this._lastFingerprint = "";
    for (const [sourceId, source] of this.sources.entries()) {
      source.destroy();
    }
    this.sources.clear();
    if (canvas?.ready && canvas?.perception) {
      canvas.perception.update({ refreshLighting: true, refreshVision: true });
    }
  }

  /**
   * Called during Foundry's initializeLightSources hook.
   */
  onInitializeLightSources() {
    for (const source of this.sources.values()) {
      if (source && !source.destroyed) {
        source.initialize();
      }
    }
  }
}

/**
 * Singleton LaserLightManager instance.
 */
export const laserLightManager = new LaserLightManager();
