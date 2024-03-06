import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { ClayObject, Model } from "../../base";
import { ClayGeometry } from "../Geometry";
import { IfcUtils } from "../../utils/ifc-utils";

// TODO: Are we going to use this, or is just necessary for reading?
// IFCSHAPEREPRESENTATION
// IFCMAPPEDITEM
// IFCREPRESENTATIONMAP
// IFCSHAPEREPRESENTATION

export class RepresentationMap<T extends ClayGeometry[]> extends ClayObject {
  attributes: IFC.IfcRepresentationMap;

  geometries: T;

  instances = new Map<
    number,
    { item: IFC.IfcMappedItem; transform: THREE.Matrix4 }
  >();

  constructor(model: Model, geometries: T) {
    super(model);
    this.geometries = geometries;

    const items = geometries.map((geom) => geom.attributes);
    const representation = IfcUtils.shape(this.model, items);

    const placement = new IFC.IfcAxis2Placement3D(
      IfcUtils.point(new THREE.Vector3()),
      null,
      null
    );

    this.attributes = new IFC.IfcRepresentationMap(placement, representation);
    this.update();
  }

  add(transformation: THREE.Matrix4) {
    const { position, xDir, yDir, zDir } =
      this.getTransformData(transformation);

    const operator = new IFC.IfcCartesianTransformationOperator3D(
      IfcUtils.direction(xDir),
      IfcUtils.direction(yDir),
      IfcUtils.point(position),
      new IFC.IfcReal(1),
      IfcUtils.direction(zDir)
    );

    const item = new IFC.IfcMappedItem(this.attributes, operator);
    this.model.set(item);

    const transform = transformation.clone();
    this.instances.set(item.expressID, { item, transform });

    return item;
  }

  set(id: number, transform: THREE.Matrix4) {
    const found = this.getItem(id);

    const { position, xDir, yDir, zDir } = this.getTransformData(transform);
    const operator = this.model.get(
      found.item.MappingTarget
    ) as IFC.IfcCartesianTransformationOperator3D;

    const origin = this.model.get(operator.LocalOrigin);
    origin.Coordinates[0].value = position.x;
    origin.Coordinates[1].value = position.y;
    origin.Coordinates[2].value = position.z;
    this.model.set(origin);

    const axis1 = this.model.get(operator.Axis1);
    axis1.DirectionRatios[0].value = xDir.x;
    axis1.DirectionRatios[1].value = xDir.y;
    axis1.DirectionRatios[2].value = xDir.z;
    this.model.set(axis1);

    const axis2 = this.model.get(operator.Axis2);
    axis2.DirectionRatios[0].value = yDir.x;
    axis2.DirectionRatios[1].value = yDir.y;
    axis2.DirectionRatios[2].value = yDir.z;
    this.model.set(axis2);

    const axis3 = this.model.get(operator.Axis3);
    axis3.DirectionRatios[0].value = zDir.x;
    axis3.DirectionRatios[1].value = zDir.y;
    axis3.DirectionRatios[2].value = zDir.z;
    this.model.set(axis3);
  }

  remove(id: number) {
    const found = this.getItem(id);

    const { item } = found;
    const target = this.model.get(
      item.MappingTarget
    ) as IFC.IfcCartesianTransformationOperator3D;

    this.model.delete(target.LocalOrigin);
    this.model.delete(target.Axis1);
    this.model.delete(target.Axis2);
    this.model.delete(target.Axis3);
    this.model.delete(target);
    this.model.delete(item);

    this.instances.delete(id);
  }

  update(): void {
    this.model.set(this.attributes);
  }

  private getItem(id: number) {
    const found = this.instances.get(id);
    if (!found) {
      throw new Error(`The instance ${id} does not exist!`);
    }
    return found;
  }

  private getTransformData(transform: THREE.Matrix4) {
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    transform.decompose(position, rotation, scale);
    const xDir = new THREE.Vector3(1, 0, 0);
    const yDir = new THREE.Vector3(0, 1, 0);
    const zDir = new THREE.Vector3(0, 0, 1);
    xDir.applyQuaternion(rotation);
    yDir.applyQuaternion(rotation);
    zDir.applyQuaternion(rotation);
    return { position, xDir, yDir, zDir };
  }
}
