import * as THREE from "three";
import { IFC4X3 as IFC } from "web-ifc";
import { Model, ClayGeometry } from "../../core";

import { MathUtils } from "../../utils/math-utils";
import { IfcUtils } from "../../utils/ifc-utils";

export class HalfSpace extends ClayGeometry {
  attributes: IFC.IfcHalfSpaceSolid | IFC.IfcBooleanClippingResult;

  direction = new THREE.Vector3();

  core: IFC.IfcHalfSpaceSolid;

  constructor(model: Model) {
    super(model);

    const position = MathUtils.toIfcCoords(this.transformation.position);
    const rotation = MathUtils.toIfcRot(this.transformation.rotation);
    const { dirX, dirY } = MathUtils.basisFromEuler(rotation);

    const placement = new IFC.IfcAxis2Placement3D(
      IfcUtils.point(position),
      IfcUtils.direction(dirY),
      IfcUtils.direction(dirX),
    );

    const plane = new IFC.IfcPlane(placement);

    this.core = new IFC.IfcHalfSpaceSolid(plane, new IFC.IfcBoolean("F"));

    this.attributes = this.core;

    this.update();
  }

  update() {
    const plane = this.model.get(this.core.BaseSurface) as IFC.IfcPlane;

    const placement = this.model.get(plane.Position);

    const location = this.model.get(
      placement.Location,
    ) as IFC.IfcCartesianPoint;

    const position = MathUtils.toIfcCoords(this.transformation.position);
    const direction = MathUtils.toIfcCoords(this.direction);

    location.Coordinates[0].value = position.x;
    location.Coordinates[1].value = position.y;
    location.Coordinates[2].value = position.z;
    this.model.set(location);

    const zDirection = this.model.get(placement.Axis);
    zDirection.DirectionRatios[0].value = direction.x;
    zDirection.DirectionRatios[1].value = direction.y;
    zDirection.DirectionRatios[2].value = direction.z;
    this.model.set(zDirection);
  }
}
