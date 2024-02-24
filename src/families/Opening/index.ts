import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import {v4 as uuidv4} from "uuid";
import {Model} from "../../base";
import {
    Extrusion,
    RectangleProfile,
} from "../../geometries";
import {Family} from "../Family";

export class Opening extends Family {

    data: WEBIFC.IFC4X3.IfcOpeningElement;

    ifcGeometry: Extrusion<RectangleProfile>;

    get mesh() {
        return this.ifcGeometry.mesh;
    }

    get position() {
        return this.ifcGeometry.position;
    }

    set position(value: THREE.Vector3) {
        this.ifcGeometry.position = value;
    }

    get baseDimension() {
        return this.ifcGeometry.profile.dimension;
    }

    set baseDimension(value: THREE.Vector3) {
        this.ifcGeometry.profile.dimension = value;
    }

    get direction() {
        return this.ifcGeometry.direction;
    }

    set direction(value: THREE.Vector3) {
        this.ifcGeometry.direction = value;
    }

    get height() {
        return this.ifcGeometry.depth;
    }

    set height(value: number) {
        this.ifcGeometry.depth = value;
    }

    constructor(model: Model) {
        super(model);

        const profile = new RectangleProfile(model);
        this.ifcGeometry = new Extrusion(model, profile);

        this.ifcGeometry.mesh.material = model.materialT;

        const representation = this.model.shapeRepresentation("Body", "SweptSolid", [this.ifcGeometry.data]);
        const shape = this.model.productDefinitionShape([representation]);

        const label = "Opening";

        this.data = this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcOpeningElement>(
            WEBIFC.IFCOPENINGELEMENT,
            this.model.guid(uuidv4()),
            null,
            this.model.label(label),
            null,
            this.model.label(label),
            this.model.localPlacement(),
            shape,
            this.model.identifier(label),
            null,
        );

        this.update();
    }

    update() {
        this.ifcGeometry.profile.update();
        this.ifcGeometry.update();
    }
}
