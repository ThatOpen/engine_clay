import * as THREE from "three";
import { ClayObject } from "../Object";

/**
 * Base object for all Clay objects with a transformation in 3D space.
 */
export abstract class ClayObject3D extends ClayObject {
  /**
   * Position of this element in 3D space.
   */
  position = new THREE.Vector3();

  /**
   * Rotation of this element in 3D space.
   */
  rotation = new THREE.Euler();

  /**
   * Gets the transform of this object as a THREE.Matrix4.
   */
  getTransform() {
    const temp = new THREE.Object3D();
    temp.position.copy(this.position);
    temp.rotation.copy(this.rotation);
    temp.updateMatrix();
    return temp.matrix;
  }

  /**
   * Sets the transform of this object given a THREE.Matrix4.
   */
  setTransform(transform: THREE.Matrix4) {
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    transform.decompose(this.position, quat, scale);
    this.rotation.setFromQuaternion(quat);
  }

  /**
   * Applies the transform of this object given a THREE.Matrix4.
   */
  applyTransform(transform: THREE.Matrix4) {
    const currentTransform = this.getTransform();
    currentTransform.multiply(transform);
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    currentTransform.decompose(this.position, quat, scale);
    this.setTransform(currentTransform);
  }
}
