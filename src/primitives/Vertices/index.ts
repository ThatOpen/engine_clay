import * as THREE from "three";
import { Primitive } from "../Primitive";
import { BufferManager, IdIndexMap } from "../../utils";

export class Vertices extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Points;

  /** The map between each vertex ID and its index. */
  idMap = new IdIndexMap();

  private _buffers: BufferManager;

  /**
   * The color of all the points.
   */
  set baseColor(color: THREE.Color) {
    super.baseColor = color;
    const allIDs = this.idMap.ids;
    const unselected = this.selected.getUnselected(allIDs);
    this.updateColor(unselected);
  }

  /**
   * The color of all the selected points.
   */
  set selectColor(color: THREE.Color) {
    super.selectColor = color;
    this.updateColor(this.selected.data);
  }

  /**
   * Creates a new instance of vertices
   * @param size Visualization point size
   */
  constructor(size: number = 0.1) {
    super();
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
    });

    this.mesh = new THREE.Points(geometry, material);
    this.mesh.frustumCulled = false;

    this._buffers = new BufferManager(geometry);
    this._buffers.createAttribute("position");
    this._buffers.createAttribute("color");
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
    ] as [number, number, number];
  }

  /**
   * Add new points
   * @param ids the vertices to edit.
   * @param coordinates the new coordinates for the vertex.
   */
  set(ids: Iterable<number>, coordinates: [number, number, number]) {
    const [x, y, z] = coordinates;
    for (const id of ids) {
      const index = this.idMap.getIndex(id);
      if (index === null) return;
      this._positionBuffer.setXYZ(index, x, y, z);
    }
    this._positionBuffer.needsUpdate = true;
  }

  /**
   * Add new points
   * @param coordinates Points to add.
   * @returns the list of ids of the created vertices.
   */
  add(coordinates: [number, number, number][]) {
    this._buffers.resizeIfNeeded(coordinates.length);
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
    this._buffers.updateCount(this.idMap.size);
    return ids;
  }

  /**
   * Select or unselects the given vertices.
   * @param active Whether to select or unselect.
   * @param ids List of vertices IDs to select or deselect. If not
   * defined, all vertices will be selected or deselected.
   */
  select(active: boolean, ids = this.idMap.ids as Iterable<number>) {
    const idsToUpdate = this.selected.select(active, ids, this.idMap.ids);
    this.updateColor(idsToUpdate);
  }

  /**
   * Applies a transformation to the selected vertices.
   * @param transformation Transformation matrix to apply.
   * @param ids IDs of the vertices to transform.
   */
  transform(transformation: THREE.Matrix4, ids = this.selected.data) {
    const vector = new THREE.Vector3();
    for (const id of ids) {
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
    this._buffers.resetAttributes();
    this.selected.data.clear();
    this.idMap.reset();
  }

  /**
   * Removes the selected points from the list
   */
  remove(ids = this.selected.data) {
    for (const id of ids) {
      for (const attribute of this._attributes) {
        this.removeFromBuffer(id, attribute);
      }
      this.idMap.remove(id);
    }
    this.select(false, ids);
    this._buffers.updateCount(this.idMap.size);
  }

  addAttribute(attribute: THREE.BufferAttribute) {
    this._buffers.addAttribute(attribute);
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

  private updateColor(ids = this.idMap.ids as Iterable<number>) {
    const colorBuffer = this._colorBuffer;
    for (const id of ids) {
      const isSelected = this.selected.data.has(id);
      const index = this.idMap.getIndex(id);
      if (index === null) continue;
      const color = isSelected ? this._selectColor : this._baseColor;
      colorBuffer.setXYZ(index, color.r, color.g, color.b);
    }
    colorBuffer.needsUpdate = true;
  }
}
