import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model } from "../../../../base";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Element } from "../../../Elements";
import { SimpleSlabType } from "../index";
import { Extrusion, RectangleProfile } from "../../../../geometries";

export class SimpleSlab extends Element {
  attributes: IFC.IfcSlab;

  type: SimpleSlabType;

  body: Extrusion<RectangleProfile>;

  thickness = 0.3;

  constructor(model: Model, type: SimpleSlabType) {
    super(model, type);
    this.type = type;

    const profile = new RectangleProfile(model);
    this.body = new Extrusion(model, profile);
    const id = this.body.attributes.expressID;
    this.type.geometries.set(id, this.body);
    this.geometries.add(id);

    const placement = IfcUtils.localPlacement();
    const shape = IfcUtils.productDefinitionShape(model, [this.body.attributes]);

    this.attributes = new IFC.IfcSlab(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      placement,
      shape,
      null,
      null
    );

    this.update();
  }

  update(updateGeometry: boolean = false) {
    this.body.depth = this.thickness;
    this.body.update();
    super.update(updateGeometry);
  }
}
