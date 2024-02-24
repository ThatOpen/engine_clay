import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import {Model} from "../../base";
import {Profile} from "../Profiles/Profile";
import { ClayGeometry } from "../Geometry";

export class Extrusion<T extends Profile> extends ClayGeometry {

    ifcData: WEBIFC.IFC4X3.IfcExtrudedAreaSolid | WEBIFC.IFC4X3.IfcBooleanClippingResult;

    core: WEBIFC.IFC4X3.IfcExtrudedAreaSolid;

    mesh: THREE.InstancedMesh;

    depth = 1;

    profile: T;

    position = new THREE.Vector3(0, 0, 0);

    rotation = new THREE.Vector3(0, 0, 0);

    direction = new THREE.Vector3(0, 1, 0);

    constructor(model: Model, profile: T) {
        super(model);
        this.profile = profile;

        this.mesh = model.newThreeMesh();

        const placement = this.model.axis2Placement3D(this.position, this.rotation);
        const direction = this.model.direction(this.direction);
        const depth = this.model.positiveLength(this.depth);

        this.core = this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcExtrudedAreaSolid>(
            WEBIFC.IFCEXTRUDEDAREASOLID,
            profile.ifcData,
            placement,
            direction,
            depth,
        );

        this.ifcData = this.core;

        this.update();
    }

    update() {

        const placement = this.model.get(this.core.Position);

        const location = this.model.get(placement.Location) as WEBIFC.IFC4X3.IfcCartesianPoint;
        location.Coordinates[0].value = this.position.z;
        location.Coordinates[1].value = this.position.x;
        location.Coordinates[2].value = this.position.y;
        this.model.set(location);

        const rotation = this.model.get(placement.Axis);
        rotation.DirectionRatios[0].value = this.rotation.z;
        rotation.DirectionRatios[1].value = this.rotation.x;
        rotation.DirectionRatios[2].value = this.rotation.y;
        this.model.set(rotation);

        const direction = this.model.get(this.core.ExtrudedDirection);
        direction.DirectionRatios[0].value = this.direction.z;
        direction.DirectionRatios[1].value = this.direction.x;
        direction.DirectionRatios[2].value = this.direction.y;
        this.model.set(direction);

        this.core.Depth.value = this.depth;

        this.model.set(this.core);
        this.model.setMesh(this.ifcData.expressID, this.mesh);
    }
}
