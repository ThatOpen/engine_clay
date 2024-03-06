import * as THREE from "three";
import * as FRAGS from "bim-fragment";
import * as WEBIFC from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { ClayObject, Model } from "../../../base";
import { ElementType } from "../ElementType";
import { IfcUtils } from "../../../utils/ifc-utils";
import { SimpleOpening } from "../../Openings";
// import { Opening } from "../Opening";
// import { IfcUtils } from "../../utils/ifc-utils";

export abstract class Element extends ClayObject {
  abstract attributes: IFC.IfcElement;

  position = new THREE.Vector3();

  rotation = new THREE.Euler();

  type: ElementType;

  geometries = new Set<number>();

  openings = new Map<number, IFC.IfcRelVoidsElement>();

  get meshes() {
    const meshes: FRAGS.FragmentMesh[] = [];
    for (const id of this.geometries) {
      const fragment = this.type.fragments.get(id);
      if (!fragment) {
        throw new Error("Fragment not found!");
      }
      meshes.push(fragment.mesh);
    }
    return meshes;
  }

  protected constructor(model: Model, type: ElementType) {
    super(model);
    this.type = type;
  }

  update(updateGeometry = false) {
    this.updateIfcElement();
    const modelID = this.model.modelID;
    const id = this.attributes.expressID;
    const tempMatrix = new THREE.Matrix4();
    this.model.ifcAPI.StreamMeshes(modelID, [id], (ifcMesh) => {
      const size = ifcMesh.geometries.size();
      for (let i = 0; i < size; i++) {
        const geometry = ifcMesh.geometries.get(i);
        const geomID = geometry.geometryExpressID;
        const transformArray = geometry.flatTransformation;
        const fragment = this.type.fragments.get(geomID);
        if (!fragment) {
          throw new Error("Fragment not found!");
        }
        const instances = fragment.getInstancesIDs(id);
        if (!instances) {
          throw new Error("Instances not found!");
        }
        tempMatrix.fromArray(transformArray);
        for (const instance of instances) {
          fragment.mesh.setMatrixAt(instance, tempMatrix);
        }
        fragment.mesh.instanceMatrix.needsUpdate = true;

        if (updateGeometry) {
          fragment.mesh.geometry.dispose();
          const data = this.model.ifcAPI.GetGeometry(modelID, geomID);
          fragment.mesh.geometry = this.ifcToThreeGeometry(data);
          const size = fragment.mesh.geometry.index.count;
          fragment.mesh.geometry.clearGroups();
          fragment.mesh.geometry.addGroup(0, size);
        }
      }
    });
  }

  private updateIfcElement() {
    const placement = this.model.get(
      this.attributes.ObjectPlacement
    ) as IFC.IfcLocalPlacement;

    const relPlacement = this.model.get(
      placement.RelativePlacement
    ) as IFC.IfcAxis2Placement3D;

    IfcUtils.setAxis2Placement(
      this.model,
      relPlacement,
      this.position,
      this.rotation
    );

    this.model.set(this.attributes);
  }

  addOpening(opening: SimpleOpening) {
    const voids = new IFC.IfcRelVoidsElement(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      this.attributes,
      opening.attributes
    );

    this.model.set(voids);

    const id = opening.attributes.expressID;
    this.openings.set(id, voids);

    this.model.update();
  }

  removeOpening(opening: SimpleOpening) {
    const id = opening.attributes.expressID;
    const found = this.openings.get(id);
    if (!found) return;
    this.model.delete(found);
    this.model.update();
  }

  protected ifcToThreeGeometry(data: WEBIFC.IfcGeometry) {
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
    return geometry as FRAGS.IndexedGeometry;
  }
}
