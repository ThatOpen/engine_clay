import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive } from "../Primitive";
import { OffsetFaces } from "../OffsetFaces";
import { Extrusions } from "../Extrusions";

export class Walls extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  offsetFaces = new OffsetFaces();
  extrusions = new Extrusions();

  constructor() {
    super();
    // TODO: Probably better to keep offsetfaces and extrusion faces separated
    this.extrusions.faces = this.offsetFaces.faces;
    this.mesh = this.extrusions.mesh;
  }
}
