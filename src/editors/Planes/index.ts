import * as THREE from "three";
import * as OBC from "openbim-components";
import { Faces } from "../../primitives";

export type PlaneTransformMode = "TRANSLATE" | "ROTATE" | "SCALE";

export class Planes {
  faces = new Faces();
  transformMode: PlaneTransformMode = "TRANSLATE";

  private _components: OBC.Components;
  private _enabled = false;

  private _selected: number | null = null;
  private _helperPlane: THREE.Mesh;

  private _transformActive = false;
  private _previousTransform = new THREE.Matrix4();
  private _newTransform = new THREE.Matrix4();

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

    const helperMaterial = new THREE.MeshBasicMaterial({ side: 2 });
    const helperGeometry = new THREE.PlaneGeometry(1000, 1000, 1000);
    this._helperPlane = new THREE.Mesh(helperGeometry, helperMaterial);
    this._helperPlane.visible = false;

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
    this._transformActive = active;

    if (!active) {
      this.faces.mesh.geometry.computeBoundingSphere();
      this.faces.mesh.geometry.computeBoundingBox();
      window.removeEventListener("mousemove", this.updateTransform);
      return;
    }

    if (this._selected === null) return;

    const center = this.faces.getCenter(this._selected);
    const normal = this.faces.getNormal(this._selected);
    if (center === null || normal === null) return;

    const [x, y, z] = center;
    const [nx, ny, nz] = normal;
    this._helperPlane.position.set(x, y, z);
    this._helperPlane.lookAt(x + nx, y + ny, z + nz);
    this._helperPlane.updateMatrix();
    this._helperPlane.updateMatrixWorld();

    const result = this._components.raycaster.castRay([this._helperPlane]);
    if (result === null) return;
    console.log(normal);
    console.log(result.point.y);

    this._previousTransform.setPosition(result.point);
    this._newTransform.setPosition(result.point);

    window.addEventListener("mousemove", this.updateTransform);
  }

  private updateTransform = () => {
    const result = this._components.raycaster.castRay([this._helperPlane]);
    if (result === null) return;
    this._newTransform.setPosition(result.point);
    const temp = this._newTransform.clone();
    temp.multiply(this._previousTransform.invert());

    if (this.transformMode === "TRANSLATE") {
      this.faces.transform(temp);
    } else if (this.transformMode === "ROTATE") {
      console.log(temp);
    } else if (this.transformMode === "SCALE") {
      console.log(temp);
    }

    this._previousTransform.copy(this._newTransform);
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
}
