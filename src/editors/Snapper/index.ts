import * as OBC from "openbim-components";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { Vertices } from "../../primitives";

export type FoundVertex = {
  id: number;
  vertices: Vertices;
};

export class Snapper {
  vertices: Vertices[] = [];
  vertexFound = new OBC.Event<FoundVertex>();

  private readonly _components: OBC.Components;
  private readonly _vertexIcon: CSS2DObject;

  set threshold(threshold: number) {
    // TODO: Add the get() method to the raycaster definition in components
    const casterComponent = this._components.raycaster as OBC.SimpleRaycaster;
    const rayCaster = casterComponent.get();
    rayCaster.params.Points = { threshold };
  }

  constructor(components: OBC.Components) {
    this._components = components;
    this.threshold = 0.3;

    const element = document.createElement("div");
    element.className = "clay-snap-vertex";
    this._vertexIcon = new CSS2DObject(element);

    this.vertexFound.on(this.setVertexSnap);
  }

  findPoint() {
    const meshes = this.vertices.map((vertex) => vertex.mesh) as any[];
    // TODO: Fix raycaster types to accept more than meshes
    const result = this._components.raycaster.castRay(meshes);
    if (result !== null && result.index !== undefined) {
      const mesh = result.object;
      const vertices = this.vertices.find((vertex) => vertex.mesh === mesh);
      if (!vertices) return;
      const id = vertices.idMap.getId(result.index);
      this.vertexFound.trigger({ id, vertices });
    } else {
      this.setVertexSnap();
    }
  }

  private setVertexSnap = (found?: FoundVertex) => {
    const scene = this._components.scene.get();
    if (!found) {
      scene.remove(this._vertexIcon);
      return;
    }

    const { id, vertices } = found;
    const coordinates = vertices.get(id);
    if (!coordinates) return;
    const [x, y, z] = coordinates;
    this._vertexIcon.position.set(x, y, z);
    scene.add(this._vertexIcon);
  };
}
