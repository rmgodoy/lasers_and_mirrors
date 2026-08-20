# TASK 6 — Interaction System

> **Goal:** Create HUD buttons, token hooks, and the laser attachment system for player interaction.  
> **Dependencies:** TASK_1–5 must be complete (needs all data helpers, sheets, and beam layer).  
> **Read PLAN.md first** for hooks table and interaction flows.

---

## FILES TO CREATE

### 1. `scripts/interaction/hud-buttons.mjs`

Inject custom buttons into the Token HUD for lasers and mirrors.

**Imports:**
- `{ MODULE_ID, TYPES }` from `../constants.mjs`
- `{ isLaser, getLaserData, updateLaserData }` from `../laser-data.mjs`
- `{ isMirror }` from `../mirror-data.mjs`
- `{ areTokensAdjacent, getPlayerToken }` from `../utils/token-helpers.mjs`
- `{ LaserSheet }` from `../apps/laser-sheet.mjs`
- `{ MirrorSheet }` from `../apps/mirror-sheet.mjs`
- `{ MirrorPlayerSheet }` from `../apps/mirror-player-sheet.mjs`
- `{ attachLaser, detachLaser, isLaserAttachedTo }` from `./attachment.mjs`
- `{ refreshBeams }` from `../canvas/beam-layer.mjs`

**Must export:**

```js
/**
 * Register the renderTokenHUD hook to inject custom buttons.
 * Call this once during module init.
 */
export function registerHUDHooks() {
  Hooks.on("renderTokenHUD", onRenderTokenHUD);
}
```

**Implementation of `onRenderTokenHUD(hud, html, data)`:**

The `html` parameter is a standard DOM element (NOT jQuery — Foundry V14 uses native DOM).

1. Get the token document: `const tokenDoc = hud.object.document;`
2. Get the token placeable: `const token = hud.object;`
3. Get the left column: `const col = html.querySelector(".col.left");`
4. If `col` is null, return early.

**For LASER tokens** (`isLaser(tokenDoc)`):

a. **GM Config Button** — only if `game.user.isGM`:
   - Create a `<div class="control-icon lam-hud-button">` with `<i class="fas fa-cog"></i>`
   - Title/tooltip: `game.i18n.localize("LAM.sheets.laser.title")`
   - On click: `new LaserSheet(tokenDoc).render(true)`
   - Append to `col`

b. **Toggle Button** — if `getLaserData(tokenDoc).interactable` is true:
   - Check adjacency: `const playerToken = getPlayerToken();`
   - Only show if player has a token on the scene
   - Create `<div class="control-icon lam-hud-button">` with `<i class="fas fa-power-off"></i>`
   - If laser is currently visible, add class `active`
   - Title: `game.i18n.localize("LAM.hud.toggleLaser")`
   - On click:
     ```js
     if (!areTokensAdjacent(playerToken, token)) {
       ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
       return;
     }
     const current = getLaserData(tokenDoc).visible;
     await updateLaserData(tokenDoc, { visible: !current });
     refreshBeams();
     ui.notifications.info(game.i18n.localize("LAM.notify.laserToggled"));
     hud.render();  // Re-render HUD to update active state
     ```
   - Append to `col`

c. **Attach/Detach Button** — if `getLaserData(tokenDoc).attachable` is true:
   - Only show for non-GM players with a token
   - `const playerToken = getPlayerToken();`
   - If laser is currently attached to this player's token → show "Detach" button:
     - Icon: `<i class="fas fa-unlink"></i>`
     - Title: `game.i18n.localize("LAM.hud.detachLaser")`
     - On click: `await detachLaser(tokenDoc); refreshBeams();`
   - Else → show "Attach" button:
     - Icon: `<i class="fas fa-link"></i>`
     - Title: `game.i18n.localize("LAM.hud.attachLaser")`
     - On click:
       ```js
       if (!areTokensAdjacent(playerToken, token)) {
         ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
         return;
       }
       await attachLaser(tokenDoc, playerToken.document);
       refreshBeams();
       ```
   - Append to `col`

**For MIRROR tokens** (`isMirror(tokenDoc)`):

a. **GM Config Button** — only if `game.user.isGM`:
   - Same pattern as laser GM button but opens `new MirrorSheet(tokenDoc)`

b. **Player Adjust Button** — for all users:
   - Check adjacency with player token
   - Create button with icon `<i class="fas fa-sync-alt"></i>`
   - Title: `game.i18n.localize("LAM.hud.adjustMirror")`
   - On click:
     ```js
     const playerToken = getPlayerToken();
     if (!playerToken || !areTokensAdjacent(playerToken, token)) {
       ui.notifications.warn(game.i18n.localize("LAM.notify.notAdjacent"));
       return;
     }
     new MirrorPlayerSheet(tokenDoc).render(true);
     ```
   - Append to `col`

**IMPORTANT:** Create a reusable helper function for button creation:

```js
function createHUDButton(iconClass, title, onClick) {
  const btn = document.createElement("div");
  btn.classList.add("control-icon", "lam-hud-button");
  btn.setAttribute("title", title);
  btn.innerHTML = `<i class="${iconClass}"></i>`;
  btn.addEventListener("click", onClick);
  return btn;
}
```

---

### 2. `scripts/interaction/attachment.mjs`

Laser attachment logic — attach/detach lasers to player tokens, sync on move.

