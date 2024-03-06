import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { Brep } from "../../../geometries";
import { IfcUtils } from "../../../utils/ifc-utils";
import { StaticElementType } from "../../Elements";
import { SimpleWindow } from "./src";

export * from "./src";

export class SimpleWindowType extends StaticElementType<SimpleWindow> {
  attributes: IFC4X3.IfcFurnishingElementType;

  shape: IFC4X3.IfcProductDefinitionShape;

  get body() {
    const geoms = this.geometries.values();
    return geoms.next().value as Brep;
  }

  constructor(model: Model) {
    super(model);

    const body = new Brep(model);
    const id = body.attributes.expressID;
    this.geometries.set(id, body);
    this.shape = IfcUtils.productDefinitionShape(model, [body.attributes]);

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
    return new SimpleWindow(this.model, this);
  }
}
