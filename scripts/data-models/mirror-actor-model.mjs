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
        max: 359,
        integer: true,
      }),
      interactable: new fields.BooleanField({ initial: true }),
      attachable: new fields.BooleanField({ initial: false }),
      attachedToTokenId: new fields.StringField({
        required: false,
        initial: null,
        nullable: true,
      }),
    };
  }
}
