import * as WEBIFC from "web-ifc";
import { createIfcEntity, createIfcType } from "../utils/generics";

type Types = {
  REAL: (value: number) => WEBIFC.IFC4X3.IfcReal;
  LENGTH: (value: number) => WEBIFC.IFC4X3.IfcLengthMeasure;
  POSITIVE_LENGTH: (value: number) => WEBIFC.IFC4X3.IfcPositiveLengthMeasure;
};

export class Base {
  protected types: Types;

  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
  ) {
    this.types = {
      REAL: (value: number) => this.real(value),
      LENGTH: (value: number) => this.length(value),
      POSITIVE_LENGTH: (value: number) => this.positiveLength(value),
    };
  }

  public guid(value: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcGloballyUniqueId>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCGLOBALLYUNIQUEID,
      value,
    );
  }

  public identifier(value: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcIdentifier>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCIDENTIFIER,
      value,
    );
  }

  public real(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcReal>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCREAL,
      value,
    );
  }

  public label(text: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcLabel>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCLABEL,
      text,
    );
  }

  public length(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcLengthMeasure>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCLENGTHMEASURE,
      value,
    );
  }

  public positiveLength(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcPositiveLengthMeasure>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCPOSITIVELENGTHMEASURE,
      value,
    );
  }

  public objectPlacement(
    placementRelTo: WEBIFC.IFC4X3.IfcObjectPlacement | null = null,
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcObjectPlacement>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCAXIS2PLACEMENT2D,
      placementRelTo,
    );
  }

  public opening(
    guid: string,
    placement: WEBIFC.IFC4X3.IfcObjectPlacement,
    mesh: WEBIFC.IFC4X3.IfcProductRepresentation,
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcOpeningElement>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCOPENINGELEMENT,
      this.guid(guid),
      null,
      this.label("name"),
      null,
      this.label("label"),
      placement,
      mesh,
      this.identifier("sadf"),
      null,
    );
  }

  public direction(values: number[]) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcDirection>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCDIRECTION,
      this.vector(values, "REAL"),
    );
  }

  public cartesianPoint(values: number[]) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcCartesianPoint>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCCARTESIANPOINT,
      this.vector(values, "LENGTH"),
    );
  }

  public point() {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcPoint>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCCARTESIANPOINT,
    );
  }

  public axis2Placement2D(
    location: number[] | WEBIFC.IFC4X3.IfcCartesianPoint,
    direction: number[] | WEBIFC.IFC4X3.IfcDirection | null = null,
  ) {
    if (Array.isArray(location)) location = this.cartesianPoint(location);
    if (Array.isArray(direction)) direction = this.direction(direction);
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcAxis2Placement2D>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCAXIS2PLACEMENT2D,
      location,
      direction,
    );
  }

  public axis2Placement3D(
    axis: number[] | WEBIFC.IFC4X3.IfcDirection | null = null,
    direction: number[] | WEBIFC.IFC4X3.IfcDirection | null = null,
  ) {
    const location = this.point();
    if (Array.isArray(axis)) axis = this.direction(axis);
    if (Array.isArray(direction)) direction = this.direction(direction);
    const placement = createIfcEntity<typeof WEBIFC.IFC4X3.IfcAxis2Placement3D>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCAXIS2PLACEMENT3D,
      location,
      axis,
      direction,
    );
    return { placement, location };
  }

  public bool(
    firstOperand: WEBIFC.IFC4X3.IfcBooleanOperand,
    secondOperand: WEBIFC.IFC4X3.IfcBooleanOperand,
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcBooleanClippingResult>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCBOOLEANCLIPPINGRESULT,
      WEBIFC.IFC4X3.IfcBooleanOperator.DIFFERENCE,
      firstOperand,
      secondOperand,
    );
  }

  public vector(values: number[], type: keyof Types) {
    if (!this.types[type]) throw new Error(`Type not found: ${type}`);
    const action = this.types[type];
    return values.map((value) => action(value));
  }
}
