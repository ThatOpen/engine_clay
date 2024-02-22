import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { createIfcEntity } from "../../../utils/generics";
import { Base } from "../../../base";
import { Family, Subtract } from "../../Family";
import {
  Extrusion,
  RectangleProfile,
  ExtrusionArgs,
  RectangleProfileArgs,
} from "../../../geometries";

type Geometries = {
  profile: RectangleProfile;
  extrusion: Extrusion;
};

type SimpleWallArgs = {
  startPoint: number[];
  endPoint: number[];
  profile: RectangleProfileArgs;
  extrusion: ExtrusionArgs;
};

export class SimpleWall extends Family {
  private _length: number = 0;
  private _height: number = 0;
  private _width: number = 0;
  private _xPosition: number = 0;
  private _yPosition: number = 0;
  private _zPosition: number = 0;
  private _startPoint: number[] = [0, 0, 0];
  private _endPoint: number[] = [0, 0, 0];
  private geometries: Geometries;
  public mesh: THREE.InstancedMesh | null = null;
  private base: Base;
  private wall: WEBIFC.IFC4X3.IfcWall;
  private _subtract: Subtract;

  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
    args: SimpleWallArgs = {
      startPoint: [0, 0, 0],
      endPoint: [5, 0, 0],
      profile: {
        direction: [1, 1], // generated
        position: [0, 0], // generated
        xDim: 5, // generated
        yDim: 3,
      },
      extrusion: {
        direction: [0, 0, 1], // default
        position: [0, 0, 0], // startpoint
        depth: 5,
      },
    },
  ) {
    super();
    this.modelID = modelID;
    this.ifcAPI = ifcAPI;
    this.base = new Base(this.ifcAPI, this.modelID);

    this._startPoint = args.startPoint;
    this._endPoint = args.endPoint;

    this._width = args.profile.yDim;
    this._length = args.profile.xDim;
    this._height = args.extrusion.depth;

    args.profile.xDim = this.base.pointsDistance(
      args.startPoint,
      args.endPoint,
    );

    args.profile.position = [
      (args.endPoint[0] - args.startPoint[0]) / 2,
      (args.endPoint[1] - args.startPoint[1]) / 2,
      (args.endPoint[2] - args.startPoint[2]) / 2,
    ];

    args.extrusion.position = args.startPoint;

    args.profile.direction = [
      args.endPoint[0] - args.startPoint[0],
      args.endPoint[1] - args.startPoint[1],
      args.endPoint[2] - args.startPoint[2],
    ];

    this.geometries = this.createGeometries(args);
    this.mesh = this.geometries.extrusion.mesh;
    this._subtract = { extrusion: this.geometries.extrusion };
    this.wall = this.create();
  }

  private createGeometries(args: SimpleWallArgs) {
    const rectangleProfile = new RectangleProfile(
      this.ifcAPI,
      this.modelID,
      args.profile,
    );

    const extrusion = new Extrusion(
      this.ifcAPI,
      this.modelID,
      rectangleProfile.profile,
      args.extrusion,
      args.profile.direction,
    );

    return {
      profile: rectangleProfile,
      extrusion,
    };
  }

  rotate(degree: number) {
    const [newStartPoint, newEndPoint] = this.base.rotate(
      this._startPoint,
      this._endPoint,
      degree,
    );

    this._startPoint = newStartPoint;
    this._endPoint = newEndPoint;

    this.geometries.profile.profile.XDim.value = this.base.pointsDistance(
      this._startPoint,
      this._endPoint,
    );

    const position = [
      (this._endPoint[0] - this._startPoint[0]) / 2,
      (this._endPoint[1] - this._startPoint[1]) / 2,
    ];

    const direction = [
      this._endPoint[0] - this._startPoint[0],
      this._endPoint[1] - this._startPoint[1],
      this._endPoint[2] - this._startPoint[2],
    ];

    this.geometries.profile.profile.Position = this.base.axis2Placement2D(
      position,
      direction,
    );

    // const extrudedDirection =
    //   this.geometries.extrusion.direction.DirectionRatios.map(
    //     (axis) => axis.value,
    //   );

    // const zAxis = this.base.getZAxis(direction);

    const { location, placement } = this.base.axis2Placement3D(
      this._startPoint,
      // zAxis,
      // direction,
    );

    this.geometries.extrusion.solid.Position = placement;
    this.geometries.extrusion.location = location;

    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.solid);
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  get startPoint() {
    return {
      x: this._startPoint[0],
      y: this._startPoint[1],
      z: this._startPoint[2],
    };
  }

  set startPoint(value: { x: number; y: number; z: number }) {
    this._startPoint[0] = value.x;
    this._startPoint[1] = value.y;
    this._startPoint[2] = value.z;
    this.adjustProfileAndSolidRepresentations();
    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.solid);
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  get endPoint() {
    return { x: this._endPoint[0], y: this._endPoint[1], z: this._endPoint[2] };
  }

  set endPoint(value: { x: number; y: number; z: number }) {
    this._endPoint[0] = value.x;
    this._endPoint[1] = value.y;
    this._endPoint[2] = value.z;
    this.adjustProfileAndSolidRepresentations();
    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.solid);
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  private adjustProfileAndSolidRepresentations() {
    this.geometries.profile.profile.XDim.value = this.base.pointsDistance(
      this._startPoint,
      this._endPoint,
    );

    const position = [
      (this._endPoint[0] - this._startPoint[0]) / 2,
      (this._endPoint[1] - this._startPoint[1]) / 2,
    ];

    const direction = [
      this._endPoint[0] - this._startPoint[0],
      this._endPoint[1] - this._startPoint[1],
      this._endPoint[2] - this._startPoint[2],
    ];

    this.geometries.profile.profile.Position = this.base.axis2Placement2D(
      position,
      direction,
    );

    // const extrudedDirection =
    //   this.geometries.extrusion.direction.DirectionRatios.map(
    //     (axis) => axis.value,
    //   );

    // const zAxis = this.base.getZAxis(direction);

    const { location, placement } = this.base.axis2Placement3D(
      this._startPoint,
      // zAxis,
      // direction,
    );

    this.geometries.extrusion.solid.Position = placement;
    this.geometries.extrusion.location = location;
  }

  get xPosition() {
    return this._xPosition;
  }

  set xPosition(value) {
    this._xPosition = value;
    this.geometries.extrusion.location.Coordinates[0].value = value;
    this.adjustStartAndEndPoints();
    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.location);
    this.geometries.extrusion.regenerate();
  }

  get yPosition() {
    return this._yPosition;
  }

  set yPosition(value) {
    this._yPosition = value;
    this.geometries.extrusion.location.Coordinates[1].value = value;
    this.adjustStartAndEndPoints();
    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.location);
    this.geometries.extrusion.regenerate();
  }

  get zPosition() {
    return this._zPosition;
  }

  set zPosition(value) {
    this._zPosition = value;
    this.geometries.extrusion.location.Coordinates[2].value = value;
    this.adjustStartAndEndPoints();
    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.location);
    this.geometries.extrusion.regenerate();
  }

  private adjustStartAndEndPoints() {
    const direction = [
      this._endPoint[0] - this._startPoint[0],
      this._endPoint[1] - this._startPoint[1],
      this._endPoint[2] - this._startPoint[2],
    ];

    this._startPoint = [
      this.geometries.extrusion.location.Coordinates[0].value,
      this.geometries.extrusion.location.Coordinates[1].value,
      this.geometries.extrusion.location.Coordinates[2].value,
    ];

    this._endPoint = this.base.calculateEndPoint(
      this._startPoint,
      direction,
      this.geometries.profile.profile.XDim.value,
    );
  }

  get width() {
    return this._width;
  }

  set width(value) {
    this._width = value;
    this.geometries.profile.profile.YDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  get length() {
    return this._length;
  }

  set length(value) {
    this._length = value;
    this.geometries.profile.profile.XDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  get height() {
    return this._height;
  }

  set height(value) {
    this._height = value;
    this.geometries.extrusion.solid.Depth.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.solid);
    this.geometries.extrusion.regenerate();
  }

  get toSubtract(): Subtract {
    return this._subtract;
  }

  subtract(extrusion: Extrusion) {
    const bool = this.base.bool(
      this._subtract.extrusion.solid as WEBIFC.IFC4X3.IfcBooleanOperand,
      extrusion.solid,
    ) as unknown as WEBIFC.IFC4X3.IfcProductRepresentation;
    this._subtract = { extrusion: { solid: bool } };
    this.wall.Representation = bool;
    this.ifcAPI.WriteLine(this.modelID, this.wall);
    this.mesh = this.geometries.extrusion.mesh;
    this.geometries.extrusion.regenerate();
  }

  protected create(): WEBIFC.IFC4X3.IfcWall {
    const wall = createIfcEntity<typeof WEBIFC.IFC4X3.IfcWall>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCWALL,
      this.base.guid(uuidv4()),
      null,
      this.base.label("Simple Wall"),
      null,
      this.base.label("Simple Wall"),
      this.base.objectPlacement(),
      this.geometries.extrusion
        .solid as unknown as WEBIFC.IFC4X3.IfcProductRepresentation,
      this.base.identifier("Simple Wall"),
      null,
    );

    this.ifcAPI.WriteLine(this.modelID, wall);
    this.geometries.extrusion.ids.push(wall.expressID);
    this.geometries.extrusion.regenerate();

    return wall;
  }
}
