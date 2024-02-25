import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import {v4 as uuidv4} from "uuid";
import {InstancedMesh} from "three";
import {Model} from "../../../base";
import {Family} from "../../Family";
import { Brep } from "../../../geometries";

export class Furniture extends Family {
    ifcData: WEBIFC.IFC4X3.IfcFurnishingElement;

    geometries: { body: Brep };

    get mesh(): InstancedMesh {
        return this.geometries.body.mesh;
    }

    constructor(model: Model, geometry: THREE.BufferGeometry) {
        super(model);

        this.geometries = {body: new Brep(model, geometry)};

        const {body} = this.geometries;
        const representation = this.model.shapeRepresentation("Body", "SweptSolid", [body.ifcData]);
        const shape = this.model.productDefinitionShape([representation]);

        const label = "Simple slab";

        this.ifcData = model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcFurnishingElement>(
            WEBIFC.IFCFURNISHINGELEMENT,
            this.model.guid(uuidv4()),
            null,
            this.model.label(label),
            null,
            this.model.label(label),
            this.model.localPlacement(),
            shape,
            this.model.identifier(label),
        );

        this.update();
    }

    update(): void {
        const {body} = this.geometries;
        body.update();
    }
}
