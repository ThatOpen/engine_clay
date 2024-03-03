import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { Model } from "./model";

export abstract class ClayObject {
  model: Model;

  abstract ifcData: WEBIFC.IfcLineObject;

  abstract update(): void;

  protected constructor(model: Model) {
    this.model = model;
  }

  setMesh(id: number, mesh: THREE.Mesh) {
    const modelID = this.model.modelID;
    this.model.ifcAPI.StreamMeshes(modelID, [id], (ifcMesh) => {
      mesh.geometry.dispose();
      const { geometryExpressID, flatTransformation } =
        ifcMesh.geometries.get(0);
      const data = this.model.ifcAPI.GetGeometry(modelID, geometryExpressID);
      mesh.geometry = this.ifcToThreeGeometry(data);
      const matrix = new THREE.Matrix4().fromArray(flatTransformation);
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
      mesh.updateMatrix();
      mesh.applyMatrix4(matrix);
    });
  }

  newThreeMesh() {
    const geometry = new THREE.BufferGeometry();
    const mesh = new THREE.InstancedMesh(geometry, this.model.material, 1);
    mesh.frustumCulled = false;
    const identity = new THREE.Matrix4().identity();
    mesh.setMatrixAt(0, identity);
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  private ifcToThreeGeometry(data: WEBIFC.IfcGeometry) {
    const index = this.model.ifcAPI.GetIndexArray(
      data.GetIndexData(),
      data.GetIndexDataSize()
    );

    const vertexData = this.model.ifcAPI.GetVertexArray(
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
}
