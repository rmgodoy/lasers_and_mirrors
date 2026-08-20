# TASK 5 — UI Sheets & Templates

> **Goal:** Create the ApplicationV2 sheets and Handlebars templates for laser config, mirror config, and player mirror control.  
> **Dependencies:** TASK_1, TASK_2 must be complete (needs `constants.mjs`, data helpers, `module.css`).  
> **Read PLAN.md first** for the ApplicationV2 pattern.

---

## FILES TO CREATE

### 1. `templates/laser-sheet.hbs`

Handlebars template for the GM laser configuration sheet.

**Context variables available** (provided by `_prepareContext`):
- `color` (string), `width` (number), `range` (number), `intensity` (number)
- `visible` (boolean), `interactable` (boolean), `attachable` (boolean)

**Template structure:**

```handlebars
<div class="lasers-and-mirrors-sheet">
  <h2>{{localize "LAM.sheets.laser.title"}}</h2>

  <div class="form-group">
    <label for="color">{{localize "LAM.labels.color"}}</label>
    <input type="color" name="color" value="{{color}}"/>
  </div>

  <div class="form-group">
    <label for="width">{{localize "LAM.labels.width"}}</label>
    <input type="range" name="width" min="1" max="20" step="1" value="{{width}}"/>
    <span class="range-value">{{width}}</span>
  </div>

  <div class="form-group">
    <label for="range">{{localize "LAM.labels.range"}}</label>
    <input type="number" name="range" min="1" max="100" step="1" value="{{range}}"/>
  </div>

  <div class="form-group">
    <label for="intensity">{{localize "LAM.labels.intensity"}}</label>
    <input type="range" name="intensity" min="0.1" max="1" step="0.1" value="{{intensity}}"/>
    <span class="range-value">{{intensity}}</span>
  </div>

  <div class="form-group">
    <label for="visible">{{localize "LAM.labels.visible"}}</label>
    <input type="checkbox" name="visible" {{checked visible}}/>
  </div>

  <div class="form-group">
    <label for="interactable">{{localize "LAM.labels.interactable"}}</label>
    <input type="checkbox" name="interactable" {{checked interactable}}/>
  </div>

  <div class="form-group">
    <label for="attachable">{{localize "LAM.labels.attachable"}}</label>
    <input type="checkbox" name="attachable" {{checked attachable}}/>
  </div>

  <button type="submit"><i class="fas fa-save"></i> {{localize "Save"}}</button>
</div>
```

---

### 2. `templates/mirror-sheet.hbs`

GM mirror configuration template.

**Context variables:** `color` (string), `width` (number), `orientation` (number)

```handlebars
<div class="lasers-and-mirrors-sheet">
  <h2>{{localize "LAM.sheets.mirror.title"}}</h2>

  <div class="form-group">
    <label for="color">{{localize "LAM.labels.color"}}</label>
    <input type="color" name="color" value="{{color}}"/>
  </div>

  <div class="form-group">
    <label for="width">{{localize "LAM.labels.width"}}</label>
    <input type="number" name="width" min="0.5" max="5" step="0.5" value="{{width}}"/>
  </div>

  <div class="form-group">
    <label for="orientation">{{localize "LAM.labels.orientation"}}</label>
    <input type="range" name="orientation" min="0" max="359" step="1" value="{{orientation}}"/>
    <span class="range-value">{{orientation}}°</span>
  </div>

  <button type="submit"><i class="fas fa-save"></i> {{localize "Save"}}</button>
</div>
```

---

### 3. `templates/mirror-player-sheet.hbs`

Simplified player-only mirror control — just the orientation slider.

**Context variables:** `orientation` (number)

```handlebars
<div class="lasers-and-mirrors-sheet">
  <h2>{{localize "LAM.sheets.mirrorPlayer.title"}}</h2>

  <div class="form-group">
    <label for="orientation">{{localize "LAM.labels.orientation"}}</label>
    <input type="range" name="orientation" min="0" max="359" step="1" value="{{orientation}}"/>
    <span class="range-value">{{orientation}}°</span>
  </div>

  <button type="submit"><i class="fas fa-save"></i> {{localize "Save"}}</button>
</div>
```

