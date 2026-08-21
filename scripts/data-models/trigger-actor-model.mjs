/**
 * TypeDataModel for Trigger actors.
 * Defines the schema stored in actor.system for trigger-type actors.
 */
export class TriggerActorModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      anchorRadius: new fields.NumberField({
        required: true,
        initial: 0,
        step: 0.05,
      }),
      enabled: new fields.BooleanField({ initial: true }),
      passThrough: new fields.BooleanField({ initial: false }),
      onBeamHit: new fields.StringField({
        required: false,
        initial: "",
        blank: true,
      }),
      onBeamStay: new fields.StringField({
        required: false,
        initial: "",
        blank: true,
      }),
      onBeamLost: new fields.StringField({
        required: false,
        initial: "",
        blank: true,
      }),
    };
  }
}
