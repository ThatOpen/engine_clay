import { v4 as uuidv4 } from "uuid";
import { IFC4X3 as IFC } from "web-ifc";
import { Model } from "../../../../base";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Element } from "../../../Elements";
import { SimpleSlabType } from "../index";
import { Extrusion, RectangleProfile } from "../../../../geometries";

export class SimpleSlab extends Element {
  import(): void {}
  attributes: IFC.IfcSlab;

  type: SimpleSlabType;

  body: Extrusion<RectangleProfile>;

  thickness = 0.3;

  constructor(model: Model, type: SimpleSlabType) {
    super(model, type);
    this.type = type;

    const profile = new RectangleProfile(model);
    this.body = new Extrusion(model, profile);
    const id = this.body.attributes.expressID;
    this.type.geometries.set(id, this.body);
    this.geometries.add(id);

    const placement = IfcUtils.localPlacement();
    const shape = IfcUtils.productDefinitionShape(model, [
      this.body.attributes,
    ]);

    this.attributes = new IFC.IfcSlab(
      new IFC.IfcGloballyUniqueId(uuidv4()),
      null,
      null,
      null,
      null,
      placement,
      shape,
      null,
      null
    );

    this.update();
  }

  update(updateGeometry: boolean = false) {
    this.body.depth = this.thickness;
    this.body.update();
    super.update(updateGeometry);
  }

  // import(model: Model, id: number): SimpleSlab {
  //   const slab = model.get(id) as IFC.IfcSlab;
  //   const representations = model.get(slab.Representation);

  //   let simpleSlab: SimpleSlab | undefined;

  //   for (const represent of representations.Representations) {
  //     const foundRep = model.get(represent);
  //     const extrusion = this.model.get(
  //       foundRep.Items[0]
  //     ) as IFC.IfcExtrudedAreaSolid;

  //     const slabDepth = model.get(
  //       extrusion.Depth
  //     ) as unknown as IFC.IfcPositiveLengthMeasure;

  //     const keyForTypeMap = `s${slabDepth.value}`;

  //     if (model.typeMap.has(keyForTypeMap)) {
  //       const slabType = model.typeMap.get(keyForTypeMap) as SimpleSlabType;
  //       simpleSlab = slabType.addInstance();
  //     } else {
  //       const slabType = new SimpleSlabType(model);
  //       simpleSlab = slabType.addInstance();
  //     }

  //     simpleSlab.thickness = slabDepth.value;
  //   }

  //   if (simpleSlab === undefined) {
  //     throw new Error("Unable to create SimpleSlab.");
  //   }

  //   return simpleSlab;
  // }
}

// const slabWidth = this.model.get(extrusion) as unknown as IFC.IfcPositiveLengthMeasure;
