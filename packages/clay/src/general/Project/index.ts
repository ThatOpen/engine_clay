import { IFC4X3 as IFC } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import * as THREE from "three";
import { ClayObject, Model } from "../../core";
import { ClippingPlaneType } from "../../elements";
import { IfcUtils } from "../../utils/ifc-utils";
import { SpatialChildren } from "../SpatialChildren";

export class Project extends ClayObject {
  attributes: IFC.IfcProject;

  ownerHistory: IFC.IfcOwnerHistory;

  spatialChildren: SpatialChildren;

  constructor(model: Model) {
    super(model);

    if (!this.model.types.has("clipping-planes")) {
      this.model.types.set("clipping-planes", new ClippingPlaneType(model));
    }

    const organization = new IFC.IfcOrganization(
      null,
      new IFC.IfcLabel("That Open Company"),
      null,
      null,
      null,
    );

    const person = new IFC.IfcPerson(
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );

    const personAndOrganization = new IFC.IfcPersonAndOrganization(
      person,
      organization,
      null,
    );

    const application = new IFC.IfcApplication(
      organization,
      new IFC.IfcLabel("2.4.0"),
      new IFC.IfcLabel("CLAY"),
      new IFC.IfcLabel("CLAY"),
    );

    this.ownerHistory = new IFC.IfcOwnerHistory(
      personAndOrganization,
      application,
      null,
      IFC.IfcChangeActionEnum.NOTDEFINED,
      null,
      null,
      null,
      new IFC.IfcTimeStamp(new Date().getTime()),
    );

    const context = new IFC.IfcGeometricRepresentationContext(
      null,
      null,
      new IFC.IfcDimensionCount(3),
      new IFC.IfcReal(1.0e-5),
      new IFC.IfcAxis2Placement3D(
        IfcUtils.point(new THREE.Vector3()),
        null,
        null,
      ),
      null,
    );

    const lengthUnit = new IFC.IfcSIUnit(
      IFC.IfcUnitEnum.LENGTHUNIT,
      null,
      IFC.IfcSIUnitName.METRE,
    );

    const areaUnit = new IFC.IfcSIUnit(
      IFC.IfcUnitEnum.AREAUNIT,
      null,
      IFC.IfcSIUnitName.SQUARE_METRE,
    );

    const volumeUnit = new IFC.IfcSIUnit(
      IFC.IfcUnitEnum.AREAUNIT,
      null,
      IFC.IfcSIUnitName.SQUARE_METRE,
    );

    const units = new IFC.IfcUnitAssignment([lengthUnit, areaUnit, volumeUnit]);

    this.attributes = new IFC.IfcProject(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      this.ownerHistory,
      null,
      null,
      null,
      null,
      null,
      [context],
      units,
    );

    this.model.set(this.attributes);

    this.spatialChildren = new SpatialChildren(
      model,
      this.ownerHistory,
      this.attributes,
    );
  }

  update(): void {
    this.model.set(this.attributes);
  }
}
