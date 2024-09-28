import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { ClayElement } from "../Element";
import { ClayElementType } from "../ElementType";

/**
 * Static variation of {@link ClayElementType}, used in types that need geometry control at the type level. It's more efficient but less flexible than {@link StaticClayElementType}.
 */
export abstract class StaticClayElementType<
  T extends ClayElement,
> extends ClayElementType<T> {
  /**
   * {@link ClayElementType.attributes}
   */
  abstract attributes: IFC.IfcElementType;

  /**
   * The IFC data containing the geometries of this type (remember that all elements of static types share the same geometry).
   */
  abstract shape: IFC.IfcProductDefinitionShape;

  /**
   * {@link ClayElementType.addInstance}. It creates a new instance to the fragments shared by all elements.
   */
  addInstance(): T {
    const element = this.createElement();
    const id = element.attributes.expressID;
    this.elements.set(id, element);

    for (const [_geometryID, fragment] of this.fragments) {
      const colors = [new THREE.Color(1, 1, 1)];
      const transforms = [new THREE.Matrix4().identity()];
      fragment.add([{ id, colors, transforms }]);
    }

    element.update(true);

    return element;
  }

  /**
   * {@link ClayElementType.addInstance}. Deletes a specific instance in the shared fragments.
   */
  deleteInstance(id: number) {
    const element = this.elements.get(id);
    if (!element) {
      throw new Error("Element does not exist!");
    }
    element.attributes.Representation = null;
    this.model.set(element.attributes);
    this.model.delete(element.attributes, true);

    for (const [_geometryID, fragment] of this.fragments) {
      fragment.remove([id]);
    }
  }

  /**
   * Updates all the elements of this type.
   * @param updateGeometry whether to update the element geometries or not. Remember that in static types, all elements share the same geometries.
   */
  update(updateGeometry = false) {
    let first = updateGeometry;
    for (const [_id, element] of this.elements) {
      // Geometry is shared, so only update it in first instance
      element.update(first);
      first = false;
    }
  }

  protected abstract createElement(): T;
}
