import * as WEBIFC from "web-ifc";
import { Model } from "./model";

export abstract class ClayObject {
  model: Model;

  abstract attributes: WEBIFC.IfcLineObject;

  abstract update(): void;

  protected constructor(model: Model) {
    this.model = model;
  }
}
