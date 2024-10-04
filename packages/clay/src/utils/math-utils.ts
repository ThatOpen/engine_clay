import * as THREE from "three";

export class MathUtils {
  static basisFromEuler(rotation: THREE.Euler) {
    const dirs = new THREE.Matrix4();
    dirs.makeRotationFromEuler(rotation);
    const dirX = new THREE.Vector3();
    const dirY = new THREE.Vector3();
    const dirZ = new THREE.Vector3();
    dirs.extractBasis(dirX, dirY, dirZ);
    return { dirX, dirY, dirZ };
  }

  static toThreeCoords(value: THREE.Vector3) {
    return new THREE.Vector3(value.x, value.z, -value.y);
  }

  static toIfcCoords(value: THREE.Vector3) {
    return new THREE.Vector3(value.x, -value.z, value.y);
  }
}
