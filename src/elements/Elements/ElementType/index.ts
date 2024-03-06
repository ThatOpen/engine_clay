import * as FRAGS from "bim-fragment";
import { IFC4X3 as IFC } from "web-ifc";
import { ClayObject } from "../../../base";
import { ClayGeometry } from "../../../geometries/Geometry";
import { Element } from "../Element";

export abstract class ElementType<
  T extends Element = Element
> extends ClayObject {
  abstract attributes: IFC.IfcElementType;

  geometries = new Map<number, ClayGeometry>();

  elements = new Map<number, T>();

  fragments = new Map<number, FRAGS.Fragment>();

  abstract addInstance(): T;

  abstract deleteInstance(id: number): void;
}
