import { IFC4X3 as IFC, Handle } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { ClayObject, Model } from "../../core";

export class SpatialChildren extends ClayObject {
  attributes: IFC.IfcRelAggregates;
  ids = new Set<number>();

  constructor(
    model: Model,
    ownerHistory: IFC.IfcOwnerHistory,
    element: IFC.IfcObjectDefinition,
  ) {
    super(model);
    this.attributes = new IFC.IfcRelAggregates(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      ownerHistory,
      null,
      null,
      element,
      [],
    );

    this.update();
  }

  add(itemID: number) {
    if (this.ids.has(itemID)) {
      return;
    }
    this.attributes.RelatedObjects.push(new Handle(itemID));
    this.ids.add(itemID);
    this.update();
  }

  remove(itemID: number) {
    if (!this.ids.has(itemID)) {
      return;
    }
    const children = this.attributes.RelatedObjects as Handle<any>[];
    this.attributes.RelatedObjects = children.filter(
      (item) => item.value !== itemID,
    );
    this.ids.delete(itemID);
    this.update();
  }

  update() {
    this.model.set(this.attributes);
  }
}
