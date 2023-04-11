import * as THREE from "three";
import earcut from "earcut";
import { Vertices } from "../Vertices";
import { Primitive, Selector } from "../Primitive";

export class Faces extends Primitive {
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
      faces: Set<number>;
    };
  } = {};

  /**
   * The list of faces. Each face is defined by a list of outer points.
   * TODO: Implement inner points.
   */
  list: {
    [id: number]: {
      id: number;
      vertices: Set<number>;
      points: Set<number>;
    };
  } = {};

  /**
   * The geometric representation of the vertices that define this instance of faces.
   */
  vertices: Vertices = new Vertices();

  selectedPoints = new Selector();

  private _faceIdGenerator = 0;
  private _pointIdGenerator = 0;
  private _nextIndex = 0;

  /**
   * The color of all the points.
   */
  set baseColor(color: THREE.Color) {
    super.baseColor = color;
    const unselected = this.selected.getUnselected(this._ids);
    this.updateColor(unselected);
    this.vertices.baseColor = color;
  }

  /**
   * The color of all the selected points.
   */
  set selectColor(color: THREE.Color) {
    super.selectColor = color;
    this.updateColor(this.selected.data);
    this.vertices.selectColor = color;
  }

  private get _index() {
    if (!this.mesh.geometry.index) {
      throw new Error("Geometery must be indexed!");
    }
    return this.mesh.geometry.index;
  }

  constructor() {
    super();
    this.updateBuffers();
    const material = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(geometry, material);
    geometry.setIndex([]);

    const normals = new THREE.BufferAttribute(new Float32Array(0), 3);
    normals.name = "normal";
    this.vertices.addAttribute(normals);
  }

  /**
   * Adds a face.
   * @param ids - the IDs of the {@link points} that define that face. It's assumed that they are coplanar.
   */
  add(ids: number[]) {
    const id = this._faceIdGenerator++;
    for (const pointID of ids) {
      const point = this.points[pointID];
      point.faces.add(id);
    }

    const face = {
      id,
      vertices: new Set<number>(),
      points: new Set<number>(ids),
      start: 0,
      end: 0,
    };

    const coordinates: number[] = [];
    for (const pointID of face.points) {
      const point = this.points[pointID];
      coordinates.push(...point.coordinates);
      const [id] = this.vertices.add([point.coordinates]);
      point.vertices.add(id);
      face.vertices.add(id);
    }

    const allIndices = Array.from(this._index.array);
    face.start = allIndices.length;
    const faceIndices = this.triangulate(coordinates);
    const offset = this._nextIndex;
    for (const faceIndex of faceIndices) {
      const absoluteIndex = faceIndex + offset;
      if (absoluteIndex >= this._nextIndex) {
        this._nextIndex = absoluteIndex + 1;
      }
      allIndices.push(absoluteIndex);
    }

    face.end = allIndices.length;
    this.mesh.geometry.setIndex(allIndices);
    this.list[id] = face;

    this.updateBuffers();
    this.updateColor([id]);
    this.computeNormal([id]);
  }

  /**
   * Removes faces.
   * @param ids List of faces to remove. If no face is specified,
   * removes all the selected faces.
   */
  remove(ids = this.selected.data) {
    const verticesToRemove = new Set<number>();
    for (const id of ids) {
      const face = this.list[id];
      for (const vertex of face.vertices) {
        verticesToRemove.add(vertex);
      }
      for (const pointID of face.points) {
        const point = this.points[pointID];
        if (point) {
          point.faces.delete(id);
        }
      }
      delete this.list[id];
    }

    for (const id of ids) {
      this.selected.data.delete(id);
    }

    const idsArray: number[] = [];
    const oldIndex = this._index.array as number[];
    for (const index of oldIndex) {
      const id = this.vertices.idMap.getId(index);
      idsArray.push(id);
    }

    this.vertices.remove(verticesToRemove);

    const newIndex: number[] = [];
    for (const id of idsArray) {
      const index = this.vertices.idMap.getIndex(id);
      if (index !== null) {
        newIndex.push(index);
      }
    }

    this.mesh.geometry.setIndex(newIndex);
    this.updateBuffers();
    this.updateColor();
  }

  removePoints(ids = this.selectedPoints.data) {
    const facesToRemove = new Set<number>();
    for (const id of ids) {
      const point = this.points[id];
      if (!point) continue;
      for (const face of point.faces) {
        facesToRemove.add(face);
      }
      delete this.points[id];
    }
    for (const id of ids) {
      this.selectedPoints.data.delete(id);
    }
    this.remove(facesToRemove);
  }

  /**
   * Select or unselects the given faces.
   * @param active Whether to select or unselect.
   * @param ids List of faces IDs to select or unselect. If not
   * defined, all faces will be selected or deselected.
   */
  select(active: boolean, ids = this._ids as Iterable<number>) {
    const idsToUpdate = this.selected.select(active, ids, this._ids);
    this.updateColor(idsToUpdate);
    const points: number[] = [];
    for (const id of ids) {
      const face = this.list[id];
      if (face) {
        points.push(...face.points);
      }
    }
    this.selectPoints(active, points);
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
        faces: new Set<number>(),
      };
    }
  }

  /**
   * Selects or unselects the given points.
   * @param active When true we will select, when false we will unselect
   * @param ids List of point IDs to add to the selected set. If not
   * defined, all points will be selected or deselected.
   */
  selectPoints(active: boolean, ids?: number[]) {
    const allPoints = Object.values(this.points).map((p) => p.id);
    const pointsIDs = ids || allPoints;
    this.selectedPoints.select(active, pointsIDs, allPoints);
    const vertices: number[] = [];
    for (const id of pointsIDs) {
      const point = this.points[id];
      if (point === undefined) continue;
      for (const id of point.vertices) {
        vertices.push(id);
      }
    }
    this.vertices.select(active, vertices);
  }

  transform(matrix: THREE.Matrix4) {
    const vertices = new Set<number>();
    for (const id of this.selectedPoints.data) {
      const point = this.points[id];
      for (const vertex of point.vertices) {
        vertices.add(vertex);
      }
    }
    this.vertices.transform(matrix, vertices);
    for (const pointID of this.selectedPoints.data) {
      const point = this.points[pointID];
      const vertexID = point.vertices.values().next().value;
      const coords = this.vertices.get(vertexID);
      if (coords === null) continue;
      point.coordinates = coords;
    }
  }

  private updateBuffers() {
    const positionBuffer = this.vertices.mesh.geometry.attributes.position;
    const normalBuffer = this.vertices.mesh.geometry.attributes.normal;
    if (this._positionBuffer !== positionBuffer) {
      this.mesh.geometry.setAttribute("position", positionBuffer);
      this.mesh.geometry.setAttribute("normal", normalBuffer);

      const colorBuffer = new Float32Array(positionBuffer.array.length * 3);
      const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
      this.mesh.geometry.setAttribute("color", colorAttribute);
    }
    this._colorBuffer.count = positionBuffer.count;
  }

  private computeNormal(ids = this._ids as Iterable<number>) {
    const normalAttribute = this._normalBuffer;
    for (const id of ids) {
      const face = this.list[id];
      if (!face) continue;
      const coordinates: number[][] = [];
      let counter = 0;
      for (const vertexID of face.vertices) {
        if (counter++ > 2) break;
        const vertex = this.vertices.get(vertexID);
        if (vertex !== null) {
          coordinates.push(vertex);
        }
      }
      const [x, y, z] = this.getNormalVector(coordinates);
      for (const vertexID of face.vertices) {
        const index = this.vertices.idMap.getIndex(vertexID);
        if (index === null) continue;
        normalAttribute.setXYZ(index, x, y, z);
      }
    }
  }

  private updateColor(ids = this._ids as Iterable<number>) {
    const colorAttribute = this._colorBuffer;
    for (const id of ids) {
      const face = this.list[id];
      const isSelected = this.selected.data.has(face.id);
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

  private getNormalVector(points: number[][]) {
    const [x1, y1, z1] = points[0];
    const [x2, y2, z2] = points[1];
    const [x3, y3, z3] = points[2];

    const a = [x2 - x1, y2 - y1, z2 - z1];
    const b = [x3 - x2, y3 - y2, z3 - z2];

    const x = a[1] * b[2] - a[2] * b[1];
    const y = a[2] * b[0] - a[0] * b[2];
    const z = a[0] * b[1] - a[1] * b[0];

    const magnitude = Math.sqrt(x * x + y * y + z * z);

    return [x / magnitude, y / magnitude, z / magnitude];
  }

  private getCoordinate(index: number, coordinates: number[]) {
    const x = coordinates[index * 3];
    const y = coordinates[index * 3 + 1];
    const z = coordinates[index * 3 + 2];
    return [x, y, z];
  }
}
