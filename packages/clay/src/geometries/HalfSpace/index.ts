import { IFC4X3 as IFC } from "web-ifc";
import { Model, ClayGeometry } from "../../core";

import { MathUtils } from "../../utils/math-utils";
import { IfcUtils } from "../../utils/ifc-utils";

export class HalfSpace extends ClayGeometry {
  attributes: IFC.IfcHalfSpaceSolid | IFC.IfcBooleanClippingResult;

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

    IfcUtils.setAxis2Placement(this.model, placement, this.transformation);

    this.model.set(this.core);
    this.attributes = this.core;
  }
}
