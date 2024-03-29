import * as THREE from "three";
import { Handle, IFC4X3 as IFC } from "web-ifc";
import { Profile } from "../Profile";
import { Model } from "../../../base";
import { IfcUtils } from "../../../utils/ifc-utils";

export class ArbitraryClosedProfile extends Profile {
  attributes: IFC.IfcArbitraryClosedProfileDef;

  dimension = new THREE.Vector3(1, 1, 0);

  rotation = new THREE.Euler(0, 0, 0);

  position = new THREE.Vector3(0, 0, 0);

  points = new Map<number, THREE.Vector3>();

  constructor(model: Model) {
    super(model);

    this.attributes = new IFC.IfcArbitraryClosedProfileDef(
      IFC.IfcProfileTypeEnum.CURVE,
      null,
      new IFC.IfcPolyline([])
    );

    this.model.set(this.attributes);
  }

  addPoint(x: number, y: number, z: number) {
    const point = new THREE.Vector3(x,y,z)
    const ifcPoint = IfcUtils.point(point);

    const polyLine = this.model.get(this.attributes.OuterCurve) as IFC.IfcPolyline;

    polyLine.Points.push(ifcPoint)

    this.model.set(polyLine)
    this.model.set(ifcPoint);
    this.points.set(ifcPoint.expressID, point);

    this.update();
  }

  removePoint(id: number) {
    this.points.delete(id);
    const polyLine = this.model.get(this.attributes.OuterCurve) as IFC.IfcPolyline;
    const points = polyLine.Points as Handle<IFC.IfcCartesianPoint>[];
    polyLine.Points = points.filter((point) => point.value !== id);
    this.model.set(polyLine);
  }

  update() {
    const polyLine = this.model.get(this.attributes.OuterCurve) as IFC.IfcPolyline;

    for (const pointRef of polyLine.Points) {
      const point = this.model.get(pointRef);

      const threePoint = this.points.get(point.expressID);
      
      if (!threePoint) {
        throw new Error("Point not found!");
      }
      const { x, y, z } = threePoint;
      point.Coordinates[0].value = x;
      point.Coordinates[1].value = y;
      point.Coordinates[2].value = z;
      this.model.set(point);
    }
  }
}