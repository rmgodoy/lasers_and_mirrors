export const MODULE_ID = "lasers-and-mirrors";

export const FLAGS = {
  TYPE: "type",
  // Laser flags
  COLOR: "color",
  WIDTH: "width",
  RANGE: "range",
  INTENSITY: "intensity",
  VISIBLE: "visible",
  INTERACTABLE: "interactable",
  ATTACHABLE: "attachable",
  ATTACHED_TO_TOKEN_ID: "attachedToTokenId",
  // Mirror flags
  ORIENTATION: "orientation",
};

export const TYPES = {
  LASER: "laser",
  MIRROR: "mirror",
};

export const LASER_DEFAULTS = {
  type: "laser",
  color: "#ff0000",
  width: 4,
  range: 30,
  intensity: 0.8,
  visible: true,
  interactable: false,
  attachable: false,
  attachedToTokenId: null,
};

export const MIRROR_DEFAULTS = {
  type: "mirror",
  color: "#c0c0c0",
  width: 1,
  orientation: 0,
};
