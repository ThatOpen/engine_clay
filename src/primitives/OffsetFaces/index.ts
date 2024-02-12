import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive } from "../Primitive";
import { Faces } from "../Faces";
import { Lines } from "../Lines";
import { Vector } from "../../utils";
// import { Polygon } from "../../utils/polygon";

interface LineVector {
  lineID: number;
  vector: number[];
}

export class OffsetFaces extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  faces = new Faces();
  lines = new Lines();

  // An axis that goes from A to B will define an OffsetFace like this. The
  // positive offset direction goes up.
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

  get knotsIDs() {
    const ids: number[] = [];
    for (const id in this.knots) {
      const idNumber = parseInt(id, 10);
      ids.push(idNumber);
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
    const linesIDs = this.lines.add(ids);

    const knotsToUpdate = new Set<number>();

    for (const id of linesIDs) {
      this.list[id] = { id, width, offset, face: 0, points: [] };
      const result = this.getFacePoints(id, knotsToUpdate);
      if (result === null) continue;
      const points = this.faces.addPoints(result);
      this.list[id].points = points;
      this.list[id].face = this.faces.add(points);
    }

    this.updateKnots(knotsToUpdate);

    return linesIDs;
  }

  /**
   * Select or unselects the given OffsetFaces.
   * @param active Whether to select or unselect.
   * @param ids List of OffsetFaces IDs to select or unselect. If not
   * defined, all lines will be selected or deselected.
   */
  select(active: boolean, ids = this.ids as Iterable<number>) {
    const faces: number[] = [];
    for (const id of ids) {
      const item = this.list[id];
      if (item) {
        faces.push(item.face);
      }
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
  selectKnots(active: boolean, ids = this.knotsIDs as Iterable<number>) {
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

  /**
   * Removes OffsetFaces.
   * @param ids List of OffsetFaces to remove. If no face is specified,
   * removes all the selected OffsetFaces.
   */
  remove(ids = this.lines.selected.data as Iterable<number>) {
    const relatedKnots = this.getRelatedKnots(ids);

    const facePoints: number[] = [];
    for (const id of ids) {
      facePoints.push(...this.list[id].points);
      delete this.list[id];
    }

    this.faces.removePoints(facePoints);
    const linesToUpdate = this.getRelatedLines(relatedKnots);
    this.lines.remove(ids);
    this.updateOffsetFaces(linesToUpdate);
  }

  /**
   * Removes Knots and all the related OffsetFaces.
   * @param ids List of knots to remove. If no knot is specified,
   * removes all the selected knots.
   */
  removePoints(ids = this.lines.vertices.selected.data as Iterable<number>) {
    const pointsToRemove = new Set<number>();
    const knotFacesToRemove = new Set<number>();
    for (const id of ids) {
      pointsToRemove.add(id);
      const face = this.knots[id];
      if (face !== null && face !== undefined) {
        knotFacesToRemove.add(face);
      }
      delete this.knots[id];
    }
    this.faces.remove(knotFacesToRemove);
    const offsetFacesToRemove = this.getRelatedLines(ids);
    this.remove(offsetFacesToRemove);
    this.lines.removePoints(pointsToRemove);
  }

  /**
   * Sets the offset of the specified OffsetFaces.
   * @param offset The offset to set.
   * @param ids List of knot IDs whose offset to change. If not specified,
   * it will change the offset of the selected OffsetFaces.
   */
  setOffset(
    offset: number,
    ids = this.lines.selected.data as Iterable<number>
  ) {
    for (const id of ids) {
      const offsetFace = this.list[id];
      offsetFace.offset = offset;
    }
    this.updateOffsetFaces(ids);
  }

  /**
   * Sets the width of the specified OffsetFaces.
   * @param width The width to set.
   * @param ids List of knot IDs whose width to change. If not specified,
   * it will change the width of the selected OffsetFaces.
   */
  setWidth(width: number, ids = this.lines.selected.data as Iterable<number>) {
    for (const id of ids) {
      const offsetFace = this.list[id];
      offsetFace.width = width;
    }
    this.updateOffsetFaces(ids);
  }

  /**
   * Applies a transformation to the selected vertices.
   * @param matrix Transformation matrix to apply.
   */
  transform(matrix: THREE.Matrix4) {
    this.lines.transform(matrix);
    const selectedPoints = this.lines.vertices.selected.data;
    const linesToUpdate = this.getRelatedLines(selectedPoints);
    this.updateOffsetFaces(linesToUpdate);
  }

  getRelatedKnots(lineIDs: Iterable<number>) {
    const relatedKnots = new Set<number>();
    for (const id of lineIDs) {
      const line = this.lines.list[id];
      relatedKnots.add(line.start);
      relatedKnots.add(line.end);
    }
    return relatedKnots;
  }

  getRelatedLines(pointIDs: Iterable<number>, neighbors = false) {
    const linesToUpdate = new Set<number>();
    this.getLinesOfPoints(pointIDs, linesToUpdate);

    if (neighbors) {
      const neighborPoints = new Set<number>();
      for (const lineID of linesToUpdate) {
        const line = this.lines.list[lineID];
        neighborPoints.add(line.start);
        neighborPoints.add(line.end);
      }
      this.getLinesOfPoints(neighborPoints, linesToUpdate);
    }

    return linesToUpdate;
  }

  private getLinesOfPoints(pointIDs: Iterable<number>, lines: Set<number>) {
    for (const id of pointIDs) {
      const point = this.lines.points[id];
      for (const lineID of point.start) {
        lines.add(lineID);
      }
      for (const lineID of point.end) {
        lines.add(lineID);
      }
    }
  }

  private getFacePoints(id: number, knots: Set<number>) {
    const offsetFace = this.list[id];
    if (!offsetFace) return null;
    const line = this.lines.list[id];
    const start = this.lines.vertices.get(line.start);
    const end = this.lines.vertices.get(line.end);
    if (!start || !end) return null;

    knots.add(line.start);
    knots.add(line.end);

    const rawDirection = Vector.subtract(end, start);
    const direction = Vector.normalize(rawDirection);

    const { width, offset } = offsetFace;

    const normal = Vector.multiply(Vector.up, direction);
    const scaledNormal = Vector.multiplyScalar(normal, width / 2);
    const invScaledNormal = Vector.multiplyScalar(scaledNormal, -1);

    const offsetDirection = Vector.multiplyScalar(normal, offset);

    const p1 = Vector.add(start, scaledNormal, offsetDirection);
    const p2 = Vector.add(start, invScaledNormal, offsetDirection);
    const p3 = Vector.add(end, invScaledNormal, offsetDirection);
    const p4 = Vector.add(end, scaledNormal, offsetDirection);
    return [p1, p2, p3, p4];
  }

  private updateOffsetFaces(ids: Iterable<number>) {
    const knotsToUpdate = new Set<number>();
    for (const id of ids) {
      const offsetFace = this.list[id];
      if (offsetFace === undefined) continue;
      const result = this.getFacePoints(id, knotsToUpdate);
      if (result === null) continue;

      for (let i = 0; i < 4; i++) {
        const pointID = offsetFace.points[i];
        const coordinates = result[i];
        this.faces.setPoint(pointID, coordinates);
      }
    }
    this.updateKnots(knotsToUpdate);
  }

  private updateKnots(ids: Iterable<number>) {
    for (const id of ids) {
      const point = this.lines.points[id];
      const coords = this.lines.vertices.get(id);
      if (coords === null) continue;

      const knotFace = this.knots[id];
      if (knotFace !== undefined && knotFace !== null) {
        const points = this.faces.list[knotFace].points;
        this.faces.removePoints(points);
        this.knots[id] = null;
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
        const currentOffsetFace = this.list[currentLine.lineID];
        const isCurrentStart = point.start.has(currentLine.lineID);
        const { width, offset } = currentOffsetFace;

        // If it's the last vector, the next one is the first one
        const isLastVector = i === vectors.length - 1;
        const j = isLastVector ? 0 : i + 1;
        const nextLine = vectors[j];
        const nextVector = nextLine.vector;
        const nextOffsetFace = this.list[nextLine.lineID];
        const isNextStart = point.start.has(nextLine.lineID);
        const nextWidth = nextOffsetFace.width;
        const nextOffset = nextOffsetFace.offset;

        // Express the outlines as a point and a direction
        // Beware the right-handed system for the direction

        const n1 = Vector.multiply(Vector.up, currentVector);
        const o1 = isCurrentStart ? -offset : offset;
        const v1 = Vector.multiplyScalar(n1, width / 2 + o1);
        const p1 = Vector.add(coords, v1);

        const n2 = Vector.multiply(nextVector, Vector.up);
        const o2 = isNextStart ? nextOffset : -nextOffset;
        const v2 = Vector.multiplyScalar(n2, nextWidth / 2 + o2);
        const p2 = Vector.add(coords, v2);

        const r1 = Vector.round(n1);
        const r2 = Vector.round(n2);
        const areLinesParallel = r1[0] === r2[0] && r1[2] === r2[2];

        const currentIndex = isCurrentStart ? 1 : 3;
        const currentPoint = currentOffsetFace.points[currentIndex];
        const nextIndex = isNextStart ? 0 : 2;
        const nextPoint = nextOffsetFace.points[nextIndex];

        if (areLinesParallel) {
          this.faces.setPoint(currentPoint, p1);
          this.faces.setPoint(nextPoint, p2);

          const pr1 = Vector.round(p1);
          const pr2 = Vector.round(p2);
          const areSamePoint = pr1[0] === pr2[0] && pr1[2] === pr2[2];

          intersectionPoints.push(p1);
          if (!areSamePoint) {
            intersectionPoints.push(p2);
          }
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

          const x = (b2 * d1 - b1 * d2) / (a1 * b2 - a2 * b1);
          const z = (a1 * d2 - a2 * d1) / (a1 * b2 - a2 * b1);

          const y = coords[1];
          // Update the vertices of both OffsetFaces
          this.faces.setPoint(currentPoint, [x, y, z]);
          this.faces.setPoint(nextPoint, [x, y, z]);
          intersectionPoints.push([x, y, z]);
        }
      }

      if (intersectionPoints.length > 2) {
        // if (Polygon.isConvex(intersectionPoints)) {
        intersectionPoints.reverse();
        // }
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
      let vector = Vector.subtract(start, end);
      if (flip) {
        vector = Vector.multiplyScalar(vector, -1);
      }
      vector = Vector.normalize(vector);
      vectors.push({ lineID, vector });
    }
  }
}
