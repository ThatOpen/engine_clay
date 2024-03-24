import { IFC4X3 as IFC, IfcLineObject } from "web-ifc";
import { ClayObject } from "../../base";

export abstract class ClayGeometry extends ClayObject {
  abstract attributes:
    | IFC.IfcGeometricRepresentationItem
    | IFC.IfcBooleanClippingResult;

  abstract core: IFC.IfcGeometricRepresentationItem;

  protected firstClipping: number | null = null;
  protected lastClipping: number | null = null;

  clippings = new Map<
    number,
    {
      previous: number | null;
      next: number | null;
      bool: IFC.IfcBooleanClippingResult;
    }
  >();

  delete() {}

  addSubtraction(geometry: ClayGeometry) {
    const item = geometry.attributes;

    if (this.clippings.has(item.expressID)) {
      return;
    }

    // Create bool between the given item and the current geometry
    // (might be another bool operation)
    const bool = new IFC.IfcBooleanClippingResult(
      IFC.IfcBooleanOperator.DIFFERENCE,
      this.attributes,
      item
    );

    this.model.set(bool);

    // If it's the first clipping, reference it
    const isFirstClipping = this.clippings.size === 0;
    if (isFirstClipping) {
      this.firstClipping = item.expressID;
    }

    // Reference this clipping by last one (if any)
    if (this.lastClipping) {
      const lastBool = this.clippings.get(this.lastClipping);
      if (!lastBool) {
        throw new Error("Malformed bool structure!");
      }
      lastBool.next = bool.expressID;
    }

    // Add clipping to the list
    const previous = this.lastClipping;
    this.clippings.set(item.expressID, { bool, previous, next: null });

    // Make this bool the current geometry

    this.attributes = bool;
    this.update();
  }

  removeSubtraction(item: IFC.IfcBooleanOperand & IfcLineObject) {
    const found = this.clippings.get(item.expressID);
    if (!found) {
      return;
    }

    const { bool, next, previous } = found;

    if (previous === null && next === null) {
      // This was the only bool in the list
      this.attributes = this.core;
      this.firstClipping = null;
      this.lastClipping = null;
    } else if (previous !== null && next === null) {
      // The deleted bool was the last one in the list
      const newLast = this.clippings.get(previous);
      if (!newLast) {
        throw new Error("Malformed bool structure!");
      }
      newLast.next = null;
      this.attributes = newLast.bool;
    } else if (previous === null && next !== null) {
      // The deleted bool was the first one in the list
      const newFirst = this.clippings.get(next);
      if (!newFirst) {
        throw new Error("Malformed bool structure!");
      }
      this.firstClipping = next;
      newFirst.previous = null;
      newFirst.bool.FirstOperand = this.core;
      this.model.set(newFirst.bool);
    } else if (previous !== null && next !== null) {
      // The deleted bool is in the middle of the list
      const before = this.clippings.get(next);
      const after = this.clippings.get(previous);
      if (!before || !after) {
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
