import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { ClayElement, Model } from "../../../../core";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { ClippingPlaneType } from "../index";

export class ClippingPlane extends ClayElement {
  attributes: IFC.IfcOpeningElement;

  type: ClippingPlaneType;

  constructor(model: Model, type: ClippingPlaneType) {
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
      null,
    );

    this.model.set(this.attributes);
  }

  update() {
    // super.update(updateGeometry);
    this.updateIfcElement();
  }
}
