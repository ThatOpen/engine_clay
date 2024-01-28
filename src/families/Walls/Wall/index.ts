import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { Family } from "../../Family";
import { createIfcEntity } from "../../../utils/generics";

export class Wall extends Family {
  private ids: number[];
  private geometryNeedsUpdate: boolean;
  private solid: WEBIFC.IFC4X3.IfcBooleanOperand &
    WEBIFC.IfcLineObject &
    WEBIFC.IFC4X3.IfcExtrudedAreaSolid;
  private profile: WEBIFC.IFC4X3.IfcRectangleProfileDef;
  public mesh: THREE.InstancedMesh;
  private _width: number = 20;
  private _height: number = 10;
  private _thickness: number = 0.5;

  constructor(
    public ifcAPI: WEBIFC.IfcAPI,
    public modelId: number,
    public location: number[] | WEBIFC.IFC4X3.IfcDirection = [0, 0, 0]
  ) {
    super(ifcAPI, modelId);
    const material = new THREE.MeshLambertMaterial();
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.InstancedMesh(geometry, material, 10);
    this.mesh.count = 0;
    this.ids = [];
    this.geometryNeedsUpdate = true;

    const direction = this.direction([0, 0, 1]);
    const axis = this.axis2Placement2D([0, 0]);
    const x = this.positiveLength(20);
    const y = this.positiveLength(0.25);
    this.profile = this.rectangularProfile(axis, x, y);

    const { placement } = this.axis2Placement3D([0, 0, 0]);
    this.solid = this.extrudedAreaSolid(this.profile, placement, direction, 2);

    this.create();
  }

  public get thickness(): number {
    return this._thickness;
  }

  public set thickness(value) {
    this._thickness = value;
    this.profile.YDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.profile);
    this.regenerate();
  }

  public get width(): number {
    return this._width;
  }

  public set width(value) {
    this._width = value;
    this.profile.XDim.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.profile);
    this.regenerate();
  }

  public get height(): number {
    return this._height;
  }

  public set height(value) {
    this._height = value;
    this.solid.Depth.value = value;
    this.ifcAPI.WriteLine(this.modelID, this.solid);
    this.regenerate();
  }

  private create(): void {
    const placement = this.objectPlacement();
    const mesh = this
      .solid as unknown as WEBIFC.IFC4X3.IfcProductRepresentation;

    const wall = createIfcEntity<typeof WEBIFC.IFC4X3.IfcWall>(
      this.ifcAPI,
      this.modelID,
      WEBIFC.IFCWALL,
      this.guid("GUID"),
      null,
      this.label("name"),
      null,
      this.label("label"),
      placement,
      mesh,
      this.identifier("wall"),
      null
    );

    this.ifcAPI.WriteLine(this.modelID, wall);

    this.ids.push(wall.expressID);

    this.ifcAPI.StreamMeshes(this.modelID, [wall.expressID], (mesh) => {
      console.log(mesh.geometries.size());
      const geometry = mesh.geometries.get(0);
      const matrix = new THREE.Matrix4().fromArray(geometry.flatTransformation);
      this.mesh.setMatrixAt(this.mesh.count++, matrix);
    });

    this.mesh.instanceMatrix.needsUpdate = true;

    if (this.geometryNeedsUpdate) {
      this.regenerate();
      this.geometryNeedsUpdate = false;
    }
  }

  protected regenerate() {
    this.ifcAPI.StreamMeshes(this.modelID, [this.ids[0]], (mesh) => {
      this.mesh.geometry.dispose();
      const geometryID = mesh.geometries.get(0).geometryExpressID;
      const data = this.ifcAPI.GetGeometry(this.modelID, geometryID);
      this.mesh.geometry = this.geometry(data);
    });
  }
}
