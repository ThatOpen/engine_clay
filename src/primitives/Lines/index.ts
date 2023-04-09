import * as THREE from "three";
import { Vertices } from "../Vertices";
import { Primitive } from "../Primitive";

export class Lines extends Primitive {
  /** {@link Primitive.mesh } */
  mesh = new THREE.LineSegments();

  /**
   * The list of points that define the lines.
   */
  points: {
    [id: number]: {
      coordinates: [number, number, number];
      id: number;
      vertices: Set<number>;
    };
  } = {};

  /**
   * The list of lines.
   */
  list: {
    [id: number]: {
      id: number;
      points: Set<number>;
      indices: Set<number>;
    };
  } = {};

  /**
   * The geometric representation of the vertices that define this instance of lines.
   */
  vertices: Vertices = new Vertices();

  private _pointIdGenerator = 0;
  private _lineIdGenerator = 0;
  private _segmentCount = 0;

  constructor() {
    super();
    this.resetBuffers();
    const material = new THREE.LineBasicMaterial({ vertexColors: true });
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.LineSegments(geometry, material);
  }

  /**
   * Adds a line.
   * @param ids - the IDs of the {@link points} that define that line.
   */
  add(ids: number[]) {
    const id = this._lineIdGenerator++;

    const indices: number[] = [];
    const newSegmentCount = this._segmentCount + ids.length - 1;
    for (let i = this._segmentCount; i < newSegmentCount; i++) {
      indices.push(i);
    }

    this.list[id] = { id, points: new Set(ids), indices: new Set(indices) };

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const point = this.points[id];
      if (i !== ids.length - 1) {
        point.vertices.add(indices[i] * 2);
      }
      if (i !== 0) {
        point.vertices.add(indices[i - 1] * 2 + 1);
      }
    }

    this._segmentCount = newSegmentCount;
  }

  /**
   * Adds the points that can be used by one or many lines.
   * @param points the list of (x, y, z) coordinates of the points.
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
    this.vertices.add(points);
  }

  /**
   * Select or unselects the given lines.
   * @param active Whether to select or unselect.
   * @param ids List of faces IDs to select or unselect. If not
   * defined, all lines will be selected or deselected.
   */
  select(active: boolean, ids = this._ids) {
    const allLines = Object.values(this.list).map((face) => face.id);
    const lineIDs = ids || allLines;
    const idsToUpdate = this.selected.select(active, lineIDs, allLines);
    this.updateColor(idsToUpdate);
  }

  selectPoints(active: boolean, ids?: number[]) {
    this.vertices.select(active, ids);
  }

  transform(matrix: THREE.Matrix4) {
    const indices = new Set<number>();
    const points = new Set<number>();
    for (const id of this.selected.data) {
      const line = this.list[id];
      for (const index of line.indices) {
        indices.add(index * 2);
        indices.add(index * 2 + 1);
      }
      for (const pointID of line.points) {
        points.add(pointID);
      }
    }
    for (const id of this.vertices.selected.data) {
      points.add(id);
      const point = this.points[id];
      for (const index of point.vertices) {
        indices.add(index);
      }
    }
    this.transformLines(matrix, indices);
    this.vertices.transform(matrix, points);
  }

  regenerate() {
    this.resetBuffers();
    const position = this._positionBuffer;
    let i = 0;
    for (const lineID in this.list) {
      const line = this.list[lineID];
      let previous: [number, number, number] | null = null;
      for (const pointID of line.points) {
        const point = this.points[pointID];
        const coords = point.coordinates;
        if (previous) {
          position.setXYZ(i++, previous[0], previous[1], previous[2]);
          position.setXYZ(i++, coords[0], coords[1], coords[2]);
          position.count += 2;
        }
        previous = coords;
      }
    }
    position.needsUpdate = true;
    this.updateColor();
  }

  private transformLines(matrix: THREE.Matrix4, indices: Iterable<number>) {
    const vector = new THREE.Vector3();
    for (const index of indices) {
      const x = this._positionBuffer.getX(index);
      const y = this._positionBuffer.getY(index);
      const z = this._positionBuffer.getZ(index);
      vector.set(x, y, z);
      vector.applyMatrix4(matrix);
      this._positionBuffer.setXYZ(index, vector.x, vector.y, vector.z);
    }
    this._positionBuffer.needsUpdate = true;
  }

  private resetBuffers() {
    const vertexCount = this._segmentCount * 2;
    const positionBuffer = new Float32Array(vertexCount * 3);
    const positionAttribute = new THREE.BufferAttribute(positionBuffer, 3);
    positionAttribute.count = 0;
    this.mesh.geometry.setAttribute("position", positionAttribute);

    const colorBuffer = new Float32Array(vertexCount * 3);
    const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
    this.mesh.geometry.setAttribute("color", colorAttribute);
  }

  private updateColor(ids = this._ids) {
    const colorAttribute = this._colorBuffer;
    for (const id of ids) {
      const line = this.list[id];
      const isSelected = this.selected.data.has(line.id);
      const { r, g, b } = isSelected ? this._selectColor : this._baseColor;
      for (const index of line.indices) {
        colorAttribute.setXYZ(index * 2, r, g, b);
        colorAttribute.setXYZ(index * 2 + 1, r, g, b);
      }
    }
    colorAttribute.needsUpdate = true;
  }
}
