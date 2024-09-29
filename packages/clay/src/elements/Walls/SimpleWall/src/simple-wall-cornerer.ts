export class SimpleWallCornerer {
  // private _corners = new Map<
  //   number,
  //   { wall: SimpleWall; atTheEndPoint: boolean }
  // >();
  // private _halfSpaces = new Map<number, { halfSpace: HalfSpace }>();
}

// private calculateDistances(
//   wall: SimpleWall,
//   atTheEndPoint: boolean,
//   intersectionPoint: THREE.Vector3,
// ) {
//   const distance1 = this.midPoint.distanceTo(intersectionPoint);
//   const distance2 = wall.midPoint.distanceTo(intersectionPoint);
//
//   const distance3 = this.startPoint.distanceTo(this.midPoint);
//   const distance4 = this.startPoint.distanceTo(intersectionPoint);
//
//   const distance5 = wall.startPoint.distanceTo(wall.midPoint);
//   const distance6 = wall.startPoint.distanceTo(intersectionPoint);
//
//   let sign1 = 1;
//   let sign2 = 1;
//
//   if (distance3 <= distance4 && distance5 <= distance6) {
//     sign1 = atTheEndPoint ? 1 : -1;
//     sign2 = atTheEndPoint ? 1 : -1;
//   } else if (distance3 >= distance4 && distance5 >= distance6) {
//     sign1 = -1;
//     sign2 = -1;
//   } else if (distance3 >= distance4 && distance5 <= distance6) {
//     sign1 = 1;
//     sign2 = -1;
//   } else if (distance3 < distance4 && distance5 > distance6) {
//     sign1 = -1;
//     sign2 = 1;
//   }
//
//   const sign3 = atTheEndPoint ? 1 : -1;
//
//   return {
//     distance1,
//     distance2,
//     sign1,
//     sign2,
//     sign3,
//   };
// }

// private updateAllCorners() {
//   for (const [_id, { wall, atTheEndPoint }] of this._corners) {
//     const intersectionPoint = this.extend(wall, atTheEndPoint);
//     if (!intersectionPoint) return;
//
//     const angle = wall.rotation.z - this.rotation.z;
//
//     const width1 = this.type.width;
//     const width2 = wall.type.width;
//
//     const { distance1, distance2, sign1, sign2, sign3 } =
//       this.calculateDistances(wall, atTheEndPoint, intersectionPoint);
//
//     for (const [_id, { halfSpace }] of wall._halfSpaces) {
//       halfSpace.position.x =
//         sign2 * distance1 + width1 / (2 * Math.sin(angle));
//       halfSpace.rotation.y = sign3 * angle;
//       halfSpace.rotation.x = (sign3 * Math.PI) / 2;
//       halfSpace.update();
//     }
//
//     for (const [_id, { halfSpace }] of this._halfSpaces) {
//       halfSpace.position.x =
//         sign1 * distance2 + width2 / (2 * Math.sin(angle));
//       halfSpace.rotation.y = angle;
//       halfSpace.rotation.x = -Math.PI / 2;
//       halfSpace.update();
//     }
//
//     wall.update(true);
//   }
//   this.update(true);
// }

// addCorner(wall: SimpleWall, atTheEndPoint = true) {
//   const intersectionPoint = this.extend(wall, atTheEndPoint);
//
//   if (!intersectionPoint) return;
//
//   const angle = wall.rotation.z - this.rotation.z;
//
//   const width1 = this.type.width;
//   const width2 = wall.type.width;
//
//   const { distance1, distance2, sign1, sign2, sign3 } =
//     this.calculateDistances(wall, atTheEndPoint, intersectionPoint);
//
//   const hsExteriorWall1 = new HalfSpace(this.model);
//   hsExteriorWall1.position.x =
//     sign1 * distance2 + width2 / (2 * Math.sin(angle));
//   hsExteriorWall1.rotation.y = angle;
//   hsExteriorWall1.rotation.x = -Math.PI / 2;
//   hsExteriorWall1.update();
//
//   const hsInteriorWall2 = new HalfSpace(this.model);
//   hsInteriorWall2.position.x =
//     sign2 * distance1 + width1 / (2 * Math.sin(angle));
//   hsInteriorWall2.rotation.y = sign3 * angle;
//   hsInteriorWall2.rotation.x = (sign3 * Math.PI) / 2;
//   hsInteriorWall2.update();
//
//   this.body.addSubtraction(hsInteriorWall2);
//   wall.body.addSubtraction(hsExteriorWall1);
//
//   wall.update(true);
//   this.update(true);
//
//   this._corners.set(wall.attributes.expressID, {
//     wall,
//     atTheEndPoint,
//   });
//
//   wall._corners.set(this.attributes.expressID, {
//     wall: this,
//     atTheEndPoint,
//   });
//
//   const hsInteriorWall2Id = hsInteriorWall2.attributes.expressID;
//   const hsExteriorWall1Id = hsExteriorWall1.attributes.expressID;
//
//   wall._halfSpaces.set(hsInteriorWall2Id, {
//     halfSpace: hsInteriorWall2,
//   });
//
//   this._halfSpaces.set(hsExteriorWall1Id, {
//     halfSpace: hsExteriorWall1,
//   });
// }
