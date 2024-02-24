import * as WEBIFC from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { Family } from "../../Family";
import {
  Extrusion,
  RectangleProfile,
} from "../../../geometries";

export class SimpleSlab extends Family {
  data: WEBIFC.IFC4X3.IfcSlab;

  ifcGeometry: Extrusion<RectangleProfile>;

  get thickness() {
    return this.ifcGeometry.depth;
  }

  set thickness(value: number) {
    this.ifcGeometry.depth = value;
  }

  get mesh() {
    return this.ifcGeometry.mesh;
  }

  constructor(model: Model) {
    super(model);

    const profile = new RectangleProfile(model);
    this.ifcGeometry = new Extrusion(model, profile);

    const representation = this.model.shapeRepresentation("Body", "SweptSolid", [this.ifcGeometry.data]);
    const shape = this.model.productDefinitionShape([representation]);

    const label = "Simple slab";

    this.data = model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcSlab>(
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
  }

  update(): void {
    this.ifcGeometry.update();
  }
}
