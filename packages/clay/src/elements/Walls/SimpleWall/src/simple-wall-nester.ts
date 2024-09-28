import * as THREE from "three";
import { ClayElement } from "../../../../core";
import { SimpleWall } from "./simple-wall";

export class SimpleWallNester {
  list = new Map<number, { opening: ClayElement; distance: number }>();

  private _wall: SimpleWall;

  constructor(wall: SimpleWall) {
    this._wall = wall;
  }

  add(element: ClayElement) {
    const wallPlane = new THREE.Plane();

    const tempPoint = this._wall.startPoint3D;
    tempPoint.z += 1;
    wallPlane.setFromCoplanarPoints(
      tempPoint,
      this._wall.startPoint3D,
      this._wall.endPoint3D,
    );

    const newPosition = new THREE.Vector3();
    wallPlane.projectPoint(element.position, newPosition);

    element.position.copy(newPosition);
    element.update();

    // The distance is signed, so that it also supports openings that are
    // before the startPoint by using the dot product
    let distance = newPosition.distanceTo(this._wall.startPoint3D);
    const vector = new THREE.Vector3();
    vector.subVectors(newPosition, this._wall.startPoint3D);
    const dotProduct = vector.dot(this._wall.direction);
    distance *= dotProduct > 0 ? 1 : -1;

    const id = element.attributes.expressID;

    this.list.set(id, { opening: element, distance });
  }

  delete(element: ClayElement) {
    this.list.delete(element.attributes.expressID);
  }

  update() {
    const start = this._wall.startPoint3D;
    const dir = this._wall.direction;
    for (const [_id, { opening, distance }] of this.list) {
      const pos = dir.clone().multiplyScalar(distance).add(start);

      // Align opening to wall
      opening.position.x = pos.x;
      opening.position.y = pos.y;
      opening.rotation.z = this._wall.rotation.z;

      opening.update();
    }
  }
}
