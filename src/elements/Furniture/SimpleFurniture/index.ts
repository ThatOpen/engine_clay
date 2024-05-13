import { IFC4X3 as IFC, IFC2X3, IFC4X3 } from "web-ifc";
import { v4 as uuidv4 } from "uuid";
import { Model } from "../../../base";
import { StaticElementType } from "../../Elements/StaticElementType";
import { SimpleFurniture } from "./src";
import { Brep } from "../../../geometries";
import { IfcUtils } from "../../../utils/ifc-utils";

export * from "./src";

export class SimpleFurnitureType extends StaticElementType<SimpleFurniture> {
  import(): void {}

  static import(
    element: IFC2X3.IfcFurnishingElement | IFC4X3.IfcFurnishingElement,
    importedModel: Model,
    model: Model
  ): SimpleFurnitureType {
    let furnitureType: SimpleFurnitureType | undefined;

    const keyForTypeMapBrep = `s${element.Name?.value}`;

    if (importedModel.typeMap.has(keyForTypeMapBrep)) {
      furnitureType = model.typeMap.get(
        keyForTypeMapBrep
      ) as SimpleFurnitureType;
    } else {
      const represent = importedModel.get(element.Representation);

      for (const rep of represent.Representations) {
        const foundRep = importedModel.get(rep);

        for (const item of foundRep.Items) {
          const itemFromIfc = importedModel.get(item);

          const mappedItemProperties = importedModel.ifcAPI.GetLine(
            importedModel.modelID,
            itemFromIfc.expressID
          );

          const representationMapID = mappedItemProperties.MappingSource;

          const representationMapProperties =
            importedModel.get(representationMapID);

          const mappedRepresentation =
            representationMapProperties.MappedRepresentation;

          const breps = importedModel.get(mappedRepresentation);

          furnitureType = new SimpleFurnitureType(model);
          for (const br of breps.Items) {
            const brep = importedModel.get(br) as IFC4X3.IfcFacetedBrep;

            const clayBrep = new Brep(model);

            clayBrep.importFromIfc(brep, importedModel);

            furnitureType.addBrep(clayBrep);
          }
        }
      }
    }

    if (!furnitureType) {
      throw new Error("Unable to determine furniture type");
    }
    return furnitureType;
  }

  attributes: IFC.IfcFurnishingElementType;

  shape: IFC.IfcProductDefinitionShape;

  body: Brep[] = [];

  constructor(model: Model) {
    super(model);

    this.shape = IfcUtils.productDefinitionShape(model, []);

    this.attributes = new IFC.IfcFurnishingElementType(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    );
  }

  addBrep(brep: Brep) {
    this.body.push(brep);
    const id = brep.attributes.expressID;
    this.geometries.set(id, brep);
    const first = this.model.get(this.shape.Representations[0]);
    first.Items.push(brep.attributes);
    const fragment = this.newFragment();
    this.fragments.set(id, fragment);
  }

  protected createElement() {
    return new SimpleFurniture(this.model, this);
  }
}
