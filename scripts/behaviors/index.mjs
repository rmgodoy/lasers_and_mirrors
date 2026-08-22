import { BehaviorRegistry } from "./behavior-registry.mjs";
import { ChangeLightPropertyBehavior } from "./behavior-light.mjs";
import { ChangeDoorPropertyBehavior } from "./behavior-door.mjs";
import { ChangeTilePropertyBehavior } from "./behavior-tile.mjs";
import { MacroCallBehavior } from "./behavior-macro.mjs";
import { ReadGameFlagBehavior } from "./behavior-read-flag.mjs";
import { SetGameFlagBehavior } from "./behavior-set-flag.mjs";
import { SetVariableBehavior } from "./behavior-set-variable.mjs";
import { ReadTriggerStateBehavior } from "./behavior-read-trigger.mjs";
import { ConditionalBehavior } from "./behavior-conditional.mjs";

/**
 * Register all built-in trigger behavior types with the registry.
 */
export function registerAllBehaviors() {
  BehaviorRegistry.register(ChangeLightPropertyBehavior);
  BehaviorRegistry.register(ChangeDoorPropertyBehavior);
  BehaviorRegistry.register(ChangeTilePropertyBehavior);
  BehaviorRegistry.register(MacroCallBehavior);
  BehaviorRegistry.register(ReadGameFlagBehavior);
  BehaviorRegistry.register(SetGameFlagBehavior);
  BehaviorRegistry.register(SetVariableBehavior);
  BehaviorRegistry.register(ReadTriggerStateBehavior);
  BehaviorRegistry.register(ConditionalBehavior);
}

// Auto-register built-in behaviors
registerAllBehaviors();

export {
  BehaviorRegistry,
  ChangeLightPropertyBehavior,
  ChangeDoorPropertyBehavior,
  ChangeTilePropertyBehavior,
  MacroCallBehavior,
  ReadGameFlagBehavior,
  SetGameFlagBehavior,
  SetVariableBehavior,
  ReadTriggerStateBehavior,
  ConditionalBehavior,
};
