import * as THREE from "three";
import { IFC4X3 as IFC } from "web-ifc";
import { Profile } from "../Profile";
import { Model } from "../../../base";
import { IfcGetter } from "../../../base/ifc-getter";

export class RectangleProfile extends Profile {
  ifcData: IFC.IfcRectangleProfileDef;

  dimension = new THREE.Vector3(1, 1, 0);

  direction = new THREE.Vector3(1, 0, 0);

  position = new THREE.Vector3(0, 0, 0);

  constructor(model: Model) {
    super(model);

    const placement = new IFC.IfcAxis2Placement2D(
      IfcGetter.point(this.position),
      IfcGetter.direction(this.direction)
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

    const location = this.model.get(
      placement.Location
    ) as IFC.IfcCartesianPoint;

    location.Coordinates[0].value = this.position.y;
    location.Coordinates[1].value = -this.position.x;
    this.model.set(location);

    const ifcDirection = this.model.get(placement.RefDirection);
    ifcDirection.DirectionRatios[0].value = this.direction.y;
    ifcDirection.DirectionRatios[1].value = -this.direction.x;
    this.model.set(ifcDirection);

    this.model.set(this.ifcData);
  }
}