---

### 4. `scripts/apps/laser-sheet.mjs`

GM-only laser configuration sheet.

**Imports:**
- `{ MODULE_ID }` from `../constants.mjs`
- `{ getLaserData, updateLaserData }` from `../laser-data.mjs`
- `{ refreshBeams }` from `../canvas/beam-layer.mjs`

**Full implementation:**

```js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class LaserSheet extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {TokenDocument} tokenDoc - the token document to configure
   * @param {object} options
   */
  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
  }

  static DEFAULT_OPTIONS = {
    id: "laser-sheet-{id}",       // {id} is replaced per instance
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.laser.title",
      resizable: true,
    },
    position: { width: 380, height: "auto" },
    form: {
      handler: LaserSheet.onSubmit,
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

  /**
   * Handle form submission — save laser data back to token flags.
   */
  static async onSubmit(event, form, formData) {
    const data = formData.object;
    // Checkboxes not present in formData when unchecked — default to false
    data.visible = data.visible ?? false;
    data.interactable = data.interactable ?? false;
    data.attachable = data.attachable ?? false;
    await updateLaserData(this.tokenDoc, data);
    refreshBeams();
  }
}
```

---

### 5. `scripts/apps/mirror-sheet.mjs`

GM-only mirror configuration sheet. Same pattern as `LaserSheet`.

**Imports:**
- `{ MODULE_ID }` from `../constants.mjs`
- `{ getMirrorData, updateMirrorData }` from `../mirror-data.mjs`
- `{ refreshBeams }` from `../canvas/beam-layer.mjs`

**Implementation:** Follow the same pattern as `LaserSheet` but:
- Class name: `MirrorSheet`
- `id`: `"mirror-sheet-{id}"`
- `title` i18n key: `"LAM.sheets.mirror.title"`
- Template path: `modules/${MODULE_ID}/templates/mirror-sheet.hbs`
- Context returns: `{ color, width, orientation }` from `getMirrorData()`
- Submit handler updates mirror data via `updateMirrorData()` then calls `refreshBeams()`

---

### 6. `scripts/apps/mirror-player-sheet.mjs`

Player-facing mirror control — only orientation slider. Includes adjacency check.

**Imports:**
- `{ MODULE_ID }` from `../constants.mjs`
- `{ getMirrorData, updateMirrorData }` from `../mirror-data.mjs`
- `{ refreshBeams }` from `../canvas/beam-layer.mjs`

**Implementation:**

```js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MirrorPlayerSheet extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(tokenDoc, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
  }

  static DEFAULT_OPTIONS = {
    id: "mirror-player-sheet-{id}",
    tag: "form",
    classes: ["lasers-and-mirrors-sheet"],
    window: {
      title: "LAM.sheets.mirrorPlayer.title",
      resizable: false,
    },
    position: { width: 320, height: "auto" },
    form: {
      handler: MirrorPlayerSheet.onSubmit,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/mirror-player-sheet.hbs`,
    },
  };

  get title() {
    return game.i18n.localize("LAM.sheets.mirrorPlayer.title");
  }

  async _prepareContext(options) {
    const data = getMirrorData(this.tokenDoc);
    return { orientation: data.orientation };
  }

  static async onSubmit(event, form, formData) {
    const { orientation } = formData.object;
    await updateMirrorData(this.tokenDoc, { orientation: Number(orientation) });
    refreshBeams();
  }
}
```

---

## VERIFICATION

1. Import and test a sheet from the browser console:
```js
const mod = await import("modules/lasers-and-mirrors/scripts/apps/laser-sheet.mjs");
const token = canvas.tokens.placeables[0];
// First set it as a laser
await token.document.update({"flags.lasers-and-mirrors": {type:"laser",color:"#ff0000",width:4,range:30,intensity:0.8,visible:true,interactable:false,attachable:false}});
// Open the sheet
new mod.LaserSheet(token.document).render(true);
```
2. The sheet window should open with all fields populated.
3. Submitting the form should update the token's flags.
4. Same test for `MirrorSheet` and `MirrorPlayerSheet`.
5. No console errors.
