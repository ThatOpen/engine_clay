import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { IfcUtils } from "../../../utils/ifc-utils";
import { StaticElementType } from "../../Elements";
import { SimpleCurtainWall } from "./src";
import { SimpleMemberType } from "../../Members";
import { SimplePlateType } from "../../Plates";
// import * as THREE from "three";
import { SimpleMember } from "../../Members/SimpleMember/src";
import { SimplePlate } from "../../Plates/SimplePlate/src";


export * from "./src";

export class SimpleCurtainWallType extends StaticElementType<SimpleCurtainWall> {
  attributes: IFC4X3.IfcCurtainWallType;

  shape: IFC4X3.IfcProductDefinitionShape;

  frameWidth = 0.1;

  length = 1;

  width = 0.2;

  height = 1;

//   private bottomFrame: Extrusion<RectangleProfile>;

//   private topFrame: Extrusion<RectangleProfile>;

//   private leftFrame: Extrusion<RectangleProfile>;

//   private rightFrame: Extrusion<RectangleProfile>;

  constructor(model: Model) {
    super(model);

    const numberOfColumns = 10;
    const numberOfRows = 3

    const sideAMembers: SimpleMember[] = [];
    const sideBMembers: SimpleMember[] = [];
    const bottomMembers: SimpleMember[] = [];
    const topMembers: SimpleMember[] = [];
    const middleMembers: SimpleMember[] = [];
    const plates: SimplePlate[] = [];

    for (let i = 0; i < numberOfColumns; i++ ) { 
        // generate horizontal member in middle

        const topMember = new SimpleMemberType(model).addInstance();
        const topMemberBody = topMember.body
        const topMemberId = topMemberBody.attributes.expressID;
        const topMemberFragment = this.newFragment();

        // bottomMember.body.position.y = numberOfColumns

        // if (i > 0) {
        //     sideBMember.body.position.z = i
        // }

        topMember.body.rotation.x = Math.PI / -2;
        topMember.body.position.z = numberOfRows
        topMember.body.position.y = i;
        topMember.body.update();

        this.fragments.set(topMemberId, topMemberFragment)
        this.geometries.set(topMemberId, topMemberBody)

        topMembers.push(topMember);

        
        // generate horizontal member in middle

        const bottomMember = new SimpleMemberType(model).addInstance();
        const bottomMemberBody = bottomMember.body
        const bottomMemberId = bottomMemberBody.attributes.expressID;
        const bottomMemberFragment = this.newFragment();

        // bottomMember.body.position.y = numberOfColumns

        // if (i > 0) {
        //     sideBMember.body.position.z = i
        // }

        bottomMember.body.rotation.x = Math.PI / -2;
        bottomMember.body.position.y = i;

        bottomMember.body.update();

        this.fragments.set(bottomMemberId, bottomMemberFragment)
        this.geometries.set(bottomMemberId, bottomMemberBody)

        bottomMembers.push(bottomMember);

        for (let j = 0; j < numberOfRows; j++ ) { 

            // generate plates 

            const plate = new SimplePlateType(model).addInstance();
            const plateBody = plate.body
            const plateId = plateBody.attributes.expressID;
            const plateFragment = this.newFragment();
            plate.body.position.y = i

            if (j > 0) {
                plate.body.position.z = j
            }

            plate.body.update();
            
            this.fragments.set(plateId, plateFragment)
            this.geometries.set(plateId, plateBody)

            plates.push(plate);


            // generate middle members
            const middleMember = new SimpleMemberType(model).addInstance(); 
            const middleMemberBody = middleMember.body
            const middleMemberId = middleMemberBody.attributes.expressID;
            const middleMemberFragment = this.newFragment();
            
            middleMember.body.position.y = i

            if (j > 0 ) {
                middleMember.body.position.z = j
            }         
            
            middleMember.body.rotation.x = Math.PI / -2;
            middleMember.body.update();

            this.fragments.set(middleMemberId, middleMemberFragment)
            this.geometries.set(middleMemberId, middleMemberBody)

            middleMembers.push(middleMember);

            // generate members on origing side
            const sideAMember = new SimpleMemberType(model).addInstance();
            const sideAMemberBody = sideAMember.body
            const sideAMemberId = sideAMemberBody.attributes.expressID;
            const sideAMemberFragment = this.newFragment();

            console.log(sideAMemberId)
            sideAMember.body.position.y = i

            if (j > 0) {
                sideAMember.body.position.z = j
            }

            sideAMember.body.update();


            this.fragments.set(sideAMemberId, sideAMemberFragment)
            this.geometries.set(sideAMemberId, sideAMemberBody)

            sideAMembers.push(sideAMember);


            // generate members on end side
            const sideBMember = new SimpleMemberType(model).addInstance();
            const sideBMemberBody = sideBMember.body
            const sideBMemberId = sideBMemberBody.attributes.expressID;
            const sideBMemberFragment = this.newFragment();

            sideBMember.body.position.y = numberOfColumns

            if (j > 0) {
                sideBMember.body.position.z = j
            }

            sideBMember.body.update();


            this.fragments.set(sideBMemberId, sideBMemberFragment)
            this.geometries.set(sideBMemberId, sideBMemberBody)

            sideBMembers.push(sideBMember);
        }
    }

    const sideAMembersAttributes = sideAMembers.map(member => member.body.attributes)
    const sideBMembersAttributes = sideBMembers.map(member => member.body.attributes)
    const bottomMembersAttributes = bottomMembers.map(member => member.body.attributes)
    const topMembersAttributes = topMembers.map(member => member.body.attributes)
    const platesAttributes = plates.map(member => member.body.attributes)
    const middleMembersAttributes = middleMembers.map(member => member.body.attributes)

    const concatItems = sideAMembersAttributes.concat(sideBMembersAttributes).concat(bottomMembersAttributes).concat(topMembersAttributes).concat(platesAttributes).concat(middleMembersAttributes)

    console.log(concatItems)

    this.shape = IfcUtils.productDefinitionShape(model, concatItems);

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

    this.updateGeometry();
    this.model.set(this.attributes);
  }

  update(updateGeometry: boolean = false) {
    this.updateGeometry();
    super.update(updateGeometry);
  }

  private updateGeometry() {
    // this.bottomFrame.profile.dimension.y = this.width;
    // this.bottomFrame.profile.dimension.x = this.length;
    // this.bottomFrame.profile.update();

    // this.bottomFrame.depth = this.frameWidth;
    // this.bottomFrame.update();

    // this.topFrame.position.z = this.height;
    // this.topFrame.depth = this.frameWidth;
    // this.topFrame.update();

    // this.rightFrame.profile.dimension.y = this.width;
    // this.rightFrame.profile.dimension.x = this.height;
    // this.rightFrame.profile.update();

    // this.rightFrame.position.x = -this.length / 2;
    // this.rightFrame.position.z = this.height / 2;
    // this.rightFrame.depth = this.frameWidth;
    // this.rightFrame.update();

    // this.leftFrame.position.x = this.length / 2 - this.frameWidth;
    // this.leftFrame.position.z = this.height / 2;
    // this.leftFrame.depth = this.frameWidth;
    // this.leftFrame.update();
  }

  protected createElement() {
    return new SimpleCurtainWall(this.model, this);
  }
}
