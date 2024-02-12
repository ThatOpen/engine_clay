import * as WEBIFC from "web-ifc";

type ConstructorArgs<T> = T extends new (...args: infer U) => any ? U : never;

type ConstructorArg<T> = T extends new (arg: infer U) => any ? U : never;

export function createIfcEntity<T extends new (...args: any[]) => any>(
  ifcAPI: WEBIFC.IfcAPI,
  modelID: number,
  type: number,
  ...args: ConstructorArgs<T>
) {
  return ifcAPI.CreateIfcEntity(modelID, type, ...args) as InstanceType<T>;
}

export function createIfcType<T extends new (...args: any[]) => any>(
  ifcAPI: WEBIFC.IfcAPI,
  modelID: number,
  type: number,
  value: ConstructorArg<T>
) {
  return ifcAPI.CreateIfcType(modelID, type, value) as InstanceType<T>;
}
