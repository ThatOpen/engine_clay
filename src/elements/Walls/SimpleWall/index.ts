import { v4 as uuidv4 } from "uuid";
import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { Model } from "../../../base";
import { DynamicElementType } from "../../Elements";
import { SimpleWall } from "./src";

export * from "./src";

export class SimpleWallType extends DynamicElementType<SimpleWall> {
  attributes: IFC4X3.IfcWallType;

  width = 0.2;

  constructor(model: Model) {
    super(model);

    this.attributes = new IFC.IfcSlabType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      IFC.IfcSlabTypeEnum.FLOOR
    );
  }

  protected createElement() {
    return new SimpleWall(this.model, this);
  }
}
