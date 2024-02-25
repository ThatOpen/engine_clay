import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { Model } from "./model";

export class IfcGetter {
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
        IfcGetter.point(location),
        IfcGetter.direction(zDirection),
        IfcGetter.direction(xDirection)
      )
    );
  }

  static shapeRepresentation(model: Model) {
    return new IFC.IfcShapeRepresentation(
      model.context,
      new IFC.IfcLabel("Body"),
      new IFC.IfcLabel("SweptSolid"),
      []
    );
  }
}
