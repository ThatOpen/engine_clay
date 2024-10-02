import { IFC4X3 as IFC, Handle } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { ClayObject, Model } from "../../core";

export class ElementChildren extends ClayObject {
  attributes: IFC.IfcRelContainedInSpatialStructure;
  ids = new Set<number>();

  constructor(
    model: Model,
    ownerHistory: IFC.IfcOwnerHistory,
    element: IFC.IfcSpatialElement,
  ) {
    super(model);
    this.attributes = new IFC.IfcRelContainedInSpatialStructure(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      ownerHistory,
      null,
      null,
      [],
      element,
    );

    this.update();
  }

  add(itemID: number) {
    if (this.ids.has(itemID)) {
      return;
    }
    this.attributes.RelatedElements.push(new Handle(itemID));
    this.ids.add(itemID);
    this.update();
  }

  remove(itemID: number) {
    if (!this.ids.has(itemID)) {
      return;
    }
    const children = this.attributes.RelatedElements as Handle<any>[];
    this.attributes.RelatedElements = children.filter(
      (item) => item.value !== itemID,
    );
    this.ids.delete(itemID);
    this.update();
  }

  update() {
    this.model.set(this.attributes);
  }
}
