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

  radiansToDegrees(radians: number) {
    return radians * (180 / Math.PI);
  }

  degreesToRadians(degree: number) {
    return (degree * Math.PI) / 180;
  }

  calculatePoints(midPoint: number[], length: number, angle: number) {
    const radians = this.degreesToRadians(angle);
    const halfLength = length / 2;

    const startPoint = [
      midPoint[0] - halfLength * Math.cos(radians),
      midPoint[1] - halfLength * Math.sin(radians),
    ];
    const endPoint = [
      midPoint[0] + halfLength * Math.cos(radians),
      midPoint[1] + halfLength * Math.sin(radians),
    ];
    return [startPoint, endPoint];
  }

  calculateRotationAngleFromDirection(direction: number[]) {
    return Math.atan2(direction[0], direction[1]);
  }

  calculateRotationAngleFromTwoPoints(
    firstPoint: number[],
    secondPoint: number[],
  ) {
    const dx = secondPoint[0] - firstPoint[0];
    const dy = secondPoint[1] - firstPoint[1];
    return Math.atan2(dy, dx);
  }

  rotate(firstPoint: number[], secondPoint: number[], degree: number) {
    const theta = this.degreesToRadians(degree);
    const midPoint = [
      (firstPoint[0] + secondPoint[0]) / 2,
      (firstPoint[1] + secondPoint[1]) / 2,
      (firstPoint[2] + secondPoint[2]) / 2,
    ];

    return [firstPoint, secondPoint].map((point) => {
      const x = point[0] - midPoint[0];
      const y = point[1] - midPoint[1];
      return [
        x * Math.cos(theta) - y * Math.sin(theta) + midPoint[0],
        x * Math.sin(theta) + y * Math.cos(theta) + midPoint[1],
        midPoint[2],
      ];
    });
  }

  calculateEndPoint(
    startPoint: number[],
    direction: number[],
    magnitude: number,
  ) {
    const vectorMagnitude = Math.sqrt(
      direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2,
    );
    const unitVector = direction.map(
      (component) => component / vectorMagnitude,
    );
    const displacementVector = unitVector.map(
      (component) => component * magnitude,
    );
    return [
      startPoint[0] + displacementVector[0],
      startPoint[1] + displacementVector[1],
      startPoint[2] + displacementVector[2],
    ];
  }

  pointsDistance(firstPoint: number[], secondPoint: number[]) {
    const dx = firstPoint[0] - secondPoint[0];
    const dy = firstPoint[1] - secondPoint[1];
    const dz = firstPoint[2] - secondPoint[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  representationContext() {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcRepresentationContext>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCREPRESENTATIONCONTEXT,
      this.label("Body"),
      this.label("Model"),
    );
  }

  productDefinitionShape(representations: WEBIFC.IFC4X3.IfcRepresentation[]) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcProductDefinitionShape>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCPRODUCTDEFINITIONSHAPE,
      this.label(""),
      this.label(""),
      representations,
    );
  }

  shapeRepresentation(
    identifier: string,
    type: string,
    representation: WEBIFC.IFC4X3.IfcRepresentationItem,
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcShapeRepresentation>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCSHAPEREPRESENTATION,
      this.representationContext(),
      this.label(identifier),
      this.label(type),
      [representation],
    );
  }

  polyline(points: number[][]) {
    const listOfPoints = points.map((point) => this.cartesianPoint(point));
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcPolyline>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCPOLYLINE,
      listOfPoints,
    );
  }

  guid(value: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcGloballyUniqueId>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCGLOBALLYUNIQUEID,
      value,
    );
  }

  identifier(value: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcIdentifier>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCIDENTIFIER,
      value,
    );
  }

  real(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcReal>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCREAL,
      value,
    );
  }

  label(text: string) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcLabel>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCLABEL,
      text,
    );
  }

  length(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcLengthMeasure>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCLENGTHMEASURE,
      value,
    );
  }

  positiveLength(value: number) {
    return createIfcType<typeof WEBIFC.IFC4X3.IfcPositiveLengthMeasure>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCPOSITIVELENGTHMEASURE,
      value,
    );
  }

  objectPlacement(
    placementRelTo: WEBIFC.IFC4X3.IfcObjectPlacement | null = null,
  ) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcObjectPlacement>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCAXIS2PLACEMENT2D,
      placementRelTo,
    );
  }

  direction(values: number[]) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcDirection>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCDIRECTION,
      this.vector(values, "REAL"),
    );
  }

  cartesianPoint(values: number[]) {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcCartesianPoint>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCCARTESIANPOINT,
      this.vector(values, "LENGTH"),
    );
  }

  point() {
    return createIfcEntity<typeof WEBIFC.IFC4X3.IfcPoint>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCCARTESIANPOINT,
    );
  }

  axis2Placement2D(
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

  axis2Placement3D(
    location: number[] | WEBIFC.IFC4X3.IfcCartesianPoint,
    axis: number[] | WEBIFC.IFC4X3.IfcDirection | null = null,
    direction: number[] | WEBIFC.IFC4X3.IfcDirection | null = null,
  ) {
    if (Array.isArray(location)) location = this.cartesianPoint(location);
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

  bool(
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

  vector(values: number[], type: keyof Types) {
    if (!this.types[type]) throw new Error(`Type not found: ${type}`);
    const action = this.types[type];
    return values.map((value) => action(value));
  }
}
