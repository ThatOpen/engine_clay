import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { Model } from "../../base";
import { Profile } from "../Profiles/Profile";
import { ClayGeometry } from "../Geometry";
import { MathUtils } from "../../utils/math-utils";
import { IfcUtils } from "../../utils/ifc-utils";

export class Extrusion<T extends Profile> extends ClayGeometry {
  import(): void {}
  attributes: IFC.IfcExtrudedAreaSolid | IFC.IfcBooleanClippingResult;

  core: IFC.IfcExtrudedAreaSolid;

  depth = 1;

  profile: T;

  position = new THREE.Vector3(0, 0, 0);

  rotation = new THREE.Euler();

  direction = new THREE.Vector3(0, 1, 0);

  constructor(model: Model, profile: T) {
    super(model);
    this.profile = profile;

    const { dirX, dirZ } = MathUtils.basisFromEuler(this.rotation);

    const placement = new IFC.IfcAxis2Placement3D(
      IfcUtils.point(this.position),
      IfcUtils.direction(dirZ),
      IfcUtils.direction(dirX)
    );

    const direction = IfcUtils.direction(this.direction);

    this.core = new IFC.IfcExtrudedAreaSolid(
      profile.attributes,
      placement,
      direction,
      new IFC.IfcPositiveLengthMeasure(this.depth)
    );

    this.attributes = this.core;

    this.update();
  }

  update() {
    const placement = this.model.get(this.core.Position);

    IfcUtils.setAxis2Placement(
      this.model,
      placement,
      this.position,
      this.rotation
    );

    const direction = this.model.get(this.core.ExtrudedDirection);
    direction.DirectionRatios[0].value = this.direction.z;
    direction.DirectionRatios[1].value = this.direction.x;
    direction.DirectionRatios[2].value = this.direction.y;
    this.model.set(direction);

    this.core.Depth.value = this.depth;

    this.model.set(this.core);
  }
}
