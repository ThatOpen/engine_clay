import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC, IFC2X3 } from "web-ifc";
import * as THREE from "three";
import { Model } from "../../../../base";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Element } from "../../../Elements";
import { SimpleSlabType } from "../index";
import { Extrusion, RectangleProfile } from "../../../../geometries";

export class SimpleSlab extends Element {
  import(): void {}
  attributes: IFC.IfcSlab;

  type: SimpleSlabType;

  body: Extrusion<RectangleProfile>;

  thickness = 0.3;

  constructor(model: Model, type: SimpleSlabType) {
    super(model, type);
    this.type = type;

    const profile = new RectangleProfile(model);
    this.body = new Extrusion(model, profile);
    const id = this.body.attributes.expressID;
    this.type.geometries.set(id, this.body);
    this.geometries.add(id);

    const placement = IfcUtils.localPlacement();
    const shape = IfcUtils.productDefinitionShape(model, [
      this.body.attributes,
    ]);

    this.attributes = new IFC.IfcSlab(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      placement,
      shape,
      null,
      null
    );

    this.model.set(this.attributes);
  }

  update(updateGeometry: boolean = false) {
    this.body.depth = this.thickness;
    this.body.update();
    super.update(updateGeometry);
  }

  importProperties(model: Model, slab: IFC2X3.IfcSlab) {
    const representations = model.get(slab.Representation);
    for (const represent of representations.Representations) {
      const foundRep = model.get(represent);
      const element = model.get(
        foundRep.Items[0]
      ) as IFC2X3.IfcExtrudedAreaSolid;

      const elevation = Element.getElevation(model, slab.expressID);

      const profile = model.get(
        element.SweptArea
      ) as IFC2X3.IfcRectangleProfileDef;

      const placement = model.get(
        element.Position
      ) as IFC2X3.IfcAxis2Placement3D;

      const location = model.get(placement.Location);

      let directionRatios = [1, 0, 0];
      if (placement.RefDirection) {
        const refDirection = model.get(placement.RefDirection);
        directionRatios = refDirection.DirectionRatios;
      }

      const angleRadians = Math.atan2(directionRatios[1], directionRatios[0]);

      const rotationMat = new THREE.Matrix4();
      rotationMat.makeRotationZ(angleRadians);

      this.body.position.x = location.Coordinates[0].value;
      this.body.position.y = location.Coordinates[1].value;
      this.body.position.z = elevation;

      this.thickness = element.Depth.value;
      this.body.update();
      this.body.profile.dimension.x = profile.XDim.value;
      this.body.profile.dimension.y = profile.YDim.value;

      this.body.profile.dimension.applyMatrix4(rotationMat);

      this.body.profile.update();

      this.update(true);
    }
  }
}
