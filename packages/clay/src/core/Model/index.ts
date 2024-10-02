import * as THREE from "three";
import * as WEBIFC from "web-ifc";
import { ClayElementType } from "../Elements";

/**
 * Object that represents an IFC model and manages all its data.
 */
export class Model {
  wasm = {
    path: "",
    absolute: false,
  };

  settings: WEBIFC.LoaderSettings = {
    TAPE_SIZE: 5000000, // 5MB
  };

  /**
   * Opaque material of the model. All models have just 1 shared opaque and transparent material.
   */
  material = new THREE.MeshLambertMaterial();

  /**
   * Transparent material of the model. All models have just 1 shared opaque and transparent material.
   */
  materialT = new THREE.MeshLambertMaterial({
    transparent: true,
    opacity: 0.2,
  });

  /**
   * Types created within this model.
   */
  types = new Map<string, ClayElementType>();

  private _ifcAPI = new WEBIFC.IfcAPI();

  private _context?: WEBIFC.IFC4X3.IfcRepresentationContext;

  private _modelID?: number;

  /**
   * The core of our libraries. It contains our IFC parser and geometry engine.
   */
  get ifcAPI() {
    return this._ifcAPI;
  }

  /**
   * The ID that identifies this IFC file.
   */
  get modelID() {
    if (this._modelID === undefined) {
      throw new Error("Model not initialized! Call the init() method.");
    }
    return this._modelID;
  }

  /**
   * The IFC context of this IFC file.
   */
  get context() {
    if (this._context === undefined) {
      throw new Error("Model not initialized! Call the init() method.");
    }
    return this._context;
  }

  /**
   * Initializes the library, allowing it to create and edit IFC data.
   */
  async init() {
    this._ifcAPI.SetWasmPath(this.wasm.path, this.wasm.absolute);
    await this._ifcAPI.Init();
    this._modelID = this._ifcAPI.CreateModel(
      { schema: WEBIFC.Schemas.IFC4X3 },
      this.settings,
    );
    this._context = new WEBIFC.IFC4X3.IfcRepresentationContext(
      new WEBIFC.IFC4X3.IfcLabel("Default"),
      new WEBIFC.IFC4X3.IfcLabel("Model"),
    );
  }

  /**
   * Creates or overwrites an item in the IFC file.
   * @param item the object to create or override.
   */
  set(item: WEBIFC.IfcLineObject) {
    this._ifcAPI.WriteLine(this.modelID, item);
  }

  /**
   * Deletes an item in the IFC file, and (optionally) all the items it references.
   * @param item the object to delete.
   * @param recursive whether to delete all items referenced by this item as well.
   */
  delete(
    item: WEBIFC.IfcLineObject | WEBIFC.Handle<WEBIFC.IfcLineObject> | null,
    recursive = false,
  ) {
    if (item === null) {
      return;
    }

    let foundItem: WEBIFC.IfcLineObject;
    if (item instanceof WEBIFC.Handle) {
      foundItem = this._ifcAPI.GetLine(this.modelID, item.value);
    } else {
      foundItem = item;
    }

    if (recursive) {
      for (const key in foundItem) {
        // @ts-ignore
        const value = foundItem[key];
        if (value instanceof WEBIFC.Handle) {
          this.delete(value);
        }
      }
    }

    this._ifcAPI.DeleteLine(this.modelID, foundItem.expressID);
  }

  /**
   * Gets an object data.
   * @param item the object whose data to get.
   */
  get<T extends WEBIFC.IfcLineObject>(item: WEBIFC.Handle<T> | T | null) {
    if (item === null) {
      throw new Error("Item not found!");
    }
    if (item instanceof WEBIFC.Handle) {
      return this._ifcAPI.GetLine(this.modelID, item.value) as T;
    }
    return item;
  }

  /**
   * Updates a model. Necessary for applying new boolean operations.
   */
  async update() {
    if (this._modelID === undefined) {
      throw new Error("Malformed model!");
    }
    // TODO: Fix memory leak
    const model = this._ifcAPI.SaveModel(this._modelID);

    this._ifcAPI.Dispose();
    this._ifcAPI = null as any;
    this._ifcAPI = new WEBIFC.IfcAPI();

    await this.init();
    this._modelID = this._ifcAPI.OpenModel(model, this.settings);
  }
}
