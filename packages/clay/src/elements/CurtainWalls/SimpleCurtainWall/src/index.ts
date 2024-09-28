import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model, ClayElement } from "../../../../core";
import { IfcUtils } from "../../../../utils/ifc-utils";

import { SimpleCurtainWallType } from "../index";

export class SimpleCurtainWall extends ClayElement {
  attributes: IFC.IfcCurtainWall;

  type: SimpleCurtainWallType;

  constructor(model: Model, type: SimpleCurtainWallType) {
    super(model, type);
    this.type = type;

    const placement = IfcUtils.localPlacement();

    for (const [id] of type.geometries) {
      this.geometries.add(id);
    }

    this.attributes = new IFC.IfcCurtainWall(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      placement,
      type.shape,
      null,
      null,
    );

    this.model.set(this.attributes);
  }
}
