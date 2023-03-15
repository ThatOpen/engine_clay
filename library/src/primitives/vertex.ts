import * as THREE from "three";

export class Vertices {

  /** Buffer increment when geometry size is exceeded. */
  bufferIncrease = 300;
  
  /** */
  points: THREE.Points;

  private geometry = new THREE.BufferGeometry();
  private vertices: THREE.Vector3[] = [];
  private capacity = 0;
  private buffer = new Float32Array(0);
  private position = new THREE.BufferAttribute(this.buffer, 3);

  constructor(color: THREE.ColorRepresentation = 0x888888, size: number = 0.1) {
    this.resetBuffer();
    const material = new THREE.PointsMaterial({ color, size });
    this.points = new THREE.Points(this.geometry, material);
  }

  /**
   * Add new points
   * @param coordinates Points to add
   */
  add(coordinates: THREE.Vector3[]) {
    this.vertices.push(...coordinates);
    this.regenerate();
  }

  private regenerate() {
    const size = this.vertices.length * 3;
    if(size >= this.capacity) {
      this.resetBuffer();
      return;
    }
    const indexToAdd = this.vertices.length - 1;
    const { x, y, z } = this.vertices[indexToAdd];
    this.buffer.set([x, y, z], indexToAdd * 3);
    this.position.count = this.vertices.length;
  }

  private resetBuffer() {
    this.capacity += this.bufferIncrease;
    this.geometry.deleteAttribute("position");
    this.buffer = new Float32Array(this.capacity);
    this.position = new THREE.BufferAttribute(this.buffer, 3);
    this.position.count = this.vertices.length;
    this.geometry.setAttribute("position", this.position);
    for (let i = 0; i < this.vertices.length; i++) {
      const { x, y, z } = this.vertices[i];
      this.buffer.set([x, y, z], i * 3);
    }
  }
}