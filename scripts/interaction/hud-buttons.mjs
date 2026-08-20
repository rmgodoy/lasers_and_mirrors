import { MODULE_ID, TYPES } from "../constants.mjs";
import { isLaser, getLaserData, updateLaserData } from "../laser-data.mjs";
import { isMirror, getMirrorData } from "../mirror-data.mjs";
import { isTrigger } from "../trigger-data.mjs";
import { areTokensAdjacent, getPlayerToken } from "../utils/token-helpers.mjs";
import { LaserTokenConfigSheet } from "../apps/laser-sheet.mjs";
import { MirrorTokenConfigSheet } from "../apps/mirror-sheet.mjs";
import { TriggerTokenConfigSheet } from "../apps/trigger-sheet.mjs";
import {
  attachLaser,
  detachLaser,
  isLaserAttachedTo,
  attachMirror,
  detachMirror,
  isMirrorAttachedTo,
} from "./attachment.mjs";
import {
  emitToggleLaser,
  emitAttachLaser,
  emitDetachLaser,
  emitAttachMirror,
  emitDetachMirror,
} from "./socket-handler.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * Helper function to create a HUD button element.
 * @param {string} iconClass - FA icon class name(s)
 * @param {string} title - Button tooltip text
 * @param {Function} onClick - Click handler
 * @returns {HTMLDivElement}
 */
function createHUDButton(iconClass, title, onClick) {
  const btn = document.createElement("div");
  btn.classList.add("control-icon", "lam-hud-button");
  btn.setAttribute("title", title);
  btn.innerHTML = `<i class="${iconClass}"></i>`;
  btn.addEventListener("click", onClick);
  return btn;
}

/**
 * Register the renderTokenHUD hook to inject custom buttons.
 * Call this once during module init.
 */
export function registerHUDHooks() {
  Hooks.on("renderTokenHUD", onRenderTokenHUD);
}

/**
 * Hook handler for renderTokenHUD.
 * @param {TokenHUD} hud
 * @param {HTMLElement} html
 * @param {object} data
 */
function onRenderTokenHUD(hud, html, data) {
  const tokenDoc = hud.object.document;
  const token = hud.object;
  const col = html.querySelector(".col.left");
  if (!col) return;

  if (isLaser(tokenDoc)) {
    const laserData = getLaserData(tokenDoc);

    // GM Config Button
    if (game.user.isGM) {
      const gmBtn = createHUDButton(
        "fas fa-cog",
        game.i18n.localize("LAM.sheets.laser.title"),
        (ev) => {
          ev.stopPropagation();
          new LaserTokenConfigSheet(tokenDoc).render(true);
        }
      );
      col.appendChild(gmBtn);
    }

    // Toggle Button
    if (laserData.interactable) {
      const playerToken = getPlayerToken();
      if (playerToken || game.user.isGM) {
        const toggleBtn = createHUDButton(
          "fas fa-power-off",
          game.i18n.localize("LAM.hud.toggleLaser"),
          async (ev) => {
            ev.stopPropagation();
            const pToken = getPlayerToken();
            if (!game.user.isGM && (!pToken || !areTokensAdjacent(pToken, token))) {
              ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
              return;
            }
            const nextVisible = !laserData.visible;
            if (game.user.isGM) {
              await updateLaserData(tokenDoc, { visible: nextVisible });
              refreshBeams();
            } else {
              emitToggleLaser(tokenDoc.parent.id, tokenDoc.id, nextVisible);
            }
            ui.notifications.info(game.i18n.localize("LAM.notify.laserToggled"));
            hud.render();
          }
        );
        if (laserData.visible) {
          toggleBtn.classList.add("active");
        }
        col.appendChild(toggleBtn);
      }
    }

    // Attach / Detach Button
    if (laserData.attachable) {
      const playerToken = getPlayerToken();
      if (playerToken) {
        const attached = isLaserAttachedTo(tokenDoc, playerToken.document);
        if (attached) {
          const detachBtn = createHUDButton(
            "fas fa-unlink",
            game.i18n.localize("LAM.hud.detachLaser"),
            async (ev) => {
              ev.stopPropagation();
              if (game.user.isGM) {
                await detachLaser(tokenDoc);
                refreshBeams();
              } else {
                emitDetachLaser(tokenDoc.parent.id, tokenDoc.id);
              }
              hud.render();
            }
          );
          col.appendChild(detachBtn);
        } else {
          const attachBtn = createHUDButton(
            "fas fa-link",
            game.i18n.localize("LAM.hud.attachLaser"),
            async (ev) => {
              ev.stopPropagation();
              const pToken = getPlayerToken();
              if (!pToken || !areTokensAdjacent(pToken, token)) {
                ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
                return;
              }
              if (game.user.isGM) {
                await attachLaser(tokenDoc, pToken.document);
                refreshBeams();
              } else {
                emitAttachLaser(tokenDoc.parent.id, tokenDoc.id, pToken.document.id);
              }
              hud.render();
            }
          );
          col.appendChild(attachBtn);
        }
      }
    }
  } else if (isMirror(tokenDoc)) {
    const mirrorData = getMirrorData(tokenDoc);

    // GM Config Button
    if (game.user.isGM) {
      const gmBtn = createHUDButton(
        "fas fa-cog",
        game.i18n.localize("LAM.sheets.mirror.title"),
        (ev) => {
          ev.stopPropagation();
          new MirrorTokenConfigSheet(tokenDoc).render(true);
        }
      );
      col.appendChild(gmBtn);
    }

    // Attach / Detach Button
    if (mirrorData.attachable) {
      const playerToken = getPlayerToken();
      if (playerToken) {
        const attached = isMirrorAttachedTo(tokenDoc, playerToken.document);
        if (attached) {
          const detachBtn = createHUDButton(
            "fas fa-unlink",
            game.i18n.localize("LAM.hud.detachMirror"),
            async (ev) => {
              ev.stopPropagation();
              if (game.user.isGM) {
                await detachMirror(tokenDoc);
                refreshBeams();
              } else {
                emitDetachMirror(tokenDoc.parent.id, tokenDoc.id);
              }
              hud.render();
            }
          );
          col.appendChild(detachBtn);
        } else {
          const attachBtn = createHUDButton(
            "fas fa-link",
            game.i18n.localize("LAM.hud.attachMirror"),
            async (ev) => {
              ev.stopPropagation();
              const pToken = getPlayerToken();
              if (!pToken || !areTokensAdjacent(pToken, token)) {
                ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
                return;
              }
              if (game.user.isGM) {
                await attachMirror(tokenDoc, pToken.document);
                refreshBeams();
              } else {
                emitAttachMirror(tokenDoc.parent.id, tokenDoc.id, pToken.document.id);
              }
              hud.render();
            }
          );
          col.appendChild(attachBtn);
        }
      }
    }
  } else if (isTrigger(tokenDoc)) {
    // GM Config Button for triggers
    if (game.user.isGM) {
      const gmBtn = createHUDButton(
        "fas fa-cog",
        game.i18n.localize("LAM.hud.configureTrigger"),
        (ev) => {
          ev.stopPropagation();
          new TriggerTokenConfigSheet(tokenDoc).render(true);
        }
      );
      col.appendChild(gmBtn);
    }
  }
}


