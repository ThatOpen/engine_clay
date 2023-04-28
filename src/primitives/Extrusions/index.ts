import * as THREE from "three";
//import earcut from "earcut";
import { Vertices } from "../Vertices";
import { Faces } from "../Faces";
import { Lines } from "../Lines";
import { Primitive } from "../Primitive";
import { Selector } from "../../utils";

export class Extrusions extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh = new THREE.Mesh();

  /**
   * The list of outer points that define the faces. Each point corresponds to a set of {@link Vertices}. This way,
   * we can provide an API of faces that share vertices, but under the hood the vertices are duplicated per face
   * (and thus being able to contain the normals as a vertex attribute).
   */
  list: {
    [id: number]: {
      id: number;
      base: number;
      paths: number[];
      faces: Set<number>;
      needsUpdate: boolean;
      parentExtrusion: number;
      childrenExtrusionFaces: Set<number>;
    };
  } = {};

  /**
   * The geometric representation of the vertices that define this instance of faces.
   */
  faces: Faces = new Faces();

  /**
   * The geometric representation of the vertices that define this instance of lines.
   */
  lines: Lines = new Lines();

  selectedExtrusions = new Selector();

  private _nextIndex = 0;

  constructor() {
    super();
    const material = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(geometry, material);
    geometry.setIndex([]);
  }

  clear() {
    this.faces = new Faces();
    this.lines = new Lines();
    this.list = {};
  }

  add(faceId: number, linesIds: number[]) {
    const id = this._nextIndex;
    const extrude = {
      id,
      base: faceId,
      paths: linesIds,
      faces: new Set<number>(),
      needsUpdate: true,
      parentExtrusion: -1,
      childrenExtrusionFaces: new Set<number>(),
    };
    this._nextIndex++;
    this.list[id] = extrude;
    this.updateExtrusions();
  }

  /**
   * Update the extrusions by creating multiple consecutive extrusions based on the given list of extrusion objects.
   * Each extrusion object contains a base surface and a set of curve-paths.
   */
  updateExtrusions() {
    for (const id in this.list) {
      if (this.list[id].needsUpdate) {
        this.list[id].needsUpdate = false;
        const pathIds = this.list[id].paths; // get the array of path IDs
        const baseId = this.list[id].base;
        // this.faces.remove(this.list[id].faces);
        const newFaces = this.updateFaces(pathIds, baseId);
        if (newFaces) {
          this.list[id].faces = newFaces;
        }
      }
    }
  }

  private updateFaces(pathIds: number[], baseId: number) {
    const newFaces = new Set<number>();
    let lastVector = new THREE.Vector3();
    for (let i = 0; i < pathIds.length; i++) {
      const newPoints: any[] = []; // create an array to hold the new points of the extruded surface
      const pathId = pathIds[i];
      const linePoints = this.lines.get(pathId);
      if (
        linePoints === null ||
        linePoints[0] === null ||
        linePoints[1] === null
      ) {
        return null;
      }
      const vector = new THREE.Vector3(
        linePoints[1][0] - linePoints[0][0],
        linePoints[1][1] - linePoints[0][1],
        linePoints[1][2] - linePoints[0][2]
      );

      const newBasePoints: any[] = [];

      this.createPoints(
        this.faces.list[baseId].points,
        newPoints,
        newBasePoints,
        vector,
        lastVector,
        i
      );

      lastVector = new THREE.Vector3(
        lastVector.x + vector.x,
        lastVector.y + vector.y,
        lastVector.z + vector.z
      );

      for (let i = 0; i < this.faces.list[baseId].points.size; i++) {
        const p1 = newBasePoints[i];
        const p2 = newBasePoints[(i + 1) % this.faces.list[baseId].points.size];
        const p3 = newPoints[(i + 1) % this.faces.list[baseId].points.size];
        const p4 = newPoints[i];
        newFaces.add(this.faces.add([p1, p2, p3, p4]));
      }
      newFaces.add(this.faces.add(newPoints));
    }
    return newFaces;
  }

  private createPoints(
    points: Set<number>,
    newPoints: any[],
    newBasePoints: any[],
    vector: THREE.Vector3,
    lastVector: THREE.Vector3,
    index: number
  ) {
    for (const pointID of points) {
      const point = this.faces.points[pointID].coordinates;
      let newBPoint = new THREE.Vector3(point[0], point[1], point[2]);
      if (index === 0) {
        const iter = points.values();
        for (let i = 0; i < points.size; i++) {
          newBasePoints.push(iter.next().value);
        }
      } else {
        newBPoint = new THREE.Vector3(
          point[0] + lastVector.x,
          point[1] + lastVector.y,
          point[2] + lastVector.z
        );
        newBasePoints.push(
          this.faces.addPoints([[newBPoint.x, newBPoint.y, newBPoint.z]])[0]
        );
      }
      if (point === null) {
        return null;
      }
      const newPoint = new THREE.Vector3(
        newBPoint.x + vector.x,
        newBPoint.y + vector.y,
        newBPoint.z + vector.z
      );
      newPoints.push(
        this.faces.addPoints([[newPoint.x, newPoint.y, newPoint.z]])[0]
      );
    }
  }

  // transform(matrix: THREE.Matrix4) {
  //   // const vertices = new Set<number>();
  //   // matrix.elements = matrix.elements;
  //   matrix = matrix;
  // }
}
