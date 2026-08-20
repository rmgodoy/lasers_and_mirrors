# HUD Rotation: 0.2° (Shift) / 1° (Normal) / 15° Snap (Ctrl)

Update the HUD rotation for mirrors and lasers to support 3 tiers of rotation precision:
1. **Holding Shift**: **0.2°** micro adjustment per step/tick
2. **Normal (no modifiers)**: **1°** adjustment per step/tick
3. **Holding Ctrl / Cmd**: **15°** snap increments (0°, 15°, 30°, 45°, 60°, 75°, 90°, etc.)

## User Review Required

> [!NOTE]
> - Works for both **knob/track dragging** and **mouse wheel scrolling** over the HUD.
> - Modifier keys (Shift for 0.2°, Ctrl/Cmd for 15°) are detected dynamically during drag, wheel scroll, and key press.

## Proposed Changes

### Interaction Layer

#### [MODIFY] [mirror-hud.mjs](file:///c:/Users/Rodrigo/AppData/Local/FoundryVTT/Data/modules/LasersAndMirrors/scripts/interaction/mirror-hud.mjs)
- Add modifier detection helpers `_isShiftHeld(event)` and `_isCtrlHeld(event)` (supporting Windows Ctrl and Mac Meta/Command).
- Update angle calculation in `_onDragMove(event)`:
  - If **Shift held**: Step is **0.2°** (`Math.round(rawAngle * 5) / 5`).
  - If **Ctrl / Cmd held**: Step is **15°** (`Math.round(rawAngle / 15) * 15`).
  - If **Normal**: Step is **1°** (`Math.round(rawAngle)`).
- Add `_onWheel(event)` listener on the HUD:
  - Mouse wheel with **Shift**: Steps by **±0.2°**.
  - Mouse wheel with **Ctrl / Cmd**: Steps by **±15°**.
  - Mouse wheel **Normal**: Steps by **±1°**.
- Add HUD angle badge showing real-time degrees (e.g. `45.2°` or `45°`) and active mode hint (`SHIFT: 0.2°`, `CTRL: 15°`).
- Draw 15° minor and 45° major tick marks along the circular HUD track.

---

### Data Models & Templates

#### [MODIFY] [mirror-actor-model.mjs](file:///c:/Users/Rodrigo/AppData/Local/FoundryVTT/Data/modules/LasersAndMirrors/scripts/data-models/mirror-actor-model.mjs)
- Change `orientation` schema to allow floating-point values (remove `integer: true`, allow `step: 0.1`).

#### [MODIFY] [laser-actor-model.mjs](file:///c:/Users/Rodrigo/AppData/Local/FoundryVTT/Data/modules/LasersAndMirrors/scripts/data-models/laser-actor-model.mjs)
- Change `orientation` schema to allow floating-point values (remove `integer: true`, allow `step: 0.1`).

#### [MODIFY] [templates/mirror-sheet.hbs](file:///c:/Users/Rodrigo/AppData/Local/FoundryVTT/Data/modules/LasersAndMirrors/templates/mirror-sheet.hbs), [templates/mirror-player-sheet.hbs](file:///c:/Users/Rodrigo/AppData/Local/FoundryVTT/Data/modules/LasersAndMirrors/templates/mirror-player-sheet.hbs), [templates/laser-sheet.hbs](file:///c:/Users/Rodrigo/AppData/Local/FoundryVTT/Data/modules/LasersAndMirrors/templates/laser-sheet.hbs)
- Update `step="0.1"` on orientation range inputs so sliders accommodate fractional angles.

## Verification Plan

### Manual Verification
- Open HUD on mirror/laser:
  - Drag knob normally -> rotates in 1° steps.
  - Drag knob while holding Shift -> rotates in 0.2° micro steps (e.g., 45.0°, 45.2°, 45.4°).
  - Drag knob while holding Ctrl -> snaps to 15° increments (0°, 15°, 30°, 45°, 60°, 75°, 90°, etc.).
  - Hover over HUD and scroll wheel: test normal (1°), Shift (0.2°), and Ctrl (15°).
  - Verify beam raycasting reflects and updates seamlessly at decimal angles.
