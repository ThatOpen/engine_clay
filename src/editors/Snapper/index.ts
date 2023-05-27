import * as THREE from "three";
import * as OBC from "openbim-components";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { Lines, Vertices } from "../../primitives";

export type FoundItem = {
  id: number;
  item: Vertices | Lines;
  coordinates: number[];
};

export class Snapper {
  vertices: Vertices[] = [];
  lines: Lines[] = [];

  snap = new OBC.Event<FoundItem>();

  mode: "LINE" | "VERTEX" | "ALL" = "ALL";

  private readonly _components: OBC.Components;
  private readonly _vertexIcon: CSS2DObject;

  set vertexThreshold(threshold: number) {
    // TODO: Add the get() method to the raycaster definition in components
    const rayCaster = this.getRaycaster();
    rayCaster.params.Points = { threshold };
  }

  set lineThreshold(threshold: number) {
    const rayCaster = this.getRaycaster();
    rayCaster.params.Line = { threshold };
  }

  constructor(components: OBC.Components) {
    this._components = components;
    this.vertexThreshold = 0.5;
    this.lineThreshold = 0.3;

    const element = document.createElement("div");
    element.className = "clay-snap-vertex";
    this._vertexIcon = new CSS2DObject(element);

    this.snap.on(this.previewSnap);
  }

  find() {
    const result = this.raycastMeshes();
    if (result !== null && result.index !== undefined) {
      const item = this.getFoundItem(result.object);
      if (!item) return;
      const id = item.idMap.getId(result.index);
      const coordinates = this.getSnapCoordinates(item, id, result);
      if (!coordinates) return;
      this.snap.trigger({ id, item, coordinates });
    } else {
      this.previewSnap();
    }
  }

  private previewSnap = (found?: FoundItem) => {
    const scene = this._components.scene.get();
    if (!found) {
      scene.remove(this._vertexIcon);
      return;
    }

    const { coordinates } = found;
    const [x, y, z] = coordinates;
    this._vertexIcon.position.set(x, y, z);
    scene.add(this._vertexIcon);
  };

  private getFoundItem(mesh: any) {
    const itemList: any[] = [];

    if (this.mode === "VERTEX" || this.mode === "ALL") {
      for (const vertices of this.vertices) {
        itemList.push(vertices);
      }
    }

    if (this.mode === "LINE" || this.mode === "ALL") {
      for (const lines of this.lines) {
        itemList.push(lines);
      }
    }

    const found = itemList.find((vertex: any) => vertex.mesh === mesh);
    return found as Vertices | Lines | undefined;
  }

  private raycastMeshes() {
    // TODO: Fix raycaster types to accept more than meshes
    const meshes: any[] = [];

    if (this.mode === "VERTEX" || this.mode === "ALL") {
      for (const vertices of this.vertices) {
        meshes.push(vertices.mesh);
      }
    }

    if (this.mode === "LINE" || this.mode === "ALL") {
      for (const lines of this.lines) {
        meshes.push(lines.mesh);
      }
    }

    return this._components.raycaster.castRay(meshes);
  }

  private getSnapCoordinates(
    item: Vertices | Lines,
    id: number,
    result: THREE.Intersection
  ) {
    if (item instanceof Vertices) {
      return item.get(id);
    }
    const { x, y, z } = result.point;
    return [x, y, z];
  }

  private getRaycaster() {
    const casterComponent = this._components.raycaster as OBC.SimpleRaycaster;
    return casterComponent.get();
  }
}