**Imports:**
- `{ MODULE_ID, FLAGS }` from `../constants.mjs`
- `{ isLaser, getLaserData, updateLaserData, getAllLasers }` from `../laser-data.mjs`

**Must export:**

```js
/**
 * Attach a laser to a target token.
 * @param {TokenDocument} laserDoc - the laser token document
 * @param {TokenDocument} targetDoc - the token to attach to
 */
export async function attachLaser(laserDoc, targetDoc) {
  await updateLaserData(laserDoc, { attachedToTokenId: targetDoc.id });
  // Move the laser to the target's position
  await laserDoc.update({
    x: targetDoc.x,
    y: targetDoc.y,
    rotation: targetDoc.rotation,
  });
  ui.notifications.info(game.i18n.localize("LAM.notify.laserAttached"));
}

/**
 * Detach a laser from its attached token.
 * @param {TokenDocument} laserDoc
 */
export async function detachLaser(laserDoc) {
  await updateLaserData(laserDoc, { attachedToTokenId: null });
  ui.notifications.info(game.i18n.localize("LAM.notify.laserDetached"));
}

/**
 * Check if a laser is attached to a specific token.
 * @param {TokenDocument} laserDoc
 * @param {TokenDocument} targetDoc
 * @returns {boolean}
 */
export function isLaserAttachedTo(laserDoc, targetDoc) {
  const data = getLaserData(laserDoc);
  return data.attachedToTokenId === targetDoc.id;
}

/**
 * Sync all lasers attached to a moved token.
 * Called from the updateToken hook when a non-laser token moves.
 * @param {TokenDocument} movedTokenDoc - the token that was moved/rotated
 * @param {object} changes - the update delta (contains x, y, rotation, etc.)
 */
export async function syncAttachedLasers(movedTokenDoc, changes) {
  const lasers = getAllLasers();
  for (const laserToken of lasers) {
    const data = getLaserData(laserToken.document);
    if (data.attachedToTokenId !== movedTokenDoc.id) continue;

    // Build update: sync position and/or rotation if they changed
    const update = {};
    if ("x" in changes) update.x = changes.x;
    if ("y" in changes) update.y = changes.y;
    if ("rotation" in changes) update.rotation = changes.rotation;

    if (Object.keys(update).length > 0) {
      await laserToken.document.update(update);
    }
  }
}

/**
 * Handle deletion of a token — detach any lasers attached to it.
 * @param {TokenDocument} deletedDoc
 */
export async function handleTokenDeletion(deletedDoc) {
  // If a laser is deleted, nothing extra needed.
  // If a non-laser token is deleted, detach any lasers attached to it.
  const lasers = getAllLasers();
  for (const laserToken of lasers) {
    const data = getLaserData(laserToken.document);
    if (data.attachedToTokenId === deletedDoc.id) {
      await detachLaser(laserToken.document);
    }
  }
}
```

---

### 3. `scripts/interaction/token-hooks.mjs`

Registers all token lifecycle hooks that trigger beam refreshes and attachment syncing.

**Imports:**
- `{ MODULE_ID }` from `../constants.mjs`
- `{ isLaser }` from `../laser-data.mjs`
- `{ isModuleToken }` from `../utils/token-helpers.mjs`
- `{ refreshBeams }` from `../canvas/beam-layer.mjs`
- `{ syncAttachedLasers, handleTokenDeletion }` from `./attachment.mjs`

**Must export:**

```js
/**
 * Register all token-related hooks.
 * Call this once during module init.
 */
export function registerTokenHooks() {
  Hooks.on("updateToken", onUpdateToken);
  Hooks.on("deleteToken", onDeleteToken);
  Hooks.on("refreshToken", onRefreshToken);
}
```

**Hook implementations:**

```js
/**
 * Called when any token document is updated.
 * @param {TokenDocument} tokenDoc
 * @param {object} changes - the update delta
 * @param {object} options
 * @param {string} userId
 */
async function onUpdateToken(tokenDoc, changes, options, userId) {
  // If flags changed on a module token → refresh beams
  if (changes.flags?.[MODULE_ID]) {
    refreshBeams();
    return;
  }

  // If position or rotation changed → refresh beams + sync attachments
  const posChanged = ("x" in changes) || ("y" in changes) || ("rotation" in changes);
  if (!posChanged) return;

  // If a non-laser token moved, sync any attached lasers
  if (!isLaser(tokenDoc)) {
    await syncAttachedLasers(tokenDoc, changes);
  }

  // Always refresh beams when any position changes
  refreshBeams();
}

/**
 * Called when a token is deleted.
 */
async function onDeleteToken(tokenDoc, options, userId) {
  await handleTokenDeletion(tokenDoc);
  refreshBeams();
}

/**
 * Called when a token's visual state is refreshed (e.g., during drag).
 * Use this for real-time beam updates while dragging.
 */
function onRefreshToken(token, flags) {
  if (isModuleToken(token.document)) {
    refreshBeams();
  }
}
```

---

## VERIFICATION

1. Place two tokens on a scene. Set one as a laser via console.
2. Right-click the laser token → Token HUD should show custom buttons.
3. If laser has `interactable: true`, the toggle button should appear.
4. Set a token as a mirror, right-click → "Adjust Mirror" button should appear.
5. Test adjacency: buttons should warn when player is too far.
6. Test attachment: attach laser to player token → move player → laser follows.
7. Delete the player token → laser should detach.
8. All beams should refresh in real-time during drag operations.
9. No console errors.
