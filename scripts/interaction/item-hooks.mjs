import { MODULE_ID, TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS } from "../constants.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";
import { LaserSheet } from "../apps/laser-sheet.mjs";
import { MirrorSheet } from "../apps/mirror-sheet.mjs";

const Items = foundry.documents?.collections?.Items ?? globalThis.Items;
const TokenDocument = foundry.documents?.TokenDocument ?? globalThis.TokenDocument;

/**
 * Register Item sheets and Canvas Control hooks for Laser/Mirror creation.
 */
export function registerItemHooks() {
  Items.registerSheet(MODULE_ID, LaserSheet, {
    types: [TYPES.LASER],
    makeDefault: true,
    label: "LAM.sheets.laser.title"
  });

  Items.registerSheet(MODULE_ID, MirrorSheet, {
    types: [TYPES.MIRROR],
    makeDefault: true,
    label: "LAM.sheets.mirror.title"
  });

  Hooks.on("preCreateItem", onPreCreateItem);
  Hooks.on("dropCanvasData", onDropCanvasData);
  Hooks.on("getSceneControlButtons", onGetSceneControlButtons);
}

/**
 * Pre-create hook to assign default flags to laser/mirror Items.
 * @param {ItemDocument} item
 * @param {object} data
 * @param {object} options
 * @param {string} userId
 */
function onPreCreateItem(item, data, options, userId) {
  if (item.type === TYPES.LASER) {
    const existing = item.flags?.[MODULE_ID] ?? {};
    item.updateSource({
      img: item.img === "icons/svg/item-bag.svg" ? "icons/svg/light.svg" : item.img,
      [`flags.${MODULE_ID}`]: { ...LASER_DEFAULTS, ...existing }
    });
  } else if (item.type === TYPES.MIRROR) {
    const existing = item.flags?.[MODULE_ID] ?? {};
    item.updateSource({
      img: item.img === "icons/svg/item-bag.svg" ? "icons/svg/shield.svg" : item.img,
      [`flags.${MODULE_ID}`]: { ...MIRROR_DEFAULTS, ...existing }
    });
  }
}

/**
 * Handle dropping an Item of type laser or mirror onto the canvas.
 * @param {Canvas} canvas
 * @param {object} data
 * @returns {boolean|void}
 */
async function onDropCanvasData(canvas, data) {
  if (data.type !== "Item" || !data.uuid) return;
  const item = await fromDropData(data);
  if (!item) return;

  const flagData = item.flags?.[MODULE_ID];
  const itemType = item.type;
  const isLaserItem = itemType === TYPES.LASER || flagData?.type === TYPES.LASER;
  const isMirrorItem = itemType === TYPES.MIRROR || flagData?.type === TYPES.MIRROR;

  if (!isLaserItem && !isMirrorItem) return;

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
    [`flags.${MODULE_ID}`]: isLaserItem
      ? { ...LASER_DEFAULTS, ...(flagData ?? {}) }
      : { ...MIRROR_DEFAULTS, ...(flagData ?? {}) }
  };

  await TokenDocument.create(tokenData, { parent: canvas.scene });
  refreshBeams();
  return false;
}

/**
 * Inject 1-click creation tools into Token Controls canvas palette.
 * @param {Array} controls
 */
function onGetSceneControlButtons(controls) {
  const tokenControls = controls.find(c => c.name === "token");
  if (!tokenControls) return;

  tokenControls.tools.push({
    name: "createLaser",
    title: "LAM.controls.createLaser",
    icon: "fas fa-lightbulb",
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
        [`flags.${MODULE_ID}`]: { ...LASER_DEFAULTS }
      }, { parent: canvas.scene });
      refreshBeams();
    }
  });

  tokenControls.tools.push({
    name: "createMirror",
    title: "LAM.controls.createMirror",
    icon: "fas fa-shield-alt",
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
        [`flags.${MODULE_ID}`]: { ...MIRROR_DEFAULTS }
      }, { parent: canvas.scene });
      refreshBeams();
    }
  });
}
