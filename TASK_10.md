# TASK 10 — Rename Token-Config Sheets + Fix HUD

> **Goal:** Rename existing `LaserSheet` → `LaserTokenConfigSheet` and `MirrorSheet` → `MirrorTokenConfigSheet`. Revert them to pure `ApplicationV2` (remove broken `ItemSheetV2` base). Update HUD buttons to use the renamed classes.  
> **Dependencies:** TASK_8–9 must be complete.  
> **Read PLAN.md first** for the ApplicationV2 pattern.

---

## CONTEXT

The existing `LaserSheet` and `MirrorSheet` in `scripts/apps/` are **Token config popups** opened from the Token HUD. They take a `TokenDocument` and read/write token flags. They should NOT extend `ItemSheetV2` — that was a mistake. They must extend plain `ApplicationV2`.

TASK_9 created the proper Item sheets (`LaserItemSheet`, `MirrorItemSheet`) that extend `ItemSheetV2`. This task fixes the Token config sheets to avoid conflict.

---

## FILES TO MODIFY

### 1. `scripts/apps/laser-sheet.mjs`

**Changes to make:**

1. **Remove** the `ItemSheetV2` line:
   ```js
   // DELETE this line:
   const ItemSheetV2 = foundry.applications.sheets?.ItemSheetV2 ?? ApplicationV2;
   ```

2. **Change** the class declaration from:
   ```js
   export class LaserSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
   ```
   To:
   ```js
   export class LaserTokenConfigSheet extends HandlebarsApplicationMixin(ApplicationV2) {
   ```

3. **Fix the constructor** — revert to the simple `tokenDoc` pattern. Replace the entire constructor with:
   ```js
   constructor(tokenDoc, options = {}) {
     super(options);
     this.tokenDoc = tokenDoc;
   }
   ```

4. **Fix `_prepareContext`** — change `this.document` to `this.tokenDoc`:
   ```js
   async _prepareContext(options) {
     const data = getLaserData(this.tokenDoc);
     // ... rest stays the same
   }
   ```

5. **Fix `onSubmit`** — change `this.document` to `this.tokenDoc`:
   ```js
   static async onSubmit(event, form, formData) {
     // ... data processing stays the same ...
     await updateLaserData(this.tokenDoc, data);
     refreshBeams();
   }
   ```

6. **Fix the `form.handler` reference** in `DEFAULT_OPTIONS`:
   ```js
   form: {
     handler: LaserTokenConfigSheet.onSubmit,
     closeOnSubmit: true,
   },
   ```

**Full replacement file content:**

```js
import { MODULE_ID } from "../constants.mjs";
import { getLaserData, updateLaserData } from "../laser-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token config popup for Laser tokens (opened from Token HUD).
 * Reads/writes token flags — NOT an Item sheet.
 */
export class LaserTokenConfigSheet extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {TokenDocument} tokenDoc - the token document to configure
   * @param {object} options
   */
  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
  }

  static DEFAULT_OPTIONS = {
    id: "laser-token-config-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.laser.title",
      resizable: true,
    },
    position: { width: 380, height: "auto" },
    form: {
      handler: LaserTokenConfigSheet.onSubmit,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/laser-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return game.i18n.localize("LAM.sheets.laser.title");
  }

  /** @override */
  async _prepareContext(options) {
    const data = getLaserData(this.tokenDoc);
    return {
      color: data.color,
      width: data.width,
      range: data.range,
      intensity: data.intensity,
      visible: data.visible,
      interactable: data.interactable,
      attachable: data.attachable,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = e.target.name === "orientation" ? `${e.target.value}°` : e.target.value;
        }
      });
    });
  }

  /**
   * Handle form submission — save laser data back to token flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.visible = Boolean(data.visible);
    data.interactable = Boolean(data.interactable);
    data.attachable = Boolean(data.attachable);
    data.width = Number(data.width);
    data.range = Number(data.range);
    data.intensity = Number(data.intensity);
    await updateLaserData(this.tokenDoc, data);
    refreshBeams();
  }
}
```

---

### 2. `scripts/apps/mirror-sheet.mjs`

**Apply the same pattern as laser-sheet.mjs above.**

**Full replacement file content:**

```js
import { MODULE_ID } from "../constants.mjs";
import { getMirrorData, updateMirrorData } from "../mirror-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token config popup for Mirror tokens (opened from Token HUD).
 * Reads/writes token flags — NOT an Item sheet.
 */
export class MirrorTokenConfigSheet extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {TokenDocument} tokenDoc - the token document to configure
   * @param {object} options
   */
  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
  }

  static DEFAULT_OPTIONS = {
    id: "mirror-token-config-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.mirror.title",
      resizable: true,
    },
    position: { width: 380, height: "auto" },
    form: {
      handler: MirrorTokenConfigSheet.onSubmit,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/mirror-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return game.i18n.localize("LAM.sheets.mirror.title");
  }

  /** @override */
  async _prepareContext(options) {
    const data = getMirrorData(this.tokenDoc);
    return {
      color: data.color,
      width: data.width,
      orientation: data.orientation,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = e.target.name === "orientation" ? `${e.target.value}°` : e.target.value;
        }
      });
    });
  }

  /**
   * Handle form submission — save mirror data back to token flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.width = Number(data.width);
    data.orientation = Number(data.orientation);
    await updateMirrorData(this.tokenDoc, data);
    refreshBeams();
  }
}
```

---

### 3. `scripts/interaction/hud-buttons.mjs`

**Only two import lines change. Everything else stays exactly the same.**

**Change line 5 from:**
```js
import { LaserSheet } from "../apps/laser-sheet.mjs";
```
**To:**
```js
import { LaserTokenConfigSheet } from "../apps/laser-sheet.mjs";
```

**Change line 6 from:**
```js
import { MirrorSheet } from "../apps/mirror-sheet.mjs";
```
**To:**
```js
import { MirrorTokenConfigSheet } from "../apps/mirror-sheet.mjs";
```

**Then find-and-replace in the file body:**
- `new LaserSheet(` → `new LaserTokenConfigSheet(`
- `new MirrorSheet(` → `new MirrorTokenConfigSheet(`

There are exactly 2 occurrences to change:
1. Line ~57: `new LaserSheet(tokenDoc).render(true)` → `new LaserTokenConfigSheet(tokenDoc).render(true)`
2. Line ~137: `new MirrorSheet(tokenDoc).render(true)` → `new MirrorTokenConfigSheet(tokenDoc).render(true)`

---

## VERIFICATION

1. Reload Foundry with the module enabled.
2. Place a token on the scene. In the console, set it as a laser:
   ```js
   const t = canvas.tokens.placeables[0];
   await t.document.update({"flags.LasersAndMirrors": {type:"laser",color:"#ff0000",width:4,range:30,intensity:0.8,visible:true,interactable:false,attachable:false}});
   ```
3. Right-click the token → Token HUD should appear → click the gear icon.
4. The `LaserTokenConfigSheet` should open (not crash).
5. Submit the form → token flags should update.
6. Repeat for a mirror token.
7. No console errors.
