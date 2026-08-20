import { MODULE_ID } from "../constants.mjs";
import { updateMirrorData } from "../mirror-data.mjs";
import { emitMirrorRotation } from "./socket-handler.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * A custom PIXI HUD for rotating mirrors.
 * Drawn as a circular track around the token with a draggable knob.
 */
export class MirrorHUD extends PIXI.Container {
  constructor(token) {
    super();
    this.token = token;
    this.name = "LAM-MirrorHUD";

    this.track = new PIXI.Graphics();
    this.pointerLine = new PIXI.Graphics();
    this.knob = new PIXI.Graphics();
    
    this.addChild(this.track);
    this.addChild(this.pointerLine);
    this.addChild(this.knob);

    this.dragging = false;
    this.currentOrientation = 0;

    // Throttle updates to ~10 per second for real-time syncing
    this.throttledUpdate = foundry.utils.throttle(this._emitUpdate.bind(this), 100);
    
    this._setupInteraction();
  }

  _getPixelSize() {
    const w = this.token.w || (this.token.document.width * (canvas.grid?.size || 100));
    const h = this.token.h || (this.token.document.height * (canvas.grid?.size || 100));
    return { width: w, height: h };
  }

  /**
   * Draw the HUD (track, pointer guide, and knob) based on the token's bounds.
   */
  draw() {
    this.clear();
    this.zIndex = 1000;
    if (this.token) {
      this.position.set(this.token.x, this.token.y);
    }

    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;
    // Radius slightly larger than the token bounds
    this.radius = Math.max(cx, cy) + 24;

    // Interactive circular track
    this.track.clear();
    // Transparent wide stroke for easy clicking/hovering
    this.track.lineStyle(28, 0xffffff, 0.001);
    this.track.drawCircle(cx, cy, this.radius);
    // Visible track ring
    this.track.lineStyle(3, 0x00e5ff, 0.4);
    this.track.drawCircle(cx, cy, this.radius);
    // Subtle outer glow ring
    this.track.lineStyle(1, 0xffffff, 0.2);
    this.track.drawCircle(cx, cy, this.radius + 3);

    // Knob visual with generous hitArea
    this._drawKnob(false);
    
    this.refresh();
    return this;
  }

  /**
   * Draw the knob graphics and set its generous hit area.
   * @param {boolean} [hovered=false]
   */
  _drawKnob(hovered = false) {
    this.knob.clear();
    
    // Outer glow
    this.knob.beginFill(0x00e5ff, hovered ? 0.35 : 0.2);
    this.knob.drawCircle(0, 0, hovered ? 20 : 16);
    this.knob.endFill();

    // Main knob circle
    this.knob.beginFill(hovered ? 0x66ffff : 0x00e5ff);
    this.knob.lineStyle(2.5, 0xffffff, 1.0);
    this.knob.drawCircle(0, 0, hovered ? 13 : 11);
    this.knob.endFill();

    // Inner bright center dot
    this.knob.beginFill(0xffffff, 0.9);
    this.knob.drawCircle(0, 0, 3.5);
    this.knob.endFill();

    // Set 30px radius hit area for effortless clicking/grabbing outside token bounds
    this.knob.hitArea = new PIXI.Circle(0, 0, 30);
  }

  /**
   * Update the knob's position and guide line.
   * @param {number} [orientation] Optional forced orientation.
   */
  refresh(orientation) {
    if (this.token) {
      this.position.set(this.token.x, this.token.y);
    }
    if (this.dragging) return; // Don't override while dragging
    
    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;
    this.radius = Math.max(cx, cy) + 24;

    const targetOrientation = orientation !== undefined ? orientation : (this.token.document.rotation ?? 0);
    this.currentOrientation = targetOrientation;
    
    // Convert Foundry rotation (0° = South, 90° = West) to math angle
    const mathRad = ((targetOrientation + 90) * Math.PI) / 180;
    
    const kx = cx + this.radius * Math.cos(mathRad);
    const ky = cy + this.radius * Math.sin(mathRad);

    this.knob.x = kx;
    this.knob.y = ky;

    // Draw directional guide line from center to knob
    this.pointerLine.clear();
    this.pointerLine.lineStyle(1.5, 0x00e5ff, 0.4);
    this.pointerLine.moveTo(cx, cy);
    this.pointerLine.lineTo(kx, ky);
    // Center point indicator
    this.pointerLine.beginFill(0x00e5ff, 0.6);
    this.pointerLine.drawCircle(cx, cy, 3);
    this.pointerLine.endFill();
  }

  _setupInteraction() {
    // Knob interaction
    this.knob.interactive = true;
    this.knob.eventMode = "static";
    this.knob.cursor = "grab";

    this.knob.on("pointerdown", this._onDragStart.bind(this));
    this.knob.on("pointerover", () => this._drawKnob(true));
    this.knob.on("pointerout", () => {
      if (!this.dragging) this._drawKnob(false);
    });

    // Track interaction (clicking anywhere on the circular ring snaps & begins drag)
    this.track.interactive = true;
    this.track.eventMode = "static";
    this.track.cursor = "pointer";
    this.track.on("pointerdown", (event) => {
      this._onDragStart(event);
      this._onDragMove(event);
    });
  }

