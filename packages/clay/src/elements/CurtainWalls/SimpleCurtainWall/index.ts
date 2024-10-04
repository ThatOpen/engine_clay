import { IFC4X3, IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import * as THREE from "three";
import { Model, StaticClayElementType } from "../../../core";
import { IfcUtils } from "../../../utils/ifc-utils";

import { SimpleCurtainWall } from "./src";
import { SimpleMemberType } from "../../Members";
import { SimplePlateType } from "../../Plates";
import { SimpleMember } from "../../Members/SimpleMember/src";
import { SimplePlate } from "../../Plates/SimplePlate/src";

export * from "./src";

export class SimpleCurtainWallType extends StaticClayElementType<SimpleCurtainWall> {
  attributes: IFC4X3.IfcCurtainWallType;

  shape: IFC4X3.IfcProductDefinitionShape;

  height = 3;

  frameWidth = 0.127;

  startPoint = new THREE.Vector3(0, 0, 0);

  endPoint = new THREE.Vector3(1, 0, 0);

  numberOfColumns = 2;

  numberOfRows = 2;

  private plates: SimplePlate[] = [];

  private sideAMembers: SimpleMember[] = [];

  private sideBMembers: SimpleMember[] = [];

  private bottomMembers: SimpleMember[] = [];

  private topMembers: SimpleMember[] = [];

  private middleHorizontalMembers: SimpleMember[] = [];

  private middleVerticalMembers: SimpleMember[] = [];

  get length() {
    return this.startPoint.distanceTo(this.endPoint);
  }

  get midPoint() {
    return new THREE.Vector3(
      (this.startPoint.x + this.endPoint.x) / 2,
      (this.startPoint.y + this.endPoint.y) / 2,
      (this.startPoint.z + this.endPoint.z) / 2,
    );
  }

  get direction() {
    const vector = new THREE.Vector3();
    vector.subVectors(this.endPoint, this.startPoint);
    vector.normalize();
    return vector;
  }

  constructor(model: Model, numberOfColumns?: number, numberOfRows?: number) {
    super(model);

    if (numberOfColumns) this.numberOfColumns = numberOfColumns;

    if (numberOfRows) this.numberOfRows = numberOfRows;

    const componentAttributes = this.instantiateComponents(model);

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
      IFC.IfcCurtainWallTypeEnum.NOTDEFINED,
    );

    this.updateComponentGeometries();
    this.model.set(this.attributes);
  }

  update(updateGeometry: boolean = false) {
    this.updateComponentGeometries();
    super.update(updateGeometry);
  }

  instantiateComponents(model: Model = this.model) {
    console.log("intantiating...");
    for (
      let currentColumn = 0;
      currentColumn < this.numberOfColumns;
      currentColumn++
    ) {
      const bottomMember = new SimpleMemberType(model).addInstance();
      const bottomMemberId = bottomMember.body.attributes.expressID;
      this.fragments.set(bottomMemberId, this.newFragment());
      this.geometries.set(bottomMemberId, bottomMember.body);
      this.bottomMembers.push(bottomMember);

      for (let currentRow = 0; currentRow < this.numberOfRows; currentRow++) {
        if (currentColumn === 0) {
          const sideAMember = new SimpleMemberType(model).addInstance();
          const sideAMemberId = sideAMember.body.attributes.expressID;
          this.fragments.set(sideAMemberId, this.newFragment());
          this.geometries.set(sideAMemberId, sideAMember.body);
          this.sideAMembers.push(sideAMember);
        }

        if (currentRow > 0) {
          const middleHorizontalMember = new SimpleMemberType(
            model,
          ).addInstance();
          const middleHorizontalMemberId =
            middleHorizontalMember.body.attributes.expressID;
          this.fragments.set(middleHorizontalMemberId, this.newFragment());
          this.geometries.set(
            middleHorizontalMemberId,
            middleHorizontalMember.body,
          );
          this.middleHorizontalMembers.push(middleHorizontalMember);
        }

        if (currentColumn > 0) {
          const middleVerticalMember = new SimpleMemberType(
            model,
          ).addInstance();
          const middleVerticalMemberId =
            middleVerticalMember.body.attributes.expressID;
          this.fragments.set(middleVerticalMemberId, this.newFragment());
          this.geometries.set(
            middleVerticalMemberId,
            middleVerticalMember.body,
          );
          this.middleVerticalMembers.push(middleVerticalMember);
        }

        if (currentColumn === this.numberOfColumns - 1) {
          const sideBMember = new SimpleMemberType(model).addInstance();
          const sideBMemberId = sideBMember.body.attributes.expressID;
          this.fragments.set(sideBMemberId, this.newFragment());
          this.geometries.set(sideBMemberId, sideBMember.body);
          this.sideBMembers.push(sideBMember);
        }

        const plate = new SimplePlateType(model).addInstance();
        const plateId = plate.body.attributes.expressID;
        this.fragments.set(plateId, this.newFragment());
        this.geometries.set(plateId, plate.body);
        this.plates.push(plate);
      }
      const topMember = new SimpleMemberType(model).addInstance();
      const topMemberId = topMember.body.attributes.expressID;
      this.fragments.set(topMemberId, this.newFragment());
      this.geometries.set(topMemberId, topMember.body);
      this.topMembers.push(topMember);
    }

    const array: any[] = [];
    const components = array.concat(
      this.plates,
      this.sideAMembers,
      this.sideBMembers,
      this.bottomMembers,
      this.topMembers,
      this.middleHorizontalMembers,
      this.middleVerticalMembers,
    );

    return components.map((component) => component.body.attributes);
  }

  //   updateComponentGeometries(model: Model = this.model) {
  //     const memberWidth = new SimpleMemberType(model).addInstance().width;
  //     const plateWidth = this.length / this.numberOfColumns - memberWidth;
  //     const plateHeight = (this.height - (this.numberOfRows + 1) * memberWidth) / this.numberOfRows;
  //     const deltaX = (this.endPoint.x - this.startPoint.x) / this.numberOfColumns;
  //     const deltaY = (this.endPoint.y - this.startPoint.y) / this.numberOfColumns;
  //     const rotationY = Math.atan2(this.endPoint.x - this.startPoint.x, this.endPoint.y - this.startPoint.y);

  //     for (let currentColumn = 0; currentColumn < this.numberOfColumns; currentColumn++) {
  //         const posX = this.startPoint.x + currentColumn * deltaX;
  //         const posY = this.startPoint.y + currentColumn * deltaY;

  //         const bottomMember = this.bottomMembers[currentColumn];
  //         bottomMember.body.profile.dimension.x = this.frameWidth;
  //         bottomMember.body.depth = this.length / this.numberOfColumns;
  //         bottomMember.body.position.set(posX, posY, memberWidth / 2);
  //         bottomMember.body.rotation.set(Math.PI / -2, rotationY, 0);
  //         bottomMember.body.profile.update();
  //         bottomMember.body.update();

  //         for (let currentRow = 0; currentRow < this.numberOfRows; currentRow++) {
  //             const nonInitialVerticalRowLocation = memberWidth + currentRow * (plateHeight + memberWidth);

  //             if (currentColumn === 0) {
  //                 const sideAMember = this.sideAMembers[currentRow];
  //                 console.log(currentRow)
  //                 console.log(this.sideAMembers)
  //                 console.log('here!!!!!!!!!!!!!!!!!!!')
  //                 sideAMember.body.profile.dimension.x = this.frameWidth;
  //                 sideAMember.body.profile.position.y = memberWidth/2
  //                 sideAMember.body.depth = plateHeight;
  //                 sideAMember.body.position.set(this.startPoint.x, this.startPoint.y, currentRow > 0 ? nonInitialVerticalRowLocation : memberWidth);
  //                 sideAMember.body.rotation.set(0, 0, -rotationY);
  //                 sideAMember.body.profile.update();
  //                 sideAMember.body.update();
  //             }

  //             if (currentColumn === this.numberOfColumns - 1) {
  //                 const sideBMember = this.sideBMembers[currentRow];
  //                 sideBMember.body.profile.dimension.x = this.frameWidth;
  //                 sideBMember.body.profile.position.y = -1 * (memberWidth/2)
  //                 sideBMember.body.depth = plateHeight;
  //                 sideBMember.body.position.set(this.endPoint.x, this.endPoint.y, currentRow > 0 ? nonInitialVerticalRowLocation : memberWidth);
  //                 sideBMember.body.rotation.set(0, 0, -rotationY);
  //                 sideBMember.body.profile.update();
  //                 sideBMember.body.update();
  //             }

  //             if (currentRow > 0) {
  //                 const middleHorizontalMember = this.middleHorizontalMembers[currentColumn * (this.numberOfRows - 1) + (currentRow - 1)];
  //                 middleHorizontalMember.body.profile.dimension.x = this.frameWidth;
  //                 middleHorizontalMember.body.depth = this.length / this.numberOfColumns;
  //                 middleHorizontalMember.body.position.set(posX, posY, nonInitialVerticalRowLocation - memberWidth / 2);
  //                 middleHorizontalMember.body.rotation.set(Math.PI / -2, rotationY, 0);
  //                 middleHorizontalMember.body.profile.update();
  //                 middleHorizontalMember.body.update();
  //             }

  //             if (currentColumn > 0 && currentRow < this.numberOfRows) {
  //                 const middleVerticalMember = this.middleVerticalMembers[(currentColumn - 1) * this.numberOfRows + currentRow];
  //                 middleVerticalMember.body.profile.dimension.x = this.frameWidth;
  //                 middleVerticalMember.body.depth = plateHeight;
  //                 middleVerticalMember.body.position.set(posX, posY, currentRow > 0 ? nonInitialVerticalRowLocation : memberWidth);
  //                 middleVerticalMember.body.rotation.set(0, 0, -rotationY);
  //                 middleVerticalMember.body.profile.update();
  //                 middleVerticalMember.body.update();
  //             }

  //             const plate = this.plates[currentColumn * this.numberOfRows + currentRow];
  //             plate.body.profile.dimension.y = plateWidth;
  //             plate.body.depth = plateHeight;
  //             plate.body.position.set(posX + deltaX / 2, posY + deltaY / 2, currentRow > 0 ? nonInitialVerticalRowLocation : memberWidth);
  //             plate.body.rotation.z = -rotationY;
  //             plate.body.profile.update();
  //             plate.body.update();
  //         }

  //         const topMember = this.topMembers[currentColumn];
  //         topMember.body.profile.dimension.x = this.frameWidth;
  //         topMember.body.depth = this.length / this.numberOfColumns;
  //         topMember.body.position.set(posX, posY, this.height - memberWidth / 2);
  //         topMember.body.rotation.set(Math.PI / -2, rotationY, 0);
  //         topMember.body.profile.update();
  //         topMember.body.update();
  //     }
  // }

  updateComponentGeometries(model: Model = this.model) {
    const memberWidth = new SimpleMemberType(model).addInstance().width;
    const plateWidth = this.length / this.numberOfColumns - memberWidth;
    const plateHeight =
      (this.height - (this.numberOfRows + 1) * memberWidth) / this.numberOfRows;

    for (
      let currentColumn = 0;
      currentColumn < this.numberOfColumns;
      currentColumn++
    ) {
      const bottomMember = this.bottomMembers[currentColumn];
      bottomMember.body.profile.dimension.x = this.frameWidth;
      bottomMember.body.depth = this.length / this.numberOfColumns;
      bottomMember.body.position.x =
        this.startPoint.x +
        (currentColumn / this.numberOfColumns) *
          (this.endPoint.x - this.startPoint.x);
      bottomMember.body.position.y =
        this.startPoint.y +
        (currentColumn / this.numberOfColumns) *
          (this.endPoint.y - this.startPoint.y);
      bottomMember.body.position.z = memberWidth / 2;
      bottomMember.body.rotation.x = Math.PI / -2;
      bottomMember.body.rotation.y = Math.atan2(
        this.endPoint.x - this.startPoint.x,
        this.endPoint.y - this.startPoint.y,
      );

      if (currentColumn === this.numberOfColumns - 1) {
        bottomMember.body.depth = this.length / this.numberOfColumns;
      }

      bottomMember.body.profile.update();
      bottomMember.body.update();

      for (let currentRow = 0; currentRow < this.numberOfRows; currentRow++) {
        const nonInitialVerticalRowLocation =
          memberWidth + currentRow * (plateHeight + memberWidth);

        if (currentColumn === 0) {
          const sideAMember = this.sideAMembers[currentRow];
          sideAMember.body.profile.dimension.x = this.frameWidth;
          sideAMember.body.profile.transformation.position.y = memberWidth / 2;
          sideAMember.body.depth = plateHeight;
          sideAMember.body.position.x = this.startPoint.x;
          sideAMember.body.position.y = this.startPoint.y;
          sideAMember.body.position.z = memberWidth;
          sideAMember.body.rotation.z =
            -1 *
            Math.atan2(
              this.endPoint.x - this.startPoint.x,
              this.endPoint.y - this.startPoint.y,
            );

          if (currentRow > 0) {
            sideAMember.body.position.z = nonInitialVerticalRowLocation;
          }

          sideAMember.body.profile.update();
          sideAMember.body.update();
        }

        if (currentRow > 0) {
          const middleHorizontalMember =
            this.middleHorizontalMembers[
              currentColumn * (this.numberOfRows - 1) + (currentRow - 1)
            ];
          middleHorizontalMember.body.profile.dimension.x = this.frameWidth;
          middleHorizontalMember.body.depth =
            this.length / this.numberOfColumns;
          middleHorizontalMember.body.position.x =
            this.startPoint.x +
            (currentColumn / this.numberOfColumns) *
              (this.endPoint.x - this.startPoint.x);
          middleHorizontalMember.body.position.y =
            this.startPoint.y +
            (currentColumn / this.numberOfColumns) *
              (this.endPoint.y - this.startPoint.y);
          middleHorizontalMember.body.position.z =
            nonInitialVerticalRowLocation - memberWidth / 2;
          middleHorizontalMember.body.rotation.x = Math.PI / -2;
          middleHorizontalMember.body.rotation.y = Math.atan2(
            this.endPoint.x - this.startPoint.x,
            this.endPoint.y - this.startPoint.y,
          );

          middleHorizontalMember.body.profile.update();
          middleHorizontalMember.body.update();
        }

        if (currentColumn > 0) {
          const middleVerticalMember =
            this.middleVerticalMembers[
              (currentColumn - 1) * this.numberOfRows + currentRow
            ];
          middleVerticalMember.body.profile.dimension.x = this.frameWidth;
          middleVerticalMember.body.depth = plateHeight;
          middleVerticalMember.body.position.x =
            this.startPoint.x +
            (currentColumn / this.numberOfColumns) *
              (this.endPoint.x - this.startPoint.x);
          middleVerticalMember.body.position.y =
            this.startPoint.y +
            (currentColumn / this.numberOfColumns) *
              (this.endPoint.y - this.startPoint.y);
          middleVerticalMember.body.position.z = memberWidth;
          middleVerticalMember.body.rotation.z =
            -1 *
            Math.atan2(
              this.endPoint.x - this.startPoint.x,
              this.endPoint.y - this.startPoint.y,
            );

          if (currentRow > 0) {
            middleVerticalMember.body.position.z =
              nonInitialVerticalRowLocation;
          }
          middleVerticalMember.body.profile.update();
          middleVerticalMember.body.update();
        }

        if (currentColumn === this.numberOfColumns - 1) {
          const sideBMember = this.sideBMembers[currentRow];
          sideBMember.body.profile.transformation.position.y =
            -1 * (memberWidth / 2);
          sideBMember.body.profile.dimension.x = this.frameWidth;
          sideBMember.body.depth = plateHeight;
          sideBMember.body.position.x = this.endPoint.x;
          sideBMember.body.position.y = this.endPoint.y;
          sideBMember.body.position.z = memberWidth;
          sideBMember.body.rotation.z =
            -1 *
            Math.atan2(
              this.endPoint.x - this.startPoint.x,
              this.endPoint.y - this.startPoint.y,
            );

          if (currentRow > 0) {
            sideBMember.body.position.z = nonInitialVerticalRowLocation;
          }

          sideBMember.body.profile.update();
          sideBMember.body.update();
        }

        const plate =
          this.plates[currentColumn * this.numberOfRows + currentRow];
        plate.body.profile.dimension.y = plateWidth;
        plate.body.depth = plateHeight;
        plate.body.position.z = memberWidth;
        plate.body.position.x =
          this.startPoint.x +
          (this.endPoint.x - this.startPoint.x) / this.numberOfColumns / 2 +
          (currentColumn / this.numberOfColumns) *
            (this.endPoint.x - this.startPoint.x);
        plate.body.position.y =
          this.startPoint.y +
          (this.endPoint.y - this.startPoint.y) / this.numberOfColumns / 2 +
          (currentColumn / this.numberOfColumns) *
            (this.endPoint.y - this.startPoint.y);
        plate.body.rotation.z =
          -1 *
          Math.atan2(
            this.endPoint.x - this.startPoint.x,
            this.endPoint.y - this.startPoint.y,
          );

        if (currentRow > 0) {
          plate.body.position.z = nonInitialVerticalRowLocation;
        }

        if (currentColumn === 0 || currentColumn === this.numberOfColumns - 1) {
          plate.body.profile.dimension.y = plateWidth - memberWidth / 2;
          plate.body.profile.transformation.position.y = memberWidth / 4;
        }

        if (currentColumn === this.numberOfColumns - 1) {
          plate.body.profile.transformation.position.y = -memberWidth / 4;
        }

        plate.body.profile.update();
        plate.body.update();
      }

      const topMember = this.topMembers[currentColumn];
      topMember.body.profile.dimension.x = this.frameWidth;
      topMember.body.depth = this.length / this.numberOfColumns;
      topMember.body.position.x =
        this.startPoint.x +
        (currentColumn / this.numberOfColumns) *
          (this.endPoint.x - this.startPoint.x);
      topMember.body.position.y =
        this.startPoint.y +
        (currentColumn / this.numberOfColumns) *
          (this.endPoint.y - this.startPoint.y);
      topMember.body.position.z = this.height - memberWidth / 2;
      topMember.body.rotation.x = Math.PI / -2;
      topMember.body.rotation.y = Math.atan2(
        this.endPoint.x - this.startPoint.x,
        this.endPoint.y - this.startPoint.y,
      );

      topMember.body.profile.update();
      topMember.body.update();
    }
  }
  protected createElement() {
    return new SimpleCurtainWall(this.model, this);
  }
}
