# Goal

Create a module for Foundry V14 to simulate laser and mirrors so we can have puzzles related to it.

# Lasers

Lasers are light emitting objects that will emit a beam of light in the direction where its token is headed.
A laser will have a sheet to control it`s appearance and range. 
Data model:
- Color: color of the light
- Width: width of the beam
- Range: total allowed range of the beam
- Intensity: intensity of the light
- Visible: to enable disable the light laser beam and all its interactions
- Interactable: boolean to control if the laser is player interactable or not.
- attachable: boolean to control if the laser can be attached to a token or object.
- tokenId: the id of the token the laser is attached to.

# Mirrors

Mirrors are objects that can reflect a laser beam.
A mirror reflects a beam of laser (and only laser, not other light sources in the scene) based on the its orientation. It must be facing the laser beam to reflect it. Must simulate phisics in a 2d plane for the laser and make the light bounce correctly. It must respect the light range. It must respect objects and walls in the scene.
A mirror blocks the light and reflects it, other light sources are not affected, laser beams cannot pass through a mirror.
A mirror will have a sheet to control it`s appearance and orientation.
Data model:
- Color: color of the mirror
- Width: width of the mirror
- Orientation: orientation of the mirror

# Features

- A player with a token adjacent to a mirro must be able to open the mirror sheet and will find only a slider to control it's orientation.
- A player may be able to interact with a laser to turn it on and off.
- Attachable lasers can be carried around by players, by letting a adjacent player attach the laser to himslef (his token). When the player moves the token the laser must follow it. The laser will face the same direction as the player token.

