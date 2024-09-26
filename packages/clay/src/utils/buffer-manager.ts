import * as THREE from "three";

export class BufferManager {
  /** Buffer increment when geometry size is exceeded, multiple of 3. */
  bufferIncrease = 300;

  /**
   * The maximum capacity of the buffers. If exceeded by the {@link size},
   * the buffers will be rescaled.
   */
  capacity = 0;

  /** The current size of the buffers. */
  get size() {
    const firstAttribute = this.attributes[0];
    return firstAttribute.count * 3;
  }

  get attributes() {
    return Object.values(this.geometry.attributes) as THREE.BufferAttribute[];
  }

  constructor(public geometry: THREE.BufferGeometry) {}

  addAttribute(attribute: THREE.BufferAttribute) {
    this.geometry.setAttribute(attribute.name, attribute);
  }

  resetAttributes() {
    for (const attribute of this.attributes) {
      this.createAttribute(attribute.name);
    }
    this.capacity = 0;
  }

  createAttribute(name: string) {
    if (this.geometry.hasAttribute(name)) {
      this.geometry.deleteAttribute(name);
    }
    const attribute = new THREE.BufferAttribute(new Float32Array(0), 3);
    attribute.name = name;
    this.geometry.setAttribute(name, attribute);
  }

  resizeIfNeeded(increase: number) {
    const newSize = this.size + increase * 3;
    const difference = newSize - this.capacity;
    if (difference >= 0) {
      const increase = Math.max(difference, this.bufferIncrease);
      const oldCapacity = this.capacity;
      this.capacity += increase;
      for (const attribute of this.attributes) {
        this.resizeBuffers(attribute, oldCapacity);
      }
    }
  }

  private resizeBuffers(attribute: THREE.BufferAttribute, oldCapacity: number) {
    this.geometry.deleteAttribute(attribute.name);
    const array = new Float32Array(this.capacity);
    const newAttribute = new THREE.BufferAttribute(array, 3);
    newAttribute.name = attribute.name;
    // newAttribute.count = attribute.count;
    this.geometry.setAttribute(attribute.name, newAttribute);
    for (let i = 0; i < oldCapacity; i++) {
      const x = attribute.getX(i);
      const y = attribute.getY(i);
      const z = attribute.getZ(i);
      newAttribute.setXYZ(i, x, y, z);
    }
  }
}
