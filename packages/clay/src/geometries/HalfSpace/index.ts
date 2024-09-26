import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { Model } from "../../base";
import { ClayGeometry } from "../Geometry";
import { MathUtils } from "../../utils/math-utils";
import { IfcUtils } from "../../utils/ifc-utils";

export class HalfSpace extends ClayGeometry {
  attributes: IFC.IfcHalfSpaceSolid | IFC.IfcBooleanClippingResult;

  core: IFC.IfcHalfSpaceSolid;

  position = new THREE.Vector3(0, 0, 0);

  rotation = new THREE.Euler(0, 0, 0);

  constructor(model: Model) {
    super(model);

    const { dirX, dirY } = MathUtils.basisFromEuler(this.rotation);

    const placement = new IFC.IfcAxis2Placement3D(
      IfcUtils.point(this.position),
      IfcUtils.direction(dirY),
      IfcUtils.direction(dirX)
    );

    const plane = new IFC.IfcPlane(placement);

    this.core = new IFC.IfcHalfSpaceSolid(plane, new IFC.IfcBoolean("F"));

    this.attributes = this.core;

    this.update();
  }

  update() {
    const plane = this.model.get(this.core.BaseSurface) as IFC.IfcPlane;

    const placement = this.model.get(plane.Position);

    IfcUtils.setAxis2Placement(
      this.model,
      placement,
      this.position,
      this.rotation
    );

    this.model.set(this.core);
    this.attributes = this.core;
  }
}
