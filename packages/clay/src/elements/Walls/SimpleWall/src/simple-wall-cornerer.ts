import * as THREE from "three";
import { SimpleWall, WallEndPointType, WallPlaneType } from "./simple-wall";
import { HalfSpace } from "../../../../geometries";

export interface WallCornerConfig {
  wall1: SimpleWall;
  wall2: SimpleWall;
  to?: WallPlaneType;
  priority?: WallEndPointType;
  cut?: "exterior" | "interior";
  cutDirection?: "exterior" | "interior";
  offset?: number | "auto";
}

interface WallCorner extends WallCornerConfig {
  to: WallPlaneType;
  priority: WallEndPointType;
  offset: number | "auto";
  halfSpace?: HalfSpace;
}

export class SimpleWallCornerer {
  list = new Map<number, Map<number, WallCorner>>();

  private _temp = new THREE.Object3D();

  add(config: WallCornerConfig) {
    const id1 = config.wall1.attributes.expressID;
    const id2 = config.wall2.attributes.expressID;

    if (!this.list.has(id1)) {
      this.list.set(id1, new Map());
    }

    const corners = this.list.get(id1) as Map<number, WallCorner>;

    const to = config.to || "center";
    const priority = config.priority || "end";
    const offset = config.offset || "auto";
    corners.set(id2, { ...config, to, priority, offset });
  }

  update(ids: Iterable<number> = this.list.keys()) {
    for (const id of ids) {
      const corners = this.list.get(id);
      if (!corners) {
        continue;
      }
      for (const [, corner] of corners) {
        this.extend(corner);
      }
    }
  }

  extend(corner: WallCorner) {
    const { wall1, wall2, to, priority, offset } = corner;
    // Strategy: there are 2 cases
    // A) Both points of the wall are on one side of this wall
    // In this case, extend its closest point to this wall
    // B) Each point of the wall are on one side of this wall
    // In that case, keep the point specified in priority

    wall1.transformation.updateMatrix();

    const dir1 = wall1.direction;
    const dir2 = wall2.direction;
    if (dir1.equals(dir2)) {
      // Same direction, so walls can't intersect
      return;
    }

    const { plane, p1 } = wall1.getPlane(to);
    if (plane === null) {
      // Malformed wall (e.g. zero length)
      return;
    }

    const start = wall2.startPoint3D;
    const end = wall2.endPoint3D;

    const extendStart = priority === "start";

    const pointToExtend = extendStart ? start : end;
    if (plane.distanceToPoint(pointToExtend) !== 0) {
      // Point is already aligned with wall
      const origin = extendStart ? end : start;
      const direction = extendStart ? start : end;
      direction.sub(origin);

      const ray = new THREE.Ray(origin, direction);

      const intersection = ray.intersectPlane(plane, new THREE.Vector3());

      if (intersection === null) {
        return;
      }

      const offsetDist = offset === "auto" ? wall2.type.width : offset;
      const factor = extendStart ? -1 : 1;
      const offsetVec = dir2.multiplyScalar(offsetDist * factor);
      intersection.add(offsetVec);

      const extended = extendStart ? wall2.startPoint : wall2.endPoint;
      extended.x = intersection.x;
      extended.y = intersection.z;

      wall2.update();
    }

    if (corner.cut && corner.cutDirection) {
      if (!corner.halfSpace) {
        const halfSpace = new HalfSpace(wall1.model);
        corner.halfSpace = halfSpace;
        wall2.body.addSubtraction(halfSpace);
      }

      const halfSpace = corner.halfSpace as HalfSpace;

      const rotation = new THREE.Vector3(0, 0, 1);

      this._temp.position.copy(p1);
      const factor = corner.cutDirection === "interior" ? -1 : 1;
      const minusNormal = plane.normal.clone().multiplyScalar(factor);
      this._temp.lookAt(p1.clone().add(minusNormal));
      this._temp.updateMatrix();

      const planeRotation = new THREE.Matrix4();
      planeRotation.extractRotation(this._temp.matrix);
      rotation.applyMatrix4(planeRotation);

      wall2.transformation.updateMatrix();
      const wallRotation = new THREE.Matrix4();
      const inverseWall = wall2.transformation.matrix.clone();
      inverseWall.invert();
      wallRotation.extractRotation(inverseWall);
      rotation.applyMatrix4(wallRotation);

      const position = this._temp.position.clone();
      position.applyMatrix4(inverseWall);

      halfSpace.transformation.position.copy(position);
      halfSpace.direction.copy(rotation).normalize();

      halfSpace.update();
    }

    wall2.update(true);
  }
}
