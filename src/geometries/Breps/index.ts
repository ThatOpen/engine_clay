import * as WEBIFC from "web-ifc"

export class Breps {
  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelId: number
  ) {}
}
