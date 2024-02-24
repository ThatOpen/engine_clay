import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import {Model} from "../../base";
import {Profile} from "../Profiles/Profile";

export class Extrusion<T extends Profile> {
    model: Model;

    data: WEBIFC.IFC4X3.IfcExtrudedAreaSolid | WEBIFC.IFC4X3.IfcBooleanClippingResult;

    extrusion: WEBIFC.IFC4X3.IfcExtrudedAreaSolid;

    mesh: THREE.InstancedMesh;

    depth = 1;

    position = new THREE.Vector3(0, 0, 0);

    rotation = new THREE.Vector3(0, 0, 0);

    direction = new THREE.Vector3(0, 1, 0);

    profile: T;

    clippings = new Map<number, { 
        previous: number | null;
        next: number | null;
        bool: WEBIFC.IFC4X3.IfcBooleanClippingResult
    }>();

    lastClipping: number | null = null;

    constructor(model: Model, profile: T) {
        this.model = model;
        this.profile = profile;

        this.mesh = model.newThreeMesh();

        const placement = this.model.axis2Placement3D(this.position, this.rotation);
        const direction = this.model.direction(this.direction);
        const depth = this.model.positiveLength(this.depth);

        this.extrusion = this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcExtrudedAreaSolid>(
            WEBIFC.IFCEXTRUDEDAREASOLID,
            profile.data,
            placement,
            direction,
            depth,
        );

        this.data = this.extrusion;

        this.update();
    }

    update() {

        const placement = this.model.get(this.extrusion.Position);

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

        const direction = this.model.get(this.extrusion.ExtrudedDirection);
        direction.DirectionRatios[0].value = this.direction.z;
        direction.DirectionRatios[1].value = this.direction.x;
        direction.DirectionRatios[2].value = this.direction.y;
        this.model.set(direction);

        this.extrusion.Depth.value = this.depth;

        this.model.set(this.extrusion);
        this.model.setMesh(this.data.expressID, this.mesh);
    }

    addSubtraction(item: WEBIFC.IFC4X3.IfcBooleanOperand & WEBIFC.IfcLineObject) {
        if(this.clippings.has(item.expressID)) {
            return;
        }

        // Create bool between the given item and the current geometry
        // (might be another bool operation)
        const bool = this.model.bool(this.data, item);
        this.model.set(bool);

        // Reference this clipping by last one (if any)
        if(this.lastClipping) {
            const lastBool = this.clippings.get(this.lastClipping);
            if(!lastBool) {
                throw new Error("Malformed bool structure!");
            }
            lastBool.next = bool.expressID;
        }

        // Add clipping to the list
        const previous = this.lastClipping;
        this.clippings.set(item.expressID, {bool, previous, next: null});

        // Make this bool the current geometry
        this.data = bool;
        this.update();
    }

    removeSubtraction(item: WEBIFC.IFC4X3.IfcBooleanOperand & WEBIFC.IfcLineObject) {
        const found = this.clippings.get(item.expressID); 
        if(!found) {
            return;
        }

        const {bool, next, previous} = found;

        if(previous === null && next === null) {
            // This was the only bool in the list
            this.data = this.extrusion;
        } else if(previous !== null && next === null) {
            // The deleted bool was the last one in the list
            const newLast = this.clippings.get(previous);
            if(!newLast) {
                throw new Error("Malformed bool structure!");
            }
            newLast.next = null;
            this.data = newLast.bool;
        } else if(previous === null && next !== null) {
            // The deleted bool was the first one in the list
            const newFirst = this.clippings.get(next);
            if(!newFirst) {
                throw new Error("Malformed bool structure!");
            }
            newFirst.previous = null;
            newFirst.bool.FirstOperand = this.extrusion;
            this.model.set(newFirst.bool);
        } else if(previous !== null && next !== null) {
            // The deleted bool is in the middle of the list
            const before = this.clippings.get(next);
            const after = this.clippings.get(previous);
            if(!before || !after) {
                throw new Error("Malformed bool structure!");
            }
            before.next = next;
            after.previous = previous;
            before.bool.SecondOperand = after.bool;
            after.bool.FirstOperand = before.bool;
            this.model.set(before.bool);
            this.model.set(after.bool);
        }

        // Remove bool
        this.clippings.delete(item.expressID);
        this.model.delete(bool);
        this.update();
    }
}
