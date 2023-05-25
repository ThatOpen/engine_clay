import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";

export class Control {
  core: TransformControls;
  helper: THREE.Object3D;

  constructor(
    camera: THREE.Camera,
    element: HTMLCanvasElement,
    scene: THREE.Scene,
    controls: TransformControls
  ) {
    this.core = new TransformControls(camera, element);

    this.helper = new THREE.Object3D();
    let transform = new THREE.Matrix4();
    this.core.attach(this.helper);
    scene.add(this.helper);
    scene.add(this.core);

    controls.addEventListener(
      "dragging-changed",
      (event) => (controls.enabled = !event.value)
    );

    controls.addEventListener("change", () => {
      this.helper.updateMatrix();
      const temp = helper.matrix.clone();
      temp.multiply(transform.invert());
      polygons.workPlane.applyMatrix4(temp);
      transform = helper.matrix.clone();
    });
  }
}
