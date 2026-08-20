# TASK 9 — Item Sheets (for Items Sidebar)

> **Goal:** Create proper `ItemSheetV2`-based sheets that open when a Laser or Mirror Item is clicked in the Items sidebar. These read/write from `item.system.*` (the TypeDataModel fields).  
> **Dependencies:** TASK_8 must be complete (needs DataModels and `ITEM_TYPES` constant).  
> **Read PLAN.md first** for the ApplicationV2 pattern.

---

## CONTEXT

The existing `LaserSheet` and `MirrorSheet` classes in `scripts/apps/` are **Token config sheets** — they take a `TokenDocument` and read/write token flags. They are NOT proper Foundry Item sheets.

This task creates **new** Item sheet classes that:
1. Extend `ItemSheetV2` (from `foundry.applications.sheets`)
2. Read from `this.document.system` (the TypeDataModel)
3. Write via `this.document.update({ system: { ... } })`
4. Reuse the existing `.hbs` templates

These sheets will be registered in TASK_11 via `DocumentSheetConfig.registerSheet`.

**IMPORTANT:** Do NOT modify or delete the existing `laser-sheet.mjs` or `mirror-sheet.mjs`. Those will be renamed in TASK_10.

---

## FILES TO CREATE

### 1. `scripts/apps/laser-item-sheet.mjs`

**Imports:**
- `{ MODULE_ID }` from `../constants.mjs`

**Full file content (copy exactly):**

```js
import { MODULE_ID } from "../constants.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Item sheet for Laser items (opened from Items sidebar).
 * Reads/writes from item.system (the TypeDataModel).
 */
export class LaserItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["lasers-and-mirrors-sheet"],
    position: { width: 380, height: "auto" },
    window: {
      resizable: true,
    },
    form: {
      handler: LaserItemSheet.onSubmit,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/laser-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return `${game.i18n.localize("LAM.sheets.laser.title")}: ${this.document.name}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    context.color = sys.color;
    context.width = sys.width;
    context.range = sys.range;
    context.intensity = sys.intensity;
    context.visible = sys.visible;
    context.interactable = sys.interactable;
    context.attachable = sys.attachable;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = e.target.value;
        }
      });
    });
  }

  /**
   * Handle form submission — save data to item.system.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.visible = Boolean(data.visible);
    data.interactable = Boolean(data.interactable);
    data.attachable = Boolean(data.attachable);
    data.width = Number(data.width);
    data.range = Number(data.range);
    data.intensity = Number(data.intensity);
    await this.document.update({ system: data });
  }
}
```

---

### 2. `scripts/apps/mirror-item-sheet.mjs`

**Imports:**
- `{ MODULE_ID }` from `../constants.mjs`

**Full file content (copy exactly):**

```js
import { MODULE_ID } from "../constants.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Item sheet for Mirror items (opened from Items sidebar).
 * Reads/writes from item.system (the TypeDataModel).
 */
export class MirrorItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["lasers-and-mirrors-sheet"],
    position: { width: 380, height: "auto" },
    window: {
      resizable: true,
    },
    form: {
      handler: MirrorItemSheet.onSubmit,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/mirror-sheet.hbs`,
    },
  };

  /** @override */
  get title() {
    return `${game.i18n.localize("LAM.sheets.mirror.title")}: ${this.document.name}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    context.color = sys.color;
    context.width = sys.width;
    context.orientation = sys.orientation;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const span = e.target.nextElementSibling;
        if (span && span.classList.contains("range-value")) {
          span.textContent = e.target.name === "orientation"
            ? `${e.target.value}°`
            : e.target.value;
        }
      });
    });
  }

  /**
   * Handle form submission — save data to item.system.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    data.width = Number(data.width);
    data.orientation = Number(data.orientation);
    await this.document.update({ system: data });
  }
}
```

---

## VERIFICATION

These sheets cannot be fully tested until TASK_11 wires the DataModel registration and sheet registration into `module.mjs`. For now, verify the files parse without errors:

```js
const ls = await import("modules/LasersAndMirrors/scripts/apps/laser-item-sheet.mjs");
const ms = await import("modules/LasersAndMirrors/scripts/apps/mirror-item-sheet.mjs");
console.log("LaserItemSheet:", ls.LaserItemSheet);
console.log("MirrorItemSheet:", ms.MirrorItemSheet);
// Both should print class constructors, no errors
```
