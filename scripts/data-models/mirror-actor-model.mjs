/**
 * TypeDataModel for Mirror actors.
 * Defines the schema stored in actor.system for mirror-type actors.
 */
export class MirrorActorModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      color: new fields.ColorField({ initial: "#c0c0c0" }),
      width: new fields.NumberField({
        required: true,
        initial: 1,
        min: 0.5,
        max: 5,
        step: 0.5,
      }),
      orientation: new fields.NumberField({
        required: true,
        initial: 0,
        min: 0,
        max: 360,
        step: 0.1,
      }),
      anchorRadius: new fields.NumberField({
        required: true,
        initial: 0,
        step: 0.05,
      }),
      enabled: new fields.BooleanField({ initial: true }),
      twoSided: new fields.BooleanField({ initial: false }),
      interactable: new fields.BooleanField({ initial: true }),
      interactionRange: new fields.NumberField({
        required: true,
        initial: 1,
        min: 1,
        max: 50,
        step: 1,
      }),
      attachable: new fields.BooleanField({ initial: false }),
      attachedToTokenId: new fields.StringField({
        required: false,
        initial: null,
        nullable: true,
      }),
      limitRotation: new fields.BooleanField({ initial: false }),
      minDeg: new fields.NumberField({
        required: true,
        initial: 0,
        min: 0,
        max: 360,
        step: 0.1,
      }),
      maxDeg: new fields.NumberField({
        required: true,
        initial: 360,
        min: 0,
        max: 360,
        step: 0.1,
      }),
      invertLimits: new fields.BooleanField({ initial: false }),
    };
  }
}
