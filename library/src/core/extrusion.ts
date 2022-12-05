import * as THREE from "three";
import earcut from "earcut";
import { Clay } from "./clay";

// TODO: move, add and delete points from profile
// TODO: edit height
// TODO: Add inner profile points (holes)
export class Extrusion extends Clay {
  points: THREE.Vector3[] = [];

  profileMaterial = new THREE.LineBasicMaterial({
    color: 0xff0000,
    depthTest: false,
  });

  profileMesh = new THREE.Line(
    new THREE.BufferGeometry(),
    this.profileMaterial
  );

  pointsMesh = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xff0000, depthTest: false, size: 0.1 })
  );

  height = 1;

  private normalPlane = new THREE.Plane();

  regenerate() {
    // Create profile representation

    const loopedPoints = [...this.points, this.points[0]];
    this.profileMesh.geometry.setFromPoints(loopedPoints);
    this.pointsMesh.geometry.setFromPoints(this.points);

    // Clean up previous geometry

    this.geometry.deleteAttribute("position");
    this.geometry.deleteAttribute("normal");

    // Get profile direction

    const [p1, p2, p3] = this.points;
    this.normalPlane.setFromCoplanarPoints(p1, p2, p3);
    const normal = this.normalPlane.normal;
    const offset = normal.clone().multiplyScalar(this.height);

    // Get vertices

    const vertices: number[] = [];

    for (const { x, y, z } of this.points) {
      vertices.push(x, y, z);
    }

    for (const { x, y, z } of this.points) {
      vertices.push(x + offset.x, y + offset.y, z + offset.z);
    }

    const positionArray = new Float32Array(vertices);
    const positionAttr = new THREE.BufferAttribute(positionArray, 3);
    this.geometry.setAttribute("position", positionAttr);

    // Triangulate base profile (also applies to end profile)
    // Earcut only works with 2d, so we need to project the points into 2d

    const points: number[] = [];
    for (const point of this.points) {
      const { x, z } = point.clone().projectOnPlane(normal);
      points.push(x, z);
    }

    const triangleIndices = earcut(points, undefined, 2);

    // Define indices

    const indices: number[] = [];

    // Base indices

    for (const index of triangleIndices) {
      indices.push(index);
    }

    const length = this.points.length;

    // End indices

    for (const index of triangleIndices) {
      indices.push(index + length);
    }

    // Transition indices are square faces composed by 2 triangles

    for (let i = 0; i < length - 1; i++) {
      indices.push(i, i + 1, i + 1 + length);
      indices.push(i + 1 + length, i + length, i);
    }

    // Last transition face

    indices.push(length - 1, 0, length);
    indices.push(length, 2 * length - 1, length - 1);

    this.geometry.setIndex(indices);
  }
}
