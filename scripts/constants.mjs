export const MODULE_ID = "LasersAndMirrors";

export const SOCKET_NAME = `module.${MODULE_ID}`;

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
  EMIT_LIGHT: "emitLight",
  LIGHT_RADIUS: "lightRadius",
  PROVIDES_VISION: "providesVision",
  // Mirror & Laser Rotation Limits
  LIMIT_ROTATION: "limitRotation",
  MIN_DEG: "minDeg",
  MAX_DEG: "maxDeg",
  INVERT_LIMITS: "invertLimits",
  // Mirror flags
  ORIENTATION: "orientation",
  TWO_SIDED: "twoSided",
  // Trigger flags
  ENABLED: "enabled",
  PASS_THROUGH: "passThrough",
  ON_BEAM_HIT: "onBeamHit",
  ON_BEAM_STAY: "onBeamStay",
  ON_BEAM_LOST: "onBeamLost",
};

export const TYPES = {
  LASER: "laser",
  MIRROR: "mirror",
  TRIGGER: "trigger",
};

export const LASER_DEFAULTS = {
  type: "laser",
  color: "#ff0000",
  width: 4,
  range: 30,
  intensity: 0.8,
  orientation: 0,
  visible: true,
  interactable: false,
  attachable: false,
  attachedToTokenId: null,
  emitLight: true,
  lightRadius: 1,
  providesVision: false,
  limitRotation: false,
  minDeg: 0,
  maxDeg: 360,
  invertLimits: false,
};


export const MIRROR_DEFAULTS = {
  type: "mirror",
  color: "#c0c0c0",
  width: 1,
  orientation: 0,
  twoSided: false,
  interactable: true,
  attachable: false,
  attachedToTokenId: null,
  limitRotation: false,
  minDeg: 0,
  maxDeg: 360,
  invertLimits: false,
};

export const TRIGGER_DEFAULTS = {
  type: "trigger",
  enabled: true,
  passThrough: false,
  onBeamHit: "",
  onBeamStay: "",
  onBeamLost: "",
};

/**
 * Prefixed Actor types as registered by Foundry from module.json documentTypes.
 * Foundry auto-prefixes module subtypes: "laser" becomes "LasersAndMirrors.laser".
 * Use these when comparing actor.type values.
 */
export const ACTOR_TYPES = {
  LASER: `${MODULE_ID}.laser`,
  MIRROR: `${MODULE_ID}.mirror`,
  TRIGGER: `${MODULE_ID}.trigger`,
};
