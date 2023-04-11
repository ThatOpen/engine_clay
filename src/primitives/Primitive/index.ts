import * as THREE from "three";
import { Selector } from "./selector";

export * from "./selector";
export * from "./id-index-map";

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

  protected get _positionBuffer() {
    return this.mesh.geometry.attributes.position as THREE.BufferAttribute;
  }

  protected get _colorBuffer() {
    return this.mesh.geometry.attributes.color as THREE.BufferAttribute;
  }

  protected get _normalBuffer() {
    return this.mesh.geometry.attributes.normal as THREE.BufferAttribute;
  }

  protected get _ids() {
    const ids: number[] = [];
    for (const id in this.list) {
      ids.push(this.list[id].id);
    }
    return ids;
  }
}
