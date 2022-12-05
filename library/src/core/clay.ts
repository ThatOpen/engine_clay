import * as THREE from "three";

export class Clay extends THREE.Mesh {
  size: number;
  geometry = new THREE.BufferGeometry();

  protected static defaultMaterial = new THREE.MeshPhongMaterial({
    flatShading: true,
    side: THREE.DoubleSide,
  });

  constructor(vertexCount = 100) {
    super();
    this.size = vertexCount;
    this.initializeGeometry();
    this.material = Clay.defaultMaterial;
  }

  private initializeGeometry() {
    const positionAttr = this.getBuffer(3);
    this.geometry.setAttribute("position", positionAttr);
    const normalBuffer = this.getBuffer(3);
    this.geometry.setAttribute("normal", normalBuffer);
  }

  private getBuffer(dimension: number) {
    const positionBuffer = new Float32Array(this.size * dimension);
    return new THREE.BufferAttribute(positionBuffer, dimension);
  }
}
