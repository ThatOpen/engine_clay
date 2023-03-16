import * as THREE from "three";

export class Vertices {
  /** Buffer increment when geometry size is exceeded, multiple of 3. */
  bufferIncrease = 300;

  /** THREE points */
  points: THREE.Points;

  defaultColor: THREE.Color = new THREE.Color(0.5, 0.5, 0.5);

  private _geometry = new THREE.BufferGeometry();
  private _vertices: THREE.Vector3[] = [];
  private _colors: THREE.Color[] = [];
  private _capacity = 0;
  private _positionBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
  private _colorBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
  private _selected = new Set<number>();

  constructor(size: number = 0.1) {
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
    this._vertices.push(...coordinates);
    for (let i = 0; i < this._vertices.length; i++) {
      this._colors.push(this.defaultColor);
    }
    this.regenerate();
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

  private selectIndex(selection: number[] = []) {
    if (selection.length === 0) {
      this.resetAllSelectedColors();
      this._selected.clear();
      for (let i = 0; i < this._vertices.length; i++) {
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
    this._colorBuffer.setX(index, 1);
    this._colorBuffer.setY(index, 0);
    this._colorBuffer.setZ(index, 0);
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

  private regenerate() {
    const size = this._vertices.length * 3;
    if (size >= this._capacity) {
      this.resetBuffer();
      return;
    }
    const indexToAdd = this._vertices.length - 1;
    const { x, y, z } = this._vertices[indexToAdd];
    this._positionBuffer.setXYZ(indexToAdd, x, y, z);
    const { r, g, b } = this._colors[indexToAdd];
    this._colorBuffer.setXYZ(indexToAdd, r, g, b);
    this._positionBuffer.count = this._vertices.length;
    this._colorBuffer.count = this._vertices.length;
  }

  private resetBuffer() {
    this._capacity += this.bufferIncrease;
    this.resetAttributePosition();
    this.resetAttributeColor();
    for (let i = 0; i < this._vertices.length; i++) {
      const { x, y, z } = this._vertices[i];
      this._positionBuffer.setXYZ(i, x, y, z);
      const { r, g, b } = this._colors[i];
      this._colorBuffer.setXYZ(i, r, g, b);
    }
  }

  private resetAttributePosition() {
    this._geometry.deleteAttribute("position");
    this._positionBuffer = new THREE.BufferAttribute(
      new Float32Array(this._capacity),
      3
    );
    this._positionBuffer.count = this._vertices.length;
    this._geometry.setAttribute("position", this._positionBuffer);
  }

  private resetAttributeColor() {
    this._geometry.deleteAttribute("color");
    this._colorBuffer = new THREE.BufferAttribute(
      new Float32Array(this._capacity),
      3
    );
    this._colorBuffer.count = this._vertices.length;
    this._geometry.setAttribute("color", this._colorBuffer);
  }
}
