import * as THREE from "three";
// import earcut from "earcut";
import { Vertices } from "../Vertices";
import { Faces } from "../Faces";
import { Lines } from "../Lines";
import { Primitive } from "../Primitive";
import { Vector } from "../../utils";

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
      baseFace: number;
      topFace: number;
      sideFaces: Set<number>;
      path: number;
    };
  } = {};

  /**
   * The geometric representation of the faces of all the extrusions.
   */
  faces: Faces = new Faces();

  /**
   * The geometric representation of the lines that represent the axis.
   */
  lines: Lines = new Lines();

  private _idGenerator = 0;

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
    this.selected.data.clear();
    this.faces.clear();
    this.lines.clear();
    this._idGenerator = 0;
    this.faces = new Faces();
    this.lines = new Lines();
    this.list = {};
  }

  add(faceID: number, pathID: number) {
    const id = this._idGenerator++;

    this.list[id] = {
      id,
      baseFace: faceID,
      path: pathID,
      topFace: -1,
      sideFaces: new Set<number>(),
    };

    const newFaces = this.createExtrusion(faceID, pathID);

    if (newFaces) {
      const { topFace, sideFaces } = newFaces;
      this.list[id].topFace = topFace;
      this.list[id].sideFaces = sideFaces;
    }

    return id;
  }

  private createExtrusion(pathID: number, baseFaceID: number) {
    const linePoints = this.lines.get(pathID);
    if (!linePoints) return null;
    const [start, end] = linePoints;

    const vector = Vector.subtract(start, end);

    const baseFace = this.faces.list[baseFaceID];

    // Create top face

    const topFacePoints: [number, number, number][] = [];
    const holes: [number, number, number][][] = [];

    for (const pointID of baseFace.points) {
      const coords = this.faces.points[pointID].coordinates;
      const transformed = Vector.add(coords, vector);
      topFacePoints.push(transformed);
    }

    for (const hole of baseFace.holes) {
      const holeCoords: [number, number, number][] = [];
      holes.push(holeCoords);
      for (const pointID of hole) {
        const coords = this.faces.points[pointID].coordinates;
        const transformed = Vector.add(coords, vector);
        holeCoords.push(transformed);
      }
    }

    const topFacePointsIDs = this.faces.addPoints(topFacePoints);

    const topHoleIDs: number[][] = [];
    for (const hole of holes) {
      const ids = this.faces.addPoints(hole);
      topHoleIDs.push(ids);
    }

    const topFace = this.faces.add(topFacePointsIDs, topHoleIDs);

    // Create side faces

    const sideFaces = new Set<number>();
    const baseFaceArray = Array.from(baseFace.points);
    this.createSideFaces(baseFaceArray, topFacePointsIDs, sideFaces);

    let i = 0;
    for (const hole of baseFace.holes) {
      const holeArray = Array.from(hole);
      const topHoleArray = Array.from(topHoleIDs[i++]);
      this.createSideFaces(holeArray, topHoleArray, sideFaces);
    }

    return { topFace, sideFaces };
  }

  private createSideFaces(base: number[], top: number[], faces: Set<number>) {
    for (let i = 0; i < base.length; i++) {
      const isLastFace = i === base.length - 1;
      const nextIndex = isLastFace ? 0 : i + 1;
      const p1 = base[i];
      const p2 = base[nextIndex];
      const p3 = top[nextIndex];
      const p4 = top[i];
      const id = this.faces.add([p1, p2, p3, p4]);
      faces.add(id);
    }
  }
}
