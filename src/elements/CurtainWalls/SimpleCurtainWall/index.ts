import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
// import { Extrusion, RectangleProfile } from "../../../geometries";
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

    // const horizontalProfile = new RectangleProfile(model);
    // const body1 = new Extrusion(model, horizontalProfile);
    // const id1 = body1.attributes.expressID;
    // const fragment = this.newFragment();
    // this.fragments.set(id1, fragment);
    // this.geometries.set(id1, body1);
    // this.bottomFrame = body1;

    // const body2 = new Extrusion(model, horizontalProfile);
    // const id2 = body2.attributes.expressID;
    // this.geometries.set(id2, body2);
    // this.topFrame = body2;
    // const fragment2 = this.newFragment();
    // this.fragments.set(id2, fragment2);

    // const verticalProfile = new RectangleProfile(model);
    // const body3 = new Extrusion(model, verticalProfile);
    // const id3 = body3.attributes.expressID;
    // this.geometries.set(id3, body3);
    // this.leftFrame = body3;
    // const fragment3 = this.newFragment();
    // this.fragments.set(id3, fragment3);
    // body3.rotation.y = Math.PI / 2;
    // body3.update();

    // const body4 = new Extrusion(model, verticalProfile);
    // const id4 = body4.attributes.expressID;
    // this.geometries.set(id4, body4);
    // this.rightFrame = body4;
    // const fragment4 = this.newFragment();
    // this.fragments.set(id4, fragment4);
    // body4.rotation.y = Math.PI / 2;
    // body4.update();



    // this.shape = IfcUtils.productDefinitionShape(model, [
    //   body1.attributes,
    //   body2.attributes,
    //   body3.attributes,
    //   body4.attributes,
    // ]);

    const numberOfColumns = 2;
    const numberOfRows = 6

    const sideAMembers: SimpleMember[] = [];
    const sideBMembers: SimpleMember[] = [];
    const bottomMembers: SimpleMember[] = [];
    const topMembers: SimpleMember[] = [];
    const middleMembers: SimpleMember[] = [];
    const plates: SimplePlate[] = [];


    // const sideBMember = new Array<Element>(numberOfRows);

    // const topMembers = new Array<Element>(numberOfColumns);
    // const bottomMembers = new Array<Element>(numberOfColumns)

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

            if (j > 0) {
                plate.body.position.z = j
                plate.body.update();
            }
            
            this.fragments.set(plateId, plateFragment)
            this.geometries.set(plateId, plateBody)

            plates.push(plate);


            // generate middle members
            const middleMember = new SimpleMemberType(model).addInstance(); 
            const middleMemberBody = middleMember.body
            const middleMemberId = middleMemberBody.attributes.expressID;
            const middleMemberFragment = this.newFragment();
            
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

            if (j > 0) {
                sideAMember.body.position.z = j
                sideAMember.body.update();
            }

            this.fragments.set(sideAMemberId, sideAMemberFragment)
            this.geometries.set(sideAMemberId, sideAMemberBody)

            sideAMembers.push(sideAMember);


            // generate members on end side
            const sideBMember = new SimpleMemberType(model).addInstance();
            const sideBMemberBody = sideBMember.body
            const sideBMemberId = sideBMemberBody.attributes.expressID;
            const sideBMemberFragment = this.newFragment();

            console.log(sideAMemberId)

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


    // // const member = new SimpleMemberType(model).addInstance();
    
    // const plate = new SimplePlateType(model).addInstance();

    // // const memberBody = member.body
    // const plateBody = plate.body

    // // const memberId = memberBody.attributes.expressID;
    // const plateId = plateBody.attributes.expressID;
    // // console.log(plateId)

    // // const memberFragment = this.newFragment();
    // const plateFragment = this.newFragment();

    // // this.fragments.set(memberId, memberFragment)
    // this.fragments.set(plateId, plateFragment)

    // // this.geometries.set(memberId, memberBody)
    // this.geometries.set(plateId, plateBody)

    console.log(sideAMembers)

    const sideAMembersAttributes = sideAMembers.map(member => member.body.attributes)
    const sideBMembersAttributes = sideBMembers.map(member => member.body.attributes)
    const bottomMembersAttributes = bottomMembers.map(member => member.body.attributes)
    const topMembersAttributes = topMembers.map(member => member.body.attributes)
    const platesAttributes = plates.map(member => member.body.attributes)
    const middleMembersAttributes = middleMembers.map(member => member.body.attributes)
    // const items = [plateBody.attributes]

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
