import { MODULE_ID, TYPES } from "../constants.mjs";
import { isLaser, getLaserData, updateLaserData } from "../laser-data.mjs";
import { isMirror } from "../mirror-data.mjs";
import { areTokensAdjacent, getPlayerToken } from "../utils/token-helpers.mjs";
import { LaserSheet } from "../apps/laser-sheet.mjs";
import { MirrorSheet } from "../apps/mirror-sheet.mjs";
import { MirrorPlayerSheet } from "../apps/mirror-player-sheet.mjs";
import { attachLaser, detachLaser, isLaserAttachedTo } from "./attachment.mjs";
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
          new LaserSheet(tokenDoc).render(true);
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
            const current = getLaserData(tokenDoc).visible;
            await updateLaserData(tokenDoc, { visible: !current });
            refreshBeams();
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
              await detachLaser(tokenDoc);
              refreshBeams();
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
              await attachLaser(tokenDoc, pToken.document);
              refreshBeams();
              hud.render();
            }
          );
          col.appendChild(attachBtn);
        }
      }
    }
  } else if (isMirror(tokenDoc)) {
    // GM Config Button
    if (game.user.isGM) {
      const gmBtn = createHUDButton(
        "fas fa-cog",
        game.i18n.localize("LAM.sheets.mirror.title"),
        (ev) => {
          ev.stopPropagation();
          new MirrorSheet(tokenDoc).render(true);
        }
      );
      col.appendChild(gmBtn);
    }

    // Player Adjust Button
    const adjustBtn = createHUDButton(
      "fas fa-sync-alt",
      game.i18n.localize("LAM.hud.adjustMirror"),
      (ev) => {
        ev.stopPropagation();
        const playerToken = getPlayerToken();
        if (!game.user.isGM && (!playerToken || !areTokensAdjacent(playerToken, token))) {
          ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
          return;
        }
        new MirrorPlayerSheet(tokenDoc).render(true);
      }
    );
    col.appendChild(adjustBtn);
  }
}
