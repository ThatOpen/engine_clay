import { v4 as uuidv4 } from "uuid";
import { IFC4X3, IFC4X3 as IFC, IFC2X3 } from "web-ifc";
import { Model } from "../../../base";
import { DynamicElementType } from "../../Elements";

import { SimpleWall } from "./src";

export * from "./src";

export class SimpleWallType extends DynamicElementType<SimpleWall> {
  import(): void {}

  static import(
    element: any,
    importerModel: Model,
    model: Model
  ): SimpleWallType {
    const representations = importerModel.get(element.Representation);
    let wallType: SimpleWallType | undefined;

    for (const represent of representations.Representations) {
      const foundRep = importerModel.get(represent);
      const extrusion = importerModel.get(
        foundRep.Items[0]
      ) as IFC2X3.IfcExtrudedAreaSolid;

      if (extrusion) {
        const profile = importerModel.get(
          extrusion.SweptArea
        ) as IFC.IfcRectangleProfileDef;

        if (profile) {
          const wallThickness = profile.YDim;
          const keyForTypeMap = `w${wallThickness.value}`;

          if (importerModel.typeMap.has(keyForTypeMap)) {
            wallType = model.typeMap.get(keyForTypeMap) as SimpleWallType;
          } else {
            wallType = new SimpleWallType(model);
          }
        }
      }
    }

    if (!wallType) {
      throw new Error("Unable to determine wall type");
    }

    return wallType;
  }

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
