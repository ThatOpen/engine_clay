import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../../base";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Element } from "../../../Elements/Element";
import { SimpleWindowType } from "../index";

export class SimpleWindow extends Element {
  attributes: IFC.IfcFurnishingElement;

  type: SimpleWindowType;

  constructor(model: Model, type: SimpleWindowType) {
    super(model, type);
    this.type = type;

    const placement = IfcUtils.localPlacement();

    this.geometries.add(type.body.attributes.expressID);

    this.attributes = new IFC.IfcFurnishingElement(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      placement,
      type.shape,
      null
    );

    this.update();
  }
}
