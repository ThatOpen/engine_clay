import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { Extrusion, RectangleProfile } from "../../../geometries";
import { Family } from "../../Family";
import { Opening } from "../../Opening";
import { IfcUtils } from "../../../utils/ifc-utils";

export class SimpleWall extends Family {
  ifcData: IFC.IfcWall;

  geometries: { body: Extrusion<RectangleProfile> };

  width = 0.2;

  height = 3;

  startPoint = new THREE.Vector3(0, 0, 0);

  endPoint = new THREE.Vector3(1, 0, 0);

  private _openings = new Map<number, { opening: Opening; distance: number }>();

  get length() {
    return this.startPoint.distanceTo(this.endPoint);
  }

  get midPoint() {
    return new THREE.Vector3(
      (this.startPoint.x + this.endPoint.x) / 2,
      (this.startPoint.y + this.endPoint.y) / 2,
      (this.startPoint.z + this.endPoint.z) / 2
    );
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

    const representation = IfcUtils.shapeRepresentation(this.model);
    representation.Items = [body.ifcData];
    const placement = IfcUtils.localPlacement();
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
    this.updateAllOpenings();

    const profile = this.geometries.body.profile;
    profile.dimension.x = this.length;
    profile.dimension.y = this.width;
    profile.update();

    const { body } = this.geometries;
    body.depth = this.height;
    body.update();

    const dir = this.direction;
    this.rotation.z = Math.atan2(dir.y, dir.x);
    this.position = this.midPoint;

    this.updateElement();
  }

  addOpening(opening: Opening) {
    super.addOpening(opening);
    this.setOpening(opening);
  }

  removeOpening(opening: Opening) {
    super.removeOpening(opening);
    this._openings.delete(opening.ifcData.expressID);
  }

  setOpening(opening: Opening) {
    const wallPlane = new THREE.Plane();

    const tempPoint = this.startPoint.clone();
    tempPoint.z += 1;
    wallPlane.setFromCoplanarPoints(tempPoint, this.startPoint, this.endPoint);
    const newPosition = new THREE.Vector3();
    wallPlane.projectPoint(opening.position, newPosition);

    opening.position.copy(newPosition);
    opening.update();

    // The distance is signed, so that it also supports openings that are
    // before the startPoint by using the dot product
    let distance = newPosition.distanceTo(this.startPoint);
    const vector = new THREE.Vector3();
    vector.subVectors(newPosition, this.startPoint);
    const dotProduct = vector.dot(this.direction);
    distance *= dotProduct > 0 ? 1 : -1;

    const id = opening.ifcData.expressID;

    this._openings.set(id, { opening, distance });
  }

  private updateAllOpenings() {
    const start = this.startPoint;
    const dir = this.direction;
    for (const [_id, { opening, distance }] of this._openings) {
      const pos = dir.clone().multiplyScalar(distance).add(start);

      // Align opening to wall
      opening.position.x = pos.x;
      opening.position.y = pos.y;
      opening.rotation.z = this.rotation.z;

      opening.update();
    }
  }
}
