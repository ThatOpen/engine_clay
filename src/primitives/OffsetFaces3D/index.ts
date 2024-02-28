import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive } from "../Primitive";
import { OffsetFaces } from "../OffsetFaces";
import { Extrusions } from "../Extrusions";
import { Vector } from "../../utils";

// TODO: Clean up all, especially holes management

export class Walls extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  offsetFaces = new OffsetFaces();
  extrusions = new Extrusions();

  list: {
    [id: number]: {
      id: number;
      extrusion: number;
      holes: Set<number>;
    };
  } = {};

  knots: {
    [id: number]: {
      id: number;
      extrusion: number;
    };
  } = {};

  holes: {
    [wallID: number]: {
      [id: number]: {
        basePoints: Set<number>;
        topPoints: Set<number>;
      };
    };
  } = {};

  defaultAxis: number;

  private _holeIdGenerator = 0;

  constructor() {
    super();
    // TODO: Probably better to keep offsetfaces and extrusion faces separated
    this.extrusions.faces = this.offsetFaces.faces;
    this.mesh = this.extrusions.mesh;

    const heightPointsID = this.extrusions.lines.addPoints([
      [0, 0, 0],
      [0, 3, 0],
    ]);

    const [axisID] = this.extrusions.lines.add(heightPointsID);
    this.defaultAxis = axisID;
  }

  regenerate(ids = this.offsetFaces.ids) {
    this.deletePreviousExtrusions(ids);

    for (const id of ids) {
      const extrusion = this.createGeometry(id);
      if (extrusion === null) continue;

      const previous = this.list[id];
      const holes = previous ? previous.holes : new Set<number>();

      this.list[id] = {
        id,
        extrusion,
        holes,
      };
    }

    const relatedKnots = this.offsetFaces.getRelatedKnots(ids);
    this.regenerateKnots(relatedKnots);
  }

  /**
   * Select or unselects the given Walls.
   * @param active Whether to select or unselect.
   * @param ids List of walls IDs to select or unselect. If not
   * defined, all lines walls be selected or deselected.
   */
  select(active: boolean, ids?: Iterable<number>) {
    const idsUndefined = ids === undefined;
    const items = idsUndefined ? this.ids : ids;
    this.selected.select(active, items, this.ids);
    const extrusions: number[] = [];
    for (const id of this.selected.data) {
      const wall = this.list[id];
      if (!wall) continue;
      extrusions.push(wall.extrusion);
    }
    const selected = idsUndefined ? undefined : extrusions;
    this.extrusions.select(active, selected);

    this.offsetFaces.select(active, items);
  }

  /**
   * Applies a transformation to the selected geometries.
   * @param matrix Transformation matrix to apply.
   */
  transform(matrix: THREE.Matrix4) {
    this.offsetFaces.transform(matrix);
    this.update();
  }

  setWidth(width: number, ids = this.selected.data) {
    this.offsetFaces.setWidth(width, ids);
    this.update();
  }

  setOffset(offset: number, ids = this.selected.data) {
    this.offsetFaces.setOffset(offset, ids);
    this.update();
  }

  private update() {
    const relatedPoints = new Set<number>();
    for (const id of this.offsetFaces.lines.vertices.selected.data) {
      relatedPoints.add(id);
    }

    const updatedLines = this.offsetFaces.getRelatedLines(relatedPoints, true);
    const updatedKnots = this.offsetFaces.getRelatedKnots(updatedLines);
    for (const id of updatedKnots) {
      this.updateKnotGeometry(id);
    }

    this.updateWalls(updatedLines);
  }

  private updateWalls(walls: Iterable<number>) {
    for (const id of walls) {
      const offsetFace = this.offsetFaces.list[id];
      const extrusionID = this.list[id].extrusion;
      const { baseFace, topFace } = this.extrusions.list[extrusionID];

      const faces = this.extrusions.faces;
      const offsetFaces = this.offsetFaces.faces;

      // Get new point coordinates

      const [p1, p1Top, p4Top, p4] = faces.list[baseFace].points;
      const [p2, p2Top, p3Top, p3] = faces.list[topFace].points;

      const [bp1, bp2, bp3, bp4] = offsetFace.points;

      const p1Coords = offsetFaces.points[bp1].coordinates;
      const p2Coords = offsetFaces.points[bp2].coordinates;
      const p3Coords = offsetFaces.points[bp3].coordinates;
      const p4Coords = offsetFaces.points[bp4].coordinates;

      const axis = this.getVerticalAxis();
      const p1TopCoords = Vector.add(p1Coords, axis);
      const p2TopCoords = Vector.add(p2Coords, axis);
      const p3TopCoords = Vector.add(p3Coords, axis);
      const p4TopCoords = Vector.add(p4Coords, axis);

      // Save distance from holes to p1 to keep it after transform
      const prevP1Coordinates = faces.points[p1].coordinates;
      const holes = this.holes[id];

      const distances: { [holeID: number]: [number, number, number][] } = {};

      if (holes) {
        for (const holeID in holes) {
          distances[holeID] = [];
          for (const pointID of holes[holeID].basePoints) {
            const point = faces.points[pointID].coordinates;
            const [x, y, z] = Vector.subtract(prevP1Coordinates, point);
            const horizontalDist = Vector.magnitude([x, 0, z]);
            distances[holeID].push([pointID, horizontalDist, y]);
          }
        }
      }

      // Set coordinates of base

      faces.setPoint(p1, p1Coords);
      faces.setPoint(p2, p2Coords);
      faces.setPoint(p3, p3Coords);
      faces.setPoint(p4, p4Coords);

      // Set coordinates of top

      faces.setPoint(p1Top, p1TopCoords);
      faces.setPoint(p2Top, p2TopCoords);
      faces.setPoint(p3Top, p3TopCoords);
      faces.setPoint(p4Top, p4TopCoords);

      // Set coordinates of holes in wall, maintaining distance to p1

      const direction = Vector.subtract(p1Coords, p4Coords);
      const normalDir = Vector.normalize(direction);
      const normalPerp = Vector.multiply(Vector.up, normalDir);
      const perpendicular = Vector.multiplyScalar(normalPerp, offsetFace.width);

      if (holes) {
        for (const holeID in distances) {
          const hole = distances[holeID];

          const topPoints = Array.from(holes[holeID].topPoints);
          let counter = 0;

          for (const point of hole) {
            const [pointID, x, y] = point;

            const horizontalVector = Vector.multiplyScalar(normalDir, x);
            const vector = Vector.add(horizontalVector, [0, y, 0]);
            const newPosition = Vector.add(p1Coords, vector);
            faces.setPoint(pointID, newPosition);

            const topPoint = topPoints[counter++];
            const newTopPosition = Vector.add(newPosition, perpendicular);
            faces.setPoint(topPoint, newTopPosition);
          }
        }
      }
    }
  }

  addHole(id: number, holePointsIDs: number[][]) {
    if (!this.holes[id]) {
      this.holes[id] = {};
    }
    for (const points of holePointsIDs) {
      const holeID = this._holeIdGenerator++;
      this.holes[id][holeID] = {
        basePoints: new Set(points),
        topPoints: new Set(),
      };
    }
  }

  private deletePreviousExtrusions(ids: number[]) {
    const previousExtrusions: number[] = [];
    for (const id of ids) {
      const previous = this.list[id];
      if (previous) {
        previousExtrusions.push(previous.extrusion);
      }
    }
    this.extrusions.remove(previousExtrusions);
  }

  private regenerateKnots(ids = this.offsetFaces.knotsIDs as Iterable<number>) {
    for (const knotID of ids) {
      const knot = this.offsetFaces.knots[knotID];
      if (knot === null || knot === undefined) continue;
      this.createKnotGeometry(knotID);
    }
  }

  private createGeometry(id: number) {
    const offsetFace = this.offsetFaces.list[id];
    const [p1ID, p2ID, p3ID, p4ID] = offsetFace.points;

    const points = this.offsetFaces.faces.points;
    const p1 = points[p1ID].coordinates;
    const p4 = points[p4ID].coordinates;

    const vector = this.getVerticalAxis();

    const p1Top = Vector.add(p1, vector);
    const p4Top = Vector.add(p4, vector);

    const direction = Vector.subtract(p1, p4);
    const normalDirection = Vector.normalize(direction);
    const normal = Vector.multiply(Vector.up, normalDirection);
    const scaledNormal = Vector.multiplyScalar(normal, offsetFace.width);
    const p1Normal = Vector.add(p1, scaledNormal);
    const normalAxisPointsIDs = this.extrusions.lines.addPoints([p1, p1Normal]);
    const [normalAxis] = this.extrusions.lines.add(normalAxisPointsIDs);

    const pointsIDs = this.extrusions.faces.addPoints([p1, p1Top, p4Top, p4]);

    const faceHoles = this.holes[id];
    const holes: number[][] = [];
    if (faceHoles) {
      for (const holeID in faceHoles) {
        const hole = faceHoles[holeID];
        const holePoints = Array.from(hole.basePoints);
        holes.push(holePoints);
      }
    }

    const faceID = this.extrusions.faces.add(pointsIDs, holes);

    const extrusionID = this.extrusions.add(faceID, normalAxis);
    const extrusion = this.extrusions.list[extrusionID];

    // Save top holes

    if (faceHoles) {
      let counter = 0;
      const topHoles = Object.values(
        this.extrusions.faces.list[extrusion.topFace].holes
      );

      for (const holeID in faceHoles) {
        const hole = topHoles[counter++];
        faceHoles[holeID].topPoints = hole.points;
      }
    }

    // Correct extrusion top to fit the OffsetFace knots

    const otherSide = this.extrusions.faces.list[extrusion.topFace];
    const otherSidePoints = Array.from(otherSide.points);

    const [extrP2, extrP2Top, extrP3Top, extrP3] = otherSidePoints;

    const p2 = points[p2ID].coordinates;
    const p3 = points[p3ID].coordinates;
    const p2Top = Vector.add(p2, vector);
    const p3Top = Vector.add(p3, vector);

    this.extrusions.faces.setPoint(extrP2, p2);
    this.extrusions.faces.setPoint(extrP3, p3);
    this.extrusions.faces.setPoint(extrP2Top, p2Top);
    this.extrusions.faces.setPoint(extrP3Top, p3Top);

    return extrusionID;
  }

  // TODO: Allow each wall to have a different vertical axis
  //  (e.g. for different heights or tilted walls)
  private getVerticalAxis() {
    const line = this.extrusions.lines.get(this.defaultAxis);
    if (!line) {
      throw new Error("Wall axis not found!");
    }
    const [start, end] = line;
    return Vector.subtract(start, end);
  }

  private updateKnotGeometry(knotID: number) {
    const baseKnot = this.offsetFaces.knots[knotID];
    if (baseKnot === null || baseKnot === undefined) {
      return;
    }

    const baseFace = this.offsetFaces.faces.list[baseKnot];

    const knot = this.knots[knotID];
    if (!knot || !knot.extrusion) {
      this.createKnotGeometry(knotID);
      console.log("knot didnt exist");
      return;
    }

    const extrudedKnot = this.extrusions.list[knot.extrusion];
    const extrudedBaseFace = this.extrusions.faces.list[extrudedKnot.baseFace];
    const extrudedTopFace = this.extrusions.faces.list[extrudedKnot.topFace];

    if (baseFace.points.size !== extrudedBaseFace.points.size) {
      this.createKnotGeometry(knotID);
      console.log("knot changed size");
      return;
    }

    const verticalAxis = this.getVerticalAxis();

    const basePointsArray = Array.from(extrudedBaseFace.points);
    const topPointsArray = Array.from(extrudedTopFace.points);

    let counter = 0;
    for (const pointID of baseFace.points) {
      const coords = this.offsetFaces.faces.points[pointID].coordinates;
      const basePointID = basePointsArray[counter];
      this.extrusions.faces.setPoint(basePointID, coords);

      const topCoords = Vector.add(coords, verticalAxis);
      const topPointID = topPointsArray[counter];
      this.extrusions.faces.setPoint(topPointID, topCoords);
      counter++;
    }
  }

  private createKnotGeometry(knotID: number) {
    if (this.knots[knotID]) {
      const knot = this.knots[knotID];
      this.extrusions.remove([knot.extrusion]);
    }

    const knotFaceID = this.offsetFaces.knots[knotID];
    if (knotFaceID === null || knotFaceID === undefined) return;

    const face = this.offsetFaces.faces.list[knotFaceID];
    const points: [number, number, number][] = [];
    for (const pointID of face.points) {
      const point = this.offsetFaces.faces.points[pointID];
      points.push(point.coordinates);
    }

    const pointsIDs = this.extrusions.faces.addPoints(points);
    const faceID = this.extrusions.faces.add(pointsIDs);
    const extrusion = this.extrusions.add(faceID, this.defaultAxis);

    this.knots[knotID] = {
      id: knotID,
      extrusion,
    };
  }
}
