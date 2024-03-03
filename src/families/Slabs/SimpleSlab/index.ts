import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model } from "../../../base";
import { Family } from "../../Family";
import { Extrusion, RectangleProfile } from "../../../geometries";
import { IfcUtils } from "../../../utils/ifc-utils";

export class SimpleSlab extends Family {
  ifcData: IFC.IfcSlab;

  geometries: { body: Extrusion<RectangleProfile> };

  get thickness() {
    return this.geometries.body.depth;
  }

  set thickness(value: number) {
    this.geometries.body.depth = value;
  }

  constructor(model: Model) {
    super(model);

    const profile = new RectangleProfile(model);
    this.geometries = { body: new Extrusion(model, profile) };

    const { body } = this.geometries;
    body.depth = 0.3;
    body.profile.dimension.x = 5;
    body.profile.dimension.y = 10;

    const representation = IfcUtils.shapeRepresentation(this.model);
    representation.Items = [body.ifcData];
    const placement = IfcUtils.localPlacement();
    const shape = new IFC.IfcProductDefinitionShape(null, null, [
      representation,
    ]);

    const label = "Simple slab";

    this.ifcData = new IFC.IfcSlab(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      new IFC.IfcLabel(label),
      null,
      new IFC.IfcLabel(label),
      placement,
      shape,
      new IFC.IfcIdentifier(label),
      null
    );

    this.update();
  }

  update(): void {
    const { body } = this.geometries;
    body.profile.update();
    body.update();
    this.updateElement();
  }
}
