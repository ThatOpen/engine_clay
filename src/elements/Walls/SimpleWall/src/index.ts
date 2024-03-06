import * as THREE from "three";
import * as FRAGS from "bim-fragment";
import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model } from "../../../../base";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Element } from "../../../Elements";
import { Extrusion, RectangleProfile } from "../../../../geometries";
import { SimpleWallType } from "../index";
import { SimpleOpening } from "../../../Openings";

export class SimpleWall extends Element {
  attributes: IFC.IfcWall;

  type: SimpleWallType;

  body: Extrusion<RectangleProfile>;

  height = 3;

  startPoint = new THREE.Vector3(0, 0, 0);

  endPoint = new THREE.Vector3(1, 0, 0);

  private _openings = new Map<
    number,
    { opening: SimpleOpening; distance: number }
  >();

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

  constructor(model: Model, type: SimpleWallType) {
    super(model, type);
    this.type = type;

    const profile = new RectangleProfile(model);
    this.body = new Extrusion(model, profile);
    const id = this.body.attributes.expressID;
    this.type.geometries.set(id, this.body);
    this.geometries.add(id);

    const placement = IfcUtils.localPlacement();
    const shape = IfcUtils.productDefinitionShape(model, [
      this.body.attributes,
    ]);

    this.attributes = new IFC.IfcWall(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      placement,
      shape,
      null,
      null
    );

    this.model.set(this.attributes);
  }

  update(updateGeometry: boolean = false) {
    this.updateAllOpenings();

    const profile = this.body.profile;
    profile.dimension.x = this.length;
    profile.dimension.y = this.type.width;
    profile.update();

    this.body.depth = this.height;
    this.body.update();

    const dir = this.direction;
    this.rotation.z = Math.atan2(dir.y, dir.x);
    this.position = this.midPoint;

    super.update(updateGeometry);
  }

  addOpening(opening: SimpleOpening) {
    super.addOpening(opening);
    this.setOpening(opening);
  }

  removeOpening(opening: SimpleOpening) {
    super.removeOpening(opening);
    this._openings.delete(opening.attributes.expressID);
  }

  setOpening(opening: SimpleOpening) {
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

    const id = opening.attributes.expressID;

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
