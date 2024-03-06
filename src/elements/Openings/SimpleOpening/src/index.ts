import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Element } from "../../../Elements/Element";
import { SimpleOpeningType } from "../index";
import { Model } from "../../../../base";
import { IfcUtils } from "../../../../utils/ifc-utils";

export class SimpleOpening extends Element {
  attributes: IFC.IfcOpeningElement;

  type: SimpleOpeningType;

  constructor(model: Model, type: SimpleOpeningType) {
    super(model, type);
    this.type = type;

    const placement = IfcUtils.localPlacement();

    this.geometries.add(type.body.attributes.expressID);

    this.attributes = new IFC.IfcOpeningElement(
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
