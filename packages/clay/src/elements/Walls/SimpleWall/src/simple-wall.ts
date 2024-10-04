import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model, ClayElement, Event } from "../../../../core";
import { IfcUtils } from "../../../../utils/ifc-utils";

import { Extrusion, RectangleProfile } from "../../../../geometries";
import { SimpleWallType } from "../index";
import { SimpleWallNester } from "./simple-wall-nester";

export type WallPlaneType = "center" | "exterior" | "interior";
export type WallEndPointType = "start" | "end";

export class SimpleWall extends ClayElement {
  readonly onUpdate = new Event<void>();

  attributes: IFC.IfcWall;

  type: SimpleWallType;

  body: Extrusion<RectangleProfile>;

  height = 3;

  elevation = 0;

  startPoint = new THREE.Vector2(0, 0);

  endPoint = new THREE.Vector2(1, 0);

  offset = 0;

  private _nester = new SimpleWallNester(this);

  get length() {
    return this.startPoint.distanceTo(this.endPoint);
  }

  get midPoint() {
    const start = this.startPoint3D;
    const end = this.endPoint3D;
    return new THREE.Vector3(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      (start.z + end.z) / 2,
    );
  }

  get direction() {
    const vector = new THREE.Vector3();
    vector.subVectors(this.endPoint3D, this.startPoint3D);
    vector.normalize();
    return vector;
  }

  get normal() {
    const direction = this.direction;
    const up = new THREE.Vector3(0, 0, 1);
    return direction.cross(up);
  }

  get startPoint3D() {
    const { x, y } = this.startPoint;
    return new THREE.Vector3(x, y, this.elevation);
  }

  get endPoint3D() {
    const { x, y } = this.endPoint;
    return new THREE.Vector3(x, y, this.elevation);
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
      null,
    );

    this.model.set(this.attributes);
  }

  update(updateGeometry = false) {
    this._nester.update();

    const profile = this.body.profile;
    profile.dimension.x = this.length;
    profile.dimension.y = this.type.width;
    profile.position.y = this.offset;
    profile.update();

    this.body.depth = this.height;
    this.body.update();

    const dir = this.direction;
    this.rotation.z = Math.atan2(dir.y, dir.x);
    this.position = this.midPoint;

    const shape = this.model.get(this.attributes.Representation);
    const reps = this.model.get(shape.Representations[0]);
    reps.Items = [this.body.attributes];
    this.model.set(reps);

    this.updateGeometryID();
    super.update(updateGeometry);
  }

  async addSubtraction(element: ClayElement, nest = false) {
    if (this.subtractions.has(element.attributes.expressID)) {
      return;
    }
    await super.addSubtraction(element);
    if (nest) {
      this._nester.add(element);
    }
    this.updateGeometryID();
  }

  async removeSubtraction(element: ClayElement) {
    if (!this.subtractions.has(element.attributes.expressID)) {
      return;
    }
    await super.removeSubtraction(element);
    this._nester.delete(element);
    this.updateGeometryID();
  }

  getPlane(type: WallPlaneType = "center") {
    const normal = this.normal;

    const p1 = this.startPoint3D;
    const p2 = this.endPoint3D;
    const p3 = p1.clone();
    p3.z += 1;

    if (p1.equals(p2)) {
      // Zero length wall
      const plane = null;
      return { p1, p2, p3, plane };
    }

    const offsetCorrection = normal.clone();
    offsetCorrection.multiplyScalar(-this.offset);

    p1.add(offsetCorrection);
    p2.add(offsetCorrection);
    p3.add(offsetCorrection);

    if (type !== "center") {
      const offset = normal.clone();
      const factor = type === "exterior" ? 1 : -1;
      const offsetAmount = (this.type.width / 2) * factor;
      offset.multiplyScalar(offsetAmount);
      p1.add(offset);
      p2.add(offset);
      p3.add(offset);
    }

    const plane = new THREE.Plane().setFromCoplanarPoints(p1, p2, p3);
    return { plane, p1, p2, p3 };
  }
}
