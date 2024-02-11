import * as WEBIFC from "web-ifc"

export abstract class Profile {
  public abstract profile: WEBIFC.IFC4X3.IfcProfileDef
  protected abstract create(...args: any[]): WEBIFC.IFC4X3.IfcProfileDef
}
