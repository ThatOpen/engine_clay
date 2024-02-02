import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { createIfcEntity } from "../../utils/generics";
import { Base } from "../../families/Base";

export class Extrusion extends Base {
  public mesh: THREE.InstancedMesh;
  protected geometryNeedsUpdate: boolean;
  protected ids: number[];

  constructor(
    protected ifcAPI: WEBIFC.IfcAPI,
    protected modelID: number
  ) {
    super(ifcAPI, modelID);
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshLambertMaterial();
    this.ids = [];
    this.mesh = new THREE.InstancedMesh(geometry, material, 10);
    this.mesh.count = 0;
    this.geometryNeedsUpdate = true;
  }

  protected extrudedAreaSolid(
    profile:
      | WEBIFC.IFC4X3.IfcProfileDef
      | WEBIFC.Handle<WEBIFC.IFC4X3.IfcProfileDef>,
    position: number[] | WEBIFC.IFC4X3.IfcAxis2Placement3D,
    direction: number[] | WEBIFC.IFC4X3.IfcDirection,
    length: number | WEBIFC.IFC4X3.IfcPositiveLengthMeasure
  ) {
    if (Array.isArray(position)) {
      position = this.axis2Placement3D(position).placement;
    }
    if (Array.isArray(direction)) direction = this.direction(direction);
    if (typeof length === "number") length = this.positiveLength(length);
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcExtrudedAreaSolid>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCEXTRUDEDAREASOLID,
      profile,
      position,
      direction,
      length
    );
  }

  protected rectangularProfile(
    position: WEBIFC.IFC4X3.IfcAxis2Placement2D,
    x: WEBIFC.IFC4X3.IfcPositiveLengthMeasure,
    y: WEBIFC.IFC4X3.IfcPositiveLengthMeasure
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcRectangleProfileDef>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCRECTANGLEPROFILEDEF,
      WEBIFC.IFC4X3.IfcProfileTypeEnum.AREA,
      this.label("Rectangle profile"),
      position,
      x,
      y
    );
  }

  protected updateMeshTransformations(entity: WEBIFC.IfcLineObject) {
    this.ids.push(entity.expressID);

    this.ifcAPI.StreamMeshes(this.modelID, [entity.expressID], (mesh) => {
      const geometry = mesh.geometries.get(0);
      const matrix = new THREE.Matrix4().fromArray(geometry.flatTransformation);
      this.mesh.setMatrixAt(this.mesh.count++, matrix);
    });

    this.mesh.instanceMatrix.needsUpdate = true;

    if (this.geometryNeedsUpdate) {
      this.regenerate();
      this.geometryNeedsUpdate = false;
    }
  }

  protected geometry(
    data: WEBIFC.IfcGeometry
  ): THREE.BufferGeometry<THREE.NormalBufferAttributes> {
    const index = this.ifcAPI.GetIndexArray(
      data.GetIndexData(),
      data.GetIndexDataSize()
    );

    const vertexData = this.ifcAPI.GetVertexArray(
      data.GetVertexData(),
      data.GetVertexDataSize()
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

  protected regenerate() {
    this.ifcAPI.StreamMeshes(this.modelID, [this.ids[0]], (mesh) => {
      this.mesh.geometry.dispose();
      const geometryID = mesh.geometries.get(0).geometryExpressID;
      const data = this.ifcAPI.GetGeometry(this.modelID, geometryID);
      this.mesh.geometry = this.geometry(data);
    });
  }
}
