import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model } from "../../../base";
import { DynamicElementType } from "../../Elements";
import { SimplePlate } from "./src";

export class SimplePlateType extends DynamicElementType<SimplePlate> {
  attributes: IFC.IfcPlateType;
  
  plateType: IFC.IfcPlateTypeEnum

  constructor(model: Model) {
    super(model);

    this.plateType = IFC.IfcPlateTypeEnum.CURTAIN_PANEL

    this.attributes = new IFC.IfcPlateType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      this.plateType,
    );
  }

  protected createElement() {
    return new SimplePlate(this.model, this);
  }
}
