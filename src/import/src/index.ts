import { IFC2X3 } from "web-ifc";
import { Model } from "../../base/model";
import { SimpleWallType } from "../../elements/Walls/SimpleWall";
import { SimpleSlabType } from "../../elements";

export class Importer {
  static import(importedModel: Model, id: number, model: Model): Element {
    let importedElement;
    const element = importedModel.get(id);

    if (element instanceof IFC2X3.IfcWallStandardCase) {
      const wallType = SimpleWallType.import(element, importedModel, model);

      if (wallType) {
        importedElement = wallType.addInstance();
        const representations = importedModel.get(element.Representation);
        for (const represent of representations.Representations) {
          const foundRep = importedModel.get(represent);
          const extrusion = importedModel.get(
            foundRep.Items[0]
          ) as IFC2X3.IfcExtrudedAreaSolid;
          console.log(extrusion);
          importedElement.importProperties(importedModel, element);
        }
      }
    } else if (element instanceof IFC2X3.IfcSlab) {
      const slabType = SimpleSlabType.import(element, importedModel, model);
      if (slabType) {
        importedElement = slabType.addInstance();
        const representations = importedModel.get(element.Representation);
        for (const represent of representations.Representations) {
          const foundRep = importedModel.get(represent);
          const extrusion = importedModel.get(
            foundRep.Items[0]
          ) as IFC2X3.IfcExtrudedAreaSolid;
          importedElement.importProperties(importedModel, extrusion);
        }
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
//   const className = `IFC2X3.${typeName}`;
//   return (
//     element && element.constructor && element.constructor.name === className
//   );
// }

// function isInstanceOfIFC4Type(
//   element: any,
//   typeName: string
// ): element is IFC4X3.IfcProduct {
//   const className = `IFC4.${typeName}`;
//   return (
//     element && element.constructor && element.constructor.name === className
//   );
// }

// function checkType(element: any, type: string) {
//   return (
//     isInstanceOfIFC2X3Type(element, type) || isInstanceOfIFC4Type(element, type)
//   );
// }
