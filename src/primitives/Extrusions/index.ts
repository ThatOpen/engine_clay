import * as THREE from "three";
// import earcut from "earcut";
import { Faces } from "../Faces";
import { Lines } from "../Lines";
import { Primitive } from "../Primitive";
import { Vector } from "../../utils";

export interface ExtrusionHole {
  base: number;
  top: number;
  faces: Set<number>;
}

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
      holes: { [id: number]: ExtrusionHole };
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

  private _faceExtrusionMap = new Map<number, number>();

  private _idGenerator = 0;
  private _holeIdGenerator = 0;

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
    this._holeIdGenerator = 0;
    this.faces = new Faces();
    this.lines = new Lines();
    this.list = {};
  }

  add(faceID: number, pathID: number) {
    const id = this._idGenerator++;

    const newFaces = this.createExtrusion(faceID, pathID);

    if (newFaces) {
      const { topFaceID, sideFacesIDs, holes } = newFaces;

      this._faceExtrusionMap.set(topFaceID, id);
      this._faceExtrusionMap.set(faceID, id);
      for (const sideFaceID of sideFacesIDs) {
        this._faceExtrusionMap.set(sideFaceID, id);
      }

      this.list[id] = {
        id,
        holes,
        baseFace: faceID,
        path: pathID,
        topFace: topFaceID,
        sideFaces: sideFacesIDs,
      };
    }

    return id;
  }

  /**
   * Removes Extrusions.
   * @param ids List of extrusions to remove. If no face is specified,
   * removes all the selected extrusions.
   */
  remove(ids = this.selected.data as Iterable<number>) {
    const faces: number[] = [];
    for (const id of ids) {
      const { topFace, baseFace, sideFaces, holes } = this.list[id];
      faces.push(topFace);
      faces.push(baseFace);
      faces.push(...sideFaces);

      for (const holeID in holes) {
        const hole = holes[holeID];
        faces.push(...hole.faces);
      }

      this._faceExtrusionMap.delete(topFace);
      this._faceExtrusionMap.delete(baseFace);
      for (const sideFace of sideFaces) {
        this._faceExtrusionMap.delete(sideFace);
      }

      delete this.list[id];
    }

    const points = new Set<number>();
    for (const faceID of faces) {
      const face = this.faces.list[faceID];
      for (const point of face.points) {
        points.add(point);
      }
    }

    this.faces.removePoints(points);
  }

  /**
   * Given a face, returns the extrusion that contains it.
   * @param faceID The ID of the face whose extrusion to get.
   */
  getFromFace(faceID: number) {
    return this._faceExtrusionMap.get(faceID);
  }

  /**
   * Select or unselects the given Extrusions.
   * @param active Whether to select or unselect.
   * @param ids List of extrusion IDs to select or unselect. If not
   * defined, all extrusions will be selected or deselected.
   */
  select(active: boolean, ids?: Iterable<number>) {
    const idsUndefined = ids === undefined;
    const items = idsUndefined ? this.ids : ids;
    this.selected.select(active, items, this.ids);
    const faces: number[] = [];
    for (const id of this.selected.data) {
      const extrusion = this.list[id];
      if (extrusion) {
        faces.push(extrusion.topFace);
        faces.push(extrusion.baseFace);
        faces.push(...extrusion.sideFaces);

        for (const holeID in extrusion.holes) {
          const hole = extrusion.holes[holeID];
          faces.push(...hole.faces);
        }
      }
    }
    const selected = idsUndefined ? undefined : faces;
    this.faces.select(active, selected);
  }

  private createExtrusion(faceID: number, pathID: number) {
    const linePoints = this.lines.get(pathID);
    if (!linePoints) return null;
    const [start, end] = linePoints;

    const vector = Vector.subtract(start, end);
    const baseFace = this.faces.list[faceID];

    // Create top face

    const topFacePoints: [number, number, number][] = [];
    const holesCoordinates: [number, number, number][][] = [];

    for (const pointID of baseFace.points) {
      const coords = this.faces.points[pointID].coordinates;
      const transformed = Vector.add(coords, vector);
      topFacePoints.push(transformed);
    }

    for (const holeID in baseFace.holes) {
      const hole = baseFace.holes[holeID];
      const holeCoords: [number, number, number][] = [];
      holesCoordinates.push(holeCoords);
      for (const pointID of hole.points) {
        const coords = this.faces.points[pointID].coordinates;
        const transformed = Vector.add(coords, vector);
        holeCoords.push(transformed);
      }
    }

    const topFacePointsIDs = this.faces.addPoints(topFacePoints);

    const topHolesPoints: number[][] = [];
    for (const hole of holesCoordinates) {
      const ids = this.faces.addPoints(hole);
      topHolesPoints.push(ids);
    }

    const topFaceID = this.faces.add(topFacePointsIDs, topHolesPoints);

    // Create side faces

    const sideFacesIDs = new Set<number>();
    const baseFaceArray = Array.from(baseFace.points);
    this.createSideFaces(baseFaceArray, topFacePointsIDs, sideFacesIDs);

    // Define holes

    const holes: { [id: number]: ExtrusionHole } = {};
    const topFace = this.faces.list[topFaceID];
    const baseHolesIDs = Object.keys(baseFace.holes);
    const topHolesIDs = Object.keys(topFace.holes);

    for (let i = 0; i < baseHolesIDs.length; i++) {
      const faces = new Set<number>();
      const baseHole = baseFace.holes[baseHolesIDs[i]];
      const topHole = topFace.holes[topHolesIDs[i]];

      const holeID = this._holeIdGenerator++;
      holes[holeID] = { base: baseHole.id, top: topHole.id, faces };

      const holePointsIdsArray = Array.from(baseHole.points);
      const topHoleCoordsArray = Array.from(topHolesPoints[i]);
      this.createSideFaces(holePointsIdsArray, topHoleCoordsArray, faces);
    }

    return { topFaceID, sideFacesIDs, holes };
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
