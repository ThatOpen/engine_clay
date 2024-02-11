import * as WEBIFC from "web-ifc";
import * as THREE from "three";

import { Family } from "../Family";
import { createIfcEntity } from "../../utils/generics";
import { Base } from "../../base";
import { Extrusion, RectangleProfile, Solid } from "../../geometries";

type Geometries = {
  profile: RectangleProfile;
  extrusion: Extrusion;
};

export class Opening extends Family {
  private base: Base;
  private opening: WEBIFC.IFC4X3.IfcOpeningElement;
  private geometries: Geometries;
  public mesh: THREE.InstancedMesh | null = null;
  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelID: number,
  ) {
    super();
    this.modelID = modelID;
    this.ifcAPI = ifcAPI;
    this.base = new Base(this.ifcAPI, this.modelID);
    const rectangleProfile = new RectangleProfile(
      this.ifcAPI,
      this.modelID,
      [-1, 2],
      1,
      10,
    );
    const extrusion = new Extrusion(
      this.ifcAPI,
      this.modelID,
      rectangleProfile.profile,
      [0, 0, 1],
      [0, 0, 0],
      2,
    );

    this.geometries = {
      profile: rectangleProfile,
      extrusion,
    };
    this.mesh = this.geometries.extrusion.mesh;
    this.opening = this.create();
  }

  public get toSubtract(): Geometries {
    return this.geometries;
  }

  public subtract(extrusion: Extrusion) {
    const bool = this.base.bool(
      this.geometries.extrusion.solid,
      extrusion.solid,
    );

    this.geometries.extrusion.solid = bool as Solid;
    this.opening.Representation =
      bool as unknown as WEBIFC.IFC4X3.IfcProductRepresentation;
    this.ifcAPI.WriteLine(this.modelID, this.opening);
    this.geometries.extrusion.regenerate();
  }

  protected create(): WEBIFC.IFC4X3.IfcOpeningElement {
    const opening = createIfcEntity<typeof WEBIFC.IFC4X3.IfcOpeningElement>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCOPENINGELEMENT,
      this.base.guid("Opening"),
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
