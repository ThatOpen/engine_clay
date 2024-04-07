import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC, IFC2X3 } from "web-ifc";
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

  importProperties(model: Model, element: IFC2X3.IfcExtrudedAreaSolid) {
    const profile = model.get(
      element.SweptArea
    ) as IFC2X3.IfcRectangleProfileDef;

    if (profile !== undefined) {
      this.body.depth = element.Depth.value;
    }
  }

  // importProperties(model: Model, wall: IFC2X3.IfcWallStandardCase) {
  //   const representations = model.get(wall.Representation);
  //   for (const represent of representations.Representations) {
  //     const foundRep = model.get(represent);
  //     const element = model.get(
  //       foundRep.Items[0]
  //     ) as IFC2X3.IfcExtrudedAreaSolid;

  //     const profile = model.get(
  //       element.SweptArea
  //     ) as IFC2X3.IfcRectangleProfileDef;

  //     const position = model.get(element.Position);
  //     if (position && profile !== undefined) {
  //       const location = model.get(position.Location);
  //       if (location && location.Coordinates.length >= 3) {
  //         const wallThickness = profile.YDim.value;
  //         const wallLength = profile.XDim.value;

  //         const profilePosition = model.get(profile.Position);
  //         const profileLocation = model.get(profilePosition.Location);

  //         const startPoint = new THREE.Vector3(
  //           profileLocation.Coordinates[0].value - wallLength / 2,
  //           profileLocation.Coordinates[1].value - wallThickness / 2,
  //           0
  //         );
  //         const endPoint = new THREE.Vector3(
  //           startPoint.x + wallLength,
  //           startPoint.y,
  //           0
  //         );

  //         const placement = model.get(
  //           wall.ObjectPlacement
  //         ) as IFC2X3.IfcLocalPlacement;
  //         const relPlacement = model.get(placement.RelativePlacement);

  //         try {
  //           const refDirection = model.get(relPlacement.RefDirection);
  //           const angleRadians = Math.atan2(
  //             refDirection.DirectionRatios[1],
  //             refDirection.DirectionRatios[0]
  //           );

  //           const rotationMat = new THREE.Matrix4();
  //           rotationMat.makeRotationZ(angleRadians);
  //           startPoint.applyMatrix4(rotationMat);
  //           endPoint.applyMatrix4(rotationMat);
  //         } catch (error) {
  //           console.error("Error applying transformation: ", error);
  //         }

  //         const relLocation = model.get(relPlacement.Location);
  //         const relCoordinates = relLocation.Coordinates;

  //         startPoint.x += relCoordinates[0].value;
  //         startPoint.y += relCoordinates[1].value;

  //         endPoint.x += relCoordinates[0].value;
  //         endPoint.y += relCoordinates[1].value;

  //         this.startPoint.setX(startPoint.x);
  //         this.startPoint.setY(startPoint.y);
  //         this.endPoint.setX(endPoint.x);
  //         this.endPoint.setY(endPoint.y);
  //         this.height = element.Depth.value;
  //         this.body.depth = wallThickness;

  //         this.update(true);
  //       }
  //     }
  //   }
  // }
}
