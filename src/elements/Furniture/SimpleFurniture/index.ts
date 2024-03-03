import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { Element } from "../../Element";
import { Brep } from "../../../geometries";
import { IfcUtils } from "../../../utils/ifc-utils";

export class Furniture extends Element {
  ifcData: IFC.IfcFurnishingElement;

  geometries: { body: Brep };

  constructor(model: Model, geometry: THREE.BufferGeometry) {
    super(model);

    this.geometries = { body: new Brep(model, geometry) };

    const { body } = this.geometries;

    const representation = IfcUtils.shapeRepresentation(this.model);
    representation.Items = [body.ifcData];
    const placement = IfcUtils.localPlacement();
    const shape = new IFC.IfcProductDefinitionShape(null, null, [
      representation,
    ]);

    const label = "Simple slab";

    this.ifcData = new IFC.IfcFurnishingElement(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      new IFC.IfcLabel(label),
      null,
      new IFC.IfcLabel(label),
      placement,
      shape,
      new IFC.IfcIdentifier(label)
    );

    this.update();
  }

  update(): void {
    const { body } = this.geometries;
    body.update();
    this.updateElement();
  }
}
