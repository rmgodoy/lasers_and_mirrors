import { MODULE_ID, ACTOR_TYPES, LASER_DEFAULTS, MIRROR_DEFAULTS, TRIGGER_DEFAULTS } from "../constants.mjs";
import { updateLaserData } from "../laser-data.mjs";
import { updateMirrorData } from "../mirror-data.mjs";
import { updateTriggerData } from "../trigger-data.mjs";
import { refreshBeams } from "../canvas/beam-layer.mjs";

/**
 * Register canvas-related Actor hooks: scene control buttons, actor pre-creation, and actor updates.
 * Call once during module init.
 */
export function registerActorHooks() {
  Hooks.on("getSceneControlButtons", onGetSceneControlButtons);
  Hooks.on("preCreateActor", onPreCreateActor);
  Hooks.on("updateActor", onUpdateActor);
}

/**
 * Hook handler for Actor document updates.
 * Keeps canvas tokens and beam rendering synchronized when an Actor is updated.
 * @param {Actor} actor
 * @param {object} changes
 * @param {object} options
 * @param {string} userId
 */
async function onUpdateActor(actor, changes, options, userId) {
  if (!actor) return;
  const isModuleActor = actor.type === ACTOR_TYPES.LASER ||
                        actor.type === ACTOR_TYPES.MIRROR ||
                        actor.type === ACTOR_TYPES.TRIGGER;
  if (!isModuleActor) return;

  if (game.user.isGM && changes.system) {
    if (actor.isToken && actor.token) {
      // Synthetic actor update: sync only its own token
      if (actor.type === ACTOR_TYPES.LASER) {
        await updateLaserData(actor.token, changes.system);
      } else if (actor.type === ACTOR_TYPES.MIRROR) {
        await updateMirrorData(actor.token, changes.system);
      } else if (actor.type === ACTOR_TYPES.TRIGGER) {
        await updateTriggerData(actor.token, changes.system);
      }
    } else if (!actor.isToken) {
      // World actor update: sync only linked tokens
      const linkedTokens = canvas.scene?.tokens?.filter(t => t.actorId === actor.id && t.isLinked);
      if (linkedTokens) {
        for (const tokenDoc of linkedTokens) {
          if (actor.type === ACTOR_TYPES.LASER) {
            await updateLaserData(tokenDoc, changes.system);
          } else if (actor.type === ACTOR_TYPES.MIRROR) {
            await updateMirrorData(tokenDoc, changes.system);
          } else if (actor.type === ACTOR_TYPES.TRIGGER) {
            await updateTriggerData(tokenDoc, changes.system);
          }
        }
      }
    }
  }

  refreshBeams();
}


/**
 * Pre-create hook for Actor documents.
 * Automatically assigns default SVG textures, prototypeToken configuration,
 * and default NONE permissions for mirrors (players interact via right-click HUD only).
 */
function onPreCreateActor(actor, data, options, userId) {
  if (actor.type === ACTOR_TYPES.LASER) {
    const defaultImg = `modules/${MODULE_ID}/assets/laser-on.svg`;
    const sysData = data.system ?? LASER_DEFAULTS;
    const proto = {
      texture: { src: defaultImg },
      width: 1,
      height: 1,
      actorLink: false,
      hidden: false,
      flags: {
        [MODULE_ID]: { ...LASER_DEFAULTS, ...sysData }
      }
    };
    actor.updateSource({
      img: data.img && data.img !== "icons/svg/mystery-man.svg" ? data.img : defaultImg,
      prototypeToken: foundry.utils.mergeObject(proto, data.prototypeToken ?? {})
    });
  } else if (actor.type === ACTOR_TYPES.MIRROR) {
    const defaultImg = `modules/${MODULE_ID}/assets/mirror.svg`;
    const sysData = data.system ?? MIRROR_DEFAULTS;
    const proto = {
      texture: { src: defaultImg },
      width: 1,
      height: 1,
      actorLink: false,
      rotation: sysData.orientation ?? MIRROR_DEFAULTS.orientation,
      flags: {
        [MODULE_ID]: { ...MIRROR_DEFAULTS, ...sysData }
      }
    };
    const ownership = {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0,
      ...(data.ownership ?? {}),
    };
    actor.updateSource({
      img: data.img && data.img !== "icons/svg/mystery-man.svg" ? data.img : defaultImg,
      ownership: ownership,
      prototypeToken: foundry.utils.mergeObject(proto, data.prototypeToken ?? {})
    });
  } else if (actor.type === ACTOR_TYPES.TRIGGER) {
    const defaultImg = `modules/${MODULE_ID}/assets/trigger.svg`;
    const sysData = data.system ?? TRIGGER_DEFAULTS;
    const proto = {
      texture: { src: defaultImg },
      width: 1,
      height: 1,
      actorLink: false,
      hidden: true,
      flags: {
        [MODULE_ID]: { ...TRIGGER_DEFAULTS, ...sysData }
      }
    };
    actor.updateSource({
      img: data.img && data.img !== "icons/svg/mystery-man.svg" ? data.img : defaultImg,
      prototypeToken: foundry.utils.mergeObject(proto, data.prototypeToken ?? {})
    });
  }
}

