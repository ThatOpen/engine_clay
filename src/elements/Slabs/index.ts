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
      inner: boolean;
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

  addPolyline(lines: number[], inner: boolean) {
    const id = this._nextPolylineIndex++;
    this.polylines[id] = {
      id,
      inner,
      lines: new Set(lines),
    };
    return id;
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

      for (const polyID of slab.polylines) {
        const pointIDs = this.createPoints(polyID);
        const inner = this.polylines[polyID].inner;
        if (inner) {
          holes.push(pointIDs);
        } else if (!outline.length) {
          outline = pointIDs;
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

  // addExtrusion(id: number) {
  // const { lines, direction, holes } = this.list[id];
  // const linesIDs = Array.from(lines);
  // const extrusionID = this.createSlab(linesIDs, direction, holes);
  // this.list[id].extrusion = extrusionID;
  // this._extrusionSlabMap.set(extrusionID, id);
  // }

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
