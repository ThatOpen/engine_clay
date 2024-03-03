import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { ClayGeometry } from "../Geometry";
import { Model } from "../../base";
import { IfcUtils } from "../../utils/ifc-utils";

export class Brep extends ClayGeometry {
  ifcData: IFC.IfcFacetedBrep | IFC.IfcBooleanClippingResult;

  core: IFC.IfcFacetedBrep;

  private _baseGeometry: THREE.BufferGeometry;

  get baseGeometry() {
    return this._baseGeometry;
  }

  set baseGeometry(geometry: THREE.BufferGeometry) {
    this.disposePreviousBrep();
    this._baseGeometry = geometry;
    this.core = this.getBrep();

    if (this.firstClipping !== null) {
      const firstBool = this.clippings.get(this.firstClipping);
      if (!firstBool) {
        throw new Error("Malformed bool!");
      }
      const { bool } = firstBool;
      bool.FirstOperand = this.core;
      this.model.set(bool);
    }
    this.update();
  }

  constructor(model: Model, geometry: THREE.BufferGeometry) {
    super(model);
    this._baseGeometry = geometry;
    this.core = this.getBrep();
    this.ifcData = this.core;
    this.update();
  }

  update() {
    this.model.set(this.core);
  }

  private getBrep() {
    const position = this._baseGeometry.getAttribute("position");
    const index = this._baseGeometry.getIndex();

    const ifcClosedShell = new IFC.IfcClosedShell([]);

    if (position && index) {
      const positions = position.array as Float32Array;
      const indices = index.array as Uint16Array;

      for (let i = 0; i < indices.length; i += 3) {
        const vertex1 = new THREE.Vector3().fromArray(
          positions,
          indices[i] * 3
        );
        const vertex2 = new THREE.Vector3().fromArray(
          positions,
          indices[i + 1] * 3
        );
        const vertex3 = new THREE.Vector3().fromArray(
          positions,
          indices[i + 2] * 3
        );

        const triangle = [vertex1, vertex2, vertex3];
        const ifcFace = this.triangleToIFCFace(triangle);

        ifcClosedShell.CfsFaces.push(ifcFace);
      }
    }

    return new IFC.IfcFacetedBrep(ifcClosedShell);
  }

  private triangleToIFCFace(triangle: THREE.Vector3[]) {
    const points = triangle.map((vertex) => IfcUtils.point(vertex));
    const polyLoop = new IFC.IfcPolyLoop(points);
    const faceBound = new IFC.IfcFaceBound(polyLoop, new IFC.IfcBoolean("T"));
    return new IFC.IfcFace([faceBound]);
  }

  private disposePreviousBrep() {
    const outer = this.model.get(this.core.Outer);
    for (const faceRef of outer.CfsFaces) {
      const face = this.model.get(faceRef);
      for (const faceBoundRef of face.Bounds) {
        const faceBound = this.model.get(faceBoundRef) as IFC.IfcFaceBound;
        const polyLoop = this.model.get(faceBound.Bound) as IFC.IfcPolyLoop;
        for (const pointRef of polyLoop.Polygon) {
          const point = this.model.get(pointRef);
          this.model.delete(point);
        }
        this.model.delete(polyLoop);
        this.model.delete(faceBound);
      }
    }
    this.model.delete(outer);
  }
}
