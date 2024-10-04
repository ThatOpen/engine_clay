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

  async update(ids: Iterable<number> = this.list.keys()) {
    for (const id of ids) {
      const corners = this.list.get(id);
      if (!corners) {
        continue;
      }
      for (const [, corner] of corners) {
        await this.extend(corner);
      }
    }
  }

  async extend(corner: WallCorner) {
    const { wall1, wall2, to, priority, offset } = corner;
    // Strategy: there are 2 cases
    // A) Both points of the wall are on one side of this wall
    // In this case, extend its closest point to this wall
    // B) Each point of the wall are on one side of this wall
    // In that case, keep the point specified in priority

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

    const offsetDist = offset === "auto" ? wall2.type.width : offset;
    const factor = extendStart ? -1 : 1;
    const offsetVec = dir2.multiplyScalar(offsetDist * factor);
    intersection.add(offsetVec);

    const extended = extendStart ? wall2.startPoint : wall2.endPoint;
    extended.x = intersection.x;
    extended.y = intersection.y;

    if (corner.cut && corner.cutDirection) {
      if (!corner.halfSpace) {
        const halfSpace = new HalfSpace(wall1.model);
        corner.halfSpace = halfSpace;
        wall2.body.addSubtraction(halfSpace);
      }

      const halfSpace = corner.halfSpace as HalfSpace;

      const temp = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10, 10),
        new THREE.MeshLambertMaterial({
          color: "blue",
        }),
      );

      const temp2 = new THREE.Object3D();
      temp2.position.copy(p1);
      const p4 = p1.clone().add(plane.normal);
      temp2.lookAt(p4);

      temp2.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      temp2.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      temp2.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));

      temp.applyMatrix4(temp2.matrix);

      // temp.updateMatrix();

      const temp3 = new THREE.Object3D();
      const transform = wall2.transformation.matrix.clone();
      transform.invert();

      temp3.applyMatrix4(transform);
      temp3.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      temp.applyMatrix4(temp3.matrix);

      // const temp4 = new THREE.Object3D();
      // temp4.position.copy(p1);
      // temp4.applyMatrix4(transform);

      // const obj = MathUtils.getTempObject3DToDisplayIfcCoords();
      // obj.add(temp);
      // wall1.meshes[0].parent.add(obj);

      // halfSpace.position.copy(temp.position);
      // halfSpace.rotation.copy(temp.rotation);

      // const transform = wall2.getTransform();
      // transform.invert();
      // halfSpace.applyTransform(transform);

      // halfSpace.rotation.y = Math.PI / 2;
      // halfSpace.position.x = 0.25;

      halfSpace.transformation.rotation.copy(temp.rotation);
      halfSpace.transformation.position.copy(temp.position);

      halfSpace.update();
    }

    wall2.update(true);
  }
}
