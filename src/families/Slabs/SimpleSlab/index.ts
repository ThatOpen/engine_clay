import * as WEBIFC from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { Family } from "../../Family";
import {
  Extrusion,
  RectangleProfile,
} from "../../../geometries";

export class SimpleSlab extends Family {
  ifcData: WEBIFC.IFC4X3.IfcSlab;

  geometries: {body: Extrusion<RectangleProfile>};

  get thickness() {
    return this.geometries.body.depth;
  }

  set thickness(value: number) {
    this.geometries.body.depth = value;
  }

  get mesh() {
    return this.geometries.body.mesh;
  }

  constructor(model: Model) {
    super(model);

    const profile = new RectangleProfile(model);
    this.geometries = {body: new Extrusion(model, profile)};

    const {body} = this.geometries;
    body.depth = 0.3;
    body.profile.dimension.x = 5;
    body.profile.dimension.y = 10;

    const representation = this.model.shapeRepresentation("Body", "SweptSolid", [body.ifcData]);
    const shape = this.model.productDefinitionShape([representation]);

    const label = "Simple slab";

    this.ifcData = model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcSlab>(
        WEBIFC.IFCSLAB,
        this.model.guid(uuidv4()),
        null,
        this.model.label(label),
        null,
        this.model.label(label),
        this.model.localPlacement(),
        shape,
        this.model.identifier(label),
        null,
    );

    this.update();
  }

  update(): void {
    const {body} = this.geometries;
    body.profile.update();
    body.update();
  }
}
