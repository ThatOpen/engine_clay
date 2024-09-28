import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model, StaticClayElementType } from "../../../core";
import { Extrusion, RectangleProfile } from "../../../geometries";
import { IfcUtils } from "../../../utils/ifc-utils";

import { SimpleWindow } from "./src";

export * from "./src";

export class SimpleWindowType extends StaticClayElementType<SimpleWindow> {
  attributes: IFC4X3.IfcFurnishingElementType;

  shape: IFC4X3.IfcProductDefinitionShape;

  frameWidth = 0.1;

  length = 1;

  width = 0.2;

  height = 1;

  private bottomFrame: Extrusion<RectangleProfile>;

  private topFrame: Extrusion<RectangleProfile>;

  private leftFrame: Extrusion<RectangleProfile>;

  private rightFrame: Extrusion<RectangleProfile>;

  constructor(model: Model) {
    super(model);

    const horizontalProfile = new RectangleProfile(model);
    const body1 = new Extrusion(model, horizontalProfile);
    const id1 = body1.attributes.expressID;
    const fragment = this.newFragment();
    this.fragments.set(id1, fragment);
    this.geometries.set(id1, body1);
    this.bottomFrame = body1;

    const body2 = new Extrusion(model, horizontalProfile);
    const id2 = body2.attributes.expressID;
    this.geometries.set(id2, body2);
    this.topFrame = body2;
    const fragment2 = this.newFragment();
    this.fragments.set(id2, fragment2);

    const verticalProfile = new RectangleProfile(model);
    const body3 = new Extrusion(model, verticalProfile);
    const id3 = body3.attributes.expressID;
    this.geometries.set(id3, body3);
    this.leftFrame = body3;
    const fragment3 = this.newFragment();
    this.fragments.set(id3, fragment3);
    body3.rotation.y = Math.PI / 2;
    body3.update();

    const body4 = new Extrusion(model, verticalProfile);
    const id4 = body4.attributes.expressID;
    this.geometries.set(id4, body4);
    this.rightFrame = body4;
    const fragment4 = this.newFragment();
    this.fragments.set(id4, fragment4);
    body4.rotation.y = Math.PI / 2;
    body4.update();

    this.shape = IfcUtils.productDefinitionShape(model, [
      body1.attributes,
      body2.attributes,
      body3.attributes,
      body4.attributes,
    ]);

    this.attributes = new IFC.IfcWindowType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      IFC.IfcWindowTypeEnum.WINDOW,
      IFC.IfcWindowTypePartitioningEnum.NOTDEFINED,
      null,
      null,
    );

    this.updateGeometry();
    this.model.set(this.attributes);
  }

  update(updateGeometry: boolean = false) {
    this.updateGeometry();
    super.update(updateGeometry);
  }

  private updateGeometry() {
    this.bottomFrame.profile.dimension.y = this.width;
    this.bottomFrame.profile.dimension.x = this.length;
    this.bottomFrame.profile.update();

    this.bottomFrame.depth = this.frameWidth;
    this.bottomFrame.update();

    this.topFrame.position.z = this.height;
    this.topFrame.depth = this.frameWidth;
    this.topFrame.update();

    this.rightFrame.profile.dimension.y = this.width;
    this.rightFrame.profile.dimension.x = this.height;
    this.rightFrame.profile.update();

    this.rightFrame.position.x = -this.length / 2;
    this.rightFrame.position.z = this.height / 2;
    this.rightFrame.depth = this.frameWidth;
    this.rightFrame.update();

    this.leftFrame.position.x = this.length / 2 - this.frameWidth;
    this.leftFrame.position.z = this.height / 2;
    this.leftFrame.depth = this.frameWidth;
    this.leftFrame.update();
  }

  protected createElement() {
    return new SimpleWindow(this.model, this);
  }
}
