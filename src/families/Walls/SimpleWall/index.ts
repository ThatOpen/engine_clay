import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { Extrusion, RectangleProfile } from "../../../geometries";
import { Family } from "../../Family";
import { IfcGetter } from "../../../base/ifc-getter";
import { Opening } from "../../Opening";

export class SimpleWall extends Family {
  ifcData: IFC.IfcWall;

  geometries: { body: Extrusion<RectangleProfile> };

  width = 0.2;

  height = 3;

  startPoint = new THREE.Vector3(0, 0, 0);

  endPoint = new THREE.Vector3(1, 0, 0);

  private _openings = new Map<number, { opening: Opening; distance: number }>();

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
    this.updateAllOpenings();

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

  addOpening(opening: Opening) {
    const wallPlane = new THREE.Plane();
    const tempPoint = this.startPoint.clone();
    tempPoint.z += 1;
    wallPlane.setFromCoplanarPoints(tempPoint, this.startPoint, this.endPoint);

    const newPosition = new THREE.Vector3();
    const position = opening.position;
    wallPlane.projectPoint(position, newPosition);
    opening.position.z = newPosition.y;
    opening.position.x = newPosition.x;
    opening.update();

    const distance = newPosition.distanceTo(this.startPoint);
    const id = opening.ifcData.expressID;

    this._openings.set(id, { opening, distance });
  }

  removeOpening(opening: Opening) {
    this._openings.delete(opening.ifcData.expressID);
  }

  updateOpening(opening: Opening) {
    this.removeOpening(opening);
    this.addOpening(opening);
  }

  private updateAllOpenings() {
    const start = this.startPoint;
    const dir = this.direction;
    for (const [_id, { opening, distance }] of this._openings) {
      const pos = dir.clone().multiplyScalar(distance).add(start);
      opening.position.x = pos.x;
      opening.position.z = pos.y;

      opening.xDirection.x = dir.x;
      opening.xDirection.z = -dir.y;

      opening.update();
    }
  }
}
