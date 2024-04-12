import * as THREE from "three";
import * as FRAGS from "bim-fragment";
import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC, IFC2X3 } from "web-ifc";
import { Model } from "../../../../base";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Element } from "../../../Elements/Element";
import { Extrusion, RectangleProfile } from "../../../../geometries";
import { SimpleWallType } from "../index";
import { SimpleOpening } from "../../../Openings";
import { ClayGeometry } from "../../../../geometries/Geometry";

export class SimpleWall extends Element {
  import(): void {}
  attributes: IFC.IfcWall;

  type: SimpleWallType;

  body: Extrusion<RectangleProfile>;

  height = 3;

  startPoint = new THREE.Vector3(0, 0, 0);

  endPoint = new THREE.Vector3(1, 0, 0);

  private _openings = new Map<
    number,
    { opening: SimpleOpening; distance: number }
  >();

  get length() {
    return this.startPoint.distanceTo(this.endPoint);
  }

  get midPoint() {
    return new THREE.Vector3(
      (this.startPoint.x + this.endPoint.x) / 2,
      (this.startPoint.y + this.endPoint.y) / 2,
      (this.startPoint.z + this.endPoint.z) / 2
    );
  }

  get direction() {
    const vector = new THREE.Vector3();
    vector.subVectors(this.endPoint, this.startPoint);
    vector.normalize();
    return vector;
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
      null
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

    super.update(updateGeometry);
  }

  addOpening(opening: SimpleOpening) {
    super.addOpening(opening);
    this.setOpening(opening);
    this.updateGeometryID();
  }

  removeOpening(opening: SimpleOpening) {
    super.removeOpening(opening);
    this._openings.delete(opening.attributes.expressID);
    this.updateGeometryID();
  }

  setOpening(opening: SimpleOpening) {
    const wallPlane = new THREE.Plane();

    const tempPoint = this.startPoint.clone();
    tempPoint.z += 1;
    wallPlane.setFromCoplanarPoints(tempPoint, this.startPoint, this.endPoint);
    const newPosition = new THREE.Vector3();
    wallPlane.projectPoint(opening.position, newPosition);

    opening.position.copy(newPosition);
    opening.update();

    // The distance is signed, so that it also supports openings that are
    // before the startPoint by using the dot product
    let distance = newPosition.distanceTo(this.startPoint);
    const vector = new THREE.Vector3();
    vector.subVectors(newPosition, this.startPoint);
    const dotProduct = vector.dot(this.direction);
    distance *= dotProduct > 0 ? 1 : -1;

    const id = opening.attributes.expressID;

    this._openings.set(id, { opening, distance });
  }

  private updateAllOpenings() {
    const start = this.startPoint;
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

  importProperties(model: Model, wall: IFC2X3.IfcWallStandardCase) {
    const representations = model.get(wall.Representation);
    for (const represent of representations.Representations) {
      const foundRep = model.get(represent);
      const element = model.get(
        foundRep.Items[0]
      ) as IFC2X3.IfcExtrudedAreaSolid;

      const profile = model.get(
        element.SweptArea
      ) as IFC2X3.IfcRectangleProfileDef;

      const position = model.get(element.Position);
      if (position && profile !== undefined) {
        const location = model.get(position.Location);
        if (location && location.Coordinates.length >= 3) {
          const wallThickness = profile.YDim.value;
          const wallLength = profile.XDim.value;

          const profilePosition = model.get(profile.Position);
          const profileLocation = model.get(profilePosition.Location);

          const startPoint = new THREE.Vector3(
            profileLocation.Coordinates[0].value - wallLength / 2,
            profileLocation.Coordinates[1].value - wallThickness / 2,
            0
          );
          const endPoint = new THREE.Vector3(
            startPoint.x + wallLength,
            startPoint.y,
            0
          );

          const placement = model.get(
            wall.ObjectPlacement
          ) as IFC2X3.IfcLocalPlacement;
          const relPlacement = model.get(placement.RelativePlacement);

          try {
            if (relPlacement.RefDirection !== null) {
              const refDirection = model.get(relPlacement.RefDirection);
              const angleRadians = Math.atan2(
                refDirection.DirectionRatios[1],
                refDirection.DirectionRatios[0]
              );

              const rotationMat = new THREE.Matrix4();
              rotationMat.makeRotationZ(angleRadians);
              startPoint.applyMatrix4(rotationMat);
              endPoint.applyMatrix4(rotationMat);
            }
          } catch (error) {
            console.error("Error applying transformation: ", error);
          }

          const relLocation = model.get(relPlacement.Location);
          const relCoordinates = relLocation.Coordinates;

          startPoint.x += relCoordinates[0].value;
          startPoint.y += relCoordinates[1].value;

          endPoint.x += relCoordinates[0].value;
          endPoint.y += relCoordinates[1].value;

          this.startPoint.setX(startPoint.x);
          this.startPoint.setY(startPoint.y);
          this.endPoint.setX(endPoint.x);
          this.endPoint.setY(endPoint.y);
          this.height = element.Depth.value;
          this.body.depth = wallThickness;

          this.update(true);
        }
      }
    }
  }
}
