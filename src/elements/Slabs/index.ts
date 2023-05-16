import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive, Extrusions, Lines } from "../../primitives";

export class Slabs extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  extrusions = new Extrusions();
  lines = new Lines();

  private _nextIndex = 0;
  private _nextPolylineIndex = 0;
  private _extrusionSlabMap = new Map<number, number>();

  list: {
    [slabID: number]: {
      id: number;
      polylines: Set<number>;
      direction: number;
      extrusion: number | null;
    };
  } = {};

  polylines: {
    [id: number]: {
      id: number;
      lines: Set<number>;
    };
  } = {};

  constructor() {
    super();
    this.mesh = this.extrusions.mesh;
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

  addPolyline(lines: number[]) {
    const id = this._nextPolylineIndex++;
    this.polylines[id] = {
      id,
      lines: new Set(lines),
    };
    return id;
  }

  setPolylines(id: number, lines: number[]) {
    this.list[id].polylines = new Set(lines);
  }

  add(polylines: number[], height: number) {
    const id = this._nextIndex++;

    const directionID = this.getDirection(height);

    this.list[id] = {
      id,
      direction: directionID,
      polylines: new Set(polylines),
      extrusion: null,
    };

    this.regenerate([id]);
  }

  remove(ids: Iterable<number>) {
    const pointsToDelete = new Set<number>();
    for (const id of ids) {
      const slab = this.list[id];
      this.removeExtrusion(id);

      for (const line of slab.polylines) {
        const { start, end } = this.lines.list[line];
        pointsToDelete.add(start);
        pointsToDelete.add(end);
      }
    }
    this.lines.removePoints(pointsToDelete);
  }

  regenerate(ids: number[]) {
    for (const id of ids) {
      this.removeExtrusion(id);
      const slab = this.list[id];

      let outline: number[] = [];
      const holes: number[][] = [];
      const outlineID = this.getOutline(id);

      for (const polyID of slab.polylines) {
        const pointIDs = this.createPoints(polyID);
        if (polyID === outlineID) {
          outline = pointIDs;
        } else {
          holes.push(pointIDs);
        }
      }

      const face = this.extrusions.faces.add(outline, holes);
      const extrusion = this.extrusions.add(face, slab.direction);

      slab.extrusion = extrusion;
      this._extrusionSlabMap.set(extrusion, id);
    }
  }

  removeExtrusion(id: number) {
    const slab = this.list[id];
    const extrusion = slab.extrusion;
    if (extrusion === null) return;
    this.extrusions.remove([extrusion]);
    this.list[id].extrusion = null;
  }

  private getOutline(id: number) {
    const slab = this.list[id];
    let biggestSize = 0;
    let biggestPolyline = 0;
    for (const polyID of slab.polylines) {
      const size = this.getPolylineSize(polyID);
      if (size > biggestSize) {
        biggestSize = size;
        biggestPolyline = polyID;
      }
    }
    return biggestPolyline;
  }

  private getPolylineSize(id: number) {
    const polyline = this.polylines[id];

    const max = Number.MAX_VALUE;

    const biggest = [-max, -max, -max];
    const smallest = [max, max, max];

    for (const lineID of polyline.lines) {
      const line = this.lines.list[lineID];
      const end = this.lines.vertices.get(line.end);
      if (!end) continue;
      if (end[0] > biggest[0]) biggest[0] = end[0];
      if (end[1] > biggest[1]) biggest[1] = end[1];
      if (end[2] > biggest[2]) biggest[2] = end[2];
      if (end[0] < smallest[0]) smallest[0] = end[0];
      if (end[1] < smallest[1]) smallest[1] = end[1];
      if (end[2] < smallest[2]) smallest[2] = end[2];
    }

    const x = Math.abs(biggest[0] - smallest[0]);
    const y = Math.abs(biggest[1] - smallest[1]);
    const z = Math.abs(biggest[2] - smallest[2]);

    return x + y + z;
  }

  private createPoints(id: number) {
    const polyline = this.polylines[id];
    const points: [number, number, number][] = [];
    for (const lineID of polyline.lines) {
      const line = this.lines.list[lineID];
      const end = this.lines.vertices.get(line.end);
      if (!end) continue;
      points.push(end);
    }
    return this.extrusions.faces.addPoints(points);
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
}
