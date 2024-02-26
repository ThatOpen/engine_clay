import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { Model } from "../../base";
import { Profile } from "../Profiles/Profile";
import { ClayGeometry } from "../Geometry";
import { IfcGetter } from "../../base/ifc-getter";

export class Extrusion<T extends Profile> extends ClayGeometry {
  ifcData: IFC.IfcExtrudedAreaSolid | IFC.IfcBooleanClippingResult;

  core: IFC.IfcExtrudedAreaSolid;

  mesh: THREE.InstancedMesh;

  depth = 1;

  profile: T;

  position = new THREE.Vector3(0, 0, 0);

  zDirection = new THREE.Vector3(0, 0, 0);

  xDirection = new THREE.Vector3(0, 0, 1);

  direction = new THREE.Vector3(0, 1, 0);

  get zRotation() {
    const { x, z } = this.xDirection;
    const result = Math.atan2(x, z);
    if (result >= 0) {
      return result;
    }
    return 2 * Math.PI + result;
  }

  set zRotation(value: number) {
    const matrix = new THREE.Matrix4();
    matrix.makeRotationY(value);
    const { elements } = matrix;
    this.xDirection.set(elements[8], elements[9], elements[10]);
  }

  constructor(model: Model, profile: T) {
    super(model);
    this.profile = profile;

    this.mesh = this.newThreeMesh();

    const placement = new IFC.IfcAxis2Placement3D(
      IfcGetter.point(this.position),
      IfcGetter.direction(this.zDirection),
      IfcGetter.direction(this.xDirection)
    );

    const direction = IfcGetter.direction(this.direction);

    this.core = new IFC.IfcExtrudedAreaSolid(
      profile.ifcData,
      placement,
      direction,
      new IFC.IfcPositiveLengthMeasure(this.depth)
    );

    this.ifcData = this.core;

    this.update();
  }

  update() {
    const placement = this.model.get(this.core.Position);

    const location = this.model.get(
      placement.Location
    ) as IFC.IfcCartesianPoint;

    location.Coordinates[0].value = this.position.z;
    location.Coordinates[1].value = -this.position.x;
    location.Coordinates[2].value = this.position.y;
    this.model.set(location);

    const zDirection = this.model.get(placement.Axis);
    zDirection.DirectionRatios[0].value = this.zDirection.z;
    zDirection.DirectionRatios[1].value = this.zDirection.x;
    zDirection.DirectionRatios[2].value = this.zDirection.y;
    this.model.set(zDirection);

    const xDirection = this.model.get(placement.RefDirection);
    xDirection.DirectionRatios[0].value = this.xDirection.z;
    xDirection.DirectionRatios[1].value = this.xDirection.x;
    xDirection.DirectionRatios[2].value = this.xDirection.y;
    this.model.set(xDirection);

    const direction = this.model.get(this.core.ExtrudedDirection);
    direction.DirectionRatios[0].value = this.direction.z;
    direction.DirectionRatios[1].value = this.direction.x;
    direction.DirectionRatios[2].value = this.direction.y;
    this.model.set(direction);

    this.core.Depth.value = this.depth;

    this.model.set(this.core);
    this.setMesh(this.ifcData.expressID, this.mesh);
  }
}
