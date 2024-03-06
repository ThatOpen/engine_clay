import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import * as FRAGS from "bim-fragment";
import { Model } from "./model";

export abstract class ClayObject {
  model: Model;

  abstract attributes: WEBIFC.IfcLineObject;

  abstract update(): void;

  protected newFragment() {
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex([]);
    const fragment = new FRAGS.Fragment(geometry, this.model.material, 0);
    fragment.mesh.frustumCulled = false;
    return fragment;
  }

  protected constructor(model: Model) {
    this.model = model;
  }
}
