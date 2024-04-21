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


    // const plateWidth = 1.9238 //plate.body.profile.dimension.y
    // const plateHeight = 1
    const memberWidth = 0.0635 //topMembtopMemberer.body.profile.dimension.y
    
    const length = 5;
    const height = 3

    const numberOfColumns = 2
    const numberOfRows = 10;

    const numberOfVerticalMembers = numberOfColumns + 1
    const numberOfHorizontalMembers = numberOfRows + 1


    const plateWidth = (length - (numberOfVerticalMembers * memberWidth)) / numberOfColumns //plate.body.profile.dimension.y
    const plateHeight = (height - (numberOfHorizontalMembers * memberWidth)) / numberOfRows

    const sideAMembers: SimpleMember[] = [];
    const sideBMembers: SimpleMember[] = [];
    const bottomMembers: SimpleMember[] = [];
    const topMembers: SimpleMember[] = [];
    const middleHorizontalMembers: SimpleMember[] = [];
    const middleVerticalMembers: SimpleMember[] = [];

    const plates: SimplePlate[] = [];

    for (let i = 0; i < numberOfColumns; i++ ) { 

        const totalDistance = plateWidth * numberOfColumns + memberWidth * (numberOfColumns - 1)
        const distanceToCenter = totalDistance / numberOfColumns

        // generate horizontal member in middle

        const topMember = new SimpleMemberType(model).addInstance();
        const topMemberBody = topMember.body
        const topMemberId = topMemberBody.attributes.expressID;
        const topMemberFragment = this.newFragment();totalDistance

        topMember.body.rotation.x = Math.PI / -2;
        topMember.body.position.z =  height - memberWidth/2 //numberOfRows * (memberWidth + plateHeight) + memberWidth/2
        topMember.body.position.y = i * distanceToCenter;
        topMember.body.depth = plateWidth + memberWidth + memberWidth/2
        
        if (i > 0) { 
          topMember.body.position.y = memberWidth/2 + i * (plateWidth + memberWidth)
          topMember.body.depth = plateWidth + memberWidth 
        }

        if (i == numberOfColumns - 1) {        
          topMember.body.depth = plateWidth + memberWidth + memberWidth/2
        }
        
        topMember.body.profile.update()
        topMember.body.update();

        this.fragments.set(topMemberId, topMemberFragment)
        this.geometries.set(topMemberId, topMemberBody)

        topMembers.push(topMember);
        
        // generate horizontal member in middle

        const bottomMember = new SimpleMemberType(model).addInstance();
        const bottomMemberBody = bottomMember.body
        const bottomMemberId = bottomMemberBody.attributes.expressID;
        const bottomMemberFragment = this.newFragment();

        bottomMember.body.rotation.x = Math.PI / -2;
        bottomMember.body.position.z = memberWidth / 2;

        bottomMember.body.position.y = i * distanceToCenter ;
        bottomMember.body.depth = plateWidth + memberWidth + memberWidth/2

        if (i>0) { 
          bottomMember.body.position.y = memberWidth/2 + i * (plateWidth + memberWidth)
          bottomMember.body.depth = plateWidth + memberWidth 
        }

        if (i == numberOfColumns - 1) {        
          bottomMember.body.depth = plateWidth + memberWidth + memberWidth/2
        }

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

            plate.body.position.y = plateWidth/2 + memberWidth

            if (i > 0) {
              plate.body.position.y =  i * (plateWidth+ memberWidth  ) + memberWidth + plateWidth/2
            }

            plate.body.position.z = memberWidth
           
            if (j > 0 ) {
              plate.body.position.z = j * (plateHeight  + memberWidth) + memberWidth 
            }

            plate.body.profile.dimension.y = plateWidth
            console.log(plateHeight)
            plate.body.depth = plateHeight

            plate.body.profile.update()

            plate.body.update();
            
            this.fragments.set(plateId, plateFragment)
            this.geometries.set(plateId, plateBody)

            plates.push(plate);

            // generate middle members
            if (j > 0 ) {
              const middleHorizontalMember = new SimpleMemberType(model).addInstance(); 
              const middleHorizontalMemberBody = middleHorizontalMember.body
              const middleHorizontalMemberId = middleHorizontalMemberBody.attributes.expressID;
              const middleHorizontalMemberFragment = this.newFragment();

              middleHorizontalMember.body.depth = plateWidth + memberWidth + memberWidth / 2
              middleHorizontalMember.body.position.z = memberWidth/2 + j * (plateHeight + memberWidth)
              middleHorizontalMember.body.position.y = i * distanceToCenter ;
              middleHorizontalMember.body.rotation.x = Math.PI / -2;

              if (i > 0) {
                middleHorizontalMember.body.depth = memberWidth + plateWidth
                middleHorizontalMember.body.position.y = memberWidth/2 + i * (plateWidth + memberWidth)
              }

              if (i == numberOfColumns - 1) {        
                middleHorizontalMember.body.depth = plateWidth + memberWidth + memberWidth/2
              }
      
              middleHorizontalMember.body.update();

              this.fragments.set(middleHorizontalMemberId, middleHorizontalMemberFragment)
              this.geometries.set(middleHorizontalMemberId, middleHorizontalMemberBody)

              middleHorizontalMembers.push(middleHorizontalMember);
            }

          if (i > 0 ) {
            // generate members on origing side
            const middleVerticalMember = new SimpleMemberType(model).addInstance();
            const middleVerticalMemberBody = middleVerticalMember.body
            const middleVerticalMemberId = middleVerticalMemberBody.attributes.expressID;
            const middleVerticalMemberFragment = this.newFragment();
  
            middleVerticalMember.body.position.y = i * (plateWidth + memberWidth) + memberWidth/2
            middleVerticalMember.body.depth = plateHeight
            middleVerticalMember.body.position.z = memberWidth
  
            if (j > 0 ) {
              middleVerticalMember.body.position.z = j * (plateHeight  + memberWidth) + memberWidth
            }
  
            middleVerticalMember.body.update();
  
            this.fragments.set(middleVerticalMemberId, middleVerticalMemberFragment)
            this.geometries.set(middleVerticalMemberId, middleVerticalMemberBody)
  
            middleVerticalMembers.push(middleVerticalMember);
  
            }

          if (i == 0 ) {
          // generate members on origing side
          const sideAMember = new SimpleMemberType(model).addInstance();
          const sideAMemberBody = sideAMember.body
          const sideAMemberId = sideAMemberBody.attributes.expressID;
          const sideAMemberFragment = this.newFragment();

          sideAMember.body.position.y = i * distanceToCenter + memberWidth/2
          sideAMember.body.depth = plateHeight
          sideAMember.body.position.z = memberWidth

          if (j > 0 ) {
            sideAMember.body.position.z = j * (plateHeight  + memberWidth) + memberWidth
          }

          sideAMember.body.update();

          this.fragments.set(sideAMemberId, sideAMemberFragment)
          this.geometries.set(sideAMemberId, sideAMemberBody)

          sideAMembers.push(sideAMember);

          }


            // generate members on end side
            const sideBMember = new SimpleMemberType(model).addInstance();
            const sideBMemberBody = sideBMember.body
            const sideBMemberId = sideBMemberBody.attributes.expressID;
            const sideBMemberFragment = this.newFragment();

            sideBMember.body.position.y = length - memberWidth / 2 // + 2 * memberWidth - memberWidth / 2
            sideBMember.body.depth = plateHeight
            sideBMember.body.position.z = memberWidth
            
            if (j > 0 ) {
              sideBMember.body.position.z = j * (plateHeight  + memberWidth) + memberWidth
            }

            sideBMember.body.update();

            this.fragments.set(sideBMemberId, sideBMemberFragment)
            this.geometries.set(sideBMemberId, sideBMemberBody)

            sideBMembers.push(sideBMember);
        }
    }

    var sideAMembersAttributes = sideAMembers.map(member => member.body.attributes)
    // sideAMembersAttributes = [];
    var sideBMembersAttributes = sideBMembers.map(member => member.body.attributes)
    // sideBMembersAttributes = [];
    var bottomMembersAttributes = bottomMembers.map(member => member.body.attributes)
    // bottomMembersAttributes = [];
    var topMembersAttributes = topMembers.map(member => member.body.attributes)
    // topMembersAttributes = [];
    var platesAttributes = plates.map(member => member.body.attributes)
    // platesAttributes = [];
    var middleHorizontalMembersAttributes = middleHorizontalMembers.map(member => member.body.attributes)
    // middleHorizontalMembersAttributes = [];
    var middleVerticalMembersAttributes = middleVerticalMembers.map(member => member.body.attributes)
    // middleVerticalMembersAttributes = [];
    const concatItems = sideAMembersAttributes.concat(sideBMembersAttributes).concat(bottomMembersAttributes).concat(topMembersAttributes).concat(platesAttributes).concat(middleHorizontalMembersAttributes).concat(middleVerticalMembersAttributes)
    console.log(sideBMembers)
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
