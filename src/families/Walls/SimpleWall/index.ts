import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { Extrusion, RectangleProfile } from "../../../geometries";
import { Family } from "../../Family";
import { IfcGetter } from "../../../base/ifc-getter";

export class SimpleWall extends Family {
  ifcData: IFC.IfcWall;

  geometries: { body: Extrusion<RectangleProfile> };

  width = 0.2;

  height = 3;

  startPoint = new THREE.Vector3(0, 0, 0);

  endPoint = new THREE.Vector3(1, 0, 0);

  get mesh() {
    return this.geometries.body.mesh;
  }

  get length() {
    return this.startPoint.distanceTo(this.endPoint);
  }

  get midPoint() {
    const vector = new THREE.Vector3(
      (this.startPoint.x + this.endPoint.x) / 2,
      (this.startPoint.y + this.endPoint.y) / 2,
      (this.startPoint.z + this.endPoint.z) / 2
    );
    return vector;
  }

  get direction() {
    const vector = new THREE.Vector3();
    vector.subVectors(this.endPoint, this.startPoint);
    vector.normalize();
    return vector;
  }

  constructor(model: Model) {
    super(model);

    const profile = new RectangleProfile(model);
    this.geometries = { body: new Extrusion(model, profile) };

    const { body } = this.geometries;

    const representation = IfcGetter.shapeRepresentation(this.model);
    representation.Items = [body.ifcData];
    const placement = IfcGetter.localPlacement();
    const shape = new IFC.IfcProductDefinitionShape(null, null, [
      representation,
    ]);

    const label = "Simple Wall";

    this.ifcData = new IFC.IfcWall(
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
    const profile = this.geometries.body.profile;
    profile.dimension.x = this.length;
    profile.dimension.y = this.width;
    profile.position = this.midPoint;
    profile.direction = this.direction;
    profile.update();

    const { body } = this.geometries;
    body.depth = this.height;
    body.update();
  }
}
