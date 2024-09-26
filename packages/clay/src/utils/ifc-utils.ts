import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { Model } from "../base";
import { MathUtils } from "./math-utils";

export class IfcUtils {
  static direction(vector: THREE.Vector3) {
    return new IFC.IfcDirection([
      new IFC.IfcReal(vector.x),
      new IFC.IfcReal(vector.y),
      new IFC.IfcReal(vector.z),
    ]);
  }

  static point(vector: THREE.Vector3) {
    return new IFC.IfcCartesianPoint([
      new IFC.IfcLengthMeasure(vector.x),
      new IFC.IfcLengthMeasure(vector.y),
      new IFC.IfcLengthMeasure(vector.z),
    ]);
  }

  static localPlacement(
    location = new THREE.Vector3(0, 0, 0),
    zDirection = new THREE.Vector3(0, 0, 1),
    xDirection = new THREE.Vector3(1, 0, 0)
  ) {
    return new IFC.IfcLocalPlacement(
      null,
      new IFC.IfcAxis2Placement3D(
        IfcUtils.point(location),
        IfcUtils.direction(zDirection),
        IfcUtils.direction(xDirection)
      )
    );
  }

  static productDefinitionShape(
    model: Model,
    items: IFC.IfcRepresentationItem[]
  ) {
    const representation = this.shape(model, items);
    return new IFC.IfcProductDefinitionShape(null, null, [representation]);
  }

  static shape(model: Model, items: IFC.IfcRepresentationItem[]) {
    return new IFC.IfcShapeRepresentation(model.context, null, null, items);
  }

  static setAxis2Placement(
    model: Model,
    placement: IFC.IfcAxis2Placement3D | IFC.IfcAxis2Placement2D,
    position: THREE.Vector3,
    rotation: THREE.Euler
  ) {
    const location = model.get(placement.Location) as IFC.IfcCartesianPoint;

    location.Coordinates[0].value = position.x;
    location.Coordinates[1].value = position.y;
    location.Coordinates[2].value = position.z;
    model.set(location);

    const { dirX, dirZ } = MathUtils.basisFromEuler(rotation);

    if (placement instanceof IFC.IfcAxis2Placement3D) {
      const zDirection = model.get(placement.Axis);
      zDirection.DirectionRatios[0].value = dirZ.x;
      zDirection.DirectionRatios[1].value = dirZ.y;
      zDirection.DirectionRatios[2].value = dirZ.z;
      model.set(zDirection);
    }

    const xDirection = model.get(placement.RefDirection);
    xDirection.DirectionRatios[0].value = dirX.x;
    xDirection.DirectionRatios[1].value = dirX.y;
    xDirection.DirectionRatios[2].value = dirX.z;
    model.set(xDirection);
  }
}
