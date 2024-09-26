import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../../base";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Element } from "../../../Elements/Element";
import { SimpleCurtainWallType } from "../index";

export class SimpleCurtainWall extends Element {
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
      null
    );

    this.model.set(this.attributes);
  }
}
