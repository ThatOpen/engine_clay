import * as THREE from "three";
import { Primitive } from "../Primitive";
import { Faces } from "../Faces";
import { Lines } from "../Lines";

export class OffsetFaces extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  faces = new Faces();
  lines = new Lines();

  constructor() {
    super();
    this.mesh = this.faces.mesh;
  }
}
