import * as THREE from "three";

export class Vertices {
  /** Buffer increment when geometry size is exceeded, multiple of 3. */
  bufferIncrease = 300;

  /** THREE points */
  points: THREE.Points;

  private _baseColor: THREE.Color = new THREE.Color(0.5, 0.5, 0.5);
  private _selectColor: THREE.Color = new THREE.Color(1, 0, 0);
  private _capacity = 0;
  private _selected = new Set<number>();

  /**
   * Number of points
   * @returns Number corresponding to the length
   */
  get length() {
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
    return this.points.geometry;
  }

  /**
   * Creates a new instance of vertices
   * @param size Visualization point size
   */
  constructor(size: number = 0.1) {
    const geometry = new THREE.BufferGeometry();
    const material = this.newPointsMaterial(size);
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.resetAttributes();
  }

  /**
   * Gets a point at the given index.
   * @param index the index of the point to retrieve.
   */
  get(index: number) {
    return [
      this._positionBuffer.getX(index),
      this._positionBuffer.getY(index),
      this._positionBuffer.getZ(index),
    ];
  }

  /**
   * Add new points
   * @param coordinates Points to add
   */
  add(coordinates: THREE.Vector3[]) {
    const list = [];
    this.resizeBufferIfNecessary(coordinates.length);
    for (let i = 0; i < coordinates.length; i++) {
      const indexToAdd = this._positionBuffer.count + i;
      const { x, y, z } = coordinates[i];
      this._positionBuffer.setXYZ(indexToAdd, x, y, z);
      const { r, g, b } = this._baseColor;
      this._colorBuffer.setXYZ(indexToAdd, r, g, b);
      list.push(indexToAdd);
    }
    this._positionBuffer.count += coordinates.length;
    this._colorBuffer.count += coordinates.length;
    return list;
  }

  /**
   * Creates a set of selected points
   * @param active When true we will select, when false we will unselect
   * @param selection List of point indices to add to the selected set. If not
   * defined, all items will be selected or deselected.
   */
  select(active: boolean, selection?: number[]) {
    if (active) {
      this.selectPoints(selection);
    } else {
      this.unselectPoints(selection);
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
    for (const index of this._selected) {
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
    this._capacity = 0;
    this._selected.clear();
  }

  /**
   * Removes the selected points from the list
   */
  remove() {
    const selected = this._selected.values();
    for (const index of selected) {
      const lastIndex = this._positionBuffer.count - 1;
      this.removeFromPositionBuffer(index, lastIndex);
      this.removeFromColorBuffer(index, lastIndex);
      this._positionBuffer.count--;
    }
  }

  private resetAttributes() {
    const positionBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
    const colorBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
    this._geometry.setAttribute("position", positionBuffer);
    this._geometry.setAttribute("color", colorBuffer);
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
    const tempPositionArray = this._geometry.getAttribute("position");
    const size = tempPositionArray.count * 3 + increase * 3;
    if (size >= this._capacity) {
      const diff = size - this._capacity;
      const increase = Math.max(diff, this.bufferIncrease);
      this.resetBuffer(increase);
    }
  }

  private selectPoints(selection?: number[]) {
    if (!selection) {
      this.selectAll();
      return;
    }
    for (let i = 0; i < selection.length; i++) {
      this.addSelection(selection[i]);
    }
  }

  private unselectPoints(selection?: number[]) {
    if (!selection) {
      this.unselectAll();
      return;
    }
    this.removeSelectColor(selection);
    for (let i = 0; i < selection.length; i++) {
      this._selected.delete(selection[i]);
    }
  }

  private selectAll() {
    for (let i = 0; i < this._positionBuffer.count; i++) {
      this.addSelection(i);
    }
  }

  private unselectAll() {
    this.removeSelectColor();
    this._selected.clear();
  }

  private addSelection(index: number) {
    this._selected.add(index);
    this._colorBuffer.setX(index, this._selectColor.r);
    this._colorBuffer.setY(index, this._selectColor.g);
    this._colorBuffer.setZ(index, this._selectColor.b);
  }

  private updateColor(select: boolean) {
    for (let i = 0; i < this._positionBuffer.count; i++) {
      const isSelected = this._selected.has(i);
      if (select !== isSelected) continue;
      const color = select ? this._selectColor : this._baseColor;
      this._colorBuffer.setXYZ(i, color.r, color.g, color.b);
    }
    this._colorBuffer.needsUpdate = true;
  }

  private removeSelectColor(selection = Array.from(this._selected)) {
    for (let i = 0; i < selection.length; i++) {
      this._colorBuffer.setXYZ(
        selection[i],
        this._baseColor.r,
        this._baseColor.g,
        this._baseColor.b
      );
    }
  }

  private resetBuffer(increase = this.bufferIncrease) {
    this._capacity += increase;
    const tempPositionArray = this._geometry.getAttribute("position").array;
    const tempColorArray = this._geometry.getAttribute("color").array;
    this.resetAttribute("position", this._positionBuffer);
    this.resetAttribute("color", this._colorBuffer);
    for (let i = 0; i < this._positionBuffer.count; i++) {
      const x = tempPositionArray[i * 3];
      const y = tempPositionArray[i * 3 + 1];
      const z = tempPositionArray[i * 3 + 2];
      this._positionBuffer.setXYZ(i, x, y, z);
      const r = tempColorArray[i * 3];
      const g = tempColorArray[i * 3 + 1];
      const b = tempColorArray[i * 3 + 2];
      this._colorBuffer.setXYZ(i, r, g, b);
    }
  }

  private resetAttribute(name: string, buffer: THREE.BufferAttribute) {
    const count = buffer.count;
    this._geometry.deleteAttribute(name);
    const array = new Float32Array(this._capacity);
    const newBuffer = new THREE.BufferAttribute(array, 3);
    newBuffer.count = count;
    this._geometry.setAttribute(name, newBuffer);
  }

  private newPointsMaterial(size: number) {
    return new THREE.PointsMaterial({
      size,
      vertexColors: true,
    });
  }
}
