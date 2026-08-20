import { MODULE_ID } from "../constants.mjs";
import { isLaser, getLaserData, updateLaserData } from "../laser-data.mjs";
import { updateMirrorData } from "../mirror-data.mjs";
import { emitMirrorRotation, emitRotateLaser, emitAttachLaser, emitDetachLaser } from "./socket-handler.mjs";
import { attachLaser, detachLaser, isLaserAttachedTo } from "./attachment.mjs";
import { areTokensAdjacent, getPlayerToken } from "../utils/token-helpers.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * A custom PIXI HUD for interacting with mirrors and lasers.
 * Drawn as a circular track around the token with a draggable knob (for rotation)
 * and an optional Hand action button (for picking up / dropping attachable lasers).
 */
export class MirrorHUD extends PIXI.Container {
  constructor(token) {
    super();
    this.token = token;
    this.name = "LAM-MirrorHUD";

    this.track = new PIXI.Graphics();
    this.pointerLine = new PIXI.Graphics();
    this.knob = new PIXI.Graphics();

    // Attach / Pick-Up Button Container
    this.attachButton = new PIXI.Container();
    this.attachButtonBg = new PIXI.Graphics();
    this.attachButtonIcon = new PIXI.Text("\uf256", {
      fontFamily: ["Font Awesome 6 Pro", "Font Awesome 6 Free", "FontAwesome", "Arial", "sans-serif"],
      fontSize: 16,
      fill: 0xffffff,
      fontWeight: "900",
      align: "center",
    });
    this.attachButtonIcon.anchor.set(0.5, 0.5);

    this.attachButtonLabel = new PIXI.Text("", {
      fontFamily: ["Signika", "Arial", "sans-serif"],
      fontSize: 11,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 3,
      fontWeight: "bold",
      align: "center",
    });
    this.attachButtonLabel.anchor.set(0.5, 0);

    this.attachButton.addChild(this.attachButtonBg);
    this.attachButton.addChild(this.attachButtonIcon);
    this.attachButton.addChild(this.attachButtonLabel);
    
    this.addChild(this.track);
    this.addChild(this.pointerLine);
    this.addChild(this.knob);
    this.addChild(this.attachButton);

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
   * Draw the HUD based on the token's capabilities (rotation, attachment).
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
    this.radius = Math.max(cx, cy) + 24;

    const isLaserToken = isLaser(this.token.document);
    const laserData = isLaserToken ? getLaserData(this.token.document) : null;
    const canRotate = isLaserToken ? (game.user.isGM || laserData?.interactable) : true;
    const canAttach = isLaserToken ? (game.user.isGM || laserData?.attachable) : false;

    if (canRotate) {
      this.track.visible = true;
      this.pointerLine.visible = true;
      this.knob.visible = true;

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

      this._drawKnob(false);
    } else {
      this.track.visible = false;
      this.pointerLine.visible = false;
      this.knob.visible = false;
    }

    if (canAttach) {
      this.attachButton.visible = true;
      this.attachButton.position.set(cx, cy - this.radius - 20);
      this._drawAttachButton(false);
    } else {
      this.attachButton.visible = false;
    }
    
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
   * Draw the Hand attach / pick-up button.
   * @param {boolean} [hovered=false]
   */
  _drawAttachButton(hovered = false) {
    this.attachButtonBg.clear();

    const playerToken = getPlayerToken();
    const isAttached = playerToken ? isLaserAttachedTo(this.token.document, playerToken.document) : false;
    const themeColor = isAttached ? 0xff9100 : 0x00e5ff;
    const highlightColor = isAttached ? 0xffb74d : 0x66ffff;

    // Outer glow ring
    this.attachButtonBg.beginFill(themeColor, hovered ? 0.4 : 0.2);
    this.attachButtonBg.drawCircle(0, 0, hovered ? 22 : 18);
    this.attachButtonBg.endFill();

    // Main button body
    this.attachButtonBg.beginFill(0x111622, 0.92);
    this.attachButtonBg.lineStyle(2.5, hovered ? highlightColor : themeColor, 1.0);
    this.attachButtonBg.drawCircle(0, 0, 16);
    this.attachButtonBg.endFill();

    // Icon styling
    this.attachButtonIcon.style.fill = hovered ? 0xffffff : themeColor;

    // Label text
    const labelText = isAttached
      ? (game.i18n.localize("LAM.hud.dropLaser") || "Drop")
      : (game.i18n.localize("LAM.hud.pickUpLaser") || "Pick Up");
    this.attachButtonLabel.text = labelText;
    this.attachButtonLabel.y = 19;
    this.attachButtonLabel.style.fill = hovered ? 0xffffff : 0xdddddd;

    // Hit area for effortless clicking
    this.attachButton.hitArea = new PIXI.Circle(0, 0, 26);
  }


  /**
   * Update the knob's position, guide line, and the attach button.
   * @param {number} [orientation] Optional forced orientation.
   */
  refresh(orientation) {
    if (this.token) {
      this.position.set(this.token.x, this.token.y);
    }
    
    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;
    this.radius = Math.max(cx, cy) + 24;

    const isLaserToken = isLaser(this.token.document);
    const laserData = isLaserToken ? getLaserData(this.token.document) : null;
    const canRotate = isLaserToken ? (game.user.isGM || laserData?.interactable) : true;
    const canAttach = isLaserToken ? (game.user.isGM || laserData?.attachable) : false;

    if (canAttach && this.attachButton.visible) {
      this.attachButton.position.set(cx, cy - this.radius - 20);
      this._drawAttachButton(false);
    }

    if (!canRotate) return;
    if (this.dragging) return; // Don't override while dragging

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

    // Attach / Pick-up button interaction
    this.attachButton.interactive = true;
    this.attachButton.eventMode = "static";
    this.attachButton.cursor = "pointer";
    this.attachButton.on("pointerover", () => this._drawAttachButton(true));
    this.attachButton.on("pointerout", () => this._drawAttachButton(false));
    this.attachButton.on("pointerdown", (event) => {
      event.stopPropagation?.();
      if (event.data?.originalEvent) {
        event.data.originalEvent.stopPropagation?.();
      }
    });
    this.attachButton.on("click", this._onAttachClick.bind(this));
  }

  async _onAttachClick(event) {
    event?.stopPropagation?.();
    if (event?.data?.originalEvent) {
      event.data.originalEvent.stopPropagation?.();
    }

    const playerToken = getPlayerToken();
    if (!playerToken) {
      ui.notifications.warn(game.i18n.localize("LAM.notify.noPlayerToken") || "No player token found.");
      return;
    }

    const isAttached = isLaserAttachedTo(this.token.document, playerToken.document);

    if (isAttached) {
      if (game.user.isGM) {
        await detachLaser(this.token.document);
        refreshBeams();
      } else {
        emitDetachLaser(this.token.document.parent.id, this.token.document.id);
      }
    } else {
      if (!game.user.isGM && !areTokensAdjacent(playerToken, this.token)) {
        ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
        return;
      }
      if (game.user.isGM) {
        await attachLaser(this.token.document, playerToken.document);
        refreshBeams();
      } else {
        emitAttachLaser(this.token.document.parent.id, this.token.document.id, playerToken.document.id);
      }
    }

    // Redraw attach button visual
    this._drawAttachButton(false);
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

    if (isLaser(this.token.document)) {
      if (game.user.isGM) {
        await updateLaserData(this.token.document, { orientation });
      } else {
        emitRotateLaser(
          this.token.document.parent.id,
          this.token.document.id,
          orientation
        );
      }
    } else {
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
  }


  /**
   * PIXI clear override for our custom structure.
   */
  clear() {
    this.track.clear();
    this.pointerLine.clear();
    this.knob.clear();
    this.attachButtonBg.clear();
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

