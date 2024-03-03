import * as THREE from "three";
import { IFC4X3 as IFC } from "web-ifc";
import { Profile } from "../Profile";
import { Model } from "../../../base";
import { IfcUtils } from "../../../utils/ifc-utils";

export class RectangleProfile extends Profile {
  ifcData: IFC.IfcRectangleProfileDef;

  dimension = new THREE.Vector3(1, 1, 0);

  rotation = new THREE.Euler(0, 0, 0);

  position = new THREE.Vector3(0, 0, 0);

  constructor(model: Model) {
    super(model);

    const placement = new IFC.IfcAxis2Placement2D(
      IfcUtils.point(this.position),
      IfcUtils.direction(new THREE.Vector3(1, 0, 0))
    );

    this.ifcData = new IFC.IfcRectangleProfileDef(
      IFC.IfcProfileTypeEnum.AREA,
      null,
      placement,
      new IFC.IfcPositiveLengthMeasure(this.dimension.x),
      new IFC.IfcPositiveLengthMeasure(this.dimension.y)
    );

    this.model.set(this.ifcData);
  }

  update() {
    this.ifcData.XDim.value = this.dimension.x;
    this.ifcData.YDim.value = this.dimension.y;

    const placement = this.model.get(this.ifcData.Position);

    IfcUtils.setAxis2Placement(
      this.model,
      placement,
      this.position,
      this.rotation
    );

    this.model.set(this.ifcData);
  }
}
