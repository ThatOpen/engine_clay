import * as THREE from "three";
import { Faces, Lines } from "../../primitives";
import { Raycaster } from "../../utils";

export type PlaneTransformMode = "TRANSLATE" | "ROTATE" | "SCALE";

type TransformState =
  | "IDLE"
  | "DRAWING_AXIS_1"
  | "START_DRAWING_AXIS_2"
  | "FINISH_DRAWING_AXIS_2";

export class Planes {
  faces = new Faces();

  private _cameraGetter: () => THREE.Camera;
  private _caster = new Raycaster();
  private _enabled = false;
  private transformMode: PlaneTransformMode = "TRANSLATE";

  private _lines = new Lines();
  private readonly _helperLine1: { id: number; start: number; end: number };
  private readonly _helperLine2: { id: number; start: number; end: number };

  private readonly _helperPlane: THREE.Mesh;

  private _selected: number | null = null;

  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();
  private _v4 = new THREE.Vector3();

  private _q = new THREE.Quaternion();

  private _scene: THREE.Scene;
  private _transformActive = false;
  private _previousTransform = new THREE.Matrix4();
  private _newTransform = new THREE.Matrix4();
  private _tempTransform = new THREE.Matrix4();

  private _state: TransformState = "IDLE";

  get enabled() {
    return this._enabled;
  }

  set enabled(active: boolean) {
    this._enabled = active;
    if (active) {
      window.addEventListener("click", this.pick);
    } else {
      window.removeEventListener("click", this.pick);
    }
  }

