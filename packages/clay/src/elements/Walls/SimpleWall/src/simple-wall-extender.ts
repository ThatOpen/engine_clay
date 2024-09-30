import * as THREE from "three";
import { SimpleWall, WallEndPointType, WallPlaneType } from "./simple-wall";

export class SimpleWallExtender {
  private _wall: SimpleWall;

  constructor(wall: SimpleWall) {
    this._wall = wall;
  }

  extend(wall: SimpleWall, to: WallPlaneType, priority: WallEndPointType) {
    // Strategy: there are 2 cases
    // A) Both points of the wall are on one side of this wall
    // In this case, extend its closest point to this wall
    // B) Each point of the wall are on one side of this wall
    // In that case, keep the point specified in priority

    if (wall.direction.equals(this._wall.direction)) {
      // Same direction, so walls can't intersect
      return;
    }

    const plane = wall.getPlane(to);
    if (plane === null) {
      // Malformed wall (e.g. zero length)
      return;
    }

    const currentWallLine = new THREE.Line3(
      this._wall.startPoint3D,
      this._wall.endPoint3D,
    );
    const wallsIntersect = plane.intersectsLine(currentWallLine);

    const start = this._wall.startPoint3D;
    const end = this._wall.endPoint3D;

    let extendStart = priority === "start";

    if (!wallsIntersect) {
      const d1 = Math.abs(plane.distanceToPoint(start));
      const d2 = Math.abs(plane.distanceToPoint(end));
      extendStart = d1 < d2;
    }

    const pointToExtend = extendStart ? start : end;
    if (plane.distanceToPoint(pointToExtend) === 0) {
      // Point is already aligned with wall
      return;
    }

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
