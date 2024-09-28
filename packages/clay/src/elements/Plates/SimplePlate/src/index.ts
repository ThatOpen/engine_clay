import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import * as THREE from "three";
import { ClayElement, Model } from "../../../../core";

import { SimplePlateType } from "..";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Extrusion, RectangleProfile } from "../../../../geometries";

export class SimplePlate extends ClayElement {
  attributes: IFC.IfcPlate;

  body: Extrusion<RectangleProfile>;

  type: SimplePlateType;

  constructor(model: Model, type: SimplePlateType) {
    super(model, type);
    this.type = type;

    const placement = IfcUtils.localPlacement();

    const profile = new RectangleProfile(model);
    profile.dimension.x = 0.0833333333333333;
    profile.dimension.y = 1.9238;
    profile.dimension.z = 1;
    profile.position = new THREE.Vector3(0, 0, 0);
    profile.update();

    this.body = new Extrusion(model, profile);
    const id = this.body.attributes.expressID;
    this.type.geometries.set(id, this.body);
    this.geometries.add(id);

    this.attributes = new IFC.IfcPlate(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      placement,
      IfcUtils.productDefinitionShape(model, [this.body.attributes]),
      null,
      type.plateType,
    );

    this.model.set(this.attributes);
  }
}
