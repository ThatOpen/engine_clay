import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive, Extrusions, Lines } from "../../primitives";

export class Slabs extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  extrusions = new Extrusions();
  lines = new Lines();

  private _nextIndex = 0;
  private _extrusionSlabMap = new Map<number, number>();

  list: {
    [slabID: number]: {
      id: number;
      lines: Set<number>;
      direction: number;
      extrusion: number | null;
    };
  } = {};

  constructor() {
    super();
    this.mesh = this.extrusions.mesh;
  }

  add(lineIDs: number[], height: number) {
    const id = this._nextIndex++;

    const directionID = this.getDirection(height);
    const extrusionID = this.createSlabExtrusion(lineIDs, directionID);
    this._extrusionSlabMap.set(extrusionID, id);

    this.list[id] = {
      id,
      direction: directionID,
      lines: new Set(lineIDs),
      extrusion: extrusionID,
    };
  }

  remove(ids: Iterable<number>) {
    const pointsToDelete = new Set<number>();
    for (const id of ids) {
      const slab = this.list[id];
      this.removeExtrusion(id);

      for (const line of slab.lines) {
        const { start, end } = this.lines.list[line];
        pointsToDelete.add(start);
        pointsToDelete.add(end);
      }
    }
    this.lines.removePoints(pointsToDelete);
  }

  removeExtrusion(id: number) {
    const slab = this.list[id];
    const extrusion = slab.extrusion;
    if (extrusion === null) return;
    this.extrusions.remove([extrusion]);
    this.list[id].extrusion = null;
  }

  addExtrusion(id: number) {
    const { lines, direction } = this.list[id];
    const linesIDs = Array.from(lines);
    const extrusionID = this.createSlabExtrusion(linesIDs, direction);
    this.list[id].extrusion = extrusionID;
    this._extrusionSlabMap.set(extrusionID, id);
  }

  /**
   * Given a face index, returns the slab ID that contains it.
   * @param faceIndex The index of the face whose slab ID to get.
   */
  getFromIndex(faceIndex: number) {
    const faceID = this.extrusions.faces.getFromIndex(faceIndex);
    if (faceID === undefined) return undefined;
    const extrusionID = this.extrusions.getFromFace(faceID);
    if (extrusionID === undefined) return undefined;
    return this._extrusionSlabMap.get(extrusionID);
  }

  private createSlabExtrusion(lineIDs: number[], directionID: number) {
    const allCoordinates = this.getAllCoordinates(lineIDs);
    const faceID = this.createBaseFace(allCoordinates);
    return this.extrusions.add(faceID, directionID);
  }

  private createBaseFace(allCoordinates: [number, number, number][]) {
    const ids = this.extrusions.faces.addPoints(allCoordinates);
    return this.extrusions.faces.add(ids);
  }

  private getDirection(height: number) {
    // TODO: Make direction normal to face
    const directionPointsIDs = this.extrusions.lines.addPoints([
      [0, 0, 0],
      [0, height, 0],
    ]);

    const [directionID] = this.extrusions.lines.add(directionPointsIDs);
    return directionID;
  }

  private getAllCoordinates(lineIDs: number[]) {
    const pointsIDs = this.getPoints(lineIDs);

    const allCoordinates: [number, number, number][] = [];
    for (const id of pointsIDs) {
      const coordinates = this.lines.vertices.get(id);
      if (!coordinates) {
        continue;
      }
      allCoordinates.push(coordinates);
    }
    return allCoordinates;
  }

  private getPoints(lineIDs: number[]) {
    const pointsIDs: number[] = [];
    let first = true;
    for (const id of lineIDs) {
      const line = this.lines.list[id];
      if (first) {
        pointsIDs.push(line.start);
        first = false;
      }
      pointsIDs.push(line.end);
    }
    // Remove last point, as it's already the first point
    pointsIDs.pop();
    return pointsIDs;
  }
}
