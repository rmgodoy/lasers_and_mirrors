import { MODULE_ID } from "../constants.mjs";
import { updateMirrorData } from "../mirror-data.mjs";

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
    this.knob = new PIXI.Graphics();
    
    this.addChild(this.track);
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
   * Draw the HUD (track and knob) based on the token's bounds.
   */
  draw() {
    this.clear();
    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;
    // Radius slightly larger than the token bounds
    this.radius = Math.max(cx, cy) + 20;

    this.track.clear();
    this.track.lineStyle(4, 0xffffff, 0.4);
    this.track.drawCircle(cx, cy, this.radius);

    this.knob.clear();
    this.knob.beginFill(0x00ffcc);
    this.knob.lineStyle(2, 0xffffff, 1.0);
    this.knob.drawCircle(0, 0, 10);
    this.knob.endFill();
    
    this.refresh();
    return this;
  }

  /**
   * Update the knob's position and ensure the track is drawn correctly.
   * @param {number} [orientation] Optional forced orientation.
   */
  refresh(orientation) {
    if (this.dragging) return; // Don't override while dragging
    
    // Ensure track is drawn at the correct size (handles late bounds computation)
    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;
    this.radius = Math.max(cx, cy) + 20;

    this.track.clear();
    this.track.lineStyle(4, 0xffffff, 0.4);
    this.track.drawCircle(cx, cy, this.radius);

    this.knob.clear();
    this.knob.beginFill(0x00ffcc);
    this.knob.lineStyle(2, 0xffffff, 1.0);
    this.knob.drawCircle(0, 0, 10);
    this.knob.endFill();

    const targetOrientation = orientation !== undefined ? orientation : (this.token.document.rotation ?? 0);
    this.currentOrientation = targetOrientation;
    
    // Foundry rotation is clockwise starting from South (0 degrees).
    // Convert Foundry rotation to math angle (0 is South, 90 is West):
    const mathRad = ((targetOrientation + 90) * Math.PI) / 180;
    
    this.knob.x = cx + this.radius * Math.cos(mathRad);
    this.knob.y = cy + this.radius * Math.sin(mathRad);
  }

  _setupInteraction() {
    this.knob.interactive = true;
    this.knob.eventMode = "static";
    this.knob.cursor = "grab";

    this.knob.on("pointerdown", this._onDragStart.bind(this));
    this.knob.on("pointermove", this._onDragMove.bind(this));
    this.knob.on("pointerup", this._onDragEnd.bind(this));
    this.knob.on("pointerupoutside", this._onDragEnd.bind(this));
  }

  _onDragStart(event) {
    this.dragging = true;
    this.knob.cursor = "grabbing";
    this.interactionData = event.data;
  }

  _onDragMove(event) {
    if (!this.dragging) return;
    
    const newPosition = this.interactionData.getLocalPosition(this);
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
    this.knob.x = cx + this.radius * Math.cos(snapRad);
    this.knob.y = cy + this.radius * Math.sin(snapRad);

    this.throttledUpdate(foundryRotation);
  }

  _onDragEnd(event) {
    if (!this.dragging) return;
    this.dragging = false;
    this.knob.cursor = "grab";
    this.interactionData = null;
    
    // Final sync
    this._emitUpdate(this.currentOrientation);
  }

  async _emitUpdate(orientation) {
    await updateMirrorData(this.token.document, { orientation });
    
    // If we are not the owner, we can optimistically update rotation locally
    // to hide latency, though refreshToken might be called anyway.
    if (this.token.document.rotation !== orientation) {
       this.token.document.updateSource({ rotation: orientation });
       this.token.renderFlags.set({ refreshRotation: true });
    }
  }

  /**
   * PIXI clear override for our custom structure.
   */
  clear() {
    this.track.clear();
    this.knob.clear();
  }
}
