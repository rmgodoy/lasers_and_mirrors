# TASK 4 — Canvas Rendering

> **Goal:** Create the custom `CanvasLayer` and `PIXI.Graphics` renderer that draws laser beams on screen.  
> **Dependencies:** TASK_1, TASK_2, TASK_3 must be complete (needs `constants.mjs`, `ray-caster.mjs`).  
> **Read PLAN.md first** for PIXI patterns and CanvasLayer API.

---

## FILES TO CREATE

### 1. `scripts/canvas/beam-layer.mjs`

A custom `CanvasLayer` that hosts the beam graphics. Gets injected into the canvas interface group.

**Imports:**
- `{ MODULE_ID }` from `../constants.mjs`
- `{ BeamRenderer }` from `./beam-renderer.mjs`
- `{ traceAllBeams }` from `../physics/ray-caster.mjs`

**Must export:**

```js
/**
 * Custom CanvasLayer that renders all laser beams.
 * Added to canvas.interface so beams draw above tokens.
 */
export class BeamLayer extends CanvasLayer {

  /**
   * PIXI container holding all beam graphics.
   * @type {PIXI.Container}
   */
  beamContainer = null;

  /**
   * The renderer instance that draws PIXI graphics.
   * @type {BeamRenderer}
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
      zIndex: 500  // Above tokens
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
  }
}
```

**Singleton pattern** — expose a module-level reference:

```js
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
```

---

### 2. `scripts/canvas/beam-renderer.mjs`

Handles the actual PIXI.Graphics drawing of beam segments.

**No Foundry-specific imports** — just receives data and draws.

**Must export:**

```js
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
   * @param {number} options.opacity - global beam opacity (0-1)
   * @param {boolean} options.glow - whether to add glow filter
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
          .moveTo(seg.start.x, seg.start.y)
          .lineTo(seg.end.x, seg.end.y)
          .stroke({
            width: seg.width * 3,
            color: color,
            alpha: opacity * 0.2 * seg.intensity
          });
      }
      this.container.addChild(glowGraphics);
    }

    // Draw the main beam
    const mainGraphics = new PIXI.Graphics();
    for (const seg of segments) {
      const color = this._hexToNumber(seg.color);
      mainGraphics
        .moveTo(seg.start.x, seg.start.y)
        .lineTo(seg.end.x, seg.end.y)
        .stroke({
          width: seg.width,
          color: color,
          alpha: opacity * seg.intensity
        });
    }
    this.container.addChild(mainGraphics);

    // Draw bright core (thin, high alpha) for realism
    const coreGraphics = new PIXI.Graphics();
    for (const seg of segments) {
      coreGraphics
        .moveTo(seg.start.x, seg.start.y)
        .lineTo(seg.end.x, seg.end.y)
        .stroke({
          width: Math.max(1, seg.width * 0.3),
          color: 0xffffff,
          alpha: opacity * seg.intensity * 0.6
        });
    }
    this.container.addChild(coreGraphics);
  }

  /**
   * Convert hex color string to numeric (e.g. "#ff0000" → 0xff0000).
   * @param {string} hex
   * @returns {number}
   */
  _hexToNumber(hex) {
    return parseInt(hex.replace("#", ""), 16);
  }
}
```

**Rendering approach** — three layers per beam for visual quality:
1. **Glow layer:** Wide, low-alpha strokes for the ambient glow
2. **Main beam:** The primary colored beam at the configured width
3. **Core:** Thin white line down the center for brightness

This creates a convincing laser effect using only `PIXI.Graphics` — no shaders or filters needed.

---

## IMPORTANT PIXI v8 NOTES (Foundry V14)

Foundry V14 uses **PIXI v8**. The drawing API changed from v7:

- **v7 (OLD):** `graphics.lineStyle(width, color, alpha).moveTo(x,y).lineTo(x,y)`
- **v8 (NEW):** `graphics.moveTo(x,y).lineTo(x,y).stroke({ width, color, alpha })`

Use the **v8 API** as shown above. The `stroke()` call comes AFTER the path definition.

If `stroke()` with object parameter causes errors, fall back to:
```js
graphics.moveTo(x, y).lineTo(x2, y2).stroke(new PIXI.GraphicsStyle({ width, color, alpha }));
```

---

## VERIFICATION

1. Add these lines temporarily to `scripts/module.mjs` (will be cleaned up in TASK_7):

```js
import { initBeamLayer } from "./canvas/beam-layer.mjs";

Hooks.on("canvasReady", async () => {
  await initBeamLayer();
});
```

2. Create a scene, place a token, set laser flags via console:
```js
const t = canvas.tokens.placeables[0];
await t.document.update({"flags.lasers-and-mirrors": {type:"laser",color:"#ff0000",width:4,range:30,intensity:0.8,visible:true}});
```

3. Refresh the canvas (F5 or navigate away and back).
4. **Expected:** A red laser beam should render from the token's center in its facing direction.
5. Place walls in the scene — the beam should stop at walls.
6. No console errors.
