import * as THREE from "three";
import { Points } from "./points";

export class Edges extends Points {
  protected tempLine = new THREE.Line3();

  private readonly lines: THREE.Line;
  private readonly lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
  });

  constructor(points: THREE.Vector3[]) {
    super(points);
    this.lines = new THREE.Line(this.geometry, this.lineMaterial);
    this.add(this.lines);
  }

  protected regenerate(points: THREE.Vector3[]) {
    super.regenerate(points);
  }

  protected getMouseScreenDistance(index: number, mouse: THREE.Vector2) {
    if (this.pickMode !== "edge") {
      return super.getMouseScreenDistance(index, mouse);
    }
    if (index / 3 === this.count - 1) return this.tolerance + 1;
    const currentPoint = this.getPositionVector(index);
    const nextPoint = this.getPositionVector(index + 3);
    this.tempLine.start.set(currentPoint.x, currentPoint.y, 0);
    this.tempLine.end.set(nextPoint.x, nextPoint.y, 0);
    this.tempVector3.set(mouse.x, mouse.y, 0);
    const closest = new THREE.Vector3();
    this.tempLine.closestPointToPoint(this.tempVector3, false, closest);
    return closest.distanceTo(this.tempVector3);
  }

  protected highlight(index: number) {
    if (this.pickMode !== "edge") {
      super.highlight(index);
      return;
    }
    super.highlight(index);
    super.highlight(index + 1);
  }
}
