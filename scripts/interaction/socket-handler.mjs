import { SOCKET_NAME, MODULE_ID } from "../constants.mjs";
import { updateMirrorData } from "../mirror-data.mjs";
import { updateLaserData } from "../laser-data.mjs";
import { attachLaser, detachLaser, attachMirror, detachMirror } from "./attachment.mjs";
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
    case "toggleMirror":
      await handleToggleMirror(data);
      break;
    case "attachLaser":
      await handleAttachLaser(data);
      break;
    case "detachLaser":
      await handleDetachLaser(data);
      break;
    case "attachMirror":
      await handleAttachMirror(data);
      break;
    case "detachMirror":
      await handleDetachMirror(data);
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
 * Handle a toggleMirror socket request from a player.
 * @param {object} data - { action, sceneId, tokenId, enabled }
 */
async function handleToggleMirror({ sceneId, tokenId, enabled }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const tokenDoc = scene.tokens.get(tokenId);
  if (!tokenDoc) return;

  await updateMirrorData(tokenDoc, { enabled });
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
 * Handle an attachMirror socket request from a player.
 * @param {object} data - { action, sceneId, mirrorTokenId, targetTokenId }
 */
async function handleAttachMirror({ sceneId, mirrorTokenId, targetTokenId }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const mirrorDoc = scene.tokens.get(mirrorTokenId);
  const targetDoc = scene.tokens.get(targetTokenId);
  if (!mirrorDoc || !targetDoc) return;

  await attachMirror(mirrorDoc, targetDoc);
  refreshBeams();
}

/**
 * Handle a detachMirror socket request from a player.
 * @param {object} data - { action, sceneId, mirrorTokenId }
 */
async function handleDetachMirror({ sceneId, mirrorTokenId }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const mirrorDoc = scene.tokens.get(mirrorTokenId);
  if (!mirrorDoc) return;

  await detachMirror(mirrorDoc);
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
 * Emit a mirror toggle request via websocket.
 * @param {string} sceneId
 * @param {string} tokenId
 * @param {boolean} enabled
 */
export function emitToggleMirror(sceneId, tokenId, enabled) {
  game.socket.emit(SOCKET_NAME, {
    action: "toggleMirror",
    sceneId,
    tokenId,
    enabled,
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

/**
 * Emit a mirror attachment request via websocket.
 * @param {string} sceneId
 * @param {string} mirrorTokenId
 * @param {string} targetTokenId
 */
export function emitAttachMirror(sceneId, mirrorTokenId, targetTokenId) {
  game.socket.emit(SOCKET_NAME, {
    action: "attachMirror",
    sceneId,
    mirrorTokenId,
    targetTokenId,
  });
}

/**
 * Emit a mirror detachment request via websocket.
 * @param {string} sceneId
 * @param {string} mirrorTokenId
 */
export function emitDetachMirror(sceneId, mirrorTokenId) {
  game.socket.emit(SOCKET_NAME, {
    action: "detachMirror",
    sceneId,
    mirrorTokenId,
  });
}

