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

    ifcData: WEBIFC.IFC4X3.IfcOpeningElement;

    geometries: {body: Extrusion<RectangleProfile>};

    get mesh() {
        return this.geometries.body.mesh;
    }

    get position() {
        return this.geometries.body.position;
    }

    set position(value: THREE.Vector3) {
        this.geometries.body.position = value;
    }

    get baseDimension() {
        return this.geometries.body.profile.dimension;
    }

    set baseDimension(value: THREE.Vector3) {
        this.geometries.body.profile.dimension = value;
    }

    get direction() {
        return this.geometries.body.direction;
    }

    set direction(value: THREE.Vector3) {
        this.geometries.body.direction = value;
    }

    get height() {
        return this.geometries.body.depth;
    }

    set height(value: number) {
        this.geometries.body.depth = value;
    }

    constructor(model: Model) {
        super(model);

        const profile = new RectangleProfile(model);
        this.geometries = {body: new Extrusion(model, profile)};

        const {body} = this.geometries;
        body.mesh.material = model.materialT;

        const representation = this.model.shapeRepresentation("Body", "SweptSolid", [body.ifcData]);
        const shape = this.model.productDefinitionShape([representation]);

        const label = "Opening";

        this.ifcData = this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcOpeningElement>(
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
        const {body} = this.geometries;
        body.profile.update();
        body.update();
    }
}
