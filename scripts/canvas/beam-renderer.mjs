import { getLineSegmentFromAngle, getSegmentNormal } from "../utils/geometry.mjs";

/**
 * Renders beam segments as PIXI.Graphics objects inside a container.
 */
export class BeamRenderer {

  /**
   * @param {PIXI.Container} container - parent container to add graphics to
   */
  constructor(container) {
    this.container = container;
  }

  /**
   * Draw all beam segments. Clears previous graphics first.
   * @param {BeamSegment[][]} beamGroups - array of segment arrays (one per laser)
   * @param {object} options
   * @param {number} [options.opacity=0.8] - global beam opacity (0-1)
   * @param {boolean} [options.glow=true] - whether to add glow effect
   */
  draw(beamGroups, { opacity = 0.8, glow = true } = {}) {
    // Clear all previous children
    this.container.removeChildren().forEach(c => c.destroy());

    for (const segments of beamGroups) {
      if (!segments || segments.length === 0) continue;
      this._drawBeamGroup(segments, opacity, glow);
    }
  }

  /**
   * Draw one laser's beam segments (including reflections).
   * @param {BeamSegment[]} segments
   * @param {number} opacity
   * @param {boolean} glow
   */
  _drawBeamGroup(segments, opacity, glow) {
    // Draw the glow layer (wider, more transparent) behind the main beam
    if (glow) {
      const glowGraphics = new PIXI.Graphics();
      for (const seg of segments) {
        const color = this._hexToNumber(seg.color);
        glowGraphics
          .lineStyle(seg.width * 3, color, opacity * 0.2 * seg.intensity)
          .moveTo(seg.start.x, seg.start.y)
          .lineTo(seg.end.x, seg.end.y);
      }
      this.container.addChild(glowGraphics);
    }

    // Draw the main beam
    const mainGraphics = new PIXI.Graphics();
    for (const seg of segments) {
      const color = this._hexToNumber(seg.color);
      mainGraphics
        .lineStyle(seg.width, color, opacity * seg.intensity)
        .moveTo(seg.start.x, seg.start.y)
        .lineTo(seg.end.x, seg.end.y);
    }
    this.container.addChild(mainGraphics);

    // Draw bright core (thin, high alpha) for realism
    const coreGraphics = new PIXI.Graphics();
    for (const seg of segments) {
      coreGraphics
        .lineStyle(Math.max(1, seg.width * 0.3), 0xffffff, opacity * seg.intensity * 0.6)
        .moveTo(seg.start.x, seg.start.y)
        .lineTo(seg.end.x, seg.end.y);
    }
    this.container.addChild(coreGraphics);
  }

  /**
   * Draw all mirrors as two-line visual overlays (gray front, black back).
   * @param {Array<{center: {x:number, y:number}, orientation: number, width: number}>} mirrors
   */
  drawMirrors(mirrors) {
    const mirrorGraphics = new PIXI.Graphics();
    const gridSize = canvas?.grid?.size ?? 100;
    
    for (const mirror of mirrors) {
      const halfWidth = (mirror.width * gridSize) / 2;
      const segment = getLineSegmentFromAngle(mirror.center, mirror.orientation, halfWidth);
      const normal = getSegmentNormal(segment.p1, segment.p2);
      
      const offsetAmt = 3; // pixels to offset the lines from the center axis

      // Gray line (front / reflective side) - offset along normal
      const frontP1 = { x: segment.p1.x + normal.x * offsetAmt, y: segment.p1.y + normal.y * offsetAmt };
      const frontP2 = { x: segment.p2.x + normal.x * offsetAmt, y: segment.p2.y + normal.y * offsetAmt };
      
      mirrorGraphics
        .lineStyle(4, 0xaaaaaa, 1)
        .moveTo(frontP1.x, frontP1.y)
        .lineTo(frontP2.x, frontP2.y);

      // Black line (back side) - offset against normal
      const backP1 = { x: segment.p1.x - normal.x * offsetAmt, y: segment.p1.y - normal.y * offsetAmt };
      const backP2 = { x: segment.p2.x - normal.x * offsetAmt, y: segment.p2.y - normal.y * offsetAmt };

      mirrorGraphics
        .lineStyle(4, 0x000000, 1)
        .moveTo(backP1.x, backP1.y)
        .lineTo(backP2.x, backP2.y);
    }
    
    this.container.addChild(mirrorGraphics);
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
