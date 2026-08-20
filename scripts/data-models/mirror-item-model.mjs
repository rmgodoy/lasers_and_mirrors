/**
 * TypeDataModel for Mirror items.
 * Defines the schema stored in item.system for mirror-type items.
 */
export class MirrorItemModel extends foundry.abstract.TypeDataModel {
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
    };
  }
}
