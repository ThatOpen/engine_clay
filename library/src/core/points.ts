import * as THREE from "three";
import { Mouse } from "../helpers/mouse";
import { ControlData } from "./types";

export class Points extends THREE.Points {
  tolerance = 0.05;

  private selected: number[] = [];
  private mouse = new Mouse();
  private controlData?: ControlData;
  private helper = new THREE.Object3D();
  private previousTransform = new THREE.Matrix4();

  private tempVector3 = new THREE.Vector3();
  private tempVector2 = new THREE.Vector2();

  get controls() {
    if (!this.controlData) {
      throw new Error("Controls were not initialized.");
    }
    return this.controlData;
  }

  set controls(data: ControlData) {
    this.cleanUpControls();
    this.controlData = data;
    data.scene.add(this.helper);
    data.helper.attach(this.helper);
    data.helper.addEventListener("change", this.onControlChange);
  }

  constructor(points: THREE.Vector3[]) {
    super();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setFromPoints(points);
    this.resetSelection();
    this.material = new THREE.PointsMaterial({
      depthTest: false,
      size: 10,
      sizeAttenuation: false,
      vertexColors: true,
    });
  }

  toggleControls(active: boolean) {
    if (!active) {
      this.controls.helper.removeFromParent();
      this.controls.helper.enabled = false;
    } else if (this.selected.length) {
      this.controls.helper.enabled = true;
      // this.controls.helper.position.copy(this.selected[0]);
      this.controls.scene.add(this.controls.helper);
    }
  }

  transform(transform: THREE.Matrix4) {
    const position = this.geometry.attributes.position;
    for (let i = 0; i < this.selected.length; i++) {
      const index = this.selected[i];
      this.tempVector3.x = position.getX(index);
      this.tempVector3.y = position.getY(index);
      this.tempVector3.z = position.getZ(index);
      this.tempVector3.applyMatrix4(transform);
      position.setX(index, this.tempVector3.x);
      position.setY(index, this.tempVector3.y);
      position.setZ(index, this.tempVector3.z);
    }
    position.needsUpdate = true;
  }

  resetSelection() {
    this.selected.length = 0;
    const size = this.geometry.attributes.position.count;
    const colorBuffer = new Float32Array(size * 3);
    const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
    this.geometry.setAttribute("color", colorAttribute);
  }

  pick(event: MouseEvent) {
    const mouse = this.mouse.getPosition(this.controls.canvas, event);
    const length = this.geometry.attributes.position.array.length;
    for (let i = 0; i < length - 2; i += 3) {
      this.getPositionVector(i);
      const distance = this.tempVector2.distanceTo(mouse);
      if (distance < this.tolerance) {
        this.highlight(i / 3);
      }
    }
  }

  private getPositionVector(i: number) {
    const position = this.geometry.attributes.position;
    this.tempVector3.x = position.array[i];
    this.tempVector3.y = position.array[i + 1];
    this.tempVector3.z = position.array[i + 2];
    this.tempVector3.project(this.controls.camera);
    this.tempVector2.set(this.tempVector3.x, this.tempVector3.y);
  }

  private highlight(index: number) {
    this.selected.push(index);
    const color = this.geometry.attributes.color;
    color.setX(index, 0);
    color.setY(index, 1);
    color.setZ(index, 0);
    color.needsUpdate = true;
  }

  private cleanUpControls() {
    if (this.controlData) {
      this.controlData.helper.removeEventListener(
        "change",
        this.onControlChange
      );
    }
  }

  private onControlChange = () => {
    this.previousTransform.multiply(this.helper.matrix);
    this.transform(this.previousTransform);
    this.previousTransform = this.helper.matrix.clone().invert();
  };
}
