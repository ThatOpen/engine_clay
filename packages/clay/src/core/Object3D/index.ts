import * as THREE from "three";
import { ClayObject } from "../Object";

/**
 * Base object for all Clay objects with a transformation in 3D space.
 */
export abstract class ClayObject3D extends ClayObject {
  /**
   * Object representing the transformation of the object in 3D space.
   */
  transformation = new THREE.Object3D();
}
