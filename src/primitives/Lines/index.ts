import * as THREE from "three";
import { Vertices } from "../Vertices";
import { IdIndexMap, Primitive } from "../Primitive";

export class Lines extends Primitive {
  /** {@link Primitive.mesh } */
  mesh = new THREE.LineSegments();

  /**
   * The list of segments.
   */
  list: {
    [id: number]: {
      id: number;
      start: number;
      end: number;
    };
  } = {};

  /**
   * The geometric representation of the vertices that define this instance of lines.
   */
  vertices: Vertices = new Vertices();

  /**
   * The map that keeps track of the segments ID and their position in the geometric buffer.
   */
  idMap = new IdIndexMap();

  /**
   * The list of points that define the lines.
   */
  private _points: { [id: number]: { start: Set<number>; end: Set<number> } } =
    {};

  /**
   * The color of all the points.
   */
  set baseColor(color: THREE.Color) {
    super.baseColor = color;
    const allIDs = this.idMap.ids;
    const unselected = this.selected.getUnselected(allIDs);
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

  constructor() {
    super();
    this.resetBuffers();
    const material = new THREE.LineBasicMaterial({ vertexColors: true });
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.LineSegments(geometry, material);
  }

  /**
   * Adds a segment between two {@link _points}.
   * @param ids - the IDs of the {@link _points} that define the segments.
   */
  add(ids: number[]) {
    for (let i = 0; i < ids.length - 1; i++) {
      const index = this.idMap.add();
      const id = this.idMap.getId(index);

      const start = ids[i];
      const end = ids[i + 1];
      const startPoint = this._points[start];
      const endPoint = this._points[end];
      startPoint.start.add(id);
      endPoint.end.add(id);

      this.list[id] = { id, start, end };
    }
  }

  /**
   * Adds the points that can be used by one or many lines.
   * @param points the list of (x, y, z) coordinates of the points.
   */
  addPoints(points: [number, number, number][]) {
    const ids = this.vertices.add(points);
    for (const id of ids) {
      this._points[id] = { start: new Set(), end: new Set() };
    }
  }

  /**
   * Select or unselects the given lines.
   * @param active Whether to select or unselect.
   * @param ids List of faces IDs to select or unselect. If not
   * defined, all lines will be selected or deselected.
   */
  select(active: boolean, ids = this._ids) {
    const allLines = this.idMap.ids;
    const lineIDs = ids || allLines;
    const idsToUpdate = this.selected.select(active, lineIDs, allLines);
    this.updateColor(idsToUpdate);
    const points: number[] = [];
    for (const id of idsToUpdate) {
      const line = this.list[id];
      points.push(line.start);
      points.push(line.end);
    }
    this.selectPoints(active, points);
  }

  selectPoints(active: boolean, ids?: number[]) {
    this.vertices.select(active, ids);
  }

  /**
   * Removes the specified lines.
   * @param ids List of lines to remove. If no line is specified,
   * removes all the selected lines.
   */
  remove(ids = this.selected.data) {
    const position = this._positionBuffer;
    const color = this._colorBuffer;
    const points: number[] = [];
    for (const id of ids) {
      const line = this.list[id];
      if (line === undefined) continue;
      this.removeFromBuffer(id, position);
      this.removeFromBuffer(id, color);
      this.idMap.remove(id);
      const startPoint = this._points[line.start];
      points.push(line.start, line.end);
      startPoint.start.delete(id);
      const endPoint = this._points[line.end];
      endPoint.end.delete(id);
      delete this.list[id];
      this.selected.data.delete(id);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    this.selectPoints(false, points);
  }

  /**
   * Removes the specified points and all lines that use them.
   * @param ids List of points to remove. If no point is specified,
   * removes all the selected points.
   */
  removePoints(ids = this.vertices.selected.data) {
    const lines = new Set<number>();
    for (const id of ids) {
      const point = this._points[id];
      if (!point) continue;
      for (const id of point.start) {
        lines.add(id);
      }
      for (const id of point.end) {
        lines.add(id);
      }
    }
    this.vertices.remove(ids);
    this.remove(lines);
  }

  transform(matrix: THREE.Matrix4) {
    const indices = new Set<number>();
    const points = new Set<number>();
    for (const id of this.vertices.selected.data) {
      points.add(id);
      const point = this._points[id];
      for (const id of point.start) {
        const index = this.idMap.getIndex(id);
        if (index === null) continue;
        indices.add(index * 2);
      }
      for (const id of point.end) {
        const index = this.idMap.getIndex(id);
        if (index === null) continue;
        indices.add(index * 2 + 1);
      }
    }
    this.transformLines(matrix, indices);
    this.vertices.transform(matrix, points);
  }

  regenerate() {
    this.resetBuffers();
    const position = this._positionBuffer;
    for (const lineID in this.list) {
      const line = this.list[lineID];
      const index = this.idMap.getIndex(line.id);
      const start = this.vertices.get(line.start);
      const end = this.vertices.get(line.end);
      if (index === null || start === null || end === null) continue;
      position.setXYZ(index * 2, start[0], start[1], start[2]);
      position.setXYZ(index * 2 + 1, end[0], end[1], end[2]);
      position.count += 2;
    }
    position.needsUpdate = true;
    this.updateColor();
  }

  private removeFromBuffer(id: number, buffer: THREE.BufferAttribute) {
    const index = this.idMap.getIndex(id);
    if (index === null) return;
    const lastIndex = this.idMap.getLastIndex();
    const indices = [index * 2, index * 2 + 1];
    const lastIndices = [lastIndex * 2, lastIndex * 2 + 1];

    for (let i = 0; i < 2; i++) {
      const x = buffer.getX(lastIndices[i]);
      const y = buffer.getY(lastIndices[i]);
      const z = buffer.getZ(lastIndices[i]);
      buffer.setXYZ(indices[i], x, y, z);
    }

    buffer.count -= 2;
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
    const vertexCount = this.idMap.size * 2;
    const positionBuffer = new Float32Array(vertexCount * 3);
    const positionAttribute = new THREE.BufferAttribute(positionBuffer, 3);
    positionAttribute.count = 0;
    this.mesh.geometry.setAttribute("position", positionAttribute);

    const colorBuffer = new Float32Array(vertexCount * 3);
    const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
    this.mesh.geometry.setAttribute("color", colorAttribute);
  }

  private updateColor(ids = this._ids as Iterable<number>) {
    const colorAttribute = this._colorBuffer;
    for (const id of ids) {
      const line = this.list[id];
      const isSelected = this.selected.data.has(line.id);
      const { r, g, b } = isSelected ? this._selectColor : this._baseColor;
      const index = this.idMap.getIndex(id);
      if (index === null) continue;
      colorAttribute.setXYZ(index * 2, r, g, b);
      colorAttribute.setXYZ(index * 2 + 1, r, g, b);
    }
    colorAttribute.needsUpdate = true;
  }
}
