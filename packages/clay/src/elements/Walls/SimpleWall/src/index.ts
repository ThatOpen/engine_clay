import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";
import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model, ClayElement, ClayGeometry } from "../../../../core";
import { IfcUtils } from "../../../../utils/ifc-utils";

import { Extrusion, RectangleProfile } from "../../../../geometries";
import { SimpleWallType } from "../index";

export class SimpleWall extends ClayElement {
  attributes: IFC.IfcWall;

  type: SimpleWallType;

  body: Extrusion<RectangleProfile>;

  height = 3;

  elevation = 0;

  startPoint = new THREE.Vector2(0, 0);

  endPoint = new THREE.Vector2(1, 0);

  private _openings = new Map<
    number,
    { opening: ClayElement; distance: number }
  >();

  // private _corners = new Map<
  //   number,
  //   { wall: SimpleWall; atTheEndPoint: boolean }
  // >();

  // private _halfSpaces = new Map<number, { halfSpace: HalfSpace }>();

  get length() {
    return this.startPoint.distanceTo(this.endPoint);
  }

  get midPoint() {
    const start = this.startPoint3D;
    const end = this.endPoint3D;
    return new THREE.Vector3(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      (start.z + end.z) / 2,
    );
  }

  get direction() {
    const vector = new THREE.Vector3();
    vector.subVectors(this.endPoint3D, this.startPoint3D);
    vector.normalize();
    return vector;
  }

  get startPoint3D() {
    const { x, y } = this.startPoint;
    return new THREE.Vector3(x, y, this.elevation);
  }

  get endPoint3D() {
    const { x, y } = this.endPoint;
    return new THREE.Vector3(x, y, this.elevation);
  }

  constructor(model: Model, type: SimpleWallType) {
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

    this.attributes = new IFC.IfcWall(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      placement,
      shape,
      null,
      null,
    );

    this.model.set(this.attributes);
  }

  update(updateGeometry: boolean = false) {
    this.updateAllOpenings();

    const profile = this.body.profile;
    profile.dimension.x = this.length;
    profile.dimension.y = this.type.width;
    profile.update();

    this.body.depth = this.height;
    this.body.update();

    const dir = this.direction;
    this.rotation.z = Math.atan2(dir.y, dir.x);
    this.position = this.midPoint;

    const shape = this.model.get(this.attributes.Representation);
    const reps = this.model.get(shape.Representations[0]);
    reps.Items = [this.body.attributes];
    this.model.set(reps);

    this.updateGeometryID();
    super.update(updateGeometry);

    // if (updateCorners) this.updateAllCorners();
  }

  // extend(wall: SimpleWall, atTheEndPoint = true) {
  //   const zDirection = new THREE.Vector3(0, 0, 1);
  //   const normalVector = wall.direction.cross(zDirection);
  //   const correctedNormalVector = new THREE.Vector3(
  //     normalVector.x,
  //     normalVector.z,
  //     normalVector.y * -1,
  //   );
  //
  //   const coplanarPoint = new THREE.Vector3(
  //     wall.startPoint.x,
  //     wall.startPoint.z,
  //     wall.startPoint.y * -1,
  //   );
  //
  //   const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
  //     correctedNormalVector,
  //     coplanarPoint,
  //   );
  //
  //   const correctedDirection = new THREE.Vector3(
  //     this.direction.x * -1,
  //     this.direction.z,
  //     this.direction.y,
  //   );
  //
  //   if (atTheEndPoint) correctedDirection.negate();
  //
  //   const origin = atTheEndPoint ? this.startPoint : this.endPoint;
  //
  //   const rayOriginPoint = new THREE.Vector3(origin.x, origin.z, origin.y * -1);
  //
  //   const rayAxisWall1 = new THREE.Ray(rayOriginPoint, correctedDirection);
  //   const intersectionPoint = rayAxisWall1.intersectPlane(
  //     plane,
  //     new THREE.Vector3(),
  //   );
  //
  //   if (intersectionPoint) {
  //     const correctedIntersectionPoint = new THREE.Vector3(
  //       intersectionPoint?.x,
  //       intersectionPoint?.z * -1,
  //       intersectionPoint?.y,
  //     );
  //
  //     wall.update(true);
  //     this.update(true);
  //
  //     return correctedIntersectionPoint;
  //   }
  //   return null;
  // }

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

  addSubtraction(element: ClayElement) {
    super.addSubtraction(element);
    this.setSubtraction(element);
    this.updateGeometryID();
  }

  removeSubtraction(element: ClayElement) {
    super.removeSubtraction(element);
    this._openings.delete(element.attributes.expressID);
    this.updateGeometryID();
  }

  setSubtraction(element: ClayElement) {
    const wallPlane = new THREE.Plane();

    const tempPoint = this.startPoint3D;
    tempPoint.z += 1;
    wallPlane.setFromCoplanarPoints(
      tempPoint,
      this.startPoint3D,
      this.endPoint3D,
    );

    const newPosition = new THREE.Vector3();
    wallPlane.projectPoint(element.position, newPosition);

    element.position.copy(newPosition);
    element.update();

    // The distance is signed, so that it also supports openings that are
    // before the startPoint by using the dot product
    let distance = newPosition.distanceTo(this.startPoint3D);
    const vector = new THREE.Vector3();
    vector.subVectors(newPosition, this.startPoint3D);
    const dotProduct = vector.dot(this.direction);
    distance *= dotProduct > 0 ? 1 : -1;

    const id = element.attributes.expressID;

    this._openings.set(id, { opening: element, distance });
  }

  private updateAllOpenings() {
    const start = this.startPoint3D;
    const dir = this.direction;
    for (const [_id, { opening, distance }] of this._openings) {
      const pos = dir.clone().multiplyScalar(distance).add(start);

      // Align opening to wall
      opening.position.x = pos.x;
      opening.position.y = pos.y;
      opening.rotation.z = this.rotation.z;

      opening.update();
    }
  }

  private updateGeometryID() {
    const modelID = this.model.modelID;
    const id = this.attributes.expressID;
    this.model.ifcAPI.StreamMeshes(modelID, [id], (ifcMesh) => {
      const newGeometry = ifcMesh.geometries.get(0);
      const newGeomID = newGeometry.geometryExpressID;
      const oldGeomID = this.geometries.values().next().value;

      this.geometries.clear();
      this.geometries.add(newGeomID);

      const frag = this.type.fragments.get(oldGeomID) as FRAGS.Fragment;
      this.type.fragments.delete(oldGeomID);
      this.type.fragments.set(newGeomID, frag);

      const geometry = this.type.geometries.get(oldGeomID) as ClayGeometry;
      this.type.geometries.delete(oldGeomID);
      this.type.geometries.set(newGeomID, geometry);
    });
  }
}
