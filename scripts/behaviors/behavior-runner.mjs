import { MODULE_ID } from "../constants.mjs";
import { BehaviorRegistry } from "./behavior-registry.mjs";

/**
 * Encapsulates the execution context of a trigger event.
 */
export class ExecutionContext {
  /**
   * @param {object} params
   * @param {TokenDocument|Token} params.token
   * @param {Actor} [params.actor]
   * @param {object} [params.beamData]
   * @param {string} [params.eventType="enter"] - "enter", "stay", "exit", or "hitChange"
   * @param {boolean} [params.isHit] - Whether the trigger is currently hit
   * @param {object} [params.variables={}] - Local variables for this flow
   */
  constructor({ token, actor = null, beamData = null, eventType = "enter", isHit = undefined, variables = {} } = {}) {
    this.tokenDoc = token?.document ?? token;
    this.actor = actor ?? this.tokenDoc?.actor;
    this.beamData = beamData;
    this.eventType = eventType;
    const tokenId = this.tokenDoc?.id ?? "";
    const tokenUuid = this.tokenDoc?.uuid ?? "";
    const actorId = this.actor?.id ?? "";
    const hitState = isHit !== undefined ? isHit : (eventType === "exit" ? false : true);
    this.variables = {
      thisTokenId: tokenId,
      thisTokenUuid: tokenUuid,
      thisActorId: actorId,
      eventType: eventType,
      isHit: hitState,
      isTriggerHit: hitState,
      ...variables,
    };
    this.stopped = false;
    this.executionLog = [];
  }

  /**
   * Set a local temporary variable in this execution flow.
   * @param {string} name
   * @param {*} value
   */
  setVariable(name, value) {
    this.variables[name] = value;
  }

  /**
   * Get a local variable from this execution flow.
   * @param {string} name
   * @returns {*}
   */
  getVariable(name) {
    return this.variables[name];
  }

  /**
   * Halt subsequent behaviors in this execution flow.
   * @param {string} [reason="Condition not met"]
   */
  stop(reason = "Condition not met") {
    this.stopped = true;
    this.stopReason = reason;
  }
}

/**
 * Runner engine that iterates through behavior sequences and executes them.
 */
export class BehaviorRunner {
  /**
   * Execute an array of behavior configurations sequentially.
   * @param {Array<object>} behaviors - List of behavior configurations
   * @param {ExecutionContext|object} contextOrHit - Execution context or hit info
   * @param {string} [eventType="enter"]
   * @returns {Promise<ExecutionContext>}
   */
  static async runSequence(behaviors, contextOrHit, eventType = "enter") {
    if (!Array.isArray(behaviors) || behaviors.length === 0) {
      return contextOrHit instanceof ExecutionContext
        ? contextOrHit
        : new ExecutionContext({ ...contextOrHit, eventType });
    }

    const context = contextOrHit instanceof ExecutionContext
      ? contextOrHit
      : new ExecutionContext({
          token: contextOrHit.triggerToken ?? contextOrHit.token,
          actor: contextOrHit.triggerToken?.actor ?? contextOrHit.actor,
          beamData: contextOrHit.beamData,
          isHit: contextOrHit.isHit,
          eventType,
        });

    for (let i = 0; i < behaviors.length; i++) {
      if (context.stopped) {
        break;
      }

      const config = behaviors[i];
      if (!config || config.enabled === false) {
        continue;
      }

      const behaviorClass = BehaviorRegistry.get(config.type);
      if (!behaviorClass) {
        console.warn(`${MODULE_ID} | Unknown behavior type: "${config.type}" at index ${i}`);
        continue;
      }

      try {
        await behaviorClass.execute(config, context);
      } catch (err) {
        console.error(`${MODULE_ID} | Error executing behavior "${config.type}" (${config.id ?? i}):`, err);
        if (typeof ui !== "undefined" && ui.notifications?.error) {
          ui.notifications.error(`Trigger behavior error (${config.type}): ${err.message}`);
        }
      }
    }

    return context;
  }
}
