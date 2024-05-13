import { IFC2X3, IFC4X3 } from "web-ifc";
import { Model } from "../../base/model";
import { SimpleWallType } from "../../elements/Walls/SimpleWall";
import { SimpleFurnitureType, SimpleSlabType } from "../../elements";

export class Importer {
  static import(importedModel: Model, id: number, model: Model): Element {
    let importedElement;
    const element = importedModel.get(id);

    if (
      element instanceof IFC4X3.IfcWallStandardCase ||
      element instanceof IFC2X3.IfcWallStandardCase
    ) {
      const wallType = SimpleWallType.import(element, importedModel, model);

      if (wallType) {
        importedElement = wallType.addInstance();
        importedElement.importProperties(importedModel, element);
      }
    } else if (element instanceof IFC2X3.IfcSlab) {
      const slabType = SimpleSlabType.import(element, importedModel, model);
      if (slabType) {
        importedElement = slabType.addInstance();
        importedElement.importProperties(importedModel, element);
      }
    } else if (
      element instanceof IFC4X3.IfcFurnishingElement ||
      element instanceof IFC2X3.IfcFurnishingElement
    ) {
      const furnitureType = SimpleFurnitureType.import(
        element,
        importedModel,
        model
      );
      if (furnitureType) {
        furnitureType.update();
        console.log(furnitureType);
        importedElement = furnitureType.addInstance();
      }
    }
    if (importedElement === undefined) {
      throw new Error("Unable to determine imported element.");
    } else {
      return importedElement as unknown as Element;
    }
  }
}

// function isInstanceOfIFC2X3Type(
//   element: any,
//   typeName: string
// ): element is IFC2X3.IfcProduct {
//   const className = { typeName };
//   return element.constructor.name === className;
// }

// function isInstanceOfIFC4Type(
//   element: any,
//   typeName: string
// ): element is IFC4X3.IfcProduct {
//   const className = `IFC4X3.${typeName}`;
//   return (
//     element && element.constructor && element.constructor.name === className
//   );
// }

// function checkType(element: any, type: string) {
//   console.log(`Getting type for: ${element.constructor.name}`);
//   if (
//     isInstanceOfIFC2X3Type(element, type) ||
//     isInstanceOfIFC4Type(element, type)
//   ) {
//     return true;
//   }
//   return false;
// }

// function getType(element: any, type: string) {
//   console.log(`Getting type for: ${element.constructor.name}`);
//   let className = null;
//   if (isInstanceOfIFC2X3Type(element, type)) {
//     className = `IFC2X3.${type}`;
//     console.log(`Matched IFC2X3 type: ${className}`);
//   }
//   if (isInstanceOfIFC4Type(element, type)) {
//     className = `IFC4X3.${type}`;
//     console.log(`Matched IFC4X3 type: ${className}`);
//   }
//   return (
//     element && element.constructor && element.constructor.name === className
//   );
// }
