import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { ClayGeometry } from "../Geometry";
import { Model } from "../../base";
import { IfcGetter } from "../../base/ifc-getter";

export class Brep extends ClayGeometry {
  ifcData: IFC.IfcFacetedBrep | IFC.IfcBooleanClippingResult;

  core: IFC.IfcFacetedBrep;

  mesh: THREE.InstancedMesh;

  baseGeometry: THREE.BufferGeometry;

  constructor(model: Model, geometry: THREE.BufferGeometry) {
    super(model);
    this.mesh = this.newThreeMesh();
    this.baseGeometry = geometry;
    this.core = this.getBrep();
    this.ifcData = this.core;
    this.update();
  }

  update() {
    this.model.set(this.core);
    this.setMesh(this.ifcData.expressID, this.mesh);
  }

  private getBrep() {
    const position = this.baseGeometry.getAttribute("position");
    const index = this.baseGeometry.getIndex();

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
    const points = triangle.map((vertex) => IfcGetter.point(vertex));
    const polyLoop = new IFC.IfcPolyLoop(points);
    const faceBound = new IFC.IfcFaceBound(polyLoop, new IFC.IfcBoolean("T"));
    return new IFC.IfcFace([faceBound]);
  }
}
