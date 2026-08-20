# Lasers & Mirrors — Module Reference

> **Target:** Foundry VTT V14 · **Module ID:** `lasers-and-mirrors`  
> **Purpose:** Laser beams + mirror reflections for puzzles. Beams respect walls, range, and 2D reflection physics.

---

## RULES FOR ALL FILES

- Every `.mjs` file MUST be ≤ 300 lines.
- Use ES modules (`import`/`export`). No CommonJS.
- No jQuery. Use native DOM APIs.
- All UI uses `ApplicationV2` + `HandlebarsApplicationMixin`.
- All data stored via `token.document.setFlag()` / `getFlag()` — never modify core schemas.
- Module ID constant: `"lasers-and-mirrors"` — used everywhere as flag namespace.

---

## DATA SCHEMAS (stored as token flags)

### Laser: `token.document.flags["lasers-and-mirrors"]`

```json
{
  "type": "laser",
  "color": "#ff0000",
  "width": 4,
  "range": 30,
  "intensity": 0.8,
  "visible": true,
  "interactable": false,
  "attachable": false,
  "attachedToTokenId": null
}
```

### Mirror: `token.document.flags["lasers-and-mirrors"]`

```json
{
  "type": "mirror",
  "color": "#c0c0c0",
  "width": 1,
  "orientation": 0
}
```

---

## FILE TREE (create exactly these files)

```
LasersAndMirrors/
├── module.json
├── lang/en.json
├── styles/module.css
├── templates/
│   ├── laser-sheet.hbs
│   ├── mirror-sheet.hbs
│   └── mirror-player-sheet.hbs
└── scripts/
    ├── module.mjs
    ├── constants.mjs
    ├── settings.mjs
    ├── laser-data.mjs
    ├── mirror-data.mjs
    ├── utils/
    │   ├── geometry.mjs
    │   └── token-helpers.mjs
    ├── physics/
    │   ├── reflection.mjs
    │   └── ray-caster.mjs
    ├── canvas/
    │   ├── beam-layer.mjs
    │   └── beam-renderer.mjs
    ├── apps/
    │   ├── laser-sheet.mjs
    │   ├── mirror-sheet.mjs
    │   └── mirror-player-sheet.mjs
    └── interaction/
        ├── token-hooks.mjs
        ├── attachment.mjs
        └── hud-buttons.mjs
```

---

## KEY FOUNDRY V14 API PATTERNS

### Flags (read/write data on tokens)

```js
// Write
await token.document.setFlag("lasers-and-mirrors", "color", "#00ff00");
// Read
const color = token.document.getFlag("lasers-and-mirrors", "color");
// Delete
await token.document.unsetFlag("lasers-and-mirrors", "color");
// Bulk write (set entire flag object)
await token.document.update({ "flags.lasers-and-mirrors": { type: "laser", color: "#ff0000" } });
```

### ApplicationV2 Sheet

```js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class MySheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "my-sheet",
    tag: "form",
    window: { title: "My Sheet", resizable: true },
    position: { width: 400, height: 300 },
    form: { handler: MySheet.onSubmit, closeOnSubmit: true },
  };

  static PARTS = {
    form: { template: "modules/lasers-and-mirrors/templates/my-sheet.hbs" }
  };

  async _prepareContext(options) {
    return { myData: "value" };
  }

  static async onSubmit(event, form, formData) {
    // formData.object has the form values
  }
}
```

### Custom CanvasLayer

```js
class MyLayer extends CanvasLayer {
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, { name: "myLayer" });
  }
  async _draw(options) { /* add PIXI children */ }
  async _tearDown(options) { /* cleanup */ }
}
```

### PIXI.Graphics Beam Drawing

```js
const g = new PIXI.Graphics();
g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 4, color: 0xff0000, alpha: 0.8 });
this.addChild(g);
```

### Wall Collision Data

```js
for (const wall of canvas.walls.placeables) {
  const [x1, y1, x2, y2] = wall.document.c;
  // line-segment intersection test against beam ray
}
```

### Token Adjacency

```js
const result = canvas.grid.measurePath([
  { x: tokenA.center.x, y: tokenA.center.y },
  { x: tokenB.center.x, y: tokenB.center.y }
]);
const isAdjacent = result.distance <= canvas.grid.distance;
```

### Token HUD Injection

```js
Hooks.on("renderTokenHUD", (hud, html, data) => {
  const btn = document.createElement("div");
  btn.classList.add("control-icon");
  btn.innerHTML = `<i class="fas fa-lightbulb"></i>`;
  btn.addEventListener("click", () => { /* handler */ });
  html.querySelector(".col.left").appendChild(btn);
});
```

### Settings

```js
game.settings.register("lasers-and-mirrors", "maxBounces", {
  name: "LAM.settings.maxBounces.name",
  hint: "LAM.settings.maxBounces.hint",
  scope: "world",
  config: true,
  type: Number,
  default: 10,
  range: { min: 1, max: 50, step: 1 }
});
// Read: game.settings.get("lasers-and-mirrors", "maxBounces")
```

---

## SETTINGS TO REGISTER

| Key | Type | Default | Scope | Purpose |
|-----|------|---------|-------|---------|
| `maxBounces` | Number | 10 | world | Max reflections per beam |
| `beamOpacity` | Number | 0.8 | world | Beam alpha (0-1) |
| `glowEffect` | Boolean | true | world | Glow filter on beams |
| `debugMode` | Boolean | false | client | Show debug visuals |

---

## HOOKS TO USE

| Hook | What to do |
|------|-----------|
| `init` | Register settings via `settings.mjs` |
| `canvasReady` | Create + draw `BeamLayer`, add to `canvas.interface` |
| `updateToken` | Call `BeamLayer.refresh()` + handle attachment sync |
| `deleteToken` | Detach any lasers attached to deleted token |
| `refreshToken` | Call `BeamLayer.refresh()` for live drag updates |
| `renderTokenHUD` | Inject laser/mirror HUD buttons |

---

## PHYSICS: 2D REFLECTION FORMULA

```
Given:
  D = normalized incoming direction vector
  N = normalized mirror surface normal

Reflected direction:
  R = D - 2 * dot(D, N) * N

Mirror surface direction from orientation angle θ:
  surface = (cos(θ), sin(θ))
  normal  = (-sin(θ), cos(θ))
```

---

## TASK EXECUTION ORDER

Execute tasks in this exact order. Each task lists its dependencies.

1. **TASK_1** — Foundation (module.json, constants, settings, lang, CSS, entry point)
2. **TASK_2** — Data helpers (laser-data, mirror-data, token-helpers, geometry utils)
3. **TASK_3** — Physics engine (reflection math, ray caster with wall/mirror collision)
4. **TASK_4** — Canvas rendering (BeamLayer, BeamRenderer with PIXI.Graphics)
5. **TASK_5** — UI sheets (laser sheet, mirror GM sheet, mirror player sheet + templates)
6. **TASK_6** — Interaction (HUD buttons, token hooks, attachment system)
7. **TASK_7** — Integration (wire everything in module.mjs, end-to-end verification)
