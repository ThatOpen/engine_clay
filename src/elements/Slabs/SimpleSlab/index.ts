import { v4 as uuidv4 } from "uuid";
import { IFC4X3, IFC4X3 as IFC, IFC2X3 } from "web-ifc";
import { DynamicElementType } from "../../Elements";
import { SimpleSlab } from "./src";
import { Model } from "../../../base";

export * from "./src";

export class SimpleSlabType extends DynamicElementType<SimpleSlab> {
  attributes: IFC4X3.IfcSlabType;

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
    return new SimpleSlab(this.model, this);
  }

  import(): void {}

  static import(
    element: IFC2X3.IfcSlab,
    importerModel: Model,
    model: Model
  ): SimpleSlabType {
    const representations = importerModel.get(element.Representation);
    let slabType: SimpleSlabType | undefined;

    for (const represent of representations.Representations) {
      const foundRep = importerModel.get(represent);
      const extrusion = importerModel.get(
        foundRep.Items[0]
      ) as IFC2X3.IfcExtrudedAreaSolid;

      if (extrusion) {
        const slabDepth = model.get(extrusion.Depth.value);

        const keyForTypeMap = `s${slabDepth}`;

        if (importerModel.typeMap.has(keyForTypeMap)) {
          slabType = model.typeMap.get(keyForTypeMap) as SimpleSlabType;
        } else {
          slabType = new SimpleSlabType(model);
          model.typeMap.set(keyForTypeMap, slabType);
        }
      }
    }
    if (!slabType) {
      throw new Error("Unable to determine wall type");
    }

    return slabType;
  }
}
