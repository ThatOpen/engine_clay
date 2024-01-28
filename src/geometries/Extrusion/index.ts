import * as WEBIFC from "web-ifc";

export class Extrusion {
  constructor(
    private ifcAPI: WEBIFC.IfcAPI,
    private modelId: number
  ) {}

  public create(): WEBIFC.IfcLineObject {
    return this.ifcAPI.CreateIfcEntity(
      this.modelId,
      WEBIFC.IFCEXTRUDEDAREASOLID
    );
  }
}
