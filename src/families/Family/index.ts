import * as WEBIFC from "web-ifc";
import { Extrusion, Solid } from "../../geometries";

export type Subtract = {
  extrusion: {
    solid: WEBIFC.IFC4X3.IfcProductRepresentation | Solid;
  };
};

export abstract class Family {
  public abstract toSubtract: Subtract;
  protected abstract create(): void;
  public abstract subtract(extrusion: Extrusion): void;
}
