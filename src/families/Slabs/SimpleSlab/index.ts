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

type SimpleSlabArgs = {
  profile: RectangleProfileArgs;
  extrusion: ExtrusionArgs;
};

export class SimpleSlab extends Family {
  private _width: number = 1;
  private _height: number = 1;
  private _thickness: number = 0.25;
  private geometries: Geometries;
  public mesh: THREE.InstancedMesh | null = null;
  private base: Base;
  private slab: WEBIFC.IFC4X3.IfcSlab;
  private _subtract: Subtract;

  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
    args: SimpleSlabArgs = {
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
    this._subtract = { extrusion: { solid: this.geometries.extrusion.solid } };
    this.slab = this.create();
    this.geometries.extrusion.ids.push(this.slab.expressID);
  }

  private createGeometries(args: SimpleSlabArgs) {
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

  public get thickness() {
    return this._thickness;
  }

  public set thickness(value) {
    this._thickness = value;
    this.geometries.extrusion.solid.Depth.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.extrusion.solid);
    this.geometries.extrusion.regenerate();
  }

  public get width() {
    return this._width;
  }

  public set width(value) {
    this._width = value;
    this.geometries.profile.profile.XDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  public get height() {
    return this._height;
  }

  public set height(value) {
    this._height = value;
    this.geometries.profile.profile.YDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.geometries.profile.profile);
    this.geometries.extrusion.regenerate();
  }

  public get toSubtract(): Subtract {
    return this._subtract;
  }

  public subtract(extrusion: Extrusion) {
    const bool = this.base.bool(
      this._subtract.extrusion.solid as WEBIFC.IFC4X3.IfcBooleanOperand,
      extrusion.solid,
    ) as unknown as WEBIFC.IFC4X3.IfcProductRepresentation;
    this._subtract = { extrusion: { solid: bool } };
    this.slab.Representation = bool;
    this.ifcAPI.WriteLine(this.modelID, this.slab);
    this.mesh = this.geometries.extrusion.mesh;
    this.geometries.extrusion.regenerate();
  }

  protected create(): WEBIFC.IFC4X3.IfcSlab {
    const slab = createIfcEntity<typeof WEBIFC.IFC4X3.IfcSlab>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCSLAB,
      this.base.guid(uuidv4()),
      null,
      this.base.label("Simple Slab"),
      null,
      this.base.label("Simple Slab"),
      this.base.objectPlacement(),
      this.geometries.extrusion
        .solid as unknown as WEBIFC.IFC4X3.IfcProductRepresentation,
      this.base.identifier("Simple Slab"),
      null,
    );

    this.ifcAPI.WriteLine(this.modelID, slab);

    return slab;
  }
}
