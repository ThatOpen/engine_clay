import * as THREE from "three";
import { Vertices } from "../Vertices";
import { Primitive } from "../types";

export class Lines implements Primitive {
  /** {@link Primitive.mesh } */
  mesh = new THREE.LineSegments();

  /**
   * The list of points that define the lines. Each point corresponds to a set of {@link Vertices}. This way,
   * we can provide an API of lines that share vertices, but under the hood the vertices are duplicated per line
   * (and thus being compatible with [THREE.EdgesGeometry](https://threejs.org/docs/#api/en/geometries/EdgesGeometry)).
   */
  points: {
    [id: number]: {
      coordinates: [number, number, number];
      id: number;
      lines: Set<number>;
      vertices: Set<number>;
    };
  } = {};

  /**
   * The list of lines.
   */
  list: {
    [id: number]: {
      id: number;
      points: Set<number>;
      indices: Set<number>;
    };
  } = {};

  /**
   * The geometric representation of the vertices that define this instance of lines.
   */
  vertices: Vertices = new Vertices();

  /** The IDs of the selected lines. */
  selected = new Set<number>();

  // private _faceIdGenerator = 0;
  private _pointIdGenerator = 0;
  private _lineIdGenerator = 0;

  private _baseColor = new THREE.Color(0.5, 0.5, 0.5);
  private _selectColor = new THREE.Color(1, 0, 0);
  private _segmentCount = 0;

  private get _positionBuffer() {
    return this.mesh.geometry.attributes.position as THREE.BufferAttribute;
  }

  private get _colorBuffer() {
    return this.mesh.geometry.attributes.color as THREE.BufferAttribute;
  }

  private get _ids() {
    const ids: number[] = [];
    for (const id in this.list) {
      ids.push(this.list[id].id);
    }
    return ids;
  }

  constructor() {
    this.resetBuffers();
    const material = new THREE.LineBasicMaterial({ vertexColors: true });
    const geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.LineSegments(geometry, material);
  }

  /**
   * Adds a line.
   * @param ids - the IDs of the {@link points} that define that line.
   */
  add(ids: number[]) {
    const id = this._lineIdGenerator++;
    for (const pointID of ids) {
      const point = this.points[pointID];
      point.lines.add(id);
    }

    const indices: number[] = [];
    const newSegmentCount = this._segmentCount + ids.length - 1;
    for (let i = this._segmentCount; i < newSegmentCount; i++) {
      indices.push(i);
    }

    this.list[id] = {
      id,
      points: new Set(ids),
      indices: new Set(indices),
    };

    this._segmentCount = newSegmentCount;
  }

  /**
   * Adds the points that can be used by one or many lines.
   * @param points the list of (x, y, z) coordinates of the points.
   */
  addPoints(points: [number, number, number][]) {
    for (const [x, y, z] of points) {
      const id = this._pointIdGenerator++;
      this.points[id] = {
        id,
        coordinates: [x, y, z],
        vertices: new Set<number>(),
        lines: new Set<number>(),
      };
    }
    this.vertices.add(points);
  }

  /**
   * Select or unselects the given lines.
   * @param active Whether to select or unselect.
   * @param ids List of faces IDs to select or unselect. If not
   * defined, all lines will be selected or deselected.
   */
  select(active: boolean, ids = this._ids) {
    const lineIDs = ids || Object.values(this.list).map((face) => face.id);
    const idsToUpdate: number[] = [];
    for (const id of lineIDs) {
      const exists = this.list[id] !== undefined;
      if (!exists) continue;

      const isAlreadySelected = this.selected.has(id);
      if (active) {
        if (isAlreadySelected) continue;
        this.selected.add(id);
        idsToUpdate.push(id);
      } else {
        if (!isAlreadySelected) continue;
        this.selected.delete(id);
        idsToUpdate.push(id);
      }
    }
    this.updateColor(idsToUpdate);
  }

  selectPoints(active: boolean, ids?: number[]) {
    this.vertices.select(active, ids);
  }

  regenerate() {
    this.resetBuffers();
    const position = this._positionBuffer;
    let i = 0;
    for (const lineID in this.list) {
      const line = this.list[lineID];
      let previous: [number, number, number] | null = null;
      for (const pointID of line.points) {
        const point = this.points[pointID];
        const coords = point.coordinates;
        if (previous) {
          position.setXYZ(i++, previous[0], previous[1], previous[2]);
          position.setXYZ(i++, coords[0], coords[1], coords[2]);
          position.count += 2;
        }
        previous = coords;
      }
    }
    position.needsUpdate = true;
    this.updateColor();
  }

  private resetBuffers() {
    const vertexCount = this._segmentCount * 2;
    const positionBuffer = new Float32Array(vertexCount * 3);
    const positionAttribute = new THREE.BufferAttribute(positionBuffer, 3);
    positionAttribute.count = 0;
    this.mesh.geometry.setAttribute("position", positionAttribute);

    const colorBuffer = new Float32Array(vertexCount * 3);
    const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
    this.mesh.geometry.setAttribute("color", colorAttribute);
  }

  private updateColor(ids = this._ids) {
    const colorAttribute = this._colorBuffer;
    for (const id of ids) {
      const line = this.list[id];
      const isSelected = this.selected.has(line.id);
      const { r, g, b } = isSelected ? this._selectColor : this._baseColor;
      for (const index of line.indices) {
        colorAttribute.setXYZ(index * 2, r, g, b);
        colorAttribute.setXYZ(index * 2 + 1, r, g, b);
      }
    }
    colorAttribute.needsUpdate = true;
  }
}
