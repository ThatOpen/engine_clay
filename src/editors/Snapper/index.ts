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

  private _helper = new Lines();
  private _helperLinesIDs = new Set<number>();
  private _helperPointsIDs = new Set<number>();
  private _midPoint: number | null = null;

  private _helperLinesTimeout = -1;

  private _lastSelectedLine: FoundItem | null = null;

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
    this.lineThreshold = 0.2;

    const element = document.createElement("div");
    element.className = "clay-snap-vertex";
    this._vertexIcon = new CSS2DObject(element);

    const scene = components.scene.get();
    scene.add(this._helper.mesh);
    const helperMat = this._helper.mesh.material as THREE.Material;
    helperMat.transparent = true;
    helperMat.opacity = 0.2;
    this._helper.baseColor = new THREE.Color(0xff0000);

    this.snap.on(this.updateLastSelection);
    this.snap.on(this.previewSnap);
    this.snap.on(this.updateMidPoint);
    this.snap.on(this.updateHelperLines);

    window.addEventListener("mousemove", () => {
      window.clearTimeout(this._helperLinesTimeout);
    });
  }

  find() {
    const result = this.raycastMeshes();
    if (result !== null && result.index !== undefined) {
      const item = this.getFoundItem(result.object);
      if (!item) return;
      if (item instanceof Lines) result.index /= 2;
      const id = item.idMap.getId(result.index);
      if (id === undefined) return;
      const coordinates = this.getSnapCoordinates(item, id, result);
      if (!coordinates) return;
      this.snap.trigger({ id, item, coordinates });
    } else {
      this.previewSnap();
    }
  }

  removeHelpers() {
    const points = new Set<number>();
    for (const id of this._helperLinesIDs) {
      const line = this._helper.list[id];
      points.add(line.start);
      points.add(line.end);
    }

    for (const id of this._helperPointsIDs) {
      points.add(id);
    }

    this._helper.removePoints(points);
    this._helperLinesIDs.clear();
    this._helperPointsIDs.clear();
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

  private updateLastSelection = (found?: FoundItem) => {
    if (found && found.item !== this._helper && found.item instanceof Lines) {
      this._lastSelectedLine = { ...found };
    }
  };

  private updateMidPoint = (found?: FoundItem) => {
    if (!found) return;

    if (found.item instanceof Lines) {
      if (!this._midPoint) {
        const [midPoint] = this._helper.addPoints([[0, 0, 0]]);
        this._midPoint = midPoint;
      }

      const line = found.item.get(found.id);
      if (line === null) return;

      const [[ax, ay, az], [bx, by, bz]] = line;

      const midPoint = [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2];
      this._helper.setPoint(this._midPoint, midPoint);
    }
  };

  private updateHelperLines = (found?: FoundItem) => {
    if (!found) {
      window.clearTimeout(this._helperLinesTimeout);
      return;
    }

    this._helperLinesTimeout = window.setTimeout(
      () => this.createHelperLines(found),
      1000
    );
  };

  private createHelperLines = (found: FoundItem) => {
    const [x, y, z] = found.coordinates;
    const scale = 1000;

    // Vertical line

    const top = [x, scale, z];
    const bottom = [x, -scale, z];
    const points = this._helper.addPoints([top, bottom]);
    const [verticalID] = this._helper.add(points);

    if (!this._lastSelectedLine) return;

    this.findHelperLineIntersections(top, bottom);
    this._helperLinesIDs.add(verticalID);

    // Extension

    const { id, item } = this._lastSelectedLine;
    const line = item.get(id) as number[][];
    if (!line) return;
    const [[ax, ay, az], [bx, by, bz]] = line;

    const vector = [(bx - ax) * scale, (by - ay) * scale, (bz - az) * scale];
    const [vx, vy, vz] = vector;
    const extStart = [x + vx, y + vy, z + vz];
    const extEnd = [x - vx, y - vy, z - vz];

    const extensionPoints = this._helper.addPoints([extStart, extEnd]);
    const [extensionID] = this._helper.add(extensionPoints);
    this.findHelperLineIntersections(extStart, extEnd);
    this._helperLinesIDs.add(extensionID);

    // Perpendicular

    const v1 = new THREE.Vector3(vx, vy, vz);
    const up = new THREE.Vector3(0, 1, 0);
    v1.cross(up);

    const perpStart = [x + v1.x, y + v1.y, z + v1.z];
    const perpEnd = [x - v1.x, y - v1.y, z - v1.z];

    const perpPoints = this._helper.addPoints([perpStart, perpEnd]);
    const [perpendicularID] = this._helper.add(perpPoints);
    this.findHelperLineIntersections(perpStart, perpEnd);
    this._helperLinesIDs.add(perpendicularID);
  };

  private findHelperLineIntersections(start: number[], end: number[]) {
    // Source: math primer for graphics, F. Dunn
    // Intersection between two rays in 3D:
    // r1(t1) = p1 + t1 d1,
    // r2(t2) = p2 + t2 d2,
    // Solution:
    // t1 = ((p2 - p1) x d2) · (d1 x d2) / ||d1 x d2||^2
    // t2 = ((p2 - p1) x d1) · (d1 x d2) / ||d1 x d2||^2

    const tolerance = 0.01;

    const p1 = new THREE.Vector3();
    const d1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const d2 = new THREE.Vector3();
    const d1XD2 = new THREE.Vector3();
    const result1 = new THREE.Vector3();
    const result2 = new THREE.Vector3();
    const p2MinusP1 = new THREE.Vector3();
    const p2MinusP1XD2 = new THREE.Vector3();
    const p2MinusP1XD1 = new THREE.Vector3();

    p1.set(start[0], start[1], start[2]);
    d1.set(end[0] - start[0], end[1] - start[1], end[2] - start[2]);

    for (const lineID of this._helperLinesIDs) {
      const line = this._helper.get(lineID);
      if (!line) continue;
      const [a, b] = line;
      p2.set(a[0], a[1], a[2]);
      d2.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      p2MinusP1.subVectors(p2, p1);
      d1XD2.copy(d1);
      d1XD2.cross(d2);
      const d1DotD2Squared = d1XD2.length() ** 2;

      p2MinusP1XD2.copy(p2MinusP1);
      p2MinusP1XD1.copy(p2MinusP1);
      p2MinusP1XD2.cross(d2);
      p2MinusP1XD1.cross(d1);

      const t1 = p2MinusP1XD2.dot(d1XD2) / d1DotD2Squared;
      const t2 = p2MinusP1XD1.dot(d1XD2) / d1DotD2Squared;

      result1.copy(d1);
      result1.multiplyScalar(t1);
      result1.add(p1);

      result2.copy(d2);
      result2.multiplyScalar(t2);
      result2.add(p2);

      if (result1.distanceTo(result2) < tolerance) {
        const { x, y, z } = result1;
        const [id] = this._helper.addPoints([[x, y, z]]);
        this._helperPointsIDs.add(id);
      }
    }
  }

  private getFoundItem(mesh: any) {
    const itemList: any[] = [];

    if (this.mode === "VERTEX" || this.mode === "ALL") {
      itemList.push(this._helper.vertices);
      for (const vertices of this.vertices) {
        itemList.push(vertices);
      }
    }

    if (this.mode === "LINE" || this.mode === "ALL") {
      itemList.push(this._helper);
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
      meshes.push(this._helper.vertices.mesh);
      for (const vertices of this.vertices) {
        meshes.push(vertices.mesh);
      }
    }

    if (this.mode === "LINE" || this.mode === "ALL") {
      meshes.push(this._helper.mesh);
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
