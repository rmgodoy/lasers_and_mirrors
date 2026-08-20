import { SOCKET_NAME, MODULE_ID } from "../constants.mjs";
import { updateMirrorData } from "../mirror-data.mjs";
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
    default:
      console.warn(`${MODULE_ID} | Unknown socket action: ${data.action}`);
  }
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
 * Emit a mirror rotation request via websocket.
 * Called by the MirrorHUD when the user is not GM.
 * @param {string} sceneId - the scene ID containing the token
 * @param {string} tokenId - the mirror token ID
 * @param {number} orientation - the new orientation in degrees
 */
export function emitMirrorRotation(sceneId, tokenId, orientation) {
  game.socket.emit(SOCKET_NAME, {
    action: "rotateMirror",
    sceneId,
    tokenId,
    orientation,
  });
}
