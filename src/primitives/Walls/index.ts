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
    this.extrusions.faces = this.offsetFaces.faces;
    this.mesh = this.extrusions.mesh;
  }
}
