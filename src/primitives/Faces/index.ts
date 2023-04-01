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
      verticesIDs: Set<number>;
    };
  } = {};

  /**
   * The list of faces. Each face is defined by a list of outer points.
   * TODO: Implement inner points.
   */
  faces: { [id: number]: { position: number; points: number[] } } = {};

  private _faceIdGenerator = 0;
  private _pointIdGenerator = 0;

  private _vertices: Vertices = new Vertices();

  private _baseMaterial = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSide,
    color: 0x888888,
  });

  private get _geometry() {
    return this.mesh.geometry;
  }

  constructor() {
    this.updatePositionBuffer();
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(geometry, this._baseMaterial);
  }

  /**
   * Adds a face.
   * @param ids - the IDs of the {@link points} that define that face. It's assumed that they are coplanar.
   */
  add(ids: number[]) {
    const id = this._faceIdGenerator++;
    this.faces[id] = {
      position: id,
      points: ids,
    };
  }

  /**
   * Adds the points that can be used by one or many faces
   */
  addPoints(points: [number, number, number][]) {
    for (const [x, y, z] of points) {
      const id = this._pointIdGenerator++;
      this.points[id] = {
        coordinates: [x, y, z],
        verticesIDs: new Set<number>(),
      };
    }
  }

  regenerate() {
    this._vertices.clear();
    this._geometry.deleteAttribute("position");
    this.updatePositionBuffer();
    const allIndices: number[] = [];
    let nextIndex = 0;
    for (const faceID in this.faces) {
      const face = this.faces[faceID];
      const flatCoordinates: number[] = [];
      for (const pointID of face.points) {
        const point = this.points[pointID];
        flatCoordinates.push(...point.coordinates);
        const [id] = this._vertices.add([point.coordinates]);
        point.verticesIDs.add(id);
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
    this.updatePositionBuffer();
    this._geometry.computeVertexNormals();
  }

  private updatePositionBuffer() {
    const positionBuffer = this._vertices.mesh.geometry.attributes.position;
    this._geometry.setAttribute("position", positionBuffer);
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
