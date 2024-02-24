import * as WEBIFC from "web-ifc";
import { ClayObject } from "../../base";

export abstract class ClayGeometry extends ClayObject {

    abstract data: WEBIFC.IFC4X3.IfcGeometricRepresentationItem | WEBIFC.IFC4X3.IfcBooleanClippingResult;

    abstract core: WEBIFC.IFC4X3.IfcGeometricRepresentationItem;

    lastClipping: number | null = null;

    clippings = new Map<number, { 
        previous: number | null;
        next: number | null;
        bool: WEBIFC.IFC4X3.IfcBooleanClippingResult
    }>();

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
            this.data = this.core;
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
            newFirst.bool.FirstOperand = this.core;
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