import * as WEBIFC from "web-ifc";
import { Model } from "../Model";

/**
 * Base object for all Clay classes.
 */
export abstract class ClayObject {
  /**
   * The IFC model this object belongs to.
   */
  model: Model;

  /**
   * The IFC data of this object.
   */
  abstract attributes: WEBIFC.IfcLineObject;

  /**
   * Update this object by overriding its data in the IFC model.
   */
  abstract update(): void;

  protected constructor(model: Model) {
    this.model = model;
  }
}
