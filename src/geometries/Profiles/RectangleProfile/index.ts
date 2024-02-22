import * as WEBIFC from "web-ifc";
import { createIfcEntity } from "../../../utils/generics";
import { Profile } from "../Profile";
import { Base } from "../../../base";

export type RectangleProfileArgs = {
  direction: number[];
  position: number[];
  xDim: number;
  yDim: number;
};
export class RectangleProfile extends Profile {
  public profile: WEBIFC.IFC4X3.IfcRectangleProfileDef;
  private base: Base;
  public position: number[];
  public direction: number[];

  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
    args: RectangleProfileArgs,
  ) {
    super();
    this.base = new Base(ifcAPI, modelID);
    this.position = args.position;
    this.direction = args.direction;
    this.profile = this.create(
      this.base.axis2Placement2D(this.position, this.direction),
      this.base.positiveLength(args.xDim),
      this.base.positiveLength(args.yDim),
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
