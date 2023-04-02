import * as THREE from "three";
import earcut from "earcut";
import { Vertices } from "../Vertices";
import { Primitive } from "../types";

export class Faces implements Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh = new THREE.Mesh();

  /**
   * The list of outer points that define the faces. Each point corresponds to a set of {@link Vertices}. This way,
   * we can provide an API of faces that share vertices, but under the hood the vertices are duplicated per face
   * (and thus being able to contain the normals as a vertex attribute).
   */
  points: {
    [id: number]: {
      coordinates: [number, number, number];
      vertices: Set<number>;
      id: number;
    };
  } = {};

  /**
   * The list of faces. Each face is defined by a list of outer points.
   * TODO: Implement inner points.
   */
  faces: {
    [id: number]: {
      id: number;
      position: number;
      vertices: Set<number>;
      points: Set<number>;
    };
  } = {};

  /**
   * The geometric representation of the vertices that define this instance of faces.
   */
  vertices: Vertices = new Vertices();

  private _faceIdGenerator = 0;
  private _pointIdGenerator = 0;
  private _selected = new Set<number>();

  private _baseColor = new THREE.Color(0.5, 0.5, 0.5);
  private _selectColor = new THREE.Color(1, 0, 0);

  /**
   * The color of all the points.
   */
  get baseColor() {
    return this._baseColor;
  }

  /**
   * The color of all the points.
   */
  set baseColor(color: THREE.Color) {
    this._baseColor.copy(color);
    const allIDs = this._ids;
    const notSelectedIDs: number[] = [];
    for (const id of allIDs) {
      if (!this._selected.has(id)) {
        notSelectedIDs.push(id);
      }
    }
    this.updateColor(notSelectedIDs);
  }

  /**
   * The color of all the selected points.
   */
  get selectColor() {
    return this._baseColor;
  }

  /**
   * The color of all the selected points.
   */
  set selectColor(color: THREE.Color) {
    this._selectColor.copy(color);
    this.updateColor(this._selected);
  }

  private get _geometry() {
    return this.mesh.geometry;
  }

  private get _colorBuffer() {
    return this.mesh.geometry.attributes.color as THREE.BufferAttribute;
  }

  private get _ids() {
    const ids: number[] = [];
    for (const id in this.faces) {
      ids.push(this.faces[id].id);
    }
    return ids;
  }

  constructor() {
    this.resetBuffers();
    const material = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(geometry, material);
  }

  /**
   * Adds a face.
   * @param ids - the IDs of the {@link points} that define that face. It's assumed that they are coplanar.
   */
  add(ids: number[]) {
    const id = this._faceIdGenerator++;
    this.faces[id] = {
      id,
      position: id,
      vertices: new Set(),
      points: new Set(ids),
    };
  }

  /**
   * Adds the points that can be used by one or many faces
   */
  addPoints(points: [number, number, number][]) {
    for (const [x, y, z] of points) {
      const id = this._pointIdGenerator++;
      this.points[id] = {
        id,
        coordinates: [x, y, z],
        vertices: new Set<number>(),
      };
    }
  }

  select(active: boolean, ids?: number[]) {
    const faceIDs = ids || Object.values(this.faces).map((face) => face.id);
    const idsToUpdate: number[] = [];
    for (const id of faceIDs) {
      const isAlreadySelected = this._selected.has(id);
      if (active) {
        if (isAlreadySelected) continue;
        this._selected.add(id);
        idsToUpdate.push(id);
      } else {
        if (!isAlreadySelected) continue;
        this._selected.delete(id);
        idsToUpdate.push(id);
      }
    }
    this.updateColor(idsToUpdate);
  }

  /**
   * Selects or unselects the given points.
   * @param active When true we will select, when false we will unselect
   * @param ids List of point IDs to add to the selected set. If not
   * defined, all points will be selected or deselected.
   */
  selectPoints(active: boolean, ids?: number[]) {
    const pointsIDs = ids || Object.values(this.points).map((p) => p.id);
    const vertices: number[] = [];
    for (const id of pointsIDs) {
      const point = this.points[id];
      if (!point) continue;
      for (const id of point.vertices) {
        vertices.push(id);
      }
    }
    this.vertices.select(active, vertices);
  }

  regenerate() {
    this.vertices.clear();
    this._geometry.deleteAttribute("position");
    this.resetBuffers();
    const allIndices: number[] = [];
    let nextIndex = 0;
    for (const faceID in this.faces) {
      const face = this.faces[faceID];
      const flatCoordinates: number[] = [];
      for (const pointID of face.points) {
        const point = this.points[pointID];
        flatCoordinates.push(...point.coordinates);
        const [id] = this.vertices.add([point.coordinates]);
        point.vertices.add(id);
        face.vertices.add(id);
      }
      const faceIndices = this.triangulate(flatCoordinates);
      const offset = nextIndex;
      for (const faceIndex of faceIndices) {
        const absoluteIndex = faceIndex + offset;
        if (absoluteIndex >= nextIndex) nextIndex = absoluteIndex + 1;
        allIndices.push(absoluteIndex);
      }
    }
    this._geometry.setIndex(allIndices);
    this.resetBuffers();
    this.updateColor();
    this._geometry.computeVertexNormals();
  }

  private resetBuffers() {
    const positionBuffer = this.vertices.mesh.geometry.attributes.position;
    this._geometry.setAttribute("position", positionBuffer);

    const colorBuffer = new Float32Array(positionBuffer.count * 3);
    const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
    this._geometry.setAttribute("color", colorAttribute);
  }

  private updateColor(ids = this._ids as Iterable<number>) {
    const colorAttribute = this._colorBuffer;
    for (const id of ids) {
      const face = this.faces[id];
      const isSelected = this._selected.has(face.id);
      const { r, g, b } = isSelected ? this._selectColor : this._baseColor;
      for (const vertexID of face.vertices) {
        const index = this.vertices.idMap.getIndex(vertexID);
        if (index === null) continue;
        colorAttribute.setXYZ(index, r, g, b);
      }
    }
    colorAttribute.needsUpdate = true;
  }

  private triangulate(coordinates: number[]) {
    // Earcut only supports 2d triangulations, so let's project the face
    // into the cartesian plane that is more parallel to the face
    const dim = this.getProjectionDimension(coordinates);
    const projectedCoords: number[] = [];
    for (let i = 0; i < coordinates.length; i++) {
      if (i % 3 !== dim) {
        projectedCoords.push(coordinates[i]);
      }
    }
    return earcut(projectedCoords, [], 2);
  }

  private getProjectionDimension(coordinates: number[]) {
    const [x1, y1, z1] = this.getCoordinate(0, coordinates);
    const [x2, y2, z2] = this.getCoordinate(1, coordinates);
    const [x3, y3, z3] = this.getCoordinate(2, coordinates);

    const a = [x2 - x1, y2 - y1, z2 - z1];
    const b = [x3 - x2, y3 - y2, z3 - z2];

    const crossProd = [
      Math.abs(a[1] * b[2] - a[2] * b[1]),
      Math.abs(a[2] * b[0] - a[0] * b[2]),
      Math.abs(a[0] * b[1] - a[1] * b[0]),
    ];

    const max = Math.max(...crossProd);
    return crossProd.indexOf(max);
  }

  private getCoordinate(index: number, coordinates: number[]) {
    const x = coordinates[index * 3];
    const y = coordinates[index * 3 + 1];
    const z = coordinates[index * 3 + 2];
    return [x, y, z];
  }
}
