import * as THREE from "three";

export class Mouse {
  /**
   * The real position of the mouse of the Three.js canvas.
   */
  getPosition(canvas: HTMLCanvasElement, event: MouseEvent) {
    const position = new THREE.Vector2();
    const bounds = canvas.getBoundingClientRect();
    position.x = this.getPositionX(bounds, event);
    position.y = this.getPositionY(bounds, event);
    return position;
  }

  private getPositionY(bound: DOMRect, event: MouseEvent) {
    return -((event.clientY - bound.top) / (bound.bottom - bound.top)) * 2 + 1;
  }

  private getPositionX(bound: DOMRect, event: MouseEvent) {
    return ((event.clientX - bound.left) / (bound.right - bound.left)) * 2 - 1;
  }
}
