import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import * as THREE from "three";

export interface ControlInput {
  canvas: HTMLCanvasElement;
  helper: TransformControls;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

export interface ControlData extends ControlInput {
  active: boolean;
  object: THREE.Object3D;
}
