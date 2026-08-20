/**
 * TypeDataModel for Laser actors.
 * Defines the schema stored in actor.system for laser-type actors.
 */
export class LaserActorModel extends foundry.abstract.TypeDataModel {
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
      orientation: new fields.NumberField({
        required: true,
        initial: 0,
        min: 0,
        max: 359,
        integer: true,
      }),
      visible: new fields.BooleanField({ initial: true }),
      emitLight: new fields.BooleanField({ initial: true }),
      lightRadius: new fields.NumberField({
        required: true,
        initial: 1,
        min: 0.5,
        max: 10,
        step: 0.5,
      }),
      providesVision: new fields.BooleanField({ initial: false }),

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
