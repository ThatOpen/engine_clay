import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive } from "../Primitive";
import { Extrusions } from "../Extrusions";
import { Lines } from "../Lines";

export class Slabs extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  extrusions = new Extrusions();
  lines = new Lines();

  private _nextIndex = 0;

  list: {
    [slabID: number]: {
      id: number;
      lines: Set<number>;
      direction: number;
      extrusion: number;
    };
  } = {};

  constructor() {
    super();
    this.mesh = this.extrusions.mesh;
  }

  add(lineIDs: number[], height: number) {
    const id = this._nextIndex++;

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

    const allCoordinates: [number, number, number][] = [];
    for (const id of pointsIDs) {
      const coordinates = this.lines.vertices.get(id);
      if (!coordinates) continue;
      allCoordinates.push(coordinates);
    }

    // Create axis

    // TODO: Make direction normal to face
    const directionPointsIDs = this.extrusions.lines.addPoints([
      [0, 0, 0],
      [0, height, 0],
    ]);

    const [directionID] = this.extrusions.lines.add(directionPointsIDs);

    // Create base face

    const ids = this.extrusions.faces.addPoints(allCoordinates);
    const faceID = this.extrusions.faces.add(ids);

    // Create extrusion
    const extrusionID = this.extrusions.add(faceID, directionID);

    this.list[id] = {
      id,
      direction: directionID,
      lines: new Set(lineIDs),
      extrusion: extrusionID,
    };
  }
}
