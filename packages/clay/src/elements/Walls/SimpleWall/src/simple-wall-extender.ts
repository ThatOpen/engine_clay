import * as THREE from "three";
import { SimpleWall } from "./simple-wall";

export class SimpleWallExtender {
  private _wall: SimpleWall;

  constructor(wall: SimpleWall) {
    this._wall = wall;
  }

  extend(wall: SimpleWall, priority: "start" | "end" = "start") {
    // Strategy: there are 2 possibilities
    // A) Both points of the wall are on one side of this wall
    // In this case, extend its closest point to this wall
    // B) Each point of the wall are on one side of this wall
    // In that case, keep the point specified in priority

    const p1 = wall.startPoint3D;
    const p2 = wall.endPoint3D;
    const p3 = p1.clone();
    p3.z += 1;
    const plane = new THREE.Plane().setFromCoplanarPoints(p1, p2, p3);

    const start = this._wall.startPoint3D;
    const end = this._wall.endPoint3D;

    const d1 = plane.distanceToPoint(start);
    const d2 = plane.distanceToPoint(end);

    const extendStart = d1 < d2;

    const origin = extendStart ? end : start;
    const direction = extendStart ? start : end;
    direction.sub(origin);

    const ray = new THREE.Ray(origin, direction);

    const intersection = ray.intersectPlane(plane, new THREE.Vector3());

    if (intersection === null) {
      return;
    }

    const extended = extendStart ? this._wall.startPoint : this._wall.endPoint;
    extended.x = intersection.x;
    extended.y = intersection.y;
    this._wall.update(true);
  }
}
