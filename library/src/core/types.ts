import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import * as THREE from "three";

export interface ControlData {
  canvas: HTMLCanvasElement;
  helper: TransformControls;
  scene: THREE.Scene;
  camera: THREE.Camera;
  active?: boolean;
}
