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

  // An axis that goes from A to B will define an OffsetFace like this:
  //       p2  +-------------------------------------------+ p3
  //          |                                           |
  //       A +-------------------------------------------+ B
  //        |                                           |
  //    p1 +-------------------------------------------+ p4

  /**
   * The list of axis. Points are p1, p2, p3, p4
   */
  list: {
    [id: number]: {
      id: number;
      width: number;
      offset: number;
      face: number;
      points: number[];
    };
  } = {};

  /**
   * A knot is the encounter of multiple OffsetFaces at a point. It's made of
   * a point and, optionally, an extra face to fill the gap (if there are more
   * than 3 OffsetFaces).
   */
  knots: { [id: number]: number | null } = {};

  private get _knotsIds() {
    const ids: number[] = [];
    for (const id in this.knots) {
      ids.push(this.list[id].id);
    }
    return ids;
  }

  constructor() {
    super();
    this.mesh = this.faces.mesh;
  }

  /**
   * Adds a new set of axes to this instance of OffsetFaces.
   * @param ids the ids of the points that define the axes ({@link Lines}).
   * @param width the width of the faces.
   * @param offset the offset of the faces to their respective axis.
   *
   */
  add(ids: number[], width: number, offset = 0) {
    if (offset > width / 2) {
      throw new Error("The axis must be contained within the face generated!");
    }

    const linesIDs = this.lines.add(ids);

    // First, create all offsetFaces
    // Then, update the necessary knots

    const knotsToUpdate = new Set<number>();

    for (const id of linesIDs) {
      const line = this.lines.list[id];
      const start = this.lines.vertices.get(line.start);
      const end = this.lines.vertices.get(line.end);
      if (!start || !end) continue;

      knotsToUpdate.add(line.start);
      knotsToUpdate.add(line.end);

      const rawDirection = Vector.substract(end, start);
      const direction = Vector.normalize(rawDirection);

      const normal = Vector.multiply(Vector.up, direction);
      const scaledNormal = Vector.multiplyScalar(normal, width / 2);
      const invScaledNormal = Vector.multiplyScalar(scaledNormal, -1);

      const p1 = Vector.add(start, scaledNormal);
      const p2 = Vector.add(start, invScaledNormal);
      const p3 = Vector.add(end, invScaledNormal);
      const p4 = Vector.add(end, scaledNormal);

      const points = this.faces.addPoints([p1, p2, p3, p4]);
      const face = this.faces.add(points);

      this.list[id] = {
        id,
        width,
        offset,
        face,
        points,
      };
    }

    this.updateKnots(knotsToUpdate);
  }

  /**
   * Select or unselects the given OffsetFaces.
   * @param active Whether to select or unselect.
   * @param ids List of OffsetFaces IDs to select or unselect. If not
   * defined, all lines will be selected or deselected.
   */
  select(active: boolean, ids = this._ids as Iterable<number>) {
    const faces: number[] = [];
    for (const id of ids) {
      const item = this.list[id];
      faces.push(item.face);
    }
    this.faces.select(active, faces);
    this.lines.select(active, ids);
  }

  /**
   * Select or unselects the given knots.
   * @param active Whether to select or unselect.
   * @param ids List of knot IDs to select or unselect. If not
   * defined, all knots will be selected or deselected.
   */
  selectKnots(active: boolean, ids = this._knotsIds as Iterable<number>) {
    const points: number[] = [];
    const faces: number[] = [];
    for (const id of ids) {
      const face = this.knots[id];
      if (face === undefined) continue;
      points.push(id);
      if (face !== null) {
        faces.push(face);
      }
    }
    this.lines.selectPoints(active, points);
    this.faces.select(active, faces);
  }

  private updateKnots(ids: Iterable<number>) {
    for (const id of ids) {
      const point = this.lines.points[id];
      const coords = this.lines.vertices.get(id);
      if (coords === null) continue;

      const knotFace = this.knots[id];
      if (knotFace !== undefined && knotFace !== null) {
        this.faces.remove([knotFace]);
        // const points = this.faces.list[knotFace].points;
        // this.faces.removePoints(points);
      }

      if (point.start.size + point.end.size === 1) {
        continue;
      }

      // Strategy: traverse all points, sort lines by angle and find the intersection
      // of each outer line with the next one

      const vectors = this.getNormalVectorsSortedClockwise(id);

      if (vectors.length === 1) {
        continue;
      }

      const intersectionPoints: [number, number, number][] = [];

      for (let i = 0; i < vectors.length; i++) {
        const currentLine = vectors[i];
        const currentVector = currentLine.vector;
        const { width } = this.list[currentLine.lineID];

        // If it's the last vector, the next one is the first one
        const isLastVector = i === vectors.length - 1;
        const j = isLastVector ? 0 : i + 1;
        const nextLine = vectors[j];
        const nextVector = nextLine.vector;
        const nextWidth = this.list[nextLine.lineID].width;

        // Express the outlines as a point and a direction
        // Beware the right-handed system for the direction

        const n1 = Vector.multiply(Vector.up, currentVector);
        const v1 = Vector.multiplyScalar(n1, width / 2);
        const p1 = Vector.add(coords, v1);

        const n2 = Vector.multiply(nextVector, Vector.up);
        const v2 = Vector.multiplyScalar(n2, nextWidth / 2);
        const p2 = Vector.add(coords, v2);

        let x: number;
        let z: number;

        const r1 = Vector.round(p1);
        const r2 = Vector.round(p2);
        const areLinesParallel = r1[0] === r2[0] && r1[2] === r2[2];

        if (areLinesParallel) {
          x = p1[0];
          z = p1[2];
        } else {
          // Convert point-direction to implicit 2D line ax + by = d
          // Although in our case we use z instead of y
          // p . n = d

          const a1 = n1[0];
          const b1 = n1[2];
          const d1 = p1[0] * n1[0] + p1[2] * n1[2];

          const a2 = n2[0];
          const b2 = n2[2];
          const d2 = p2[0] * n2[0] + p2[2] * n2[2];

          x = (b2 * d1 - b1 * d2) / (a1 * b2 - a2 * b1);
          z = (a1 * d2 - a2 * d1) / (a1 * b2 - a2 * b1);
        }

        // Update the vertices of both OffsetFaces
        const currentOffsetFace = this.list[currentLine.lineID];
        const isCurrentStart = point.start.has(currentLine.lineID);
        const currentIndex = isCurrentStart ? 1 : 3;
        const currentPoint = currentOffsetFace.points[currentIndex];
        this.faces.setPoint(currentPoint, [x, 0, z]);

        const nextOffsetFace = this.list[nextLine.lineID];
        const isNextStart = point.start.has(nextLine.lineID);
        const nextIndex = isNextStart ? 0 : 2;
        const nextPoint = nextOffsetFace.points[nextIndex];
        this.faces.setPoint(nextPoint, [x, 0, z]);

        intersectionPoints.push([x, 0, z]);
      }

      if (intersectionPoints.length > 2) {
        intersectionPoints.reverse();
        const pointsIDs = this.faces.addPoints(intersectionPoints);
        this.knots[id] = this.faces.add(pointsIDs);
      }
    }
  }

  private getNormalVectorsSortedClockwise(id: number) {
    const vectors: LineVector[] = [];
    const point = this.lines.points[id];
    this.getAllNormalizedVectors(vectors, point.start, false);
    this.getAllNormalizedVectors(vectors, point.end, true);
    return this.order2DVectorsClockwise(vectors);
  }

  private order2DVectorsClockwise(vectors: LineVector[]) {
    const vectorsWithAngles: { angle: number; line: LineVector }[] = [];
    for (const line of vectors) {
      const { vector } = line;
      let angle = Math.atan2(vector[0], vector[2]);
      if (angle < 0) angle += 2 * Math.PI;
      console.log((angle * 180) / Math.PI);
      vectorsWithAngles.push({ angle, line });
    }

    vectorsWithAngles.sort((v1, v2) => (v1.angle > v2.angle ? 1 : -1));
    return vectorsWithAngles.map((item) => item.line);
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