/**
 * Inject 1-click creation tools into Token Controls canvas palette.
 * Creates an Actor and drops a corresponding Actor-backed Token onto the canvas.
 * @param {object|Array} controls
 */
function onGetSceneControlButtons(controls) {
  let tokenControls;
  if (Array.isArray(controls)) {
    tokenControls = controls.find(c => c.name === "tokens" || c.name === "token");
  } else if (controls && typeof controls === "object") {
    tokenControls = controls.tokens ?? controls.token;
  }

  if (!tokenControls) return;

  const tools = Array.isArray(tokenControls.tools) ? tokenControls.tools : null;
  if (!tools) return;

  tools.push({
    name: "createLaser",
    title: "LAM.controls.createLaser",
    icon: "fas fa-lightbulb",
    visible: true,
    button: true,
    onClick: async () => {
      let laserActor = game.actors.find(a => a.type === ACTOR_TYPES.LASER && a.name === "Laser Default");
      if (!laserActor) {
        laserActor = await Actor.create({
          name: "Laser Default",
          type: ACTOR_TYPES.LASER,
          img: `modules/${MODULE_ID}/assets/laser-on.svg`,
          system: { ...LASER_DEFAULTS },
        });
      }

      const point = canvas.grid.getTopLeftPoint(canvas.center);
      await TokenDocument.create({
        name: "Laser",
        actorId: laserActor.id,
        actorLink: false,
        texture: { src: `modules/${MODULE_ID}/assets/laser-on.svg` },
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        hidden: false,
        [`flags.${MODULE_ID}`]: { ...LASER_DEFAULTS, ...(laserActor.system ?? {}) },
      }, { parent: canvas.scene });
      refreshBeams();
    },
  });

  tools.push({
    name: "createMirror",
    title: "LAM.controls.createMirror",
    icon: "fas fa-shield-alt",
    visible: true,
    button: true,
    onClick: async () => {
      let mirrorActor = game.actors.find(a => a.type === ACTOR_TYPES.MIRROR && a.name === "Mirror Default");
      if (!mirrorActor) {
        mirrorActor = await Actor.create({
          name: "Mirror Default",
          type: ACTOR_TYPES.MIRROR,
          img: `modules/${MODULE_ID}/assets/mirror.svg`,
          system: { ...MIRROR_DEFAULTS },
          ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0 },
        });
      }

      const point = canvas.grid.getTopLeftPoint(canvas.center);
      await TokenDocument.create({
        name: "Mirror",
        actorId: mirrorActor.id,
        actorLink: false,
        texture: { src: `modules/${MODULE_ID}/assets/mirror.svg` },
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        rotation: mirrorActor.system?.orientation ?? MIRROR_DEFAULTS.orientation,
        [`flags.${MODULE_ID}`]: { ...MIRROR_DEFAULTS, ...(mirrorActor.system ?? {}) },
      }, { parent: canvas.scene });
      refreshBeams();
    },
  });

  tools.push({
    name: "createTrigger",
    title: "LAM.controls.createTrigger",
    icon: "fas fa-crosshairs",
    visible: true,
    button: true,
    onClick: async () => {
      let triggerActor = game.actors.find(a => a.type === ACTOR_TYPES.TRIGGER && a.name === "Trigger Default");
      if (!triggerActor) {
        triggerActor = await Actor.create({
          name: "Trigger Default",
          type: ACTOR_TYPES.TRIGGER,
          img: `modules/${MODULE_ID}/assets/trigger.svg`,
          system: { ...TRIGGER_DEFAULTS },
        });
      }

      const point = canvas.grid.getTopLeftPoint(canvas.center);
      await TokenDocument.create({
        name: "Trigger",
        actorId: triggerActor.id,
        actorLink: false,
        texture: { src: `modules/${MODULE_ID}/assets/trigger.svg` },
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        hidden: true,
        [`flags.${MODULE_ID}`]: { ...TRIGGER_DEFAULTS, ...(triggerActor.system ?? {}) },
      }, { parent: canvas.scene });
      refreshBeams();
    },
  });
}


