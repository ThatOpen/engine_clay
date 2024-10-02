import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";
import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import * as WEBIFC from "web-ifc";
import { ClayObject } from "../../Object";
import { Model } from "../../Model";
import { ClayElementType } from "../ElementType";
import { IfcUtils } from "../../../utils/ifc-utils";
import { ClayGeometry } from "../../Geometry";

/**
 * Any object with a physical representation in the IFC. It corresponds to the IFCELEMENT entity in the IFC schema.
 */
export abstract class ClayElement extends ClayObject {
  /**
   * {@link ClayObject.attributes}
   */
  abstract attributes: IFC.IfcElement;

  /**
   * Position of this element in 3D space.
   */
  position = new THREE.Vector3();

  /**
   * Rotation of this element in 3D space.
   */
  rotation = new THREE.Euler();

  /**
   * The type of this element.
   */
  type: ClayElementType;

  /**
   * The geometry IDs of this element.
   */
  geometries = new Set<number>();

  /**
   * The list of IFC links to the Elements that create subtractions in this element.
   */
  subtractions = new Map<number, IFC.IfcRelVoidsElement>();

  /**
   * The list of all meshes of the fragments that compose this element.
   */
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

  protected constructor(model: Model, type: ClayElementType) {
    super(model);
    this.type = type;
  }

  /**
   * Updates this element both in the IFC model and in the 3D scene.
   * @param updateGeometry whether to update the geometries of the fragments that compose this element.
   */
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

  /**
   * Adds a new subtraction to this element.
   * @param subtraction the element that will be subtracted from this element.
   */
  async addSubtraction(subtraction: ClayElement) {
    if (!(subtraction.attributes instanceof IFC.IfcFeatureElementSubtraction)) {
      throw new Error(
        "Only elements with attributes of type IfcFeatureElementSubtraction can be used to subtract",
      );
    }

    const voids = new IFC.IfcRelVoidsElement(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      this.attributes,
      subtraction.attributes,
    );

    this.model.set(voids);

    const id = subtraction.attributes.expressID;
    this.subtractions.set(id, voids);

    await this.model.update();
  }

  /**
   * Removes an existing subtraction from this element.
   * @param subtraction the element whose subtraction will be removed from this element.
   */
  async removeSubtraction(subtraction: ClayElement) {
    const id = subtraction.attributes.expressID;
    const found = this.subtractions.get(id);
    if (!found) return;
    this.model.delete(found);
    await this.model.update();
  }

  protected ifcToThreeGeometry(data: WEBIFC.IfcGeometry) {
    const index = this.model.ifcAPI.GetIndexArray(
      data.GetIndexData(),
      data.GetIndexDataSize(),
    );

    const vertexData = this.model.ifcAPI.GetVertexArray(
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
    return geometry as FRAGS.IndexedGeometry;
  }

  protected updateGeometryID() {
    // When performing boolean operations, web-ifc creates new geometry IDs
    // If this happens, we need to update the data and remove the old geometry
    const modelID = this.model.modelID;
    const id = this.attributes.expressID;
    this.model.ifcAPI.StreamMeshes(modelID, [id], (ifcMesh) => {
      const newGeometry = ifcMesh.geometries.get(0);
      const newGeomID = newGeometry.geometryExpressID;
      const oldGeomID = this.geometries.values().next().value;

      if (newGeomID === oldGeomID) {
        return;
      }

      this.geometries.clear();
      this.geometries.add(newGeomID);

      const frag = this.type.fragments.get(oldGeomID) as FRAGS.Fragment;
      this.type.fragments.delete(oldGeomID);
      this.type.fragments.set(newGeomID, frag);

      const geometry = this.type.geometries.get(oldGeomID) as ClayGeometry;
      this.type.geometries.delete(oldGeomID);
      this.type.geometries.set(newGeomID, geometry);

      this.model.delete(oldGeomID);
    });
  }

  protected updateIfcElement() {
    const placement = this.model.get(
      this.attributes.ObjectPlacement,
    ) as IFC.IfcLocalPlacement;

    const relPlacement = this.model.get(
      placement.RelativePlacement,
    ) as IFC.IfcAxis2Placement3D;

    IfcUtils.setAxis2Placement(
      this.model,
      relPlacement,
      this.position,
      this.rotation,
    );

    this.model.set(this.attributes);
  }
}
