import * as THREE from "three";
import * as OBC from "openbim-components";
import { Faces, Lines } from "../../primitives";

export type PlaneTransformMode = "TRANSLATE" | "ROTATE" | "SCALE";

type TransformState =
  | "IDLE"
  | "ANGLE_AXIS_1"
  | "ANGLE_AXIS_2"
  | "ANGLE_FINISHING";

export class Planes {
  faces = new Faces();

  private _enabled = false;
  private transformMode: PlaneTransformMode = "TRANSLATE";

  private _components: OBC.Components;

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

  private _transformActive = false;
  private _previousTransform = new THREE.Matrix4();
  private _newTransform = new THREE.Matrix4();

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

  constructor(components: OBC.Components) {
    this._components = components;
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

    const scene = components.scene.get();
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

    const camera = this._components.camera.get();
    this._helperPlane.rotation.copy(camera.rotation);
    this._helperPlane.updateMatrix();
    this._helperPlane.updateMatrixWorld();

    const result = this._components.raycaster.castRay([this._helperPlane]);
    if (result === null) {
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

    if (this.transformMode === "TRANSLATE") {
      window.addEventListener("click", this.finishDrawing);
    } else if (this.transformMode === "ROTATE") {
      this._state = "ANGLE_AXIS_1";
      window.addEventListener("click", this.startDrawingAngle);
    }

    window.addEventListener("mousemove", this.updateTransform);
  }

  private updateTransform = () => {
    const result = this._components.raycaster.castRay([this._helperPlane]);
    if (result === null) return;

    const { x, y, z } = result.point;

    if (this.transformMode === "TRANSLATE") {
      this._newTransform.setPosition(result.point);
      const temp = this._newTransform.clone();
      temp.multiply(this._previousTransform.invert());
      this._lines.setPoint(this._helperLine1.end, [x, y, z]);
      this.faces.transform(temp);
    } else if (this.transformMode === "ROTATE") {
      if (this._state === "ANGLE_AXIS_1") {
        this._lines.setPoint(this._helperLine1.end, [x, y, z]);
      } else {
        this._lines.setPoint(this._helperLine2.end, [x, y, z]);

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
        const camera = this._components.camera.get();
        axis.applyEuler(camera.rotation);
        this._q.setFromAxisAngle(axis, angle);

        console.log(angle);

        this._newTransform.identity();

        const move = new THREE.Matrix4().makeTranslation(
          this._v1.x,
          this._v1.y,
          this._v1.z
        );

        const rotation = new THREE.Matrix4();
        rotation.makeRotationFromQuaternion(this._q);

        const invMove = move.clone().invert();

        this._newTransform.multiply(move);
        this._newTransform.multiply(rotation);
        this._newTransform.multiply(invMove);
        this._newTransform.multiply(this._helperPlane.matrix);

        const temp = this._newTransform.clone();

        if (this._state === "ANGLE_AXIS_2") {
          this._state = "ANGLE_FINISHING";
          this._previousTransform = this._newTransform.clone();
        }

        temp.multiply(this._previousTransform.invert());
        this.faces.transform(temp);
      }
    } else if (this.transformMode === "SCALE") {
      console.log("scale");
    }

    this._previousTransform.copy(this._newTransform);
  };

  private startDrawingAngle = () => {
    this._state = "ANGLE_AXIS_2";
    window.removeEventListener("click", this.startDrawingAngle);
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
    const result = this._components.raycaster.castRay([this.faces.mesh]);
    if (result === null || result.faceIndex === undefined) return;
    const faceID = this.faces.getFromIndex(result.faceIndex);
    if (faceID !== undefined) {
      this._selected = faceID;
      this.faces.select(true, [faceID]);
    }
  };

  private setHelperLineVisible(active: boolean) {
    const scene = this._components.scene.get();
    if (active) {
      scene.add(this._lines.mesh, this._lines.vertices.mesh);
    } else {
      scene.remove(this._lines.mesh, this._lines.vertices.mesh);
    }
  }
}
