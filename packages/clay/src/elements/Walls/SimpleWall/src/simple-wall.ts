import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model, ClayElement } from "../../../../core";
import { IfcUtils } from "../../../../utils/ifc-utils";

import { Extrusion, RectangleProfile } from "../../../../geometries";
import { SimpleWallType } from "../index";
import { SimpleWallNester } from "./simple-wall-nester";
import { SimpleWallExtender } from "./simple-wall-extender";

export class SimpleWall extends ClayElement {
  attributes: IFC.IfcWall;

  type: SimpleWallType;

  body: Extrusion<RectangleProfile>;

  height = 3;

  elevation = 0;

  startPoint = new THREE.Vector2(0, 0);

  endPoint = new THREE.Vector2(1, 0);

  private _nester = new SimpleWallNester(this);
  private _extender = new SimpleWallExtender(this);

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

  update(updateGeometry: boolean = false) {
    this._nester.update();

    const profile = this.body.profile;
    profile.dimension.x = this.length;
    profile.dimension.y = this.type.width;
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

    // if (updateCorners) this.updateAllCorners();
  }

  addSubtraction(element: ClayElement) {
    super.addSubtraction(element);
    this._nester.add(element);
    this.updateGeometryID();
  }

  removeSubtraction(element: ClayElement) {
    super.removeSubtraction(element);
    this._nester.delete(element);
    this.updateGeometryID();
  }

  extend(wall: SimpleWall) {
    this._extender.extend(wall);
  }
}
