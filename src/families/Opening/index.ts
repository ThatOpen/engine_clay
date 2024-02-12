import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { createIfcEntity } from "../../utils/generics";
import { Family } from "../Family";
import { Base } from "../../base";
import {
  Extrusion,
  RectangleProfile,
  ExtrusionArgs,
  RectangleProfileArgs,
} from "../../geometries";

type Geometries = {
  profile: RectangleProfile;
  extrusion: Extrusion;
};

type OpeningArgs = {
  profile: RectangleProfileArgs;
  extrusion: ExtrusionArgs;
};

export class Opening extends Family {
  private geometries: Geometries;
  public mesh: THREE.InstancedMesh | null = null;
  private base: Base;
  private opening: WEBIFC.IFC4X3.IfcOpeningElement;
  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
    args: OpeningArgs = {
      profile: {
        position: [-1, 2],
        xDim: 1,
        yDim: 10,
      },
      extrusion: {
        direction: [0, 0, 1],
        position: [0, 0, 0],
        depth: 2,
      },
    },
  ) {
    super();
    this.modelID = modelID;
    this.ifcAPI = ifcAPI;
    this.base = new Base(this.ifcAPI, this.modelID);
    this.geometries = this.createGeometries(args);
    this.mesh = this.geometries.extrusion.mesh;
    this.opening = this.create();
  }

  private createGeometries(args: OpeningArgs) {
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

  public subtract(extrusion: Extrusion) {
    const lastGeometries = { ...this.geometries };
    const bool = this.base.bool(
      lastGeometries.extrusion.solid,
      extrusion.solid,
    );

    this.opening.Representation =
      bool as unknown as WEBIFC.IFC4X3.IfcProductRepresentation;
    this.ifcAPI.WriteLine(this.modelID, this.opening);
    this.geometries.extrusion.resetMesh();
    this.mesh = this.geometries.extrusion.mesh;
    this.geometries.extrusion.updateMeshTransformations(this.opening);
    this.geometries.extrusion.regenerate();
  }
  protected create(): WEBIFC.IFC4X3.IfcOpeningElement {
    const opening = createIfcEntity<typeof WEBIFC.IFC4X3.IfcOpeningElement>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCOPENINGELEMENT,
      this.base.guid(uuidv4()),
      null,
      this.base.label("Opening"),
      null,
      this.base.label("opening"),
      this.base.objectPlacement(),
      this.geometries.extrusion
        .solid as unknown as WEBIFC.IFC4X3.IfcProductRepresentation,
      this.base.identifier("opening"),
      null,
    );

    this.ifcAPI.WriteLine(this.modelID, opening);
    this.geometries.extrusion.updateMeshTransformations(opening);

    return opening;
  }
}
