import * as THREE from "three";
import { Mouse } from "../helpers/mouse";
import { ControlData, ControlInput } from "./types";

export class Points extends THREE.Points {
  tolerance = 0.05;

  private selected = new Set<number>();
  private mouse = new Mouse();

  private controlData?: ControlData;

  private transformReference = new THREE.Matrix4();
  private tempVector3 = new THREE.Vector3();
  private tempVector2 = new THREE.Vector2();

  get count() {
    return this.geometry.attributes.position.count;
  }

  get controls(): ControlData {
    if (!this.controlData) {
      throw new Error("Controls were not initialized.");
    }
    return this.controlData;
  }

  set controls(data: ControlInput) {
    this.cleanUpControls();
    const object = new THREE.Object3D();
    this.controlData = { ...data, object, active: true };
    data.scene.add(this.controls.object);
    data.helper.attach(this.controls.object);
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

  create(points: THREE.Vector3[], index = this.count) {
    this.toggleControls(false);
    const list = this.getPointList();
    list.splice(index, 0, ...points);
    this.geometry.setFromPoints(list);
    this.resetSelection();
  }

  delete(indices = Array.from(this.selected)) {
    const sorted = indices.sort();
    const list = this.getPointList();
    this.toggleControls(false);
    this.resetSelection();
    let counter = 0;
    for (const index of sorted) {
      list.splice(index - counter, 1);
      counter++;
    }
    this.geometry.setFromPoints(list);
  }

  toggleControls(active: boolean) {
    this.controls.active = active;
    this.controls.helper.enabled = active;
    if (!active) {
      this.controls.helper.removeFromParent();
    } else if (this.selected.size) {
      this.controls.scene.add(this.controls.helper);
    }
  }

  resetSelection() {
    this.selected.clear();
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
    this.resetControls();
  }

  resetControls() {
    const sum = new THREE.Vector3();
    const position = this.geometry.attributes.position;
    for (const index of this.selected) {
      sum.x += position.getX(index);
      sum.y += position.getY(index);
      sum.z += position.getZ(index);
    }
    const midX = sum.x / this.selected.size;
    const midY = sum.y / this.selected.size;
    const midZ = sum.z / this.selected.size;
    this.controls.active = false;
    this.controls.object.position.set(midX, midY, midZ);
    this.controls.object.rotation.set(0, 0, 0);
    this.controls.object.scale.set(1, 1, 1);
    this.controls.object.updateMatrixWorld();
    this.transformReference.copy(this.controls.object.matrix).invert();
    this.controls.helper.position.set(0, 0, 0);
    this.controls.active = true;
  }

  private getPointList() {
    const list: THREE.Vector3[] = [];
    const position = this.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      list.push(new THREE.Vector3(x, y, z));
    }
    return list;
  }

  private transform() {
    const position = this.geometry.attributes.position;
    for (const index of this.selected) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);

      this.tempVector3.set(x, y, z);
      this.tempVector3
        .applyMatrix4(this.transformReference)
        .applyMatrix4(this.controls.object.matrixWorld);

      position.setX(index, this.tempVector3.x);
      position.setY(index, this.tempVector3.y);
      position.setZ(index, this.tempVector3.z);
    }
    this.transformReference.copy(this.controls.object.matrix).invert();
    position.needsUpdate = true;
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
    this.selected.add(index);
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
    if (!this.controls.active) return;
    this.transform();
  };
}
