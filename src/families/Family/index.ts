import * as THREE from "three";
import { ClayObject } from "../../base";

export abstract class Family extends ClayObject {
  abstract geometries: { [name: string]: ClayObject };

  abstract get mesh(): THREE.InstancedMesh;
}
