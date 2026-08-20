import { isMirror, getMirrorData } from "../mirror-data.mjs";
import { isLaser, getLaserData } from "../laser-data.mjs";
import { MirrorHUD } from "./mirror-hud.mjs";
import { areTokensAdjacent, getPlayerToken } from "../utils/token-helpers.mjs";


/**
 * Active MirrorHUD instance, if any.
 * @type {MirrorHUD|null}
 */
let activeMirrorHUD = null;

/**
 * The token that currently has a mirror HUD open.
 * @type {Token|null}
 */
let activeToken = null;

/**
 * Tracking right-mouse button down for pan vs click differentiation.
 */
let rightDownPos = null;
let isRightDown = false;

/**
 * Register the right-click rotation handler on the canvas.
 * Call once during module ready hook.
 */
export function registerMirrorRotationHandler() {
  Hooks.on("canvasReady", () => {
    _dismissHUD();
    _attachCanvasListeners();
  });

  Hooks.on("canvasTearDown", () => {
    _dismissHUD();
  });

  Hooks.on("deleteToken", (tokenDoc) => {
    if (activeToken && activeToken.id === tokenDoc.id) {
      _dismissHUD();
    }
  });

  // Also attach immediately if canvas is already ready
  if (canvas?.ready) _attachCanvasListeners();
}

/**
 * Attach right-click and pointer listeners to the canvas view.
 */
function _attachCanvasListeners() {
  const view = canvas?.app?.view ?? canvas?.app?.canvas;
  if (!view) return;

  // Prevent browser context menu on canvas
  view.removeEventListener("contextmenu", _onContextMenu);
  view.addEventListener("contextmenu", _onContextMenu);

  // Track pointerdown and pointerup for right clicks
  view.removeEventListener("pointerdown", _onPointerDown);
  view.addEventListener("pointerdown", _onPointerDown);

  view.removeEventListener("pointerup", _onPointerUp);
  view.addEventListener("pointerup", _onPointerUp);
}

/**
 * Prevent the default browser context menu on canvas.
 */
function _onContextMenu(event) {
  event.preventDefault();
}

/**
 * Track right mouse button press.
 */
function _onPointerDown(event) {
  if (event.button === 2) {
    isRightDown = true;
    rightDownPos = { x: event.clientX, y: event.clientY };
  }
}

/**
 * Handle right mouse button release.
 * Distinguishes between camera pan (dragged) and right-click (static click).
 */
function _onPointerUp(event) {
  if (event.button !== 2 || !isRightDown) return;
  isRightDown = false;

  if (!rightDownPos) return;
  const dist = Math.hypot(event.clientX - rightDownPos.x, event.clientY - rightDownPos.y);
  rightDownPos = null;

  // If the user moved more than 5 pixels while holding right click, it was a camera pan -> do nothing
  if (dist > 5) return;

  // Get canvas world coordinates
  const worldPos = _getCanvasWorldCoordinates(event.clientX, event.clientY);
  if (!worldPos) return;

  const rotatableToken = _getRotatableTokenAt(worldPos);

  if (rotatableToken) {
    // If clicking the same token that currently has the HUD open, toggle it off (dismiss)
    if (activeToken && activeToken.id === rotatableToken.id) {
      _dismissHUD();
      return;
    }

    const tokenDoc = rotatableToken.document;
    const isLaserToken = isLaser(tokenDoc);
    const isMirrorToken = isMirror(tokenDoc);

    // If it's a laser and not GM, verify interactable or attachable flag
    if (isLaserToken && !game.user.isGM) {
      const laserData = getLaserData(tokenDoc);
      if (!laserData.interactable && !laserData.attachable) {
        return;
      }
    }

    // If it's a mirror and not GM, verify interactable or attachable flag
    if (isMirrorToken && !game.user.isGM) {
      const mirrorData = getMirrorData(tokenDoc);
      if (!mirrorData.interactable && !mirrorData.attachable) {
        return;
      }
    }

    // Check adjacency for non-GM users
    if (!game.user.isGM) {
      const playerToken = getPlayerToken();
      if (!playerToken || !areTokensAdjacent(playerToken, rotatableToken)) {
        ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
        return;
      }
    }


    // Dismiss any previous HUD and show on the new rotatable token
    _dismissHUD();
    _showHUD(rotatableToken);
  } else {
    // Right-clicked anywhere else (empty canvas or non-rotatable token) -> dismiss HUD
    if (activeMirrorHUD) {
      _dismissHUD();
    }
  }
}

/**
 * Show the MirrorHUD on a token.
 * Added to canvas.interface so interaction is not clipped by token bounding box.
 * @param {Token} rotatableToken
 */
function _showHUD(rotatableToken) {
  activeToken = rotatableToken;
  activeMirrorHUD = new MirrorHUD(rotatableToken);
  activeMirrorHUD.draw();
  activeMirrorHUD.position.set(rotatableToken.x, rotatableToken.y);
  
  const parent = canvas.interface ?? canvas.stage;
  parent.addChild(activeMirrorHUD);
}

/**
 * Dismiss and destroy the active MirrorHUD.
 */
function _dismissHUD() {
  if (!activeMirrorHUD) return;

  // Final sync of current orientation
  activeMirrorHUD._emitUpdate(activeMirrorHUD.currentOrientation);

  activeMirrorHUD.clear();
  if (activeMirrorHUD.parent) {
    activeMirrorHUD.parent.removeChild(activeMirrorHUD);
  }
  activeMirrorHUD.destroy({ children: true });
  activeMirrorHUD = null;
  activeToken = null;
}

/**
 * Convert client/screen coordinates to canvas world coordinates.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, y: number }|null}
 */
function _getCanvasWorldCoordinates(clientX, clientY) {
  if (canvas.canvasCoordinatesFromClient) {
    return canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
  }

  const view = canvas?.app?.view ?? canvas?.app?.canvas;
  if (!view) return null;

  const rect = view.getBoundingClientRect();
  const scaleX = (view.width || rect.width) / rect.width;
  const scaleY = (view.height || rect.height) / rect.height;
  const screenX = (clientX - rect.left) * scaleX;
  const screenY = (clientY - rect.top) * scaleY;

  return canvas.stage.toLocal(new PIXI.Point(screenX, screenY));
}

/**
 * Find a mirror or laser token at the given canvas world position.
 * Checks topmost tokens first.
 * @param {{ x: number, y: number }} pos - canvas world coordinates
 * @returns {Token|null}
 */
function _getRotatableTokenAt(pos) {
  if (!canvas?.tokens?.placeables) return null;

  const tokens = [...canvas.tokens.placeables].reverse();
  for (const token of tokens) {
    if (!isMirror(token.document) && !isLaser(token.document)) continue;
    const x = token.x ?? token.document.x;
    const y = token.y ?? token.document.y;
    const w = token.w || (token.document.width * (canvas.grid?.size || 100));
    const h = token.h || (token.document.height * (canvas.grid?.size || 100));
    if (pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h) {
      return token;
    }
  }
  return null;
}

