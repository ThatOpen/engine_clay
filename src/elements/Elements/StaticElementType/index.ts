import { IFC4X3 as IFC } from "web-ifc";
import * as THREE from "three";
import { Element } from "../Element";
import { ElementType } from "../ElementType";

export abstract class StaticElementType<
  T extends Element
> extends ElementType<T> {
  abstract attributes: IFC.IfcElementType;

  abstract shape: IFC.IfcProductDefinitionShape;

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

  update(updateGeometry = false) {
    let first = updateGeometry;
    for (const [_id, element] of this.elements) {
      element.update(first);
      first = false;
    }
  }

  protected abstract createElement(): T;
}
