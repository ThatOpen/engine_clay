import * as THREE from "three";
import earcut from "earcut";
import { Vertices } from "../Vertices";
import { Primitive } from "../Primitive";
import { Selector } from "../../utils";

interface Face {
  id: number;
  vertices: Set<number>;
  points: Set<number>;
  holes: {
    [id: string]: {
      id: number;
      points: Set<number>;
    };
  };
}

interface FacePoint {
  id: number;
  coordinates: [number, number, number];
  vertices: Set<number>;
  faces: Set<number>;
}

export class Faces extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh = new THREE.Mesh();

  /**
   * The list of points that define the faces. Each point corresponds to a set of {@link Vertices}. This way,
   * we can provide an API of faces that share vertices, but under the hood the vertices are duplicated per face
   * (and thus being able to contain the normals as a vertex attribute).
   */
  points: { [id: number]: FacePoint } = {};

  /**
   * The list of faces. Each face is defined by a list of outer points.
   */
  list: { [id: number]: Face } = {};

  /**
   * The geometric representation of the vertices that define this instance of faces.
   */
  vertices: Vertices = new Vertices();

  /**
   * The list of selected {@link points}.
   */
  selectedPoints = new Selector();

  private _vertexFaceMap = new Map<number, number>();

  private _faceIdGenerator = 0;
  private _pointIdGenerator = 0;
  private _holeIdGenerator = 0;

  /**
   * The color of all the points.
   */
  set baseColor(color: THREE.Color) {
    super.baseColor = color;
    const unselected = this.selected.getUnselected(this.ids);
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

    this.updateBuffers();
  }

  /**
   * Quickly removes all the faces and releases all the memory used.
   */
  clear() {
    this.selected.data.clear();
    this.selectedPoints.data.clear();
    this.mesh.geometry.setIndex([]);
    this.vertices.clear();
    this.updateBuffers();
    this.list = {};
    this.points = {};
    this._faceIdGenerator = 0;
    this._pointIdGenerator = 0;
    this._holeIdGenerator = 0;
  }

  /**
   * Adds a face.
   * @param ids - the IDs of the {@link points} that define that face. It's assumed that they are coplanar.
   * @param holesPointsIDs - the IDs of the {@link points} that define the holes.
   */
  add(ids: number[], holesPointsIDs: number[][] = []) {
    const id = this._faceIdGenerator++;

    // Add face references to points

    for (const pointID of ids) {
      const point = this.points[pointID];
      point.faces.add(id);
    }

    const holes: { [id: string]: { id: number; points: Set<number> } } = {};

    for (const pointIDs of holesPointsIDs) {
      const id = this._holeIdGenerator++;
      const points = new Set(pointIDs);
      holes[id] = { id, points };
      for (const pointID of pointIDs) {
        const point = this.points[pointID];
        point.faces.add(id);
      }
    }

    const face = {
      id,
      holes,
      vertices: new Set<number>(),
      points: new Set<number>(ids),
    };

    // Create face vertices

    const coordinates: number[] = [];
    for (const pointID of face.points) {
      this.saveCoordinates(pointID, coordinates, face);
    }

    let holesCounter = coordinates.length / 3;
    const holeIndices: number[] = [];

    for (const holeID in face.holes) {
      holeIndices.push(holesCounter);
      const hole = face.holes[holeID];
      holesCounter += hole.points.size;
      for (const pointID of hole.points) {
        this.saveCoordinates(pointID, coordinates, face);
      }
    }

    // Generate face indices

    const allIndices = Array.from(this._index.array);
    const faceIndices = this.triangulate(coordinates, holeIndices);

    let offset = 0;
    for (const index of allIndices) {
      if (index >= offset) offset = index + 1;
    }

    for (const faceIndex of faceIndices) {
      const absoluteIndex = faceIndex + offset;
      allIndices.push(absoluteIndex);
    }

    this.mesh.geometry.setIndex(allIndices);
    this.list[id] = face;

    this.updateBuffers();
    this.updateColor([id]);
    // this.computeNormal([id]);
    this.mesh.geometry.computeVertexNormals();

    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();

    return id;
  }

  /**
   * Removes faces.
   * @param ids List of faces to remove. If no face is specified,
   * removes all the selected faces.
   */
  remove(ids = this.selected.data as Iterable<number>) {
    const verticesToRemove = new Set<number>();
    for (const id of ids) {
      const face = this.list[id];
      if (face === undefined) continue;
      for (const vertex of face.vertices) {
        verticesToRemove.add(vertex);
        this._vertexFaceMap.delete(vertex);
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
    const oldIndex = this._index.array as Uint8Array;
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

  /**
   * Adds the points that can be used by one or many faces
   */
  addPoints(points: [number, number, number][]) {
    const newPoints = [];
    for (const [x, y, z] of points) {
      const id = this._pointIdGenerator++;
      this.points[id] = {
        id,
        coordinates: [x, y, z],
        vertices: new Set<number>(),
        faces: new Set<number>(),
      };
      newPoints.push(id);
    }
    return newPoints;
  }

  removePoints(ids = this.selectedPoints.data as Iterable<number>) {
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
  select(active: boolean, ids = this.ids as Iterable<number>) {
    const idsToUpdate = this.selected.select(active, ids, this.ids);
    this.updateColor(idsToUpdate);
    const points: number[] = [];
    for (const id of ids) {
      const face = this.list[id];
      if (face) {
        points.push(...face.points);
        for (const holeID in face.holes) {
          const hole = face.holes[holeID];
          points.push(...hole.points);
        }
      }
    }
    this.selectPoints(active, points);
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

  /**
   * Sets a point of the face to a specific position.
   * @param id The point whose position to set.
   * @param coordinates The new coordinates of the point.
   */
  setPoint(id: number, coordinates: [number, number, number]) {
    const point = this.points[id];
    if (point === undefined) return;
    point.coordinates = coordinates;
    this.vertices.set(point.vertices, coordinates);
  }

  /**
   * Applies a transformation to the selected vertices.
   * @param matrix Transformation matrix to apply.
   */
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

  /**
   * Given a face index, returns the face ID.
   * @param faceIndex The index of the face whose ID to get.
   */
  getFromIndex(faceIndex: number) {
    const vertexIndex = this._index.array[faceIndex * 3];
    const vertexID = this.vertices.idMap.getId(vertexIndex);
    return this._vertexFaceMap.get(vertexID);
  }

  /**
   * Gets the center point of a face.
   * @param id The face whose center to get.
   */
  getCenter(id: number) {
    const face = this.list[id];
    if (!face) return null;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    for (const pointID of face.points) {
      const point = this.points[pointID];
      const [x, y, z] = point.coordinates;
      sumX += x;
      sumY += y;
      sumZ += z;
    }
    const size = face.points.size;
    return [sumX / size, sumY / size, sumZ / size];
  }

  /**
   * Gets the normalVector of a face.
   * @param id The face whose normal vector to get.
   */
  getNormal(id: number) {
    const face = this.list[id];
    const firstVertex = Array.from(face.vertices)[0];
    const index = this.vertices.idMap.getIndex(firstVertex);
    if (index === null) return null;
    const normal = this.vertices.mesh.geometry.attributes.normal;
    const x = normal.getX(index);
    const y = normal.getY(index);
    const z = normal.getZ(index);
    return [x, y, z];
  }

  private saveCoordinates(pointID: number, coordinates: number[], face: Face) {
    const point = this.points[pointID];
    coordinates.push(...point.coordinates);
    const [id] = this.vertices.add([point.coordinates]);
    this._vertexFaceMap.set(id, face.id);
    point.vertices.add(id);
    face.vertices.add(id);
  }

  private updateBuffers() {
    const positionBuffer = this.vertices.mesh.geometry.attributes.position;
    const normalBuffer = this.vertices.mesh.geometry.attributes.normal;
    if (this._positionBuffer !== positionBuffer) {
      this.mesh.geometry.deleteAttribute("position");
      this.mesh.geometry.deleteAttribute("normal");
      this.mesh.geometry.deleteAttribute("color");
      this.mesh.geometry.setAttribute("position", positionBuffer);
      this.mesh.geometry.setAttribute("normal", normalBuffer);
      const colorBuffer = new Float32Array(positionBuffer.array.length * 3);
      const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
      this.mesh.geometry.setAttribute("color", colorAttribute);
      this.updateColor();
    }
  }

  private updateColor(ids = this.ids as Iterable<number>) {
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

  private triangulate(coordinates: number[], holesIndices: number[]) {
    // Earcut only supports 2d triangulations, so let's project the face
    // into the cartesian plane that is more parallel to the face
    const dim = this.getProjectionDimension(coordinates);
    const projectedCoords: number[] = [];
    for (let i = 0; i < coordinates.length; i++) {
      if (i % 3 !== dim) {
        projectedCoords.push(coordinates[i]);
      }
    }
    return earcut(projectedCoords, holesIndices, 2);
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
