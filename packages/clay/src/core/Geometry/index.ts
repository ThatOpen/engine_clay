import { IFC4X3 as IFC } from "web-ifc";
import { ClayObject } from "../Object";
import { ClayObject3D } from "../Object3D";

/**
 * An object that represents an IFC geometry that can represent one or many IfcElements in 3D. It supports boolean operations.
 */
export abstract class ClayGeometry extends ClayObject3D {
  /**
   * {@link ClayObject.attributes}. It can either be an IFC geometry, or the result of a boolean operation.
   */
  abstract attributes:
    | IFC.IfcGeometricRepresentationItem
    | IFC.IfcBooleanClippingResult;

  /**
   * The base IFC geometry of this object. If there are no boolean operations, it's the same as {@link ClayGeometry.attributes}.
   */
  abstract core: IFC.IfcGeometricRepresentationItem;

  protected clippings = new Map<
    number,
    {
      previous: number | null;
      next: number | null;
      bool: IFC.IfcBooleanClippingResult;
    }
  >();

  protected firstClipping: number | null = null;

  protected lastClipping: number | null = null;

  protected subtractedGeometriesToBools = new Map<number, number>();

  /**
   * Deletes this geometry in the IFC model.
   */
  delete() {
    this.model.delete(this.core);
    for (const [, { bool }] of this.clippings) {
      this.model.delete(bool);
    }
    this.clippings.clear();
    this.subtractedGeometriesToBools.clear();
  }

  /**
   * Adds a boolean subtraction to this geometry.
   * @param geometry the geometry to subtract from this.
   */
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
      item,
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

    this.subtractedGeometriesToBools.set(
      geometry.attributes.expressID,
      bool.expressID,
    );
  }

  /**
   * Remove the specified geometry as subtraction (if it is a subtraction).
   * @param geometry the geometry whose subtraction to remove. If this geometry is not a subtraction, nothing happens.
   */
  removeSubtraction(geometry: ClayGeometry) {
    const boolID = this.subtractedGeometriesToBools.get(
      geometry.attributes.expressID,
    );

    if (boolID === undefined) {
      // This geometry was not subtracted from this one
      return;
    }

    const found = this.clippings.get(boolID);
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
    this.clippings.delete(boolID);
    this.model.delete(bool);
    this.update();
  }
}
