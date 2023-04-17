import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive } from "../Primitive";
import { Faces } from "../Faces";
import { Lines } from "../Lines";
import { Vector } from "../../utils";

export class OffsetFaces extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  faces = new Faces();
  lines = new Lines();

  /**
   * The list of axis.
   */
  axes: {
    [id: number]: {
      width: number;
      offset: number;
    };
  } = {};

  constructor() {
    super();
    this.mesh = this.faces.mesh;
  }

  addPoints(points: [number, number, number][]) {
    this.lines.addPoints(points);
  }

  addAxes(ids: number[], width: number, offset = 0) {
    if (offset > width / 2) {
      throw new Error("The axis must be contained within the face generated!");
    }
    const lineIDs = this.lines.add(ids);

    for (const id of ids) {
      const point = this.lines.points[id];
      let vectors: number[][] = [];

      this.getAllNormalizedVectors(vectors, point.start, false);
      this.getAllNormalizedVectors(vectors, point.end, true);

      vectors = this.order2DVectorsCounterClockwise(vectors);

      // for (let i = 0; i < vectors.length; i++) {
      //   const currentVector = vectors[i];

      //   const isLast = i === vectors.length - 1;
      //   const nextVector = isLast ? vectors[i + 1] : vectors[0];

      //   const upVector = [0, 1, 0];

      //   const currentRightDirection = Vector.multiply(currentVector, upVector);
      // }
    }

    for (const id of lineIDs) {
      const line = this.lines.list[id];

      const start = this.lines.vertices.get(line.start);
      const end = this.lines.vertices.get(line.end);
      if (start === null || end === null) continue;

      const pointOverStart = [start[0], start[1] + 1, start[2]];
      const firstNormal = Vector.getNormal([pointOverStart, start, end]);

      const offsetVector = Vector.multiplyScalar(firstNormal, offset);
      const depthVector = Vector.multiplyScalar(firstNormal, width / 2);
      const minusDepthVector = Vector.multiplyScalar(depthVector, -1);

      const p1 = Vector.add(start, depthVector, offsetVector);
      const p2 = Vector.add(start, minusDepthVector, offsetVector);
      const p3 = Vector.add(end, minusDepthVector, offsetVector);
      const p4 = Vector.add(end, depthVector, offsetVector);

      const counter = Object.keys(this.faces.points).length;
      this.faces.addPoints([p1, p2, p3, p4]);
      this.faces.add([counter, counter + 1, counter + 2, counter + 3]);

      this.axes[id] = { width, offset };
    }
  }

  private order2DVectorsCounterClockwise(vectors: number[][]) {
    const vectorsWithAngles: { angle: number; vector: number[] }[] = [];
    for (const vector of vectors) {
      const angle = Math.atan2(vector[2], vector[0]);
      vectorsWithAngles.push({ angle, vector });
    }
    return vectorsWithAngles
      .sort((item) => item.angle)
      .map((item) => item.vector);
  }

  private getAllNormalizedVectors(
    vectors: number[][],
    ids: Set<number>,
    flip: boolean
  ) {
    for (const lineID of ids) {
      const line = this.lines.list[lineID];
      const start = this.lines.vertices.get(line.start);
      const end = this.lines.vertices.get(line.end);
      if (start === null || end === null) {
        throw new Error(`Error with line ${lineID}`);
      }
      let vector = Vector.substract(start, end);
      if (flip) {
        vector = Vector.multiplyScalar(vector, -1);
      }
      vector = Vector.normalize(vector);
      vectors.push(vector);
    }
  }
}
