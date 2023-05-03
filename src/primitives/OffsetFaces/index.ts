import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive } from "../Primitive";
import { Faces } from "../Faces";
import { Lines } from "../Lines";
import { Vector } from "../../utils";

interface LineVector {
  lineID: number;
  vector: number[];
}

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

    const linesIDs = this.lines.add(ids);

    for (const id of linesIDs) {
      this.axes[id] = {
        width,
        offset,
      };
    }
  }

  regenerate() {
    this.faces.clear();

    // A line that goes from A to B will define an offsetface like this:
    //     p1                             p2
    //     +------------------------------+
    //    |  A +-------------------+ B   |
    //   +------------------------------+
    //   p4                            p3

    // The next array means: [pointIndex, x, z]

    const offsetFaces: {
      [lineID: number]: { [pointIndex: number]: [number, number] };
    } = {};

    // Strategy: traverse all points, sort lines by angle and find the intersection
    // of each line with the next one

    for (const pointID in this.lines.points) {
      const id = parseInt(pointID, 10);
      const point = this.lines.points[id];
      const coords = this.lines.vertices.get(id);
      if (coords === null) continue;

      let vectors: LineVector[] = [];

      this.getAllNormalizedVectors(vectors, point.start, false);
      this.getAllNormalizedVectors(vectors, point.end, true);

      vectors = this.order2DVectorsCounterClockwise(vectors);

      const upVector = [0, 1, 0];

      for (let i = 0; i < vectors.length; i++) {
        const currentLine = vectors[i];
        const currentVector = currentLine.vector;
        const isCurrentStart = point.start.has(currentLine.lineID);

        const { width } = this.axes[currentLine.lineID];

        if (!offsetFaces[currentLine.lineID]) {
          offsetFaces[currentLine.lineID] = {};
        }

        const onlyOneLineInPoint = vectors.length === 1;
        if (onlyOneLineInPoint) {
          const normal = Vector.multiply(upVector, currentVector);
          const v1 = Vector.multiplyScalar(normal, width);
          const v2 = Vector.multiplyScalar(normal, -width);

          const p1 = Vector.add(coords, v1);
          const p2 = Vector.add(coords, v2);

          const index1 = isCurrentStart ? 1 : 3;
          const index2 = isCurrentStart ? 4 : 2;

          offsetFaces[currentLine.lineID][index1] = [p1[0], p1[2]];
          offsetFaces[currentLine.lineID][index2] = [p2[0], p2[2]];

          break;
        }

        const isLastVector = i === vectors.length - 1;
        const j = isLastVector ? 0 : i + 1;
        const nextLine = vectors[j];
        const nextVector = nextLine.vector;
        const nextWidth = this.axes[nextLine.lineID].width;

        // Express the outlines as a point and a direction
        // Beware the left-handed system for the direction

        const n1 = Vector.multiply(upVector, currentVector);
        const v1 = Vector.multiplyScalar(n1, width);
        const p1 = Vector.add(coords, v1);

        const n2 = Vector.multiply(nextVector, upVector);
        const v2 = Vector.multiplyScalar(n2, nextWidth);
        const p2 = Vector.add(coords, v2);

        // Convert point-direction to implicit 2D line ax + by = d
        // Beware that "y" is "z" in our 2D system
        // p . n = d

        const a1 = n1[0];
        const b1 = n1[2];
        const d1 = p1[0] * n1[0] + p1[2] * n1[2];

        const a2 = n2[0];
        const b2 = n2[2];
        const d2 = p2[0] * n2[0] + p2[2] * n2[2];

        // Find the intersection of the two lines

        const x = (b2 * d1 - b1 * d2) / (a1 * b2 - a2 * b1);
        const y = (a1 * d2 - a2 * d1) / (a1 * b2 - a2 * b1);

        // Save the intersection points in both lines

        if (!offsetFaces[nextLine.lineID]) {
          offsetFaces[nextLine.lineID] = {};
        }

        const isNextStart = point.start.has(nextLine.lineID);

        const currentIndex = isCurrentStart ? 1 : 3;
        const nextIndex = isNextStart ? 4 : 2;

        offsetFaces[currentLine.lineID][currentIndex] = [x, y];
        offsetFaces[nextLine.lineID][nextIndex] = [x, y];
      }
    }

    console.log(offsetFaces);

    for (const lineID in offsetFaces) {
      const offsetFace = offsetFaces[lineID];
      const points: [number, number, number][] = [];
      for (let i = 1; i < 5; i++) {
        const [x, z] = offsetFace[i];
        points.push([x, 0, z]);
      }
      const ids = this.faces.addPoints(points);
      this.faces.add(ids);
    }
  }

  private order2DVectorsCounterClockwise(vectors: LineVector[]) {
    const vectorsWithAngles: { angle: number; line: LineVector }[] = [];
    for (const line of vectors) {
      const { vector } = line;
      let angle = Math.atan2(vector[0], vector[2]);
      if (angle < 0) angle += 2 * Math.PI;
      vectorsWithAngles.push({ angle, line });
    }
    return vectorsWithAngles
      .sort((item) => item.angle)
      .map((item) => item.line);
  }

  private getAllNormalizedVectors(
    vectors: LineVector[],
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
      vectors.push({ lineID, vector });
    }
  }
}