  constructor(scene: THREE.Scene, cameraGetter: () => THREE.Camera) {
    this._cameraGetter = cameraGetter;
    this._scene = scene;
    const material = this.faces.mesh.material as THREE.Material;
    material.transparent = true;
    material.opacity = 0.2;

    const helperMaterial = new THREE.MeshBasicMaterial({
      color: 0xeeeeee,
      transparent: true,
      opacity: 0.3,
      side: 2,
    });

    const helperGeometry = new THREE.PlaneGeometry(10, 10, 10);
    this._helperPlane = new THREE.Mesh(helperGeometry, helperMaterial);
    // this._helperPlane.visible = false;

    const [a, b, c, d] = this._lines.addPoints([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);

    const [helperLineID] = this._lines.add([a, b]);
    this._helperLine1 = this._lines.list[helperLineID];

    const [helperAngleLineID] = this._lines.add([c, d]);
    this._helperLine2 = this._lines.list[helperAngleLineID];

    scene.add(this.faces.mesh);
    scene.add(this._helperPlane);
  }

  add() {
    const pointIDs = this.faces.addPoints([
      [1, 0, 1],
      [-1, 0, 1],
      [-1, 0, -1],
      [1, 0, -1],
    ]);

    return this.faces.add(pointIDs);
  }

  transform(active = !this._transformActive) {
    if (active === this._transformActive) return;
    if (active && this._selected === null) return;

    this._transformActive = active;

    if (!active) {
      this.setHelperLineVisible(false);
      this.faces.mesh.geometry.computeBoundingSphere();
      this.faces.mesh.geometry.computeBoundingBox();
      window.removeEventListener("mousemove", this.updateTransform);
      return;
    }

    if (this._selected === null) return;

    this.setHelperLineVisible(true);

    const center = this.faces.getCenter(this._selected);

    if (center === null) {
      this.transform(false);
      return;
    }

    const [cx, cy, cz] = center;
    this._helperPlane.position.set(cx, cy, cz);

    const camera = this._cameraGetter();
    this._helperPlane.rotation.copy(camera.rotation);
    this._helperPlane.updateMatrix();
    this._helperPlane.updateMatrixWorld();

    const result = this._caster.cast([this._helperPlane])[0];
    if (!result) {
      this.transform(false);
      return;
    }

    this._previousTransform.setPosition(result.point);
    this._newTransform.setPosition(result.point);

    const { x, y, z } = result.point;
    this._lines.setPoint(this._helperLine1.start, [x, y, z]);
    this._lines.setPoint(this._helperLine1.end, [x, y, z]);
    this._lines.setPoint(this._helperLine2.start, [x, y, z]);
    this._lines.setPoint(this._helperLine2.end, [x, y, z]);

    this._state = "DRAWING_AXIS_1";

    if (this.transformMode === "TRANSLATE") {
      window.addEventListener("click", this.finishDrawing);
    } else {
      window.addEventListener("click", this.startDrawing);
    }

    window.addEventListener("mousemove", this.updateTransform);
  }

  private updateTransform = () => {
    const result = this._caster.cast([this._helperPlane])[0];
    if (result === null) return;
    this.updateAxis(result);
    this.getTransformData();
    this.applyTransform();
  };

  private updateAxis(result: THREE.Intersection) {
    const { x, y, z } = result.point;
    const isFirstAxis = this._state === "DRAWING_AXIS_1";
    const axis = isFirstAxis ? this._helperLine1 : this._helperLine2;
    this._lines.setPoint(axis.end, [x, y, z]);
  }

  private getTransformData() {
    if (this.transformMode === "TRANSLATE") {
      this.getTranslation();
    } else if (this.transformMode === "ROTATE") {
      this.getRotation();
    } else if (this.transformMode === "SCALE") {
      this.getScale();
    }
  }

  private getTranslation() {
    const endPoint = this._lines.vertices.get(this._helperLine1.end);
    if (endPoint === null) return;
    const [x, y, z] = endPoint;
    this._v1.set(x, y, z);
    this._newTransform.setPosition(this._v1);
  }

  private getScale() {
    if (this._state === "DRAWING_AXIS_1") return;
    this.getSegmentVectors();

    const firstLength = this._v2.length();
    const secondLength = this._v4.length();
    const factor = secondLength / firstLength;

    this._newTransform.identity();

    const { x, y, z } = this._v1;
    const move = new THREE.Matrix4().makeTranslation(x, y, z);
    const scale = new THREE.Matrix4().makeScale(factor, factor, factor);
    const invMove = move.clone().invert();

    this._newTransform.multiply(move);
    this._newTransform.multiply(scale);
    this._newTransform.multiply(invMove);
    this._newTransform.multiply(this._helperPlane.matrix);
  }

  private getRotation() {
    if (this._state === "DRAWING_AXIS_1") return;
    this.getSegmentVectors();

    let angle = this._v4.angleTo(this._v2);

    // Correct angle sign (otherwise it's always the shorter unsigned angle)

    this._v3.set(0, 0, 1);
    this._v3.applyEuler(this._helperPlane.rotation);
    this._v4.cross(this._v2);
    const dot = this._v4.dot(this._v3);
    if (dot > 0) {
      angle *= -1;
    }

    // Get axis from camera

    const axis = new THREE.Vector3();
    axis.set(0, 0, 1);
    const camera = this._cameraGetter();
    axis.applyEuler(camera.rotation);
    this._q.setFromAxisAngle(axis, angle);

    this._newTransform.identity();

    const { x, y, z } = this._v1;
    const move = new THREE.Matrix4().makeTranslation(x, y, z);
    const rotation = new THREE.Matrix4().makeRotationFromQuaternion(this._q);
    const invMove = move.clone().invert();

    this._newTransform.multiply(move);
    this._newTransform.multiply(rotation);
    this._newTransform.multiply(invMove);
    this._newTransform.multiply(this._helperPlane.matrix);
  }

  private getSegmentVectors() {
    const first = this._lines.get(this._helperLine1.id);
    const second = this._lines.get(this._helperLine2.id);
    if (first === null || second === null) return;

    const [[ax, ay, az], [bx, by, bz]] = first;
    const [[cx, cy, cz], [dx, dy, dz]] = second;

    this._v1.set(ax, ay, az);
    this._v2.set(bx, by, bz);
    this._v3.set(cx, cy, cz);
    this._v4.set(dx, dy, dz);

    this._v2.sub(this._v1);
    this._v4.sub(this._v3);
  }

  private applyTransform() {
    // Rotation and scale only update when updating the second axis
    const isNotMove = this.transformMode !== "TRANSLATE";
    const isFirstAxis = this._state === "DRAWING_AXIS_1";
    if (isFirstAxis && isNotMove) return;

    this._tempTransform.copy(this._newTransform);

    if (this._state === "START_DRAWING_AXIS_2") {
      this._state = "FINISH_DRAWING_AXIS_2";
      this._previousTransform = this._newTransform.clone();
    }

    this._tempTransform.multiply(this._previousTransform.invert());
    this.faces.transform(this._tempTransform);

    this._previousTransform.copy(this._newTransform);
  }

  private startDrawing = () => {
    this._state = "START_DRAWING_AXIS_2";
    window.removeEventListener("click", this.startDrawing);
    window.addEventListener("click", this.finishDrawing);
  };

  private finishDrawing = () => {
    this._state = "IDLE";
    window.removeEventListener("click", this.finishDrawing);
    this.transform(false);
  };

  private pick = () => {
    if (this._transformActive) return;
    this.faces.select(false);
    this._selected = null;
    const result = this._caster.cast([this.faces.mesh])[0];
    if (!result || result.faceIndex === undefined) return;
    const faceID = this.faces.getFromIndex(result.faceIndex);
    if (faceID !== undefined) {
      this._selected = faceID;
      this.faces.select(true, [faceID]);
    }
  };

  private setHelperLineVisible(active: boolean) {
    if (active) {
      this._scene.add(this._lines.mesh, this._lines.vertices.mesh);
    } else {
      this._scene.remove(this._lines.mesh, this._lines.vertices.mesh);
    }
  }
}
