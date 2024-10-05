import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model, DynamicClayElementType } from "../../../core";
import { SimpleWall } from "./src";
import {
  SimpleWallCornerer,
  WallCornerConfig,
} from "./src/simple-wall-cornerer";

export * from "./src";

export class SimpleWallType extends DynamicClayElementType<SimpleWall> {
  attributes: IFC.IfcWallType;

  width = 0.2;

  private _cornerer = new SimpleWallCornerer();

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

    this.model.set(this.attributes);
  }

  addCorner(config: WallCornerConfig) {
    this._cornerer.add(config);
  }

  updateCorners(ids?: Iterable<number>) {
    this._cornerer.update(ids);
  }

  protected createElement() {
    return new SimpleWall(this.model, this);
  }
}
