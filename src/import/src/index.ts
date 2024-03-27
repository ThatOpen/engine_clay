import { IFC2X3 } from "web-ifc";
import { Model } from "../../base/model";
import { SimpleWallType } from "../../elements/Walls/SimpleWall";

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
