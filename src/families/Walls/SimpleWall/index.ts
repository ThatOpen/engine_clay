import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { createIfcEntity } from "../../../utils/generics";
import { Extrusion, Solid } from "../../../geometries";
import { RectangleProfile } from "../../../geometries/Profiles/RectangleProfile";
import { Base } from "../../../base";
import { Family } from "../../Family";

type Geometries = {
  profile: RectangleProfile;
  extrusion: Extrusion;
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
  ) {
    super();
    this.modelID = modelID;
    this.ifcAPI = ifcAPI;
    this.base = new Base(this.ifcAPI, this.modelID);
    this.geometries = this.createGeometries();
    this.mesh = this.geometries.extrusion.mesh;
    this.wall = this.create();
  }

  private createGeometries() {
    const rectangleProfile = new RectangleProfile(this.ifcAPI, this.modelID);
    const extrusion = new Extrusion(
      this.ifcAPI,
      this.modelID,
      rectangleProfile.profile,
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
    const profile = this.geometries.profile.profile;
    profile.YDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, profile);
    this.geometries.extrusion.regenerate();
  }

  public get width(): number {
    return this._width;
  }

  public set width(value) {
    this._width = value;
    const profile = this.geometries.profile.profile;
    profile.XDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, profile);
    this.geometries.extrusion.regenerate();
  }

  public get height(): number {
    return this._height;
  }

  public set height(value) {
    this._height = value;
    const solid = this.geometries.extrusion.solid;
    solid.Depth.value = value;
    this.ifcAPI.WriteLine(this.modelID, solid);
    this.geometries.extrusion.regenerate();
  }

  public subtract(extrusion: Extrusion) {
    const bool = this.base.bool(
      this.geometries.extrusion.solid,
      extrusion.solid,
    ) as Solid;

    this.ifcAPI.DeleteLine(this.modelID, this.wall.expressID);
    this.geometries = this.createGeometries();
    this.mesh = this.geometries.extrusion.mesh;
    this.wall = this.create(bool);
  }

  protected create(solid: Solid | null = null): WEBIFC.IFC4X3.IfcWall {
    solid = solid || this.geometries.extrusion.solid;
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
      solid as unknown as WEBIFC.IFC4X3.IfcProductRepresentation,
      this.base.identifier("wall"),
      null,
    );

    this.ifcAPI.WriteLine(this.modelID, wall);
    this.geometries.extrusion.updateMeshTransformations(wall);

    return wall;
  }
}
