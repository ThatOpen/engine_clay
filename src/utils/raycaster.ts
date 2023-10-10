import * as THREE from "three";

export class Raycaster {
  core: THREE.Raycaster;
  private _mouse = new THREE.Vector2();

  domElement?: HTMLCanvasElement;
  camera?: THREE.Camera;

  private _mouseEvent = new THREE.Vector2();
  private _trackMouse = false;

  get trackMouse() {
    return this._trackMouse;
  }

  set trackMouse(active: boolean) {
    this._trackMouse = active;
    if (active) {
      window.addEventListener("mousemove", this.getMousePosition);
    } else {
      window.removeEventListener("mousemove", this.getMousePosition);
    }
  }

  constructor() {
    this.core = new THREE.Raycaster();
    if (!this.core.params.Points) {
      throw new Error("Raycaster has undefined Points");
    }

    this.core.params.Points.threshold = 0.2;
  }

  cast(items: THREE.Object3D[]) {
    if (!this.domElement || !this.camera) {
      throw new Error("DOM element and camera must be initialized!");
    }

    const x = this._mouseEvent.x;
    const y = this._mouseEvent.y;
    const b = this.domElement.getBoundingClientRect();
    this._mouse.x = ((x - b.left) / (b.right - b.left)) * 2 - 1;
    this._mouse.y = -((y - b.top) / (b.bottom - b.top)) * 2 + 1;

    this.core.setFromCamera(this._mouse, this.camera);
    return this.core.intersectObjects(items);
  }

  private getMousePosition = (event: MouseEvent) => {
    this._mouseEvent.x = event.clientX;
    this._mouseEvent.y = event.clientY;
  };
}
