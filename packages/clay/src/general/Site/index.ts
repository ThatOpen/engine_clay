import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { ClayObject, Model } from "../../core";
import { SpatialChildren } from "../SpatialChildren";
import { ElementChildren } from "../ElementChildren";
import { Project } from "../Project";
import { IfcUtils } from "../../utils/ifc-utils";

export class Site extends ClayObject {
  attributes: IFC.IfcSite;

  spatialChildren: SpatialChildren;

  children: ElementChildren;

  constructor(model: Model, project: Project) {
    super(model);

    this.attributes = new IFC.IfcSite(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      project.ownerHistory,
      null,
      null,
      null,
      IfcUtils.localPlacement(),
      null,
      null,
      IFC.IfcElementCompositionEnum.ELEMENT,
      null,
      null,
      null,
      null,
      null,
    );

    this.model.set(this.attributes);

    project.spatialChildren.add(this.attributes.expressID);

    this.spatialChildren = new SpatialChildren(
      model,
      project.ownerHistory,
      this.attributes,
    );

    this.children = new ElementChildren(
      model,
      project.ownerHistory,
      this.attributes,
    );
  }

  update(): void {
    this.model.set(this.attributes);
  }
}
