import * as THREE from "three";
import { Lines } from "../../primitives";
import { Raycaster } from "../../utils";

export class Polygons {
  lines = new Lines();
  workPlane: THREE.Mesh;

  list: {
    [id: number]: {
      id: number;
      lines: Set<number>;
    };
  } = {};

  private _editMode = false;
  private _caster = new Raycaster();
  private _foundItems: THREE.Intersection[] = [];

  private _isClosingPolygon = false;
  private _newPoints: number[] = [];
  private _newLines: number[] = [];
  private _firstPointID: number | null = null;

  private _nextIndex = 0;

  get items() {
    return [this.lines.mesh, this.lines.vertices.mesh, this.workPlane];
  }

  get editMode() {
    return this._editMode;
  }

  set editMode(active: boolean) {
    this.workPlane.visible = active;
    this._caster.trackMouse = active;
    this._editMode = active;

    if (active) {
      window.addEventListener("mousemove", this.update);
    } else {
      window.removeEventListener("mousemove", this.update);
    }

    const wasPolygonInProcess = Boolean(this._newPoints.length);
    const wasDrawingCancelled = wasPolygonInProcess && !active;
    if (wasDrawingCancelled) {
      this.cancel();
    }
  }

  set camera(camera: THREE.Camera) {
    this._caster.camera = camera;
  }

  set domElement(element: HTMLCanvasElement) {
    this._caster.domElement = element;
  }

  constructor() {
    this.workPlane = this.newWorkPlane();
  }

  add() {
    if (!this._editMode) return;
    if (!this._foundItems.length) return;

    if (this._isClosingPolygon) {
      this.finishPolygon();
      return;
    }

    const { x, y, z } = this._foundItems[0].point;

    if (!this._newPoints.length) {
      const [firstPoint] = this.lines.addPoints([[x, y, z]]);
      this._firstPointID = firstPoint;
      this._newPoints.push(firstPoint);
    }

    const previousPoint = this._newPoints[this._newPoints.length - 1];
    const [newPoint] = this.lines.addPoints([[x, y, z]]);
    this._newPoints.push(newPoint);

    const [newLine] = this.lines.add([previousPoint, newPoint]);
    this._newLines.push(newLine);

    this.lines.vertices.mesh.geometry.computeBoundingSphere();
  }

  private update = () => {
    this._foundItems = this._caster.cast([
      this.workPlane,
      this.lines.vertices.mesh,
    ]);

    if (this.editMode) {
      this.updateCurrentPoint();
    }
  };

  private cancel() {
    this.lines.removePoints(this._newPoints);
    this._newPoints.length = 0;
    this._newLines.length = 0;
    this._firstPointID = null;
  }

  private addPolygon(lines: number[]) {
    const id = this._nextIndex++;
    this.list[id] = {
      id,
      lines: new Set(lines),
    };
    return id;
  }

  private finishPolygon() {
    const last = this._newPoints.pop();
    if (last !== undefined) {
      this.lines.removePoints([last]);
    }

    this._newLines.pop();

    const lastPoint = this._newPoints[this._newPoints.length - 1];
    const firstPoint = this._newPoints[0];
    const [newLine] = this.lines.add([lastPoint, firstPoint]);
    this._newLines.push(newLine);

    this.addPolygon(this._newLines);

    this._newLines.length = 0;
    this._newPoints.length = 0;
    this._isClosingPolygon = false;
    this._firstPointID = null;
  }

  private updateCurrentPoint() {
    if (!this._foundItems.length || this._firstPointID === null) {
      this._isClosingPolygon = false;
      return;
    }

    const lastIndex = this._newPoints.length - 1;
    const lastPoint = this._newPoints[lastIndex];

    let foundFirstPoint = false;
    let basePlane: THREE.Intersection | null = null;

    const index = this.lines.vertices.idMap.getIndex(this._firstPointID);

    for (const item of this._foundItems) {
      if (item.object === this.workPlane) {
        basePlane = item;
      }
      if (item.object === this.lines.vertices.mesh && item.index === index) {
        foundFirstPoint = true;
      }
    }

    if (foundFirstPoint) {
      const coords = this.lines.vertices.get(this._firstPointID);
      if (coords) {
        const [x, y, z] = coords;
        this.lines.setPoint(lastPoint, [x, y, z]);
        this._isClosingPolygon = true;
        return;
      }
    } else if (basePlane) {
      const { x, y, z } = basePlane.point;
      this.lines.setPoint(lastPoint, [x, y, z]);
    }

    this._isClosingPolygon = false;
  }

  private newWorkPlane() {
    const floorPlaneGeom = new THREE.PlaneGeometry(10, 10);
    const floorPlaneMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.7,
      color: 0xc4adef,
    });
    const plane = new THREE.Mesh(floorPlaneGeom, floorPlaneMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.visible = false;
    return plane;
  }
}
