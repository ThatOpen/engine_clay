import * as WEBIFC from "web-ifc";
import { createIfcEntity, createIfcType } from "../../utils/generics";

type Types = {
  REAL: (value: number) => WEBIFC.IFC4X3.IfcReal;
  LENGTH: (value: number) => WEBIFC.IFC4X3.IfcLengthMeasure;
  POSITIVE_LENGTH: (value: number) => WEBIFC.IFC4X3.IfcPositiveLengthMeasure;
};

export abstract class Base {
  protected types: Types;

  constructor(
    protected ifcAPI: WEBIFC.IfcAPI,
    protected modelID: number
  ) {
    this.types = {
      REAL: (value: number) => this.real(value),
      LENGTH: (value: number) => this.length(value),
      POSITIVE_LENGTH: (value: number) => this.positiveLength(value),
    };
  }

  protected guid(value: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcGloballyUniqueId>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCGLOBALLYUNIQUEID,
      value
    );
  }

  protected identifier(value: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcIdentifier>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCIDENTIFIER,
      value
    );
  }

  protected real(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcReal>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCREAL,
      value
    );
  }

  protected label(text: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcLabel>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCLABEL,
      text
    );
  }

  protected length(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcLengthMeasure>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCLENGTHMEASURE,
      value
    );
  }

  protected positiveLength(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcPositiveLengthMeasure>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCPOSITIVELENGTHMEASURE,
      value
    );
  }

  protected direction(values: number[]) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcDirection>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCDIRECTION,
      this.vector(values, "REAL")
    );
  }

  protected cartesianPoint(values: number[]) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcCartesianPoint>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCCARTESIANPOINT,
      this.vector(values, "LENGTH")
    );
  }

  protected point() {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcPoint>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCCARTESIANPOINT
    );
  }

  protected objectPlacement(
    placementRelTo: WEBIFC.IFC4X3.IfcObjectPlacement | null = null
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcObjectPlacement>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCAXIS2PLACEMENT2D,
      placementRelTo
    );
  }

  protected axis2Placement2D(
    location: number[] | WEBIFC.IFC4X3.IfcCartesianPoint,
    direction: number[] | WEBIFC.IFC4X3.IfcDirection | null = null
  ) {
    if (Array.isArray(location)) location = this.cartesianPoint(location);
    if (Array.isArray(direction)) direction = this.direction(direction);
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcAxis2Placement2D>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCAXIS2PLACEMENT2D,
      location,
      direction
    );
  }

  protected axis2Placement3D(
    axis: number[] | WEBIFC.IFC4X3.IfcDirection | null = null,
    direction: number[] | WEBIFC.IFC4X3.IfcDirection | null = null
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
      direction
    );
    return { placement, location };
  }

  protected bool(
    first: WEBIFC.IFC4X3.IfcBooleanOperand,
    second: WEBIFC.IFC4X3.IfcBooleanOperand
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcBooleanClippingResult>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCBOOLEANCLIPPINGRESULT,
      WEBIFC.IFC4X3.IfcBooleanOperator.DIFFERENCE,
      first,
      second
    );
  }

  protected vector(values: number[], type: keyof Types) {
    if (!this.types[type]) throw new Error(`Type not found: ${type}`);
    const action = this.types[type];
    return values.map((value) => action(value));
  }
}
