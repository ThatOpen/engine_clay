import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { StaticElementType } from "../../Elements/StaticElementType";
import { SimpleFurniture } from "./src";
import { Brep } from "../../../geometries";
import { IfcUtils } from "../../../utils/ifc-utils";

export * from "./src";

export class SimpleFurnitureType extends StaticElementType<SimpleFurniture> {
  import(): void {
  }
  attributes: IFC.IfcFurnishingElementType;

  shape: IFC.IfcProductDefinitionShape;

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
    return new SimpleFurniture(this.model, this);
  }
}
