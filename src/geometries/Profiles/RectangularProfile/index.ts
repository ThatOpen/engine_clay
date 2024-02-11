import * as WEBIFC from "web-ifc";
import { createIfcEntity } from "../../../utils/generics";
import { Profile } from "../Profile";
import { Base } from "../../../base";

export class RectangularProfile extends Profile {
  public profile: WEBIFC.IFC4X3.IfcRectangleProfileDef;
  private base: Base;

  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
    axis: number[] = [0, 0],
    xDim: number = 1,
    yDim: number = 0.25,
  ) {
    super();
    this.base = new Base(ifcAPI, modelID);
    this.profile = this.create(
      this.base.axis2Placement2D(axis),
      this.base.positiveLength(xDim),
      this.base.positiveLength(yDim),
    );
  }

  protected create(
    position: WEBIFC.IFC4X3.IfcAxis2Placement2D,
    xDim: WEBIFC.IFC4X3.IfcPositiveLengthMeasure,
    yDim: WEBIFC.IFC4X3.IfcPositiveLengthMeasure,
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcRectangleProfileDef>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCRECTANGLEPROFILEDEF,
      WEBIFC.IFC4X3.IfcProfileTypeEnum.AREA,
      this.base.label("Rectangular profile"),
      position,
      xDim,
      yDim,
    );
  }
}
