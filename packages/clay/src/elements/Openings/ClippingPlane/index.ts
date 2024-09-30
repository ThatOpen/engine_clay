import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { StaticClayElementType, Model } from "../../../core";
import { ClippingPlane } from "./src";
import { HalfSpace } from "../../../geometries";

import { IfcUtils } from "../../../utils/ifc-utils";

export * from "./src";

export class ClippingPlaneType extends StaticClayElementType<ClippingPlane> {
  attributes: IFC4X3.IfcElementType;

  shape: IFC4X3.IfcProductDefinitionShape;

  get body() {
    const geoms = this.geometries.values();
    return geoms.next().value as HalfSpace;
  }

  constructor(model: Model) {
    super(model);

    const body = new HalfSpace(model);
    this.geometries.set(body.attributes.expressID, body);
    this.shape = IfcUtils.productDefinitionShape(model, [body.attributes]);

    this.attributes = new IFC.IfcElementType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );

    this.model.set(this.attributes);
  }

  update() {
    // super.update(false);
  }

  protected createElement() {
    return new ClippingPlane(this.model, this);
  }
}