  _onDragStart(event) {
    event.stopPropagation?.();
    if (event.data?.originalEvent) {
      event.data.originalEvent.stopPropagation?.();
    }
    
    this.dragging = true;
    this.knob.cursor = "grabbing";
    this._drawKnob(true);

    // Bind global move and up handlers to canvas stage and window
    this._stageMoveHandler = this._onDragMove.bind(this);
    this._stageUpHandler = this._onDragEnd.bind(this);

    canvas.stage?.on("pointermove", this._stageMoveHandler);
    canvas.stage?.on("pointerup", this._stageUpHandler);
    canvas.stage?.on("pointerupoutside", this._stageUpHandler);
    window.addEventListener("pointerup", this._stageUpHandler, { once: true });
  }

  _onDragMove(event) {
    if (!this.dragging) return;
    event.stopPropagation?.();

    // Get pointer position in local HUD coordinates
    let globalPos = event.global ?? event.data?.global;
    if (!globalPos && event.clientX !== undefined) {
      globalPos = canvas.stage.toLocal(new PIXI.Point(event.clientX, event.clientY));
    }
    const newPosition = globalPos ? this.toLocal(globalPos) : (event.getLocalPosition ? event.getLocalPosition(this) : { x: 0, y: 0 });

    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;

    const dx = newPosition.x - cx;
    const dy = newPosition.y - cy;
    
    // Math angle in radians
    let mathAngle = Math.atan2(dy, dx);
    
    // Convert to Foundry rotation (degrees, clockwise from South)
    let degrees = (mathAngle * 180) / Math.PI;
    let foundryRotation = Math.round(degrees - 90);
    if (foundryRotation < 0) foundryRotation += 360;
    if (foundryRotation >= 360) foundryRotation %= 360;
    
    this.currentOrientation = foundryRotation;

    // Snap knob visually
    const snapRad = ((foundryRotation + 90) * Math.PI) / 180;
    const kx = cx + this.radius * Math.cos(snapRad);
    const ky = cy + this.radius * Math.sin(snapRad);
    this.knob.x = kx;
    this.knob.y = ky;

    // Update guide line
    this.pointerLine.clear();
    this.pointerLine.lineStyle(1.5, 0x00e5ff, 0.5);
    this.pointerLine.moveTo(cx, cy);
    this.pointerLine.lineTo(kx, ky);
    this.pointerLine.beginFill(0x00e5ff, 0.7);
    this.pointerLine.drawCircle(cx, cy, 3);
    this.pointerLine.endFill();

    // Real-time optimistic update of token sprite rotation and beams
    this._applyLocalRotation(foundryRotation);
    this.throttledUpdate(foundryRotation);
  }

  _onDragEnd(event) {
    if (!this.dragging) return;
    event?.stopPropagation?.();
    this.dragging = false;
    this.knob.cursor = "grab";
    this._drawKnob(false);

    if (this._stageMoveHandler) {
      canvas.stage?.off("pointermove", this._stageMoveHandler);
      canvas.stage?.off("pointerup", this._stageUpHandler);
      canvas.stage?.off("pointerupoutside", this._stageUpHandler);
      this._stageMoveHandler = null;
      this._stageUpHandler = null;
    }
    
    // Final sync
    this._emitUpdate(this.currentOrientation);
  }

  _applyLocalRotation(orientation) {
    if (this.token.document) {
      this.token.document.updateSource({ rotation: orientation });
      if (this.token.document.flags?.[MODULE_ID]) {
        this.token.document.flags[MODULE_ID].orientation = orientation;
      }
    }
    if (this.token.mesh) {
      this.token.mesh.rotation = (orientation * Math.PI) / 180;
    }
    if (this.token.renderFlags) {
      this.token.renderFlags.set({ refreshRotation: true });
    }
    refreshBeams();
  }

  async _emitUpdate(orientation) {
    this._applyLocalRotation(orientation);

    if (game.user.isGM) {
      // GM can update directly
      await updateMirrorData(this.token.document, { orientation });
    } else {
      // Non-GM: send via websocket for GM to process
      emitMirrorRotation(
        this.token.document.parent.id,
        this.token.document.id,
        orientation
      );
    }
  }

  /**
   * PIXI clear override for our custom structure.
   */
  clear() {
    this.track.clear();
    this.pointerLine.clear();
    this.knob.clear();
  }

  /**
   * Cleanup event listeners on destruction.
   */
  destroy(options) {
    if (this._stageMoveHandler) {
      canvas.stage?.off("pointermove", this._stageMoveHandler);
      canvas.stage?.off("pointerup", this._stageUpHandler);
      canvas.stage?.off("pointerupoutside", this._stageUpHandler);
      this._stageMoveHandler = null;
      this._stageUpHandler = null;
    }
    super.destroy(options);
  }
}

