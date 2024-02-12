import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { createIfcEntity } from "../../../utils/generics";
import { Base } from "../../../base";
import { Family } from "../../Family";
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
  profile: RectangleProfileArgs;
  extrusion: ExtrusionArgs;
};

export class SimpleWall extends Family {
  private _width: number = 1;
  private _height: number = 1;
  private _thickness: number = 0.25;
  private geometries: Geometries;
  public mesh: THREE.InstancedMesh | null = null;
  private base: Base;
  private wall: WEBIFC.IFC4X3.IfcWall;
  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
    args: SimpleWallArgs = {
      profile: {
        position: [0, 0],
        xDim: 5,
        yDim: 3,
      },
      extrusion: {
        direction: [0, 0, 1],
        position: [0, 0, 0],
        depth: 5,
      },
    },
  ) {
    super();
    this.modelID = modelID;
    this.ifcAPI = ifcAPI;
    this.base = new Base(this.ifcAPI, this.modelID);
    this.geometries = this.createGeometries(args);
    this.mesh = this.geometries.extrusion.mesh;
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
    );

    return {
      profile: rectangleProfile,
      extrusion,
    };
  }

  public get toSubtract(): Geometries {
    return this.geometries;
  }

  public get thickness(): number {
    return this._thickness;
  }

  public set thickness(value) {
    this._thickness = value;
    this.geometries.profile.profile.YDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  public get width(): number {
    return this._width;
  }

  public set width(value) {
    this._width = value;
    this.geometries.profile.profile.XDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  public get height(): number {
    return this._height;
  }

  public set height(value) {
    this._height = value;
    this.geometries.extrusion.solid.Depth.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.solid);
    this.geometries.extrusion.regenerate();
  }

  public subtract(extrusion: Extrusion) {
    const lastGeometries = { ...this.geometries };
    const bool = this.base.bool(
      lastGeometries.extrusion.solid,
      extrusion.solid,
    );

    this.wall.Representation =
      bool as unknown as WEBIFC.IFC4X3.IfcProductRepresentation;
    this.ifcAPI.WriteLine(this.modelID, this.wall);
    this.geometries.extrusion.resetMesh();
    this.mesh = this.geometries.extrusion.mesh;
    this.geometries.extrusion.updateMeshTransformations(this.wall);
    this.geometries.extrusion.regenerate();
  }

  protected create(): WEBIFC.IFC4X3.IfcWall {
    const wall = createIfcEntity<typeof WEBIFC.IFC4X3.IfcWall>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCWALL,
      this.base.guid(uuidv4()),
      null,
      this.base.label("SimpleWall"),
      null,
      this.base.label("wall"),
      this.base.objectPlacement(),
      this.geometries.extrusion
        .solid as unknown as WEBIFC.IFC4X3.IfcProductRepresentation,
      this.base.identifier("wall"),
      null,
    );

    this.ifcAPI.WriteLine(this.modelID, wall);
    this.geometries.extrusion.updateMeshTransformations(wall);

    return wall;
  }
}
