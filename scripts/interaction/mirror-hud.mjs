import { MODULE_ID } from "../constants.mjs";
import { isLaser, getLaserData, updateLaserData } from "../laser-data.mjs";
import { isMirror, getMirrorData, updateMirrorData } from "../mirror-data.mjs";
import {
  emitMirrorRotation,
  emitRotateLaser,
  emitAttachLaser,
  emitDetachLaser,
  emitAttachMirror,
  emitDetachMirror,
} from "./socket-handler.mjs";
import {
  attachLaser,
  detachLaser,
  isLaserAttachedTo,
  attachMirror,
  detachMirror,
  isMirrorAttachedTo,
  isAttachedTo,
} from "./attachment.mjs";
import { areTokensAdjacent, getPlayerToken } from "../utils/token-helpers.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * Format an angle in degrees for display:
 * Shows integer angles as e.g. "45°", and decimal angles as e.g. "45.2°".
 * @param {number} angle
 * @returns {string}
 */
export function formatAngle(angle) {
  const norm = (angle % 360 + 360) % 360;
  const rounded = Number(norm.toFixed(1));
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(1)}`;
}

/**
 * A custom PIXI HUD for interacting with mirrors and lasers.
 * Drawn as a circular track around the token with a draggable knob (for rotation),
 * real-time angle/modifier badge, and an optional Hand action button (for picking up / dropping attachable lasers and mirrors).
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

    // Angle Badge Container
    this.badgeContainer = new PIXI.Container();
    this.badgeBg = new PIXI.Graphics();
    this.badgeAngleText = new PIXI.Text("0°", {
      fontFamily: ["Signika", "Arial", "sans-serif"],
      fontSize: 13,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 3,
      fontWeight: "bold",
      align: "center",
    });
    this.badgeAngleText.anchor.set(0.5, 0.5);
    this.badgeAngleText.position.set(0, -5);

    this.badgeModeText = new PIXI.Text("1° STEP", {
      fontFamily: ["Signika", "Arial", "sans-serif"],
      fontSize: 9,
      fill: 0x88ccdd,
      stroke: 0x000000,
      strokeThickness: 2,
      fontWeight: "bold",
      align: "center",
    });
    this.badgeModeText.anchor.set(0.5, 0.5);
    this.badgeModeText.position.set(0, 7);

    this.badgeContainer.addChild(this.badgeBg);
    this.badgeContainer.addChild(this.badgeAngleText);
    this.badgeContainer.addChild(this.badgeModeText);
    
    this.addChild(this.track);
    this.addChild(this.pointerLine);
    this.addChild(this.knob);
    this.addChild(this.attachButton);
    this.addChild(this.badgeContainer);

    this.dragging = false;
    this.currentOrientation = 0;
    this._lastPointerAngle = 0;
    this._currentVirtualAngle = 0;
    this._lastDragEvent = null;

    // Throttle updates to ~10 per second for real-time syncing
    this.throttledUpdate = foundry.utils.throttle(this._emitUpdate.bind(this), 100);
    
    this._setupInteraction();
    this._setupKeyListeners();
  }

  _getPixelSize() {
    const w = this.token.w || (this.token.document.width * (canvas.grid?.size || 100));
    const h = this.token.h || (this.token.document.height * (canvas.grid?.size || 100));
    return { width: w, height: h };
  }

  /**
   * Modifier detection helpers supporting Windows and Mac.
   */
  _isShiftHeld(event) {
    if (event?.shiftKey || event?.data?.originalEvent?.shiftKey || event?.nativeEvent?.shiftKey) return true;
    const KM = foundry.helpers?.interaction?.KeyboardManager ?? globalThis.KeyboardManager;
    if (game.keyboard?.isModifierActive?.(KM?.MODIFIER_KEYS?.SHIFT ?? "Shift")) return true;
    return this._keysDown?.has("Shift") ?? false;
  }

  _isCtrlHeld(event) {
    if (
      event?.ctrlKey ||
      event?.metaKey ||
      event?.data?.originalEvent?.ctrlKey ||
      event?.data?.originalEvent?.metaKey ||
      event?.nativeEvent?.ctrlKey ||
      event?.nativeEvent?.metaKey
    ) {
      return true;
    }
    const KM = foundry.helpers?.interaction?.KeyboardManager ?? globalThis.KeyboardManager;
    if (
      game.keyboard?.isModifierActive?.(KM?.MODIFIER_KEYS?.CONTROL ?? "Control") ||
      game.keyboard?.isModifierActive?.(KM?.MODIFIER_KEYS?.ALT ?? "Alt")
    ) {
      return true;
    }
    return (this._keysDown?.has("Control") || this._keysDown?.has("Meta")) ?? false;
  }

  /**
   * Listen to key presses during HUD lifetime for dynamic modifier feedback.
   */
  _setupKeyListeners() {
    this._keysDown = new Set();
    this._onKeyDown = (e) => {
      this._keysDown.add(e.key);
      if (e.key === "Shift" || e.key === "Control" || e.key === "Meta" || e.key === "Alt") {
        this._onModifierChange(e);
      }
    };
    this._onKeyUp = (e) => {
      this._keysDown.delete(e.key);
      if (e.key === "Shift" || e.key === "Control" || e.key === "Meta" || e.key === "Alt") {
        this._onModifierChange(e);
      }
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  _removeKeyListeners() {
    if (this._onKeyDown) window.removeEventListener("keydown", this._onKeyDown);
    if (this._onKeyUp) window.removeEventListener("keyup", this._onKeyUp);
    this._keysDown?.clear();
  }

  /**
   * Handle modifier keypress state transitions dynamically.
   */
  _onModifierChange(event) {
    const isShift = this._isShiftHeld(event);
    const isCtrl = this._isCtrlHeld(event);

    if (this.dragging) {
      if (isCtrl) {
        // Snap to nearest 15°
        const snapped = Math.round(this.currentOrientation / 15) * 15;
        const normalized = (snapped % 360 + 360) % 360;
        this.currentOrientation = normalized;
        this._currentVirtualAngle = normalized;
        this._updateVisuals(this.currentOrientation, false, true);
        this._applyLocalRotation(this.currentOrientation);
        this.throttledUpdate(this.currentOrientation);
      } else if (isShift) {
        // Switch to geared micro mode anchored at current orientation
        this._currentVirtualAngle = this.currentOrientation;
        this._updateVisuals(this.currentOrientation, true, false);
      } else {
        // Return to normal 1° 1:1 tracking anchored at current orientation
        this._currentVirtualAngle = this.currentOrientation;
        this._updateVisuals(this.currentOrientation, false, false);
      }
    } else {
      this._updateBadge(this.currentOrientation, isShift, isCtrl);
    }
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
    const isMirrorToken = isMirror(this.token.document);
    const laserData = isLaserToken ? getLaserData(this.token.document) : null;
    const mirrorData = isMirrorToken ? getMirrorData(this.token.document) : null;
    const canRotate = isLaserToken
      ? (game.user.isGM || laserData?.interactable)
      : (game.user.isGM || mirrorData?.interactable !== false);
    const canAttach = isLaserToken
      ? (game.user.isGM || laserData?.attachable)
      : (game.user.isGM || mirrorData?.attachable);

    if (canRotate) {
      this.track.visible = true;
      this.pointerLine.visible = true;
      this.knob.visible = true;
      this.badgeContainer.visible = true;

      this._drawTrack();
      this._drawKnob(false);
    } else {
      this.track.visible = false;
      this.pointerLine.visible = false;
      this.knob.visible = false;
      this.badgeContainer.visible = false;
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
   * Draw the interactive circular track with 15° and 45°/90° tick marks.
   */
  _drawTrack() {
    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;

    this.track.clear();

    // 1. Transparent wide hit stroke for easy clicking/dragging anywhere on ring
    this.track.lineStyle(28, 0xffffff, 0.001);
    this.track.drawCircle(cx, cy, this.radius);

    // 2. Outer and inner subtle track borders
    this.track.lineStyle(1, 0x00e5ff, 0.2);
    this.track.drawCircle(cx, cy, this.radius + 5);
    this.track.drawCircle(cx, cy, this.radius - 5);

    // 3. Main track ring
    this.track.lineStyle(2.5, 0x00e5ff, 0.45);
    this.track.drawCircle(cx, cy, this.radius);

    // 4. Tick marks every 15 degrees around the circle
    for (let deg = 0; deg < 360; deg += 15) {
      // Convert Foundry rotation deg to math angle (0° = South, 90° = West...)
      const rad = ((deg + 90) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      let tickInner = 3;
      let tickOuter = 3;
      let tickWidth = 1;
      let tickAlpha = 0.4;
      let tickColor = 0x00e5ff;

      if (deg % 90 === 0) {
        // Major cardinal (0, 90, 180, 270)
        tickInner = 6;
        tickOuter = 6;
        tickWidth = 2;
        tickAlpha = 0.95;
        tickColor = 0xffffff;
      } else if (deg % 45 === 0) {
        // Semi-major (45, 135, 225, 315)
        tickInner = 5;
        tickOuter = 5;
        tickWidth = 1.5;
        tickAlpha = 0.75;
        tickColor = 0x66ffff;
      }

      this.track.lineStyle(tickWidth, tickColor, tickAlpha);
      this.track.moveTo(cx + (this.radius - tickInner) * cos, cy + (this.radius - tickInner) * sin);
      this.track.lineTo(cx + (this.radius + tickOuter) * cos, cy + (this.radius + tickOuter) * sin);
    }
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
    const isAttached = playerToken ? isAttachedTo(this.token.document, playerToken.document) : false;
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
    const isLaserToken = isLaser(this.token.document);
    const labelText = isAttached
      ? (isLaserToken ? (game.i18n.localize("LAM.hud.dropLaser") || "Drop") : (game.i18n.localize("LAM.hud.dropMirror") || "Drop"))
      : (isLaserToken ? (game.i18n.localize("LAM.hud.pickUpLaser") || "Pick Up") : (game.i18n.localize("LAM.hud.pickUpMirror") || "Pick Up"));
    this.attachButtonLabel.text = labelText;
    this.attachButtonLabel.y = 19;
    this.attachButtonLabel.style.fill = hovered ? 0xffffff : 0xdddddd;

    // Hit area for effortless clicking
    this.attachButton.hitArea = new PIXI.Circle(0, 0, 26);
  }

  /**
   * Draw and update the real-time angle badge.
   * @param {number} orientation
   * @param {boolean} isShift
   * @param {boolean} isCtrl
   */
  _updateBadge(orientation, isShift = false, isCtrl = false) {
    if (!this.badgeContainer.visible) return;

    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;
    const badgeY = cy + this.radius + 24;

    this.badgeContainer.position.set(cx, badgeY);

    const formatted = formatAngle(orientation);
    this.badgeAngleText.text = `${formatted}°`;

    const borderColor = isCtrl ? 0xffb74d : (isShift ? 0x66ffaa : 0x00e5ff);
    const modeText = isCtrl ? "CTRL: 15° SNAP" : (isShift ? "SHIFT: 0.2° MICRO" : "1° STEP");
    const modeColor = isCtrl ? 0xffb74d : (isShift ? 0x66ffaa : 0x88ccdd);

    this.badgeModeText.text = modeText;
    this.badgeModeText.style.fill = modeColor;

    // Draw badge background box
    const bw = 96;
    const bh = 34;
    this.badgeBg.clear();
    // Shadow / glow
    this.badgeBg.beginFill(0x000000, 0.4);
    this.badgeBg.drawRoundedRect(-bw / 2 - 1, -bh / 2 - 1, bw + 2, bh + 2, 7);
    this.badgeBg.endFill();

    // Main box
    this.badgeBg.beginFill(0x0d1522, 0.92);
    this.badgeBg.lineStyle(1.5, borderColor, 0.85);
    this.badgeBg.drawRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
    this.badgeBg.endFill();
  }

  /**
   * Update visual elements (knob position, pointer line, angle badge).
   */
  _updateVisuals(orientation, isShift = false, isCtrl = false) {
    const bounds = this._getPixelSize();
    const cx = bounds.width / 2;
    const cy = bounds.height / 2;

    // Convert Foundry rotation to math angle
    const mathRad = ((orientation + 90) * Math.PI) / 180;
    const kx = cx + this.radius * Math.cos(mathRad);
    const ky = cy + this.radius * Math.sin(mathRad);

    this.knob.x = kx;
    this.knob.y = ky;

    // Update guide line with mode-tinted theme
    this.pointerLine.clear();
    const lineColor = isCtrl ? 0xffb74d : (isShift ? 0x66ffaa : 0x00e5ff);
    this.pointerLine.lineStyle(1.5, lineColor, 0.5);
    this.pointerLine.moveTo(cx, cy);
    this.pointerLine.lineTo(kx, ky);
    this.pointerLine.beginFill(lineColor, 0.7);
    this.pointerLine.drawCircle(cx, cy, 3);
    this.pointerLine.endFill();

    // Update badge
    this._updateBadge(orientation, isShift, isCtrl);
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
    const isMirrorToken = isMirror(this.token.document);
    const laserData = isLaserToken ? getLaserData(this.token.document) : null;
    const mirrorData = isMirrorToken ? getMirrorData(this.token.document) : null;
    const canRotate = isLaserToken
      ? (game.user.isGM || laserData?.interactable)
      : (game.user.isGM || mirrorData?.interactable !== false);
    const canAttach = isLaserToken
      ? (game.user.isGM || laserData?.attachable)
      : (game.user.isGM || mirrorData?.attachable);

    if (canAttach && this.attachButton.visible) {
      this.attachButton.position.set(cx, cy - this.radius - 20);
      this._drawAttachButton(false);
    }

    if (!canRotate) return;
    if (this.dragging) return; // Don't override while dragging

    const targetOrientation = orientation !== undefined ? orientation : (this.token.document.rotation ?? 0);
    this.currentOrientation = Number(((targetOrientation % 360 + 360) % 360).toFixed(1));
    this._currentVirtualAngle = this.currentOrientation;
    
    const isShift = this._isShiftHeld();
    const isCtrl = this._isCtrlHeld();
    this._updateVisuals(this.currentOrientation, isShift, isCtrl);
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

    // Track interaction (clicking anywhere on the circular ring begins drag)
    this.track.interactive = true;
    this.track.eventMode = "static";
    this.track.cursor = "pointer";
    this.track.on("pointerdown", (event) => {
      const isShift = this._isShiftHeld(event);
      const isCtrl = this._isCtrlHeld(event);
      const clickAngle = this._getPointerFoundryAngle(event);

      if (!isShift) {
        // Normal or Ctrl: snap/jump to clicked angle
        let newAngle = isCtrl ? Math.round(clickAngle / 15) * 15 : Math.round(clickAngle);
        newAngle = (newAngle % 360 + 360) % 360;
        if (newAngle >= 360) newAngle = 0;
        this.currentOrientation = newAngle;
        this._currentVirtualAngle = newAngle;
        this._applyLocalRotation(newAngle);
        this.throttledUpdate(newAngle);
      }
      this._onDragStart(event);
      this._updateVisuals(this.currentOrientation, isShift, isCtrl);
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

    const isLaserToken = isLaser(this.token.document);
    const isAttached = isAttachedTo(this.token.document, playerToken.document);

    if (isAttached) {
      if (isLaserToken) {
        if (game.user.isGM) {
          await detachLaser(this.token.document);
          refreshBeams();
        } else {
          emitDetachLaser(this.token.document.parent.id, this.token.document.id);
        }
      } else {
        if (game.user.isGM) {
          await detachMirror(this.token.document);
          refreshBeams();
        } else {
          emitDetachMirror(this.token.document.parent.id, this.token.document.id);
        }
      }
    } else {
      if (!game.user.isGM && !areTokensAdjacent(playerToken, this.token)) {
        ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
        return;
      }
      if (isLaserToken) {
        if (game.user.isGM) {
          await attachLaser(this.token.document, playerToken.document);
          refreshBeams();
        } else {
          emitAttachLaser(this.token.document.parent.id, this.token.document.id, playerToken.document.id);
        }
      } else {
        if (game.user.isGM) {
          await attachMirror(this.token.document, playerToken.document);
          refreshBeams();
        } else {
          emitAttachMirror(this.token.document.parent.id, this.token.document.id, playerToken.document.id);
        }
      }
    }

    // Redraw attach button visual
    this._drawAttachButton(false);
  }

  /**
   * Convert pointer event position to Foundry rotation angle in degrees.
   */
  _getPointerFoundryAngle(event) {
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
    
    // Math angle in degrees
    const mathAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Convert to Foundry rotation (degrees clockwise from South: 0° = South, 90° = West, 180° = North, 270° = East)
    let foundryAngle = mathAngle - 90;
    return (foundryAngle % 360 + 360) % 360;
  }

  _onDragStart(event) {
    event.stopPropagation?.();
    if (event.data?.originalEvent) {
      event.data.originalEvent.stopPropagation?.();
    }
    
    this.dragging = true;
    this.knob.cursor = "grabbing";
    this._drawKnob(true);

    const pointerAngle = this._getPointerFoundryAngle(event);
    this._lastPointerAngle = pointerAngle;
    this._currentVirtualAngle = this.currentOrientation;
    this._lastDragEvent = event;

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
    this._lastDragEvent = event;
    event.stopPropagation?.();

    const pointerAngle = this._getPointerFoundryAngle(event);
    let delta = pointerAngle - this._lastPointerAngle;
    // Shortest angular difference (-180 to +180)
    while (delta < -180) delta += 360;
    while (delta > 180) delta -= 360;
    this._lastPointerAngle = pointerAngle;

    const isShift = this._isShiftHeld(event);
    const isCtrl = this._isCtrlHeld(event);

    let steppedRotation;
    if (isShift) {
      // 5:1 gear reduction for high precision 0.2° micro-adjustment
      this._currentVirtualAngle += delta * 0.2;
      let normalized = (this._currentVirtualAngle % 360 + 360) % 360;
      steppedRotation = Number((Math.round(normalized * 5) / 5).toFixed(1));
    } else if (isCtrl) {
      // 15° snap increment
      this._currentVirtualAngle += delta;
      let normalized = (this._currentVirtualAngle % 360 + 360) % 360;
      steppedRotation = Math.round(normalized / 15) * 15;
    } else {
      // 1° normal increment
      this._currentVirtualAngle += delta;
      let normalized = (this._currentVirtualAngle % 360 + 360) % 360;
      steppedRotation = Math.round(normalized);
    }

    if (steppedRotation >= 360) steppedRotation = 0;
    if (steppedRotation < 0) steppedRotation = 0;

    this.currentOrientation = steppedRotation;

    this._updateVisuals(steppedRotation, isShift, isCtrl);
    this._applyLocalRotation(steppedRotation);
    this.throttledUpdate(steppedRotation);
  }

  _onDragEnd(event) {
    if (!this.dragging) return;
    event?.stopPropagation?.();
    this.dragging = false;
    this._lastDragEvent = null;
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
    if (this.token?.document) {
      this.token.document.updateSource({ rotation: orientation });
      if (this.token.document.flags?.[MODULE_ID]) {
        this.token.document.flags[MODULE_ID].orientation = orientation;
      }
    }
    if (this.token?.renderFlags) {
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
    this.badgeBg.clear();
  }

  /**
   * Cleanup event listeners on destruction.
   */
  destroy(options) {
    this._removeKeyListeners();
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
