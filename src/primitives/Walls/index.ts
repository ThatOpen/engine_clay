import * as THREE from "three";
// import { Vector3 } from "three";
import { Primitive } from "../Primitive";
import { OffsetFaces } from "../OffsetFaces";
import { Extrusions } from "../Extrusions";
import { Vector } from "../../utils";

export class Walls extends Primitive {
  /** {@link Primitive.mesh } */
  mesh: THREE.Mesh;

  offsetFaces = new OffsetFaces();
  extrusions = new Extrusions();

  list: {
    [id: number]: {
      id: number;
      extrusion: number;
    };
  } = {};

  defaultAxis: number;

  constructor() {
    super();
    // TODO: Probably better to keep offsetfaces and extrusion faces separated
    this.extrusions.faces = this.offsetFaces.faces;
    this.mesh = this.extrusions.mesh;

    const heightPointsID = this.extrusions.lines.addPoints([
      [0, 0, 0],
      [0, 3, 0],
    ]);

    const [axisID] = this.extrusions.lines.add(heightPointsID);
    this.defaultAxis = axisID;
  }

  regenerate(ids = this.offsetFaces.ids) {
    for (const id of ids) {
      const extrusion = this.createGeometry(id);
      if (extrusion === null) continue;

      this.list[id] = {
        id,
        extrusion,
      };
    }
    const relatedKnots = this.offsetFaces.getRelatedKnots(ids);
    this.regenerateKnots(relatedKnots);
  }

  /**
   * Select or unselects the given Walls.
   * @param active Whether to select or unselect.
   * @param ids List of walls IDs to select or unselect. If not
   * defined, all lines walls be selected or deselected.
   */
  select(active: boolean, ids?: Iterable<number>) {
    const idsUndefined = ids === undefined;
    const items = idsUndefined ? this.ids : ids;
    this.selected.select(active, items, this.ids);
    const extrusions: number[] = [];
    for (const id of this.selected.data) {
      const wall = this.list[id];
      if (!wall) continue;
      extrusions.push(wall.extrusion);
    }
    const selected = idsUndefined ? undefined : extrusions;
    this.extrusions.select(active, selected);
  }

  private regenerateKnots(ids = this.offsetFaces.knotsIDs as Iterable<number>) {
    for (const knotID of ids) {
      const knot = this.offsetFaces.knots[knotID];
      if (knot === null || knot === undefined) continue;
      this.createKnotGeometry(knot);
    }
  }

  private createGeometry(offsetFaceID: number) {
    const offsetFace = this.offsetFaces.list[offsetFaceID];
    const [p1ID, p2ID, p3ID, p4ID] = offsetFace.points;

    const points = this.offsetFaces.faces.points;
    const p1 = points[p1ID].coordinates;
    const p4 = points[p4ID].coordinates;

    const line = this.extrusions.lines.get(this.defaultAxis);
    if (!line) return null;
    const [start, end] = line;
    const vector = Vector.subtract(start, end);

    const p1Top = Vector.add(p1, vector);
    const p4Top = Vector.add(p4, vector);

    const direction = Vector.subtract(p1, p4);
    const normalDirection = Vector.normalize(direction);
    const normal = Vector.multiply(Vector.up, normalDirection);
    const scaledNormal = Vector.multiplyScalar(normal, offsetFace.width);
    const p1Normal = Vector.add(p1, scaledNormal);
    const normalAxisPointsIDs = this.extrusions.lines.addPoints([p1, p1Normal]);
    const [normalAxis] = this.extrusions.lines.add(normalAxisPointsIDs);

    const pointsIDs = this.extrusions.faces.addPoints([p1, p1Top, p4Top, p4]);
    const faceID = this.extrusions.faces.add(pointsIDs);
    const extrusionID = this.extrusions.add(faceID, normalAxis);

    // Correct extrusion top to fit the OffsetFace knots

    const extrusion = this.extrusions.list[extrusionID];
    const otherSide = this.extrusions.faces.list[extrusion.topFace];
    const otherSidePoints = Array.from(otherSide.points);

    const [extrP2, extrP2Top, extrP3Top, extrP3] = otherSidePoints;

    const p2 = points[p2ID].coordinates;
    const p3 = points[p3ID].coordinates;
    const p2Top = Vector.add(p2, vector);
    const p3Top = Vector.add(p3, vector);

    this.extrusions.faces.setPoint(extrP2, p2);
    this.extrusions.faces.setPoint(extrP3, p3);
    this.extrusions.faces.setPoint(extrP2Top, p2Top);
    this.extrusions.faces.setPoint(extrP3Top, p3Top);

    return extrusionID;
  }

  private createKnotGeometry(knot: number) {
    const face = this.offsetFaces.faces.list[knot];
    const points: [number, number, number][] = [];
    for (const pointID of face.points) {
      const point = this.offsetFaces.faces.points[pointID];
      points.push(point.coordinates);
    }
    const pointsIDs = this.extrusions.faces.addPoints(points);
    const faceID = this.extrusions.faces.add(pointsIDs);
    this.extrusions.add(faceID, this.defaultAxis);
  }
}
