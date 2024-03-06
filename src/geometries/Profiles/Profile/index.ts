import * as WEBIFC from "web-ifc";
import { ClayObject } from "../../../base/clay-object";

export abstract class Profile extends ClayObject {
  abstract attributes: WEBIFC.IFC4X3.IfcProfileDef;
}
