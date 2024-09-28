import * as THREE from "three";
import { IFC4X3 as IFC } from "web-ifc";
import { ClayElement } from "../Element";
import { ClayElementType } from "../ElementType";

/**
 * Dynamic variation of {@link ClayElementType}, used in types that need geometry control at the instance level. It's less efficient but more flexible than {@link StaticClayElementType}.
 */
export abstract class DynamicClayElementType<
  T extends ClayElement,
> extends ClayElementType {
  /**
   * {@link ClayElementType.attributes}
   */
  abstract attributes: IFC.IfcElementType;

  /**
   * {@link ClayElementType.addInstance}. It creates a new fragment per instance, allowing for geometry control at the instance level.
   */
  addInstance(): T {
    const element = this.createElement();
    const id = element.attributes.expressID;
    for (const geomID of element.geometries) {
      const fragment = this.newFragment();
      const colors = [new THREE.Color(1, 1, 1)];
      const transforms = [new THREE.Matrix4().identity()];
      fragment.add([{ id, colors, transforms }]);
      this.fragments.set(geomID, fragment);
    }
    element.update(true);
    this.elements.set(id, element);
    return element;
  }

  /**
   * {@link ClayElementType.addInstance}. Deletes a specific fragment.
   */
  deleteInstance(id: number) {
    const element = this.elements.get(id);
    if (!element) {
      throw new Error("Element does not exist!");
    }
    this.model.delete(element.attributes, true);

    for (id of element.geometries) {
      const fragment = this.fragments.get(id);
      if (!fragment) {
        throw new Error("Fragment not found!");
      }
      fragment.dispose(false);
      this.fragments.delete(id);

      const geometry = this.geometries.get(id);
      if (!geometry) {
        throw new Error("Geometry not found!");
      }
      geometry.delete();
      this.geometries.delete(id);
    }
  }

  /**
   * Updates all the elements of this type.
   * @param updateGeometry whether to update the element geometries or not. Remember that in dynamic types, each element has a
   */
  update(updateGeometry = false) {
    for (const [_id, element] of this.elements) {
      element.update(updateGeometry);
    }
  }

  protected abstract createElement(): T;
}
