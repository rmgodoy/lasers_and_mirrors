# Goal
Have an easier way to configure the Trigger actor to change things on the scene based on the beam hitting it or not. For this we'll create a behavior system to be called in sequence from the trigger. Each trigger type will have a linked sequence of behaviors linked together and resolved when that type triggers.

# Code guidelines

I want a file per behavior type inside the Behaviors folder.
No file can have more then 300 lines. Prior reutilization and modularization of code.

# Trigger Sheet Changes

- Each trigger type (enter/exit/stay) will have a dedicated tab
- each tab will be composed of a list of behaviors
- users can add, remove and edit behaviors
- Behaviors must be edited in a new dialog that will appear when the user clicks "add" or "edit" in the behaviors list

# Behaviors

- Change light property
- Change door property
- Change tile property
- Macro call
- Read game flag
- Set game flag
- Set variable
- Conditional

## Change Light Property

I want a simple UI to enter the light source UUID, a drop down to select one of it's properties, and a field to enter the new value. And a + button to add more propreties to the same behavior, all based on the same light uuid. Each new property must have a -/trash button to remove it from the list of this behavior (minimum 1 property)

## Change Door Property

Similar to light source property, but for doors. Drop down to select one of it's properties, and a field to enter the new value. And a + button to add more propreties to the same behavior, all based on the same door uuid. Each new property must have a -/trash button to remove it from the list of this behavior (minimum 1 property).

## Change Tile Property

Similar to light source property, but for tiles. Drop down to select one of it's properties, and a field to enter the new value. And a + button to add more propreties to the same behavior, all based on the same tile uuid. Each new property must have a -/trash button to remove it from the list of this behavior (minimum 1 property).

## Macro call

Dialog with a rich text editor for macro editing (don`t use normal text edits, I think Foundry has a native code editor for macros, use that here).

## Read game flag

Uses canvas.scene.getFlag("world", $flagName) to read an arbritrary value based on an arbitrary flag name.

## Set game flag

Uses canvas.scene.setFlag("world", $flagName, $flagValue) to save an arbritrary value based on an arbitrary flag name.

## Set variable

Used to create a local temporary variable only available to this execution flow. You give it a name and a value in the ui.

## Conditional

This behavior will be responsible to make assertions between game flags or variables, we can pass a uuid from a read game flag or set variable behavior to be compared against another game flag or variable or a value. I also want to support AND and OR operations and parenthesis (for order of operations). If this condition evaluate to true, it continues the execution of the behavior graph, otherwise, it stops here.