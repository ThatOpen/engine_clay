import * as THREE from "three";
import { Vertices } from "../Vertices";
import { Primitive } from "../Primitive";
import { BufferManager, IdIndexMap } from "../../utils";

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
   * The list of points that define each line.
   */
  points: { [id: number]: { start: Set<number>; end: Set<number> } } = {};

  private _buffers: BufferManager;

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
    const material = new THREE.LineBasicMaterial({ vertexColors: true });
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.LineSegments(geometry, material);
    this._buffers = new BufferManager(geometry);
    this.setupAttributes();
  }

  /**
   * Quickly removes all the lines and releases all the memory used.
   */
  clear() {
    this.selected.data.clear();
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.BufferGeometry();
    this.setupAttributes();
    this.vertices.clear();
    this.idMap.reset();
    this.list = {};
    this.points = {};
  }

  /**
   * Adds a segment between two {@link points}.
   * @param ids - the IDs of the {@link points} that define the segments.
   */
  add(ids: number[]) {
    const createdIDs: number[] = [];
    const newVerticesCount = (ids.length - 1) * 2;
    this._buffers.resizeIfNeeded(newVerticesCount);
    const { r, g, b } = this._baseColor;
    for (let i = 0; i < ids.length - 1; i++) {
      const startID = ids[i];
      const endID = ids[i + 1];

      const start = this.vertices.get(startID);
      const end = this.vertices.get(endID);

      if (start === null || end === null) continue;

      const index = this.idMap.add();
      const id = this.idMap.getId(index);
      createdIDs.push(id);

      const startPoint = this.points[startID];
      const endPoint = this.points[endID];
      startPoint.start.add(id);
      endPoint.end.add(id);

      this._positionBuffer.setXYZ(index * 2, start[0], start[1], start[2]);
      this._positionBuffer.setXYZ(index * 2 + 1, end[0], end[1], end[2]);
      this._colorBuffer.setXYZ(index * 2, r, g, b);
      this._colorBuffer.setXYZ(index * 2 + 1, r, g, b);

      this.list[id] = { id, start: startID, end: endID };
    }
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();
    return createdIDs;
  }

  get(id: number) {
    const line = this.list[id];
    const start = this.vertices.get(line.start);
    const end = this.vertices.get(line.end);
    if (!start || !end) return null;
    return [start, end];
  }

  /**
   * Adds the points that can be used by one or many lines.
   * @param points the list of (x, y, z) coordinates of the points.
   */
  addPoints(points: number[][]) {
    const ids = this.vertices.add(points);
    for (const id of ids) {
      this.points[id] = { start: new Set(), end: new Set() };
    }
    return ids;
  }

  /**
   * Select or unselects the given lines.
   * @param active Whether to select or unselect.
   * @param ids List of lines IDs to select or unselect. If not
   * defined, all lines will be selected or deselected.
   */
  select(active: boolean, ids = this.ids as Iterable<number>) {
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
  remove(ids = this.selected.data as Iterable<number>) {
    const position = this._positionBuffer;
    const color = this._colorBuffer;
    const points: number[] = [];
    for (const id of ids) {
      const line = this.list[id];
      if (line === undefined) continue;
      this.removeFromBuffer(id, position);
      this.removeFromBuffer(id, color);
      this.idMap.remove(id);
      const startPoint = this.points[line.start];
      points.push(line.start, line.end);
      startPoint.start.delete(id);
      const endPoint = this.points[line.end];
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
  removePoints(ids = this.vertices.selected.data as Iterable<number>) {
    const lines = new Set<number>();
    for (const id of ids) {
      const point = this.points[id];
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

  /**
   * Sets a point of the line to a specific position.
   * @param id The point whose position to set.
   * @param coordinates The new coordinates of the point.
   */
  setPoint(id: number, coordinates: number[]) {
    const indices = new Set<number>();
    this.getPointIndices(id, indices);
    this.setLines(coordinates, indices);
    this.vertices.set([id], coordinates);
  }

  transform(matrix: THREE.Matrix4) {
    const indices = new Set<number>();
    const points = new Set<number>();
    for (const id of this.vertices.selected.data) {
      points.add(id);
      this.getPointIndices(id, indices);
    }
    this.transformLines(matrix, indices);
    this.vertices.transform(matrix, points);
  }

  private getPointIndices(id: number, indices: Set<number>) {
    const point = this.points[id];
    for (const id of point.start) {
      const index = this.idMap.getIndex(id);
      if (index === null) {
        continue;
      }
      indices.add(index * 2);
    }
    for (const id of point.end) {
      const index = this.idMap.getIndex(id);
      if (index === null) {
        continue;
      }
      indices.add(index * 2 + 1);
    }
  }

  private setupAttributes() {
    this._buffers.createAttribute("position");
    this._buffers.createAttribute("color");
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

  private setLines(coords: number[], indices: Iterable<number>) {
    const [x, y, z] = coords;
    for (const index of indices) {
      this._positionBuffer.setXYZ(index, x, y, z);
    }
    this._positionBuffer.needsUpdate = true;
  }

  private updateColor(ids = this.ids as Iterable<number>) {
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
