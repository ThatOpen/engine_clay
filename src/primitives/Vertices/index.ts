import * as THREE from "three";
import { IdIndexMap } from "./id-index-map";
import { Primitive } from "../types";

export class Vertices implements Primitive {
  /** Buffer increment when geometry size is exceeded, multiple of 3. */
  bufferIncrease = 300;

  /** {@link Primitive.mesh } */
  mesh: THREE.Points;

  private _baseColor: THREE.Color = new THREE.Color(0.5, 0.5, 0.5);
  private _selectColor: THREE.Color = new THREE.Color(1, 0, 0);
  private _capacity = 0;
  private _selected = new Set<number>();
  private _items = new IdIndexMap();

  /**
   * Number of points
   * @returns Number corresponding to the length
   */
  get size() {
    return this._positionBuffer.count;
  }

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
    this.updateColor(false);
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
    this.updateColor(true);
  }

  private get _positionBuffer() {
    return this._geometry.attributes.position as THREE.BufferAttribute;
  }

  private get _colorBuffer() {
    return this._geometry.attributes.color as THREE.BufferAttribute;
  }

  private get _geometry() {
    return this.mesh.geometry;
  }

  /**
   * Creates a new instance of vertices
   * @param size Visualization point size
   */
  constructor(size: number = 0.1) {
    const geometry = new THREE.BufferGeometry();
    const material = this.newPointsMaterial(size);
    this.mesh = new THREE.Points(geometry, material);
    this.mesh.frustumCulled = false;
    this.resetAttributes();
  }

  /**
   * Gets the coordinates of the vertex with the given ID.
   * @param id the id of the point to retrieve.
   */
  get(id: number) {
    const index = this._items.getIndex(id);
    if (index === null) return null;
    return [
      this._positionBuffer.getX(index),
      this._positionBuffer.getY(index),
      this._positionBuffer.getZ(index),
    ];
  }

  /**
   * Add new points
   * @param coordinates Points to add.
   * @returns the list of ids of the created vertices.
   */
  add(coordinates: [number, number, number][]) {
    this.resizeBufferIfNecessary(coordinates.length);
    const ids: number[] = [];
    for (let i = 0; i < coordinates.length; i++) {
      const index = this._items.add();
      const id = this._items.getId(index);
      ids.push(id);
      const [x, y, z] = coordinates[i];
      this._positionBuffer.setXYZ(index, x, y, z);
      const { r, g, b } = this._baseColor;
      this._colorBuffer.setXYZ(index, r, g, b);
    }
    this.updateBuffersCount();
    return ids;
  }

  /**
   * Creates a set of selected points
   * @param active When true we will select, when false we will unselect
   * @param ids List of point IDs to add to the selected set. If not
   * defined, all items will be selected or deselected.
   */
  select(active: boolean, ids?: number[]) {
    if (active) {
      this.selectPoints(ids);
    } else {
      this.unselectPoints(ids);
    }
    this._colorBuffer.needsUpdate = true;
  }

  /**
   * Apply a displacement vector to the selected points
   * @param displacement Displacement vector
   */
  move(displacement: THREE.Vector3) {
    const transform = new THREE.Matrix4();
    transform.setPosition(displacement);
    this.transform(transform);
  }

  /**
   * Rotate the selected points
   * @param rotation euler rotation
   */
  rotate(rotation: THREE.Vector3) {
    const transform = new THREE.Matrix4();
    const { x, y, z } = rotation;
    transform.makeRotationFromEuler(new THREE.Euler(x, y, z));
    this.transform(transform);
  }

  /**
   * Scale the selected points
   * @param scale Scale vector
   */
  scale(scale: THREE.Vector3) {
    const transform = new THREE.Matrix4();
    transform.scale(scale);
    this.transform(transform);
  }

  /**
   * Applies a transformation to the selected vertices.
   * @param transformation Transformation matrix to apply.
   */
  transform(transformation: THREE.Matrix4) {
    const vector = new THREE.Vector3();
    for (const id of this._selected) {
      const index = this._items.getIndex(id);
      if (index === null) continue;
      const x = this._positionBuffer.getX(index);
      const y = this._positionBuffer.getY(index);
      const z = this._positionBuffer.getZ(index);
      vector.set(x, y, z);
      vector.applyMatrix4(transformation);
      this._positionBuffer.setXYZ(index, vector.x, vector.y, vector.z);
    }
    this._positionBuffer.needsUpdate = true;
  }

  /**
   * Quickly removes all the points and releases all the memory used.
   */
  clear() {
    this.resetAttributes();
    this._selected.clear();
    this._items.reset();
  }

  /**
   * Removes the selected points from the list
   */
  remove() {
    const selected = this._selected.values();
    for (const id of selected) {
      const index = this._items.getIndex(id);
      if (index === null) continue;
      const lastIndex = this._items.getLastIndex();
      this.removeFromPositionBuffer(index, lastIndex);
      this.removeFromColorBuffer(index, lastIndex);
      this._items.remove(id);
    }
    this.updateBuffersCount();
    this._positionBuffer.needsUpdate = true;
    this._colorBuffer.needsUpdate = true;
  }

  private selectPoints(ids?: number[]) {
    const selection = ids || this._items.ids;
    for (const id of selection) {
      const index = this._items.getIndex(id);
      if (index === null) continue;
      this._selected.add(id);
      this._colorBuffer.setX(index, this._selectColor.r);
      this._colorBuffer.setY(index, this._selectColor.g);
      this._colorBuffer.setZ(index, this._selectColor.b);
    }
  }

  private unselectPoints(ids?: number[]) {
    this.removeSelectColor(ids);
    if (!ids) {
      this._selected.clear();
      return;
    }
    for (const id of ids) {
      this._selected.delete(id);
    }
  }

  private updateBuffersCount() {
    const size = this._items.size;
    this._positionBuffer.count = size;
    this._colorBuffer.count = size;
  }

  private resetAttributes() {
    const positionBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
    const colorBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
    this._geometry.setAttribute("position", positionBuffer);
    this._geometry.setAttribute("color", colorBuffer);
    this._capacity = 0;
  }

  private removeFromColorBuffer(index: number, lastIndex: number) {
    this._colorBuffer.setXYZ(
      index,
      this._colorBuffer.getX(lastIndex),
      this._colorBuffer.getY(lastIndex),
      this._colorBuffer.getZ(lastIndex)
    );
  }

  private removeFromPositionBuffer(index: number, lastIndex: number) {
    this._positionBuffer.setXYZ(
      index,
      this._positionBuffer.getX(lastIndex),
      this._positionBuffer.getY(lastIndex),
      this._positionBuffer.getZ(lastIndex)
    );
  }

  private resizeBufferIfNecessary(increase: number) {
    const position = this._geometry.getAttribute("position");
    const size = position.count * 3 + increase * 3;
    const difference = size - this._capacity;
    if (difference >= 0) {
      const increase = Math.max(difference, this.bufferIncrease);
      this.resizeBuffers(increase);
    }
  }

  private resizeBuffers(increase = this.bufferIncrease) {
    this._capacity += increase;
    const oldPositionArray = this._geometry.getAttribute("position").array;
    const oldColorArray = this._geometry.getAttribute("color").array;
    this.resizeAttribute("position", this._positionBuffer);
    this.resizeAttribute("color", this._colorBuffer);
    for (let i = 0; i < this._positionBuffer.count; i++) {
      const x = oldPositionArray[i * 3];
      const y = oldPositionArray[i * 3 + 1];
      const z = oldPositionArray[i * 3 + 2];
      this._positionBuffer.setXYZ(i, x, y, z);
      const r = oldColorArray[i * 3];
      const g = oldColorArray[i * 3 + 1];
      const b = oldColorArray[i * 3 + 2];
      this._colorBuffer.setXYZ(i, r, g, b);
    }
  }

  private resizeAttribute(name: string, buffer: THREE.BufferAttribute) {
    const count = buffer.count;
    this._geometry.deleteAttribute(name);
    const array = new Float32Array(this._capacity);
    const newBuffer = new THREE.BufferAttribute(array, 3);
    newBuffer.count = count;
    this._geometry.setAttribute(name, newBuffer);
  }

  private updateColor(select: boolean) {
    const allIDs = this._items.ids;
    for (const id of allIDs) {
      const isSelected = this._selected.has(id);
      if (select !== isSelected) continue;
      const index = this._items.getIndex(id);
      if (!index) continue;
      const color = select ? this._selectColor : this._baseColor;
      this._colorBuffer.setXYZ(index, color.r, color.g, color.b);
    }
    this._colorBuffer.needsUpdate = true;
  }

  private removeSelectColor(ids = Array.from(this._selected)) {
    for (const id of ids) {
      const index = this._items.getIndex(id);
      if (index === null) return;
      this._colorBuffer.setXYZ(
        index,
        this._baseColor.r,
        this._baseColor.g,
        this._baseColor.b
      );
    }
  }

  private newPointsMaterial(size: number) {
    return new THREE.PointsMaterial({
      size,
      vertexColors: true,
    });
  }
}
