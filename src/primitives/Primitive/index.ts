import * as THREE from "three";
import { Selector } from "../../utils";

export type BufferAttributeType = "color" | "uv" | "normal" | "position";

export type ObjectWithBufferAndBufferAttributeType = {
  buffer: THREE.BufferAttribute;
  bufferAttributeType: BufferAttributeType;
};

export abstract class Primitive {
  /** Physical object with a geometry and one or many materials that can be placed in the scene. */
  abstract mesh: {
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
  };

  /**
   * All the selected items within this primitive.
   */
  selected = new Selector();

  protected _baseColor = new THREE.Color(0.5, 0.5, 0.5);
  protected _selectColor = new THREE.Color(1, 0, 0);

  /**
   * The list of ids of the {@link list} of items.
   */
  get ids() {
    const ids: number[] = [];
    for (const id in this.list) {
      ids.push(this.list[id].id);
    }
    return ids;
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
  }

  /**
   * The color of all the selected points.
   */
  get selectColor() {
    return this._selectColor;
  }

  /**
   * The color of all the selected points.
   */
  set selectColor(color: THREE.Color) {
    this._selectColor.copy(color);
  }

  protected list: {
    [id: number]: {
      id: number;
      [key: string]: any;
    };
  } = {};

  _getObjectWithBufferAndBufferAttributeType(
    bufferAttributeType: BufferAttributeType
  ) {
    return {
      buffer: this.mesh.geometry.attributes[
        bufferAttributeType
      ] as THREE.BufferAttribute,
      bufferAttributeType,
    };
  }

  protected get _positionBufferObject(): ObjectWithBufferAndBufferAttributeType {
    return this._getObjectWithBufferAndBufferAttributeType("position");
  }

  protected get _colorBufferObject(): ObjectWithBufferAndBufferAttributeType {
    return this._getObjectWithBufferAndBufferAttributeType("color");
  }

  protected get _normalBufferObject(): ObjectWithBufferAndBufferAttributeType {
    return this._getObjectWithBufferAndBufferAttributeType("normal");
  }

  protected get _uvBufferObject(): ObjectWithBufferAndBufferAttributeType {
    return this._getObjectWithBufferAndBufferAttributeType("uv");
  }

  protected get _attributes() {
    return Object.values(
      this.mesh.geometry.attributes
    ) as THREE.BufferAttribute[];
  }
}
