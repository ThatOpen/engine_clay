import * as WEBIFC from "web-ifc";
import { ClayObject3D } from "../../../core";

export abstract class Profile extends ClayObject3D {
  abstract attributes: WEBIFC.IFC4X3.IfcProfileDef;
}
