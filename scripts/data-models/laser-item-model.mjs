/**
 * TypeDataModel for Laser items.
 * Defines the schema stored in item.system for laser-type items.
 */
export class LaserItemModel extends foundry.abstract.TypeDataModel {
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
      visible: new fields.BooleanField({ initial: true }),
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
