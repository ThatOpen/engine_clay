import * as THREE from "three";

export interface Primitive {
  /** Physical object with a geometry and one or many materials that can be placed in the scene. */
  mesh: {
    geometry: THREE.BufferGeometry;
    material: THREE.Material[] | THREE.Material;
  };
}
