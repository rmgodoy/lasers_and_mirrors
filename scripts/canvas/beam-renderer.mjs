import { getLineSegmentFromAngle, getSegmentNormal } from "../utils/geometry.mjs";

/**
 * Renders beam segments as PIXI / PrimaryGraphics objects.
 */
export class BeamRenderer {

  /**
   * @param {PIXI.Container|PIXI.Graphics} target - parent container or graphics object to draw on
   */
  constructor(target) {
    this.target = target;
  }

  /**
   * Draw all beam segments. Clears previous graphics first.
   * @param {BeamSegment[][]} beamGroups - array of segment arrays (one per laser)
   * @param {object} options
   * @param {number} [options.opacity=0.8] - global beam opacity (0-1)
   * @param {boolean} [options.glow=true] - whether to add glow effect
   */
  draw(beamGroups, { opacity = 0.8, glow = true } = {}) {
    if (!this.target) return;

    // If target is a single Graphics/PrimaryGraphics instance
    if (typeof this.target.clear === "function") {
      this.target.clear();
      for (const segments of beamGroups) {
        if (!segments || segments.length === 0) continue;
        this._drawSegmentsOnGraphics(this.target, segments, opacity, glow);
      }
      if (typeof this.target.finishPoly === "function") {
        this.target.finishPoly();
      }
      return;
    }

    // Otherwise, target is a PIXI.Container
    if (typeof this.target.removeChildren === "function") {
      this.target.removeChildren().forEach(c => c.destroy());
      for (const segments of beamGroups) {
        if (!segments || segments.length === 0) continue;
        this._drawBeamGroup(segments, opacity, glow);
      }
    }
  }

  /**
   * Draw segments onto a single graphics instance.
   * @param {PIXI.Graphics} g
   * @param {BeamSegment[]} segments
   * @param {number} opacity
   * @param {boolean} glow
   */
  _drawSegmentsOnGraphics(g, segments, opacity, glow) {
    const hasObjConfig = typeof g.lineTextureStyle === "function" || (PIXI.LINE_CAP && true);

    // Glow pass (subtle, tight ambient laser halo)
    if (glow) {
      for (const seg of segments) {
        const color = this._hexToNumber(seg.color);
        const glowWidth = Math.max(2, Math.round(seg.width * 1.6));
        const glowAlpha = Math.min(0.4, opacity * 0.2 * seg.intensity);
        if (hasObjConfig && PIXI.LINE_CAP?.ROUND) {
          g.lineStyle({ width: glowWidth, color, alpha: glowAlpha, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
        } else {
          g.lineStyle(glowWidth, color, glowAlpha);
        }
        g.moveTo(seg.start.x, seg.start.y).lineTo(seg.end.x, seg.end.y);
      }
    }

    // Main laser beam pass (uniform solid laser color)
    for (const seg of segments) {
      const color = this._hexToNumber(seg.color);
      const beamWidth = Math.max(1, seg.width);
      const beamAlpha = Math.min(1.0, opacity * Math.max(0.2, seg.intensity));
      if (hasObjConfig && PIXI.LINE_CAP?.ROUND) {
        g.lineStyle({ width: beamWidth, color, alpha: beamAlpha, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
      } else {
        g.lineStyle(beamWidth, color, beamAlpha);
      }
      g.moveTo(seg.start.x, seg.start.y).lineTo(seg.end.x, seg.end.y);
    }

    // Bright core pass (razor-sharp white hot center)
    for (const seg of segments) {
      const coreWidth = Math.max(1, Math.round(seg.width * 0.35));
      const coreAlpha = Math.min(1.0, opacity * Math.min(1.0, 0.4 + seg.intensity * 0.6));
      if (hasObjConfig && PIXI.LINE_CAP?.ROUND) {
        g.lineStyle({ width: coreWidth, color: 0xffffff, alpha: coreAlpha, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
      } else {
        g.lineStyle(coreWidth, 0xffffff, coreAlpha);
      }
      g.moveTo(seg.start.x, seg.start.y).lineTo(seg.end.x, seg.end.y);
    }
  }

  /**
   * Draw one laser's beam segments into container children.
   * @param {BeamSegment[]} segments
   * @param {number} opacity
   * @param {boolean} glow
   */
  _drawBeamGroup(segments, opacity, glow) {
    const g = new PIXI.Graphics();
    this._drawSegmentsOnGraphics(g, segments, opacity, glow);
    this.target.addChild(g);
  }

  /**
   * Convert hex color string to numeric (e.g. "#ff0000" → 0xff0000).
   * @param {string|number} hex
   * @returns {number}
   */
  _hexToNumber(hex) {
    if (typeof hex === "number") return hex;
    if (!hex) return 0xff0000;
    return parseInt(hex.replace("#", ""), 16);
  }
}
