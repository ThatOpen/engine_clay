import * as THREE from "three";

export class Vertices {
  /** Buffer increment when geometry size is exceeded, multiple of 3. */
  bufferIncrease = 300;

  /** THREE points */
  points: THREE.Points;

  private geometry = new THREE.BufferGeometry();
  private vertices: THREE.Vector3[] = [];
  private colors: THREE.Color[] = [];
  private capacity = 0;
  private bufferPosition = new Float32Array(0);
  private position = new THREE.BufferAttribute(this.bufferPosition, 3);
  private bufferColor = new Float32Array(0);
  private color = new THREE.BufferAttribute(this.bufferColor, 3);

  constructor(size: number = 0.1) {
    this.resetBuffer();
    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
    });
    this.points = new THREE.Points(this.geometry, material);
  }

  /**
   * Add new points
   * @param coordinates Points to add
   */
  add(coordinates: THREE.Vector3[], colors: THREE.Color[]) {
    this.vertices.push(...coordinates);
    this.colors.push(...colors);
    this.regenerate();
  }

  private regenerate() {
    const size = this.vertices.length * 3;
    if (size >= this.capacity) {
      this.resetBuffer();
      return;
    }
    const indexToAdd = this.vertices.length - 1;
    const { x, y, z } = this.vertices[indexToAdd];
    this.bufferPosition.set([x, y, z], indexToAdd * 3);
    const { r, g, b } = this.colors[indexToAdd];
    this.bufferColor.set([r, g, b], indexToAdd * 3);
    this.position.count = this.vertices.length;
    this.color.count = this.vertices.length;
  }

  private resetBuffer() {
    this.capacity += this.bufferIncrease;
    this.geometry.deleteAttribute("position");
    this.bufferPosition = new Float32Array(this.capacity);
    this.position = new THREE.BufferAttribute(this.bufferPosition, 3);
    this.position.count = this.vertices.length;
    this.geometry.deleteAttribute("color");
    this.bufferColor = new Float32Array(this.capacity);
    this.color = new THREE.BufferAttribute(this.bufferColor, 3);
    this.color.count = this.vertices.length;
    this.geometry.setAttribute("position", this.position);
    this.geometry.setAttribute("color", this.color);

    for (let i = 0; i < this.vertices.length; i++) {
      const { x, y, z } = this.vertices[i];
      this.bufferPosition.set([x, y, z], i * 3);
      const { r, g, b } = this.colors[i];
      this.bufferColor.set([r, g, b], i * 3);
    }
  }
}
