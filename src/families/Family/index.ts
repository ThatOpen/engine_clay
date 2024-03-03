import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { ClayObject, Model } from "../../base";
import { Opening } from "../Opening";
import { IfcUtils } from "../../utils/ifc-utils";

export abstract class Family extends ClayObject {
  abstract ifcData: IFC.IfcElement;
  abstract geometries: { [name: string]: ClayObject };

  mesh: THREE.InstancedMesh;

  position = new THREE.Vector3();

  rotation = new THREE.Euler();

  openings = new Map<number, IFC.IfcRelVoidsElement>();

  constructor(model: Model) {
    super(model);
    this.mesh = this.newThreeMesh();
  }

  addOpening(opening: Opening) {
    const voids = new IFC.IfcRelVoidsElement(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      this.ifcData,
      opening.ifcData
    );

    this.model.set(voids);

    const id = opening.ifcData.expressID;
    this.openings.set(id, voids);

    this.model.update();
  }

  removeOpening(opening: Opening) {
    const id = opening.ifcData.expressID;
    const found = this.openings.get(id);
    if (!found) return;
    this.model.delete(found);
    this.model.update();
  }

  updateElement() {
    const placement = this.model.get(
      this.ifcData.ObjectPlacement
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

    this.model.set(this.ifcData);
    this.setMesh(this.ifcData.expressID, this.mesh);
  }
}
