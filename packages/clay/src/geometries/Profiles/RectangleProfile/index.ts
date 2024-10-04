import * as THREE from "three";
import { IFC4X3 as IFC } from "web-ifc";
import { Profile } from "../Profile";
import { Model } from "../../../core";
import { IfcUtils } from "../../../utils/ifc-utils";
import { MathUtils } from "../../../utils";

export class RectangleProfile extends Profile {
  attributes: IFC.IfcRectangleProfileDef;

  dimension = new THREE.Vector3(1, 1, 0);

  depth = 1;

  constructor(model: Model) {
    super(model);

    const position = MathUtils.toIfcCoords(this.transformation.position);

    const placement = new IFC.IfcAxis2Placement2D(
      IfcUtils.point(position),
      IfcUtils.direction(new THREE.Vector3(1, 0, 0)),
    );

    this.attributes = new IFC.IfcRectangleProfileDef(
      IFC.IfcProfileTypeEnum.AREA,
      null,
      placement,
      new IFC.IfcPositiveLengthMeasure(this.dimension.x),
      new IFC.IfcPositiveLengthMeasure(this.dimension.y),
    );

    this.model.set(this.attributes);
  }

  update() {
    this.attributes.XDim.value = this.dimension.x;
    this.attributes.YDim.value = this.dimension.y;

    const placement = this.model.get(this.attributes.Position);

    IfcUtils.setAxis2Placement(this.model, placement, this.transformation);

    this.model.set(this.attributes);
  }
}
