import { SOCKET_NAME, MODULE_ID } from "../constants.mjs";
import { updateMirrorData } from "../mirror-data.mjs";
import { updateLaserData } from "../laser-data.mjs";
import { attachLaser, detachLaser } from "./attachment.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * Register the module socket listener.
 * Call once during module ready hook.
 */
export function registerSocketHandler() {
  game.socket.on(SOCKET_NAME, onSocketMessage);
}

/**
 * Handle incoming socket messages.
 * Only the GM processes write operations.
 * @param {object} data - the socket message payload
 */
async function onSocketMessage(data) {
  if (!game.user.isGM) return;

  switch (data.action) {
    case "rotateMirror":
      await handleRotateMirror(data);
      break;
    case "rotateLaser":
      await handleRotateLaser(data);
      break;
    case "toggleLaser":
      await handleToggleLaser(data);
      break;
    case "attachLaser":
      await handleAttachLaser(data);
      break;
    case "detachLaser":
      await handleDetachLaser(data);
      break;
    default:
      console.warn(`${MODULE_ID} | Unknown socket action: ${data.action}`);
  }
}

/**
 * Handle a rotateLaser socket request from a player.
 * @param {object} data - { action, sceneId, tokenId, orientation }
 */
async function handleRotateLaser({ sceneId, tokenId, orientation }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const tokenDoc = scene.tokens.get(tokenId);
  if (!tokenDoc) return;

  await updateLaserData(tokenDoc, { orientation });
  refreshBeams();
}


/**
 * Handle a rotateMirror socket request from a player.
 * @param {object} data - { action, sceneId, tokenId, orientation }
 */
async function handleRotateMirror({ sceneId, tokenId, orientation }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const tokenDoc = scene.tokens.get(tokenId);
  if (!tokenDoc) return;

  await updateMirrorData(tokenDoc, { orientation });
  refreshBeams();
}

/**
 * Handle a toggleLaser socket request from a player.
 * @param {object} data - { action, sceneId, tokenId, visible }
 */
async function handleToggleLaser({ sceneId, tokenId, visible }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const tokenDoc = scene.tokens.get(tokenId);
  if (!tokenDoc) return;

  await updateLaserData(tokenDoc, { visible });
  refreshBeams();
}

/**
 * Handle an attachLaser socket request from a player.
 * @param {object} data - { action, sceneId, laserTokenId, targetTokenId }
 */
async function handleAttachLaser({ sceneId, laserTokenId, targetTokenId }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const laserDoc = scene.tokens.get(laserTokenId);
  const targetDoc = scene.tokens.get(targetTokenId);
  if (!laserDoc || !targetDoc) return;

  await attachLaser(laserDoc, targetDoc);
  refreshBeams();
}

/**
 * Handle a detachLaser socket request from a player.
 * @param {object} data - { action, sceneId, laserTokenId }
 */
async function handleDetachLaser({ sceneId, laserTokenId }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const laserDoc = scene.tokens.get(laserTokenId);
  if (!laserDoc) return;

  await detachLaser(laserDoc);
  refreshBeams();
}

/**
 * Emit a mirror rotation request via websocket.
 * @param {string} sceneId
 * @param {string} tokenId
 * @param {number} orientation
 */
export function emitMirrorRotation(sceneId, tokenId, orientation) {
  game.socket.emit(SOCKET_NAME, {
    action: "rotateMirror",
    sceneId,
    tokenId,
    orientation,
  });
}

/**
 * Emit a laser rotation request via websocket.
 * @param {string} sceneId
 * @param {string} tokenId
 * @param {number} orientation
 */
export function emitRotateLaser(sceneId, tokenId, orientation) {
  game.socket.emit(SOCKET_NAME, {
    action: "rotateLaser",
    sceneId,
    tokenId,
    orientation,
  });
}


/**
 * Emit a laser toggle request via websocket.
 * @param {string} sceneId
 * @param {string} tokenId
 * @param {boolean} visible
 */
export function emitToggleLaser(sceneId, tokenId, visible) {
  game.socket.emit(SOCKET_NAME, {
    action: "toggleLaser",
    sceneId,
    tokenId,
    visible,
  });
}

/**
 * Emit a laser attachment request via websocket.
 * @param {string} sceneId
 * @param {string} laserTokenId
 * @param {string} targetTokenId
 */
export function emitAttachLaser(sceneId, laserTokenId, targetTokenId) {
  game.socket.emit(SOCKET_NAME, {
    action: "attachLaser",
    sceneId,
    laserTokenId,
    targetTokenId,
  });
}

/**
 * Emit a laser detachment request via websocket.
 * @param {string} sceneId
 * @param {string} laserTokenId
 */
export function emitDetachLaser(sceneId, laserTokenId) {
  game.socket.emit(SOCKET_NAME, {
    action: "detachLaser",
    sceneId,
    laserTokenId,
  });
}

