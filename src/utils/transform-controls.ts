import * as THREE from "three";
import * as OBC from "openbim-components";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";

export class Control {
  core: TransformControls;
  helper: THREE.Object3D;
  transformed = new OBC.Event<THREE.Matrix4>();
  controlsActivated = new OBC.Event();

  get items() {
    return [this.helper, this.core];
  }

  constructor(camera: THREE.Camera, element: HTMLCanvasElement) {
    this.core = new TransformControls(camera, element);

    this.helper = new THREE.Object3D();
    let transform = new THREE.Matrix4();
    this.core.attach(this.helper);

    this.core.addEventListener("dragging-changed", () => {
      this.controlsActivated.trigger();
    });

    this.core.addEventListener("change", () => {
      this.helper.updateMatrix();
      const temp = this.helper.matrix.clone();
      temp.multiply(transform.invert());
      this.transformed.trigger(temp);
      transform = this.helper.matrix.clone();
    });
  }
}
