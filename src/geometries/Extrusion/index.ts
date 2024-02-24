import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import {Model} from "../../base";
import {Profile} from "../Profiles/Profile";

export class Extrusion<T extends Profile> {
    model: Model;

    data: WEBIFC.IFC4X3.IfcExtrudedAreaSolid;

    mesh: THREE.InstancedMesh;

    depth = 1;

    position = new THREE.Vector3(0, 0, 0);

    rotation = new THREE.Vector3(0, 0, 0);

    direction = new THREE.Vector3(0, 1, 0);

    profile: T;

    constructor(model: Model, profile: T) {
        this.model = model;
        this.profile = profile;

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.MeshLambertMaterial();
        this.mesh = new THREE.InstancedMesh(geometry, material, 1);
        this.mesh.frustumCulled = false;
        const identity = new THREE.Matrix4().identity();
        this.mesh.setMatrixAt(0, identity);
        this.mesh.instanceMatrix.needsUpdate = true;

        const placement = this.model.axis2Placement3D(this.position, this.rotation);
        const direction = this.model.direction(this.direction);
        const depth = this.model.positiveLength(this.depth);

        this.data = this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcExtrudedAreaSolid>(
            WEBIFC.IFCEXTRUDEDAREASOLID,
            profile.data,
            placement,
            direction,
            depth,
        );

        this.update();
    }

    update() {

        const placement = this.model.get(this.data.Position);

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

        const direction = this.model.get(this.data.ExtrudedDirection);
        direction.DirectionRatios[0].value = this.direction.z;
        direction.DirectionRatios[1].value = this.direction.x;
        direction.DirectionRatios[2].value = this.direction.y;
        this.model.set(direction);

        this.data.Depth.value = this.depth;

        this.model.set(this.data);
        this.model.setMesh(this.data.expressID, this.mesh);
    }
}
