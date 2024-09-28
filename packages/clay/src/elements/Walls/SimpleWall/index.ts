import { v4 as uuidv4 } from "uuid";
import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { Model, DynamicClayElementType } from "../../../core";
import { SimpleWall } from "./src";

export * from "./src";

export class SimpleWallType extends DynamicClayElementType<SimpleWall> {
  attributes: IFC4X3.IfcWallType;

  width = 0.2;

  constructor(model: Model) {
    super(model);

    this.attributes = new IFC.IfcWallType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      IFC.IfcWallTypeEnum.STANDARD,
    );
  }

  protected createElement() {
    return new SimpleWall(this.model, this);
  }
}
