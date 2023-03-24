import * as THREE from "three";

export class Vertices {
  /** Buffer increment when geometry size is exceeded, multiple of 3. */
  bufferIncrease = 300;

  /** THREE points */
  points: THREE.Points;

  defaultColor: THREE.Color = new THREE.Color(0.5, 0.5, 0.5);
  selectColor: THREE.Color = new THREE.Color(1, 0, 0);

  private _capacity = 0;
  private _geometry = new THREE.BufferGeometry();
  private _positionBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
  private _colorBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
  private _selected = new Set<number>();

  /**
   * Creates a new instance of vertices
   * @param size Visualization point size
   */
  constructor(size: number = 0.1) {
    this._geometry.setAttribute("position", this._positionBuffer);
    this._geometry.setAttribute("color", this._colorBuffer);
    this.resetBuffer();
    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
    });
    this.points = new THREE.Points(this._geometry, material);
  }

  /**
   * Add new points
   * @param coordinates Points to add
   */
  add(coordinates: THREE.Vector3[]) {
    const list = [];
    this.checkBufferSize(coordinates.length);
    for (let i = 0; i < coordinates.length; i++) {
      const indexToAdd = this._positionBuffer.count + i;
      const { x, y, z } = coordinates[i];
      this._positionBuffer.setXYZ(indexToAdd, x, y, z);
      const { r, g, b } = this.defaultColor;
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
   * @param selection List of point indices to add to the selected set
   */
  select(active: boolean, selection: number[] = []) {
    if (active) {
      this.selectIndex(selection);
      return;
    }
    this.unselect(selection);
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
   * Removes points from the list
   */
  remove() {
    for (const index of this._selected.values()) {
      const lastIndex = this._positionBuffer.count - 1;
      this._positionBuffer.setXYZ(
        index,
        this._positionBuffer.getX(lastIndex),
        this._positionBuffer.getY(lastIndex),
        this._positionBuffer.getZ(lastIndex)
      );
      this._colorBuffer.setXYZ(
        index,
        this._colorBuffer.getX(lastIndex),
        this._colorBuffer.getY(lastIndex),
        this._colorBuffer.getZ(lastIndex)
      );
      this._positionBuffer.count--;
    }
  }

  /**
   * Get position buffer
   * @returns The position buffer of the vertices
   */
  getPositionBuffer() {
    return this._positionBuffer;
  }

  /**
   * Number of points
   * @returns Number corresponding to the lenght
   */
  length() {
    return this._positionBuffer.count;
  }

  getPointByIndex(index: number) {
    return [
      this._positionBuffer.getX(index),
      this._positionBuffer.getY(index),
      this._positionBuffer.getZ(index),
    ];
  }

  private checkBufferSize(increase: number) {
    const tempPositionArray = this._geometry.getAttribute("position");
    const size = tempPositionArray.count * 3 + increase * 3;
    while (size >= this._capacity) {
      if (this.bufferIncrease < 1) {
        this.bufferIncrease = 1;
      }
      this.resetBuffer();
      return;
    }
  }

  private selectIndex(selection: number[] = []) {
    if (selection.length === 0) {
      this.resetAllSelectedColors();
      this._selected.clear();
      for (let i = 0; i < this._positionBuffer.count; i++) {
        this.addSelection(i);
      }
      return;
    }
    for (let i = 0; i < selection.length; i++) {
      this.addSelection(selection[i]);
    }
  }

  private addSelection(index: number) {
    this._selected.add(index);
    this._colorBuffer.setX(index, this.selectColor.r);
    this._colorBuffer.setY(index, this.selectColor.g);
    this._colorBuffer.setZ(index, this.selectColor.b);
  }

  private unselect(selection: number[] = []) {
    this.restoreColor(selection);
    if (selection.length === 0) {
      this._selected.clear();
      return;
    }
    for (let i = 0; i < selection.length; i++) {
      this._selected.delete(selection[i]);
    }
  }

  private restoreColor(selection: number[] = []) {
    if (selection.length === 0) {
      this.resetAllSelectedColors();
      return;
    }
    this.resetSelectedColors(selection);
  }

  private resetAllSelectedColors() {
    for (const index of this._selected.values()) {
      this._colorBuffer.setXYZ(
        index,
        this.defaultColor.r,
        this.defaultColor.g,
        this.defaultColor.b
      );
    }
  }

  private resetSelectedColors(selection: number[]) {
    for (let i = 0; i < selection.length; i++) {
      this._colorBuffer.setXYZ(
        selection[i],
        this.defaultColor.r,
        this.defaultColor.g,
        this.defaultColor.b
      );
    }
  }

  private transform(transformation: THREE.Matrix4) {
    const vector = new THREE.Vector3();
    for (const index of this._selected) {
      const x = this._positionBuffer.getX(index);
      const y = this._positionBuffer.getY(index);
      const z = this._positionBuffer.getZ(index);
      vector.set(x, y, z);
      vector.applyMatrix4(transformation);
      this._positionBuffer.setXYZ(index, vector.x, vector.y, vector.z);
    }
  }

  private resetBuffer() {
    this._capacity += this.bufferIncrease;
    const tempPositionArray = this._geometry.getAttribute("position").array;
    const tempColorArray = this._geometry.getAttribute("color").array;
    this.resetAttributePosition();
    this.resetAttributeColor();
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

  private resetAttributePosition() {
    const count = this._positionBuffer.count;
    this._geometry.deleteAttribute("position");
    this._positionBuffer = new THREE.BufferAttribute(
      new Float32Array(this._capacity),
      3
    );
    this._positionBuffer.count = count;
    this._geometry.setAttribute("position", this._positionBuffer);
  }

  private resetAttributeColor() {
    const count = this._colorBuffer.count;
    this._geometry.deleteAttribute("color");
    this._colorBuffer = new THREE.BufferAttribute(
      new Float32Array(this._capacity),
      3
    );
    this._colorBuffer.count = count;
    this._geometry.setAttribute("color", this._colorBuffer);
  }
}
