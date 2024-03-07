import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { StaticElementType } from "../../Elements/StaticElementType";
import { SimpleFurniture } from "./src";
import { Brep } from "../../../geometries";
import { IfcUtils } from "../../../utils/ifc-utils";

export * from "./src";

export class SimpleFurnitureType extends StaticElementType<SimpleFurniture> {
  attributes: IFC.IfcFurnishingElementType;

  shape: IFC.IfcProductDefinitionShape;

  body: Brep;

  constructor(model: Model) {
    super(model);


    this.body = new Brep(model);
    const id = this.body.attributes.expressID;
    this.geometries.set(id, this.body);
    this.shape = IfcUtils.productDefinitionShape(model, [this.body.attributes]);

    const fragment = this.newFragment();
    this.fragments.set(id, fragment);

    this.attributes = new IFC.IfcFurnishingElementType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    );
  }

  protected createElement() {
    return new SimpleFurniture(this.model, this);
  }
}
