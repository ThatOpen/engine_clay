import * as THREE from "three";
import { Mouse } from "../helpers/mouse";
import { ControlData, ControlInput } from "./types";

export class Points extends THREE.Points {
  screenTolerance = 0.05;
  pickMode: "point" | "edge" = "point";

  snapSettings = {
    distance: 1,
    enabled: true,
  };

  protected selected = new Set<number>();
  protected tempVector3 = new THREE.Vector3();
  protected tempVector2 = new THREE.Vector2();

  private mouse = new Mouse();
  private controlData?: ControlData;
  private transformReference = new THREE.Matrix4();

  snappedPoints: THREE.Vector3[] = [];
  snappedLines: THREE.Line3[] = [];
  snapPointObject = new THREE.Points();
  snapLineObject = new THREE.Line();

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
    this.controlData = { ...data, object, active: false, position: "last" };
    data.scene.add(this.controls.object);
    data.helper.attach(this.controls.object);
    data.helper.addEventListener("change", this.onControlChange);
  }

  constructor(points: THREE.Vector3[]) {
    super();
    this.geometry = new THREE.BufferGeometry();
    this.regenerate(points);
    this.resetSelection();
    this.setupSnappingObjects();
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
    this.regenerate(list);
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
    this.resetColor(this.geometry);
  }

  pick(event: MouseEvent) {
    const mouse = this.mouse.getPosition(this.controls.canvas, event);
    const length = this.geometry.attributes.position.array.length;
    let anythingFound = false;
    for (let i = 0; i < length - 2; i += 3) {
      const distance = this.getMouseScreenDistance(i, mouse);
      if (distance < this.screenTolerance) {
        anythingFound = true;
        this.highlight(i / 3);
      }
    }
    if (!anythingFound) {
      this.resetSelection();
      this.toggleControls(false);
    }
    this.resetControls();
  }

  resetControls() {
    if (this.controls.position === "center") {
      this.setControlsToCenterOfSelection();
    } else if (this.controls.position === "last") {
      this.setControlsToLastSelection();
    }
  }

  private setControlsToLastSelection() {
    const last = this.getLastSelected();
    if (last === undefined) return;
    const position = this.geometry.attributes.position;
    const x = position.getX(last);
    const y = position.getY(last);
    const z = position.getZ(last);
    this.setControlsPosition(x, y, z);
  }

  private getLastSelected() {
    return Array.from(this.selected).pop();
  }

  private setControlsToCenterOfSelection() {
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
    this.setControlsPosition(midX, midY, midZ);
  }

  private setControlsPosition(x: number, y: number, z: number) {
    const previousState = this.controls.active;
    this.controls.active = false;
    this.controls.object.position.set(x, y, z);
    this.controls.object.rotation.set(0, 0, 0);
    this.controls.object.scale.set(1, 1, 1);
    this.controls.object.updateMatrixWorld();
    this.transformReference.copy(this.controls.object.matrix).invert();
    this.controls.helper.position.set(0, 0, 0);
    this.controls.active = previousState;
  }

  protected regenerate(points: THREE.Vector3[]) {
    this.geometry.setFromPoints(points);
  }

  protected highlight(index: number) {
    this.selected.add(index);
    const color = this.geometry.attributes.color;
    color.setX(index, 0);
    color.setY(index, 1);
    color.setZ(index, 0);
    color.needsUpdate = true;
  }

  protected resetColor(geometry: THREE.BufferGeometry) {
    const size = geometry.attributes.position.count;
    const colorBuffer = new Float32Array(size * 3);
    const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
    geometry.setAttribute("color", colorAttribute);
  }

  protected getMouseScreenDistance(index: number, mouse: THREE.Vector2) {
    const vector = this.getPositionVector(index);
    return vector.distanceTo(mouse);
  }

  protected getPositionVector(i: number) {
    const position = this.geometry.attributes.position;
    this.tempVector3.x = position.array[i];
    this.tempVector3.y = position.array[i + 1];
    this.tempVector3.z = position.array[i + 2];
    this.tempVector3.project(this.controls.camera);
    return new THREE.Vector2(this.tempVector3.x, this.tempVector3.y);
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
      if (this.selected.size === 1) {
        this.transformOnePoint();
      } else {
        this.transformManyPoints(index);
      }

      position.setX(index, this.tempVector3.x);
      position.setY(index, this.tempVector3.y);
      position.setZ(index, this.tempVector3.z);
    }
    this.transformReference.copy(this.controls.object.matrix).invert();
    position.needsUpdate = true;
  }

  // TODO: Extract this in a separate class
  // TODO: Transform many points and transform one point can be merged
  // if in the case of many points we consider 1 reference point

  private transformManyPoints(index: number) {
    const position = this.geometry.attributes.position;

    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);

    this.tempVector3.set(x, y, z);
    this.tempVector3
      .applyMatrix4(this.transformReference)
      .applyMatrix4(this.controls.object.matrixWorld);
  }

  private transformOnePoint() {
    if (this.snapSettings.enabled) {
      const snapped = this.applySnapping();
      if (snapped) return;
    }
    const isOffset = !this.controls.object.position.equals(this.tempVector3);
    if (isOffset) {
      this.tempVector3.copy(this.controls.object.position);
    }
  }

  private applySnapping() {
    const snapped = this.snapPoints();
    if (snapped) return snapped;
    return this.snapLines();
  }

  private snapLines() {
    const controls = this.controls.object.position;
    for (const line of this.snappedLines) {
      const temp = new THREE.Vector3();
      line.closestPointToPoint(controls, false, temp);
      if (temp.distanceTo(controls) < this.snapSettings.distance) {
        this.tempVector3.copy(temp);
        this.toggleSnapLineObject(true, line);
        return true;
      }
    }
    this.toggleSnapLineObject(false);
    return false;
  }

  private snapPoints() {
    const controls = this.controls.object.position;
    for (const point of this.snappedPoints) {
      if (point.distanceTo(controls) < this.snapSettings.distance) {
        this.tempVector3.copy(point);
        this.toggleSnapPointObject(true);
        return true;
      }
    }
    this.toggleSnapPointObject(false);
    return false;
  }

  toggleSnapPointObject(active: boolean) {
    if (active) {
      this.controls.scene.add(this.snapPointObject);
      this.snapPointObject.position.copy(this.tempVector3);
    } else if (this.snapPointObject.parent) {
      this.snapPointObject.removeFromParent();
    }
  }

  toggleSnapLineObject(active: boolean, line?: THREE.Line3) {
    if (active && line) {
      this.controls.scene.add(this.snapLineObject);
      this.snapLineObject.position.copy(line.start);
      this.snapLineObject.lookAt(line.end);
    } else if (this.snapLineObject.parent) {
      this.snapLineObject.removeFromParent();
    }
  }

  private setupSnappingObjects() {
    this.snapPointObject.geometry = new THREE.BufferGeometry();
    this.snapPointObject.geometry.setFromPoints([new THREE.Vector3()]);
    this.snapPointObject.renderOrder = 1;
    this.snapPointObject.material = new THREE.PointsMaterial({
      color: 0xff00ff,
      depthTest: false,
      size: 12,
      sizeAttenuation: false,
    });
    this.snapLineObject.geometry = new THREE.BufferGeometry();
    this.snapLineObject.geometry.setFromPoints([
      new THREE.Vector3(0, 0, -1000),
      new THREE.Vector3(0, 0, 1000),
    ]);
    this.snapLineObject.material = new THREE.LineBasicMaterial({
      color: 0xff00ff,
    });
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
