import * as THREE from "three";
import { IdIndexMap } from "./id-index-map";
import { Primitive } from "../types";

export class Vertices implements Primitive {
  /** Buffer increment when geometry size is exceeded, multiple of 3. */
  bufferIncrease = 300;

  /** {@link Primitive.mesh } */
  mesh: THREE.Points;

  /** The map between each vertex ID and its index. */
  idMap = new IdIndexMap();

  private _baseColor: THREE.Color = new THREE.Color(0.5, 0.5, 0.5);
  private _selectColor: THREE.Color = new THREE.Color(1, 0, 0);
  private _capacity = 0;
  private _selected = new Set<number>();

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
    const allIDs = this.idMap.ids;
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

  private get _positionBuffer() {
    return this._geometry.attributes.position as THREE.BufferAttribute;
  }

  private get _colorBuffer() {
    return this.mesh.geometry.attributes.color as THREE.BufferAttribute;
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

    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
    });

    this.mesh = new THREE.Points(geometry, material);
    this.mesh.frustumCulled = false;
    this.resetAttributes();
  }

  /**
   * Gets the coordinates of the vertex with the given ID.
   * @param id the id of the point to retrieve.
   */
  get(id: number) {
    const index = this.idMap.getIndex(id);
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
    const { r, g, b } = this._baseColor;
    for (let i = 0; i < coordinates.length; i++) {
      const index = this.idMap.add();
      const id = this.idMap.getId(index);
      ids.push(id);
      const [x, y, z] = coordinates[i];
      this._positionBuffer.setXYZ(index, x, y, z);
      this._colorBuffer.setXYZ(index, r, g, b);
    }
    this.updateBuffersCount();
    return ids;
  }

  /**
   * Select or unselects the given vertices.
   * @param active Whether to select or unselect.
   * @param ids List of vertices IDs to select or deselect. If not
   * defined, all vertices will be selected or deselected.
   */
  select(active: boolean, ids = this.idMap.ids as Iterable<number>) {
    const idsToUpdate: number[] = [];
    for (const id of ids) {
      const exists = this.idMap.getIndex(id) !== null;
      if (!exists) continue;
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
      const index = this.idMap.getIndex(id);
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
    this.idMap.reset();
  }

  /**
   * Removes the selected points from the list
   */
  remove() {
    const position = this._positionBuffer;
    const color = this._colorBuffer;
    for (const id of this._selected) {
      this._selected.delete(id);
      this.removeFromBuffer(id, position);
      this.removeFromBuffer(id, color);
      this.idMap.remove(id);
    }
    this.updateBuffersCount();
  }

  private updateBuffersCount() {
    const size = this.idMap.size;

    const position = this._positionBuffer;
    position.count = size;
    position.needsUpdate = true;

    const color = this._colorBuffer;
    color.count = size;
    color.needsUpdate = true;
  }

  private resetAttributes() {
    const positionBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
    const colorBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
    this._geometry.setAttribute("position", positionBuffer);
    this._geometry.setAttribute("color", colorBuffer);
    this._capacity = 0;
  }

  private removeFromBuffer(id: number, buffer: THREE.BufferAttribute) {
    const lastIndex = this.idMap.getLastIndex();
    const index = this.idMap.getIndex(id);
    if (index !== null) {
      buffer.setXYZ(
        index,
        buffer.getX(lastIndex),
        buffer.getY(lastIndex),
        buffer.getZ(lastIndex)
      );
    }
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

  private updateColor(ids = this.idMap.ids as Iterable<number>) {
    for (const id of ids) {
      const isSelected = this._selected.has(id);
      const index = this.idMap.getIndex(id);
      if (!index) continue;
      const color = isSelected ? this._selectColor : this._baseColor;
      this._colorBuffer.setXYZ(index, color.r, color.g, color.b);
    }
    this._colorBuffer.needsUpdate = true;
  }
}
