import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model, DynamicClayElementType } from "../../../core";

import { SimpleMember } from "./src";

export class SimpleMemberType extends DynamicClayElementType<SimpleMember> {
  attributes: IFC.IfcMemberType;

  memberType: IFC.IfcMemberTypeEnum;

  constructor(model: Model) {
    super(model);

    this.memberType = IFC.IfcMemberTypeEnum.MULLION;

    this.attributes = new IFC.IfcMemberType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      this.memberType,
    );
  }

  protected createElement() {
    return new SimpleMember(this.model, this);
  }
}
