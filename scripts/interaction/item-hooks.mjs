import { MODULE_ID, TYPES, ITEM_TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS } from "../constants.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * Register canvas-related Item hooks: drop-to-canvas and scene control buttons.
 * Call once during module init.
 */
export function registerItemHooks() {
  Hooks.on("dropCanvasData", onDropCanvasData);
  Hooks.on("getSceneControlButtons", onGetSceneControlButtons);
}

/**
 * Handle dropping an Item of type laser or mirror onto the canvas.
 * Creates a Token with the Item's system data copied into token flags.
 * @param {Canvas} _canvas
 * @param {object} data
 * @returns {boolean|void}
 */
async function onDropCanvasData(_canvas, data) {
  if (data.type !== "Item" || !data.uuid) return;

  let item;
  try {
    item = await fromUuid(data.uuid);
  } catch (e) {
    return;
  }
  if (!item) return;

  // Check if this is one of our custom Item types (prefixed)
  const isLaserItem = item.type === ITEM_TYPES.LASER;
  const isMirrorItem = item.type === ITEM_TYPES.MIRROR;
  if (!isLaserItem && !isMirrorItem) return;

  // Read data from the Item's TypeDataModel (item.system)
  const systemData = item.system?.toObject?.() ?? { ...item.system };

  // Build flag data: merge defaults with Item system data, set the flag type
  const flagData = isLaserItem
    ? { ...LASER_DEFAULTS, ...systemData }
    : { ...MIRROR_DEFAULTS, ...systemData };

  // Grid alignment
  const center = canvas.grid.getCenterPoint({ x: data.x, y: data.y });
  const tokenData = {
    name: item.name,
    img: item.img && item.img !== "icons/svg/item-bag.svg"
      ? item.img
      : (isLaserItem ? "icons/svg/light.svg" : "icons/svg/shield.svg"),
    x: center.x - canvas.grid.size / 2,
    y: center.y - canvas.grid.size / 2,
    width: 1,
    height: 1,
    [`flags.${MODULE_ID}`]: flagData,
  };

  await TokenDocument.create(tokenData, { parent: canvas.scene });
  refreshBeams();
  return false; // Prevent default drop handling
}

/**
 * Inject 1-click creation tools into Token Controls canvas palette.
 * @param {object|Array} controls
 */
function onGetSceneControlButtons(controls) {
  let tokenControls;
  if (Array.isArray(controls)) {
    tokenControls = controls.find(c => c.name === "tokens" || c.name === "token");
  } else if (controls && typeof controls === "object") {
    tokenControls = controls.tokens ?? controls.token;
  }

  if (!tokenControls) return;

  const tools = Array.isArray(tokenControls.tools) ? tokenControls.tools : null;
  if (!tools) return;

  tools.push({
    name: "createLaser",
    title: "LAM.controls.createLaser",
    icon: "fas fa-lightbulb",
    visible: true,
    button: true,
    onClick: async () => {
      const point = canvas.grid.getTopLeftPoint(canvas.center);
      await TokenDocument.create({
        name: "Laser",
        img: "icons/svg/light.svg",
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        [`flags.${MODULE_ID}`]: { ...LASER_DEFAULTS },
      }, { parent: canvas.scene });
      refreshBeams();
    },
  });

  tools.push({
    name: "createMirror",
    title: "LAM.controls.createMirror",
    icon: "fas fa-shield-alt",
    visible: true,
    button: true,
    onClick: async () => {
      const point = canvas.grid.getTopLeftPoint(canvas.center);
      await TokenDocument.create({
        name: "Mirror",
        img: "icons/svg/shield.svg",
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        [`flags.${MODULE_ID}`]: { ...MIRROR_DEFAULTS },
      }, { parent: canvas.scene });
      refreshBeams();
    },
  });
}

