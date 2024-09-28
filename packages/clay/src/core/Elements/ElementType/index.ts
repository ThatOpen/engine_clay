import * as FRAGS from "@thatopen/fragments";
import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { ClayObject } from "../../Object";
import { ClayGeometry } from "../../Geometry";
import { ClayElement } from "../Element";

/**
 * Base class of all element types in CLAY. In CLAY, types are the managers of instances. In other words: if you want to create a wall, you must first create a wall type, and then use it to create a wall instance. It manages all {@link ClayGeometry}, {@link ClayElement} and  {@link FRAGS.Fragment} that belong to this type. It allows to create and delete element instances of this type.
 */
export abstract class ClayElementType<
  T extends ClayElement = ClayElement,
> extends ClayObject {
  /**
   * The IFC data of this object type.
   */
  abstract attributes: IFC.IfcElementType;

  /**
   * All {@link ClayGeometry} that belong to elements of this type.
   */
  geometries = new Map<number, ClayGeometry>();

  /**
   * All {@link ClayElement} of this type.
   */
  elements = new Map<number, T>();

  /**
   * All {@link FRAGS.Fragment} that belong to elements of this type.
   */
  fragments = new Map<number, FRAGS.Fragment>();

  /**
   * Adds a new instance of this type.
   */
  abstract addInstance(): T;

  /**
   * Deletes an existing instance of this type.
   */
  abstract deleteInstance(id: number): void;

  protected newFragment() {
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex([]);
    const fragment = new FRAGS.Fragment(geometry, this.model.material, 0);
    fragment.mesh.frustumCulled = false;
    return fragment;
  }
}
