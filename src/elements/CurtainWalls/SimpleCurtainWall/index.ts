import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { IfcUtils } from "../../../utils/ifc-utils";
import { StaticElementType } from "../../Elements";
import { SimpleCurtainWall } from "./src";
import { SimpleMemberType } from "../../Members";
import { SimplePlateType } from "../../Plates";
import { SimpleMember } from "../../Members/SimpleMember/src";
import { SimplePlate } from "../../Plates/SimplePlate/src";

export * from "./src";

export class SimpleCurtainWallType extends StaticElementType<SimpleCurtainWall> {
  attributes: IFC4X3.IfcCurtainWallType;

  shape: IFC4X3.IfcProductDefinitionShape;

  length = 6;

  height = 3;

  numberOfColumns = 8;

  numberOfRows = 5;

  //Glazing

  private plates: SimplePlate[] = [];

  //Outer square frame

  private sideAMembers: SimpleMember[] = [];

  private sideBMembers: SimpleMember[] = [];

  private bottomMembers: SimpleMember[] = [];

  private topMembers: SimpleMember[] = [];

  //Interior grid frame

  private middleHorizontalMembers: SimpleMember[] = [];

  private middleVerticalMembers: SimpleMember[] = [];

  constructor(model: Model) {
    super(model);

    const componentAttributes = this.composeCurtainWall(model);

    this.shape = IfcUtils.productDefinitionShape(model, componentAttributes);

    this.attributes = new IFC.IfcCurtainWallType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      IFC.IfcCurtainWallTypeEnum.NOTDEFINED
    );
  }

  update(updateGeometry: boolean = false) {
    const componentAttributes = this.composeCurtainWall();

    this.shape = IfcUtils.productDefinitionShape(
      this.model,
      componentAttributes
    );

    super.update(updateGeometry);
  }

  composeCurtainWall(model?: Model) {
    if (!model) {
      model = this.model;
    }

    const memberWidth = new SimpleMemberType(model).addInstance().width;

    const plateWidth =
      (this.length - (this.numberOfColumns + 1) * memberWidth) /
      this.numberOfColumns;
    const plateHeight =
      (this.height - (this.numberOfRows + 1) * memberWidth) / this.numberOfRows;

    const horizontalMemberLength = plateWidth + memberWidth + memberWidth / 2;

    for (let i = 0; i < this.numberOfColumns; i++) {
      const initialHorizontalColumnLocation = 0;
      const nonInitialHorizontalColumnLocation =
        i * (plateWidth + memberWidth) + memberWidth / 2;

      // generate top horizontal members of outer frame-------------------------
      const topMember = new SimpleMemberType(model).addInstance();
      const topMemberId = topMember.body.attributes.expressID;

      topMember.body.depth = horizontalMemberLength;

      topMember.body.position.y = initialHorizontalColumnLocation;
      topMember.body.position.z = this.height - memberWidth / 2;

      topMember.body.rotation.x = Math.PI / -2;

      if (i > 0) {
        topMember.body.depth = plateWidth + memberWidth;
        topMember.body.position.y = nonInitialHorizontalColumnLocation;
      }

      if (i == this.numberOfColumns - 1) {
        topMember.body.depth = horizontalMemberLength;
      }

      topMember.body.profile.update();
      topMember.body.update();

      this.fragments.set(topMemberId, this.newFragment());
      this.geometries.set(topMemberId, topMember.body);
      this.topMembers.push(topMember);

      // generate bottom horizontal members of outer frame-------------------------
      const bottomMember = new SimpleMemberType(model).addInstance();
      const bottomMemberId = bottomMember.body.attributes.expressID;

      bottomMember.body.depth = horizontalMemberLength;

      bottomMember.body.position.y = initialHorizontalColumnLocation;
      bottomMember.body.position.z = memberWidth / 2;

      bottomMember.body.rotation.x = Math.PI / -2;

      if (i > 0) {
        bottomMember.body.depth = plateWidth + memberWidth;
        bottomMember.body.position.y = nonInitialHorizontalColumnLocation;
      }

      if (i == this.numberOfColumns - 1) {
        bottomMember.body.depth = horizontalMemberLength;
      }

      bottomMember.body.update();

      this.fragments.set(bottomMemberId, this.newFragment());
      this.geometries.set(bottomMemberId, bottomMember.body);
      this.bottomMembers.push(bottomMember);

      for (let j = 0; j < this.numberOfRows; j++) {
        const nonInitialVerticalRowLocation =
          memberWidth + j * (plateHeight + memberWidth);

        // generate glazing plates------------------------------------
        const plate = new SimplePlateType(model).addInstance();
        const plateId = plate.body.attributes.expressID;

        plate.body.profile.dimension.y = plateWidth;
        plate.body.depth = plateHeight;

        plate.body.position.y = plateWidth / 2 + memberWidth;
        plate.body.position.z = memberWidth;

        if (i > 0) {
          plate.body.position.y =
            memberWidth + i * (plateWidth + memberWidth) + plateWidth / 2;
        }

        if (j > 0) {
          plate.body.position.z = nonInitialVerticalRowLocation;
        }

        plate.body.profile.update();
        plate.body.update();

        this.fragments.set(plateId, this.newFragment());
        this.geometries.set(plateId, plate.body);
        this.plates.push(plate);

        // generate middle horizontal grid members-----------------------------------
        if (j > 0) {
          const middleHorizontalMember = new SimpleMemberType(
            model
          ).addInstance();
          const middleHorizontalMemberId =
            middleHorizontalMember.body.attributes.expressID;

          middleHorizontalMember.body.depth = horizontalMemberLength;

          middleHorizontalMember.body.position.y =
            initialHorizontalColumnLocation;
          middleHorizontalMember.body.position.z =
            nonInitialVerticalRowLocation - memberWidth / 2;

          middleHorizontalMember.body.rotation.x = Math.PI / -2;

          if (i > 0) {
            middleHorizontalMember.body.depth = memberWidth + plateWidth;
            middleHorizontalMember.body.position.y =
              nonInitialHorizontalColumnLocation;
          }

          if (i == this.numberOfColumns - 1) {
            middleHorizontalMember.body.depth = horizontalMemberLength;
          }

          middleHorizontalMember.body.update();

          this.fragments.set(middleHorizontalMemberId, this.newFragment());
          this.geometries.set(
            middleHorizontalMemberId,
            middleHorizontalMember.body
          );
          this.middleHorizontalMembers.push(middleHorizontalMember);
        }

        if (i > 0) {
          // generate middle vertical grid members-------------------------
          const middleVerticalMember = new SimpleMemberType(
            model
          ).addInstance();
          const middleVerticalMemberId =
            middleVerticalMember.body.attributes.expressID;

          middleVerticalMember.body.depth = plateHeight;

          middleVerticalMember.body.position.y =
            nonInitialHorizontalColumnLocation;
          middleVerticalMember.body.position.z = memberWidth;

          if (j > 0) {
            middleVerticalMember.body.position.z =
              nonInitialVerticalRowLocation;
          }

          middleVerticalMember.body.update();

          this.fragments.set(middleVerticalMemberId, this.newFragment());
          this.geometries.set(
            middleVerticalMemberId,
            middleVerticalMember.body
          );
          this.middleVerticalMembers.push(middleVerticalMember);
        }

        if (i == 0) {
          // generate vertical outer frame members on origing side--------------------------------
          const sideAMember = new SimpleMemberType(model).addInstance();
          const sideAMemberId = sideAMember.body.attributes.expressID;

          sideAMember.body.depth = plateHeight;

          sideAMember.body.position.y =
            initialHorizontalColumnLocation + memberWidth / 2;
          sideAMember.body.position.z = memberWidth;

          if (j > 0) {
            sideAMember.body.position.z = nonInitialVerticalRowLocation;
          }

          sideAMember.body.update();

          this.fragments.set(sideAMemberId, this.newFragment());
          this.geometries.set(sideAMemberId, sideAMember.body);
          this.sideAMembers.push(sideAMember);
        }

        // generate vertical outer frame members on end side--------------------------------------
        const sideBMember = new SimpleMemberType(model).addInstance();
        const sideBMemberId = sideBMember.body.attributes.expressID;

        sideBMember.body.depth = plateHeight;

        sideBMember.body.position.y = this.length - memberWidth / 2;
        sideBMember.body.position.z = memberWidth;

        if (j > 0) {
          sideBMember.body.position.z = nonInitialVerticalRowLocation;
        }

        sideBMember.body.update();

        this.fragments.set(sideBMemberId, this.newFragment());
        this.geometries.set(sideBMemberId, sideBMember.body);
        this.sideBMembers.push(sideBMember);
      }
    }

    const components = new Array<any>().concat(
      this.plates,
      this.sideAMembers,
      this.sideBMembers,
      this.bottomMembers,
      this.topMembers,
      this.middleHorizontalMembers,
      this.middleVerticalMembers
    );

    return components.map((component) => component.body.attributes);
  }

  protected createElement() {
    return new SimpleCurtainWall(this.model, this);
  }
}
