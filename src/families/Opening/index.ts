import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../base";
import { Extrusion, RectangleProfile } from "../../geometries";
import { Family } from "../Family";
import { IfcGetter } from "../../base/ifc-getter";

export class Opening extends Family {
  ifcData: IFC.IfcOpeningElement;

  geometries: { body: Extrusion<RectangleProfile> };

  get mesh() {
    return this.geometries.body.mesh;
  }

  get position() {
    return this.geometries.body.position;
  }

  set position(value: THREE.Vector3) {
    this.geometries.body.position = value;
  }

  get baseDimension() {
    return this.geometries.body.profile.dimension;
  }

  set baseDimension(value: THREE.Vector3) {
    this.geometries.body.profile.dimension = value;
  }

  get xDirection() {
    return this.geometries.body.xDirection;
  }

  set xDirection(value: THREE.Vector3) {
    this.geometries.body.xDirection = value;
  }

  get zDirection() {
    return this.geometries.body.zDirection;
  }

  set zDirection(value: THREE.Vector3) {
    this.geometries.body.zDirection = value;
  }

  get zRotation() {
    return this.geometries.body.zRotation;
  }

  set zRotation(value: number) {
    this.geometries.body.zRotation = value;
  }

  get direction() {
    return this.geometries.body.direction;
  }

  set direction(value: THREE.Vector3) {
    this.geometries.body.direction = value;
  }

  get height() {
    return this.geometries.body.depth;
  }

  set height(value: number) {
    this.geometries.body.depth = value;
  }

  constructor(model: Model) {
    super(model);

    const profile = new RectangleProfile(model);
    this.geometries = { body: new Extrusion(model, profile) };

    const { body } = this.geometries;
    body.mesh.material = model.materialT;

    const representation = IfcGetter.shapeRepresentation(this.model);
    representation.Items = [body.ifcData];
    const placement = IfcGetter.localPlacement();
    const shape = new IFC.IfcProductDefinitionShape(null, null, [
      representation,
    ]);

    const label = "Opening";

    this.ifcData = new IFC.IfcOpeningElement(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      new IFC.IfcLabel(label),
      null,
      new IFC.IfcLabel(label),
      placement,
      shape,
      new IFC.IfcIdentifier(label),
      null
    );

    this.update();
  }

  update() {
    const { body } = this.geometries;
    body.profile.update();
    body.update();
  }
}
