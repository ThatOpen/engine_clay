import * as THREE from "three";
import { SimpleWall, WallEndPointType, WallPlaneType } from "./simple-wall";

export interface WallCornerConfig {
  wall1: SimpleWall;
  wall2: SimpleWall;
  to?: WallPlaneType;
  priority?: WallEndPointType;
}

interface WallCorner extends WallCornerConfig {
  to: WallPlaneType;
  priority: WallEndPointType;
}

export class SimpleWallCornerer {
  list = new Map<number, Set<WallCorner>>();

  add(config: WallCornerConfig) {
    const to = config.to || "center";
    const priority = config.priority || "end";

    const id = config.wall1.attributes.expressID;
    if (!this.list.has(id)) {
      this.list.set(id, new Set());
    }

    const corners = this.list.get(id) as Set<WallCorner>;
    corners.add({ ...config, to, priority });
  }

  update(ids: Iterable<number> = this.list.keys()) {
    for (const id of ids) {
      const corners = this.list.get(id);
      if (!corners) {
        continue;
      }
      for (const corner of corners) {
        this.extend(corner);
      }
    }
  }

  extend(corner: WallCornerConfig) {
    const { wall1, wall2, to, priority } = corner;
    // Strategy: there are 2 cases
    // A) Both points of the wall are on one side of this wall
    // In this case, extend its closest point to this wall
    // B) Each point of the wall are on one side of this wall
    // In that case, keep the point specified in priority

    if (wall1.direction.equals(wall2.direction)) {
      // Same direction, so walls can't intersect
      return;
    }

    const plane = wall1.getPlane(to);
    if (plane === null) {
      // Malformed wall (e.g. zero length)
      return;
    }

    const currentWallLine = new THREE.Line3(
      wall2.startPoint3D,
      wall2.endPoint3D,
    );
    const wallsIntersect = plane.intersectsLine(currentWallLine);

    const start = wall2.startPoint3D;
    const end = wall2.endPoint3D;

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

    const extended = extendStart ? wall2.startPoint : wall2.endPoint;
    extended.x = intersection.x;
    extended.y = intersection.y;
    wall2.update(true);
  }
}
