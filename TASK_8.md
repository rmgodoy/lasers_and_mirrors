# TASK 8 — DataModel + Type Constants

> **Goal:** Create `TypeDataModel` classes for Laser and Mirror items so Foundry V14 knows their schema, and add prefixed type constants.  
> **Dependencies:** TASK_1–7 must be complete.  
> **Read PLAN.md first** for module ID and data schemas.

---

## CONTEXT

Foundry V14 **auto-prefixes** module subtypes defined in `module.json`. Since `module.json` has:

```json
"documentTypes": { "Item": { "laser": {}, "mirror": {} } }
```

The actual `item.type` string at runtime is `"LasersAndMirrors.laser"` and `"LasersAndMirrors.mirror"`.

Without a `TypeDataModel` registered in `CONFIG.Item.dataModels`, items created via the "Create Item" dialog have no schema defaults and no `system` data.

---

## FILES TO CREATE

### 1. `scripts/data-models/laser-item-model.mjs`

This file defines the schema for Laser items. It must be ≤ 300 lines.

**No imports needed** — uses only Foundry globals.

**Full file content (copy exactly):**

```js
/**
 * TypeDataModel for Laser items.
 * Defines the schema stored in item.system for laser-type items.
 */
export class LaserItemModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      color: new fields.ColorField({ initial: "#ff0000" }),
      width: new fields.NumberField({
        required: true,
        initial: 4,
        min: 1,
        max: 20,
        integer: true,
      }),
      range: new fields.NumberField({
        required: true,
        initial: 30,
        min: 1,
        max: 100,
        integer: true,
      }),
      intensity: new fields.NumberField({
        required: true,
        initial: 0.8,
        min: 0.1,
        max: 1,
        step: 0.1,
      }),
      visible: new fields.BooleanField({ initial: true }),
      interactable: new fields.BooleanField({ initial: false }),
      attachable: new fields.BooleanField({ initial: false }),
      attachedToTokenId: new fields.StringField({
        required: false,
        initial: null,
        nullable: true,
      }),
    };
  }
}
```

---

### 2. `scripts/data-models/mirror-item-model.mjs`

This file defines the schema for Mirror items. It must be ≤ 300 lines.

**No imports needed** — uses only Foundry globals.

**Full file content (copy exactly):**

```js
/**
 * TypeDataModel for Mirror items.
 * Defines the schema stored in item.system for mirror-type items.
 */
export class MirrorItemModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      color: new fields.ColorField({ initial: "#c0c0c0" }),
      width: new fields.NumberField({
        required: true,
        initial: 1,
        min: 0.5,
        max: 5,
        step: 0.5,
      }),
      orientation: new fields.NumberField({
        required: true,
        initial: 0,
        min: 0,
        max: 359,
        integer: true,
      }),
    };
  }
}
```

---

## FILE TO MODIFY

### 3. `scripts/constants.mjs`

Add a new `ITEM_TYPES` export with the **prefixed** type strings that match what Foundry stores at runtime. Do NOT change the existing `TYPES` export (it is still used for token flags).

**Add these lines at the end of the existing file, after the `MIRROR_DEFAULTS` export:**

```js
/**
 * Prefixed Item types as registered by Foundry from module.json documentTypes.
 * Foundry auto-prefixes module subtypes: "laser" becomes "LasersAndMirrors.laser".
 * Use these when comparing item.type values.
 */
export const ITEM_TYPES = {
  LASER: `${MODULE_ID}.laser`,
  MIRROR: `${MODULE_ID}.mirror`,
};
```

**The final `constants.mjs` file should have these exports:**
- `MODULE_ID` (unchanged)
- `FLAGS` (unchanged)
- `TYPES` (unchanged)
- `LASER_DEFAULTS` (unchanged)
- `MIRROR_DEFAULTS` (unchanged)
- `ITEM_TYPES` (new)

---

## VERIFICATION

Run this in the Foundry browser console after applying changes and reloading:

```js
// Check the module is loaded
const mod = await import("modules/LasersAndMirrors/scripts/constants.mjs");
console.log("ITEM_TYPES:", mod.ITEM_TYPES);
// Expected: { LASER: "LasersAndMirrors.laser", MIRROR: "LasersAndMirrors.mirror" }

// Check DataModels are NOT yet registered (they will be wired in TASK_11)
// This is just to confirm the files parse without errors:
const lm = await import("modules/LasersAndMirrors/scripts/data-models/laser-item-model.mjs");
const mm = await import("modules/LasersAndMirrors/scripts/data-models/mirror-item-model.mjs");
console.log("LaserItemModel:", lm.LaserItemModel);
console.log("MirrorItemModel:", mm.MirrorItemModel);
// Both should print class constructors, no errors
```

No console errors should appear.
