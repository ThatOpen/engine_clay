import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { createIfcEntity } from "../../utils/generics";
import { Base } from "../../base";

export type Solid = WEBIFC.IFC4X3.IfcBooleanOperand &
  WEBIFC.IfcLineObject &
  WEBIFC.IFC4X3.IfcExtrudedAreaSolid;

export type ExtrusionArgs = {
  direction: number[];
  position: number[];
  depth: number;
};

export class Extrusion {

  public mesh: THREE.InstancedMesh;
  public geometry: THREE.BufferGeometry;
  public geometryNeedsUpdate: boolean;
  public ids: number[];

  private base: Base;
  public solid: Solid;
  public material: THREE.MeshLambertMaterial;

  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
    profile: WEBIFC.IFC4X3.IfcProfileDef,
    args: ExtrusionArgs,
  ) {
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.MeshLambertMaterial();
    this.ids = [];

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, 10);
    this.mesh.count = 1;
    const identity = new THREE.Matrix4().identity();
    this.mesh.setMatrixAt(0, identity);
    this.mesh.instanceMatrix.needsUpdate = true;

    this.base = new Base(ifcAPI, modelID);
    
    this.solid = this.extrudedAreaSolid(
      profile,
      args.position,
      args.direction,
      args.depth,
    );
    this.geometryNeedsUpdate = true;

  }

  private extrudedAreaSolid(
    profile:
      | WEBIFC.IFC4X3.IfcProfileDef
      | WEBIFC.Handle<WEBIFC.IFC4X3.IfcProfileDef>,
    position: number[],
    direction: number[],
    depth: number,
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcExtrudedAreaSolid>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCEXTRUDEDAREASOLID,
      profile,
      this.base.axis2Placement3D(position).placement,
      this.base.direction(direction),
      this.base.positiveLength(depth),
    );
  }

  public regenerate() {
    this.ifcAPI.StreamMeshes(this.modelID, [this.ids[0]], (mesh) => {
      this.mesh.geometry.dispose();
      const {geometryExpressID, flatTransformation} = mesh.geometries.get(0);
      const data = this.ifcAPI.GetGeometry(this.modelID, geometryExpressID);
      this.mesh.geometry = this.getGeometry(data);

      const matrix = new THREE.Matrix4().fromArray(flatTransformation);
      this.mesh.position.set(0, 0, 0);
      this.mesh.rotation.set(0, 0, 0);
      this.mesh.scale.set(1, 1, 1);
      this.mesh.updateMatrix();
      this.mesh.applyMatrix4(matrix);
    });
  }

  private getGeometry(data: WEBIFC.IfcGeometry) {
    const index = this.ifcAPI.GetIndexArray(
      data.GetIndexData(),
      data.GetIndexDataSize(),
    );

    const vertexData = this.ifcAPI.GetVertexArray(
      data.GetVertexData(),
      data.GetVertexDataSize(),
    );

    const position = new Float32Array(vertexData.length / 2);
    const normal = new Float32Array(vertexData.length / 2);

    for (let i = 0; i < vertexData.length; i += 6) {
      position[i / 2] = vertexData[i];
      position[i / 2 + 1] = vertexData[i + 1];
      position[i / 2 + 2] = vertexData[i + 2];

      normal[i / 2] = vertexData[i + 3];
      normal[i / 2 + 1] = vertexData[i + 4];
      normal[i / 2 + 2] = vertexData[i + 5];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
    geometry.setIndex(Array.from(index));
    return geometry;
  }
}
