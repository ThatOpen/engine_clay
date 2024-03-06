import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { StaticElementType } from "../../Elements/StaticElementType";
import { SimpleOpening } from "./src";
import { Extrusion, RectangleProfile } from "../../../geometries";
import { Model } from "../../../base";
import { IfcUtils } from "../../../utils/ifc-utils";

export * from "./src";

export class SimpleOpeningType extends StaticElementType<SimpleOpening> {
  attributes: IFC4X3.IfcElementType;

  shape: IFC4X3.IfcProductDefinitionShape;

  height = 1;

  width = 1;

  length = 1;

  get body() {
    const geoms = this.geometries.values();
    return geoms.next().value as Extrusion<RectangleProfile>;
  }

  constructor(model: Model) {
    super(model);

    const profile = new RectangleProfile(model);
    const body = new Extrusion(model, profile);
    const id = body.attributes.expressID;
    this.geometries.set(id, body);
    this.shape = IfcUtils.productDefinitionShape(model, [body.attributes]);

    const fragment = this.newFragment();
    fragment.mesh.material = [this.model.materialT];
    this.fragments.set(id, fragment);

    this.attributes = new IFC.IfcElementType(
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

    this.model.set(this.attributes);
  }

  update(updateGeometry: boolean = false) {
    this.body.profile.dimension.x = this.width;
    this.body.profile.dimension.y = this.length;
    this.body.profile.update();
    this.body.depth = this.height;
    this.body.update();

    super.update(updateGeometry);
  }

  protected createElement() {
    return new SimpleOpening(this.model, this);
  }
}
