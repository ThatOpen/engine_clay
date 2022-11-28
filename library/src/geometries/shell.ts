import * as THREE from "three";
import { Clay } from "../core/clay";

export class Shell extends Clay {
  selectionMaterial = new THREE.MeshPhongMaterial({
    color: "blue",
    depthTest: false,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  selection: THREE.Mesh;

  private faces: number[][] = [];
  private faceIndexMap = new Map<number, number>();

  constructor(geometry: THREE.BufferGeometry) {
    super();
    if (!geometry.index) {
      throw new Error("The geometry must be indexed!");
    }

    this.geometry = geometry;

    // Deduplicate geometry

    const newPosition: number[] = [];
    const newIndex: number[] = [];

    const vertexIndexMap = new Map<string, number>();
    let indexCounter = 0;

    for (let i = 0; i < geometry.index.count; i++) {
      const currentIndex = geometry.index.getX(i);
      const vertexX = geometry.attributes.position.getX(currentIndex);
      const vertexY = geometry.attributes.position.getY(currentIndex);
      const vertexZ = geometry.attributes.position.getZ(currentIndex);

      const vertexID = [vertexX, vertexY, vertexZ].toString();

      if (vertexIndexMap.has(vertexID)) {
        const recicledIndex = vertexIndexMap.get(vertexID) as number;
        newIndex.push(recicledIndex);
      } else {
        vertexIndexMap.set(vertexID, indexCounter);
        newIndex.push(indexCounter);
        newPosition.push(vertexX, vertexY, vertexZ);
        indexCounter++;
      }
    }

    const newPositionBuffer = new Float32Array(newPosition);
    const newPositionAttr = new THREE.BufferAttribute(newPositionBuffer, 3);
    geometry.setAttribute("position", newPositionAttr);
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    geometry.setIndex(newIndex);
    geometry.computeVertexNormals();

    // Set up selection

    const copy = new THREE.BufferGeometry();
    copy.setAttribute("position", geometry.attributes.position);
    copy.setAttribute("normal", geometry.attributes.normal);
    copy.setIndex([]);
    this.selection = new THREE.Mesh(copy, this.selectionMaterial);
    this.selection = new THREE.Mesh(copy, this.selectionMaterial);

    // Sort triangles by shared edges

    const trianglesByEdges = new Map<
      string,
      { faces: number[]; edge: number[] }
    >();

    for (let i = 0; i < geometry.index.count; i += 3) {
      const index1 = geometry.index.getX(i);
      const index2 = geometry.index.getY(i);
      const index3 = geometry.index.getZ(i);

      const edges = [
        [index1, index2].sort(),
        [index2, index3].sort(),
        [index1, index3].sort(),
      ];

      for (const edge of edges) {
        const edgeID = edge.toString();
        if (!trianglesByEdges.has(edgeID)) {
          trianglesByEdges.set(edgeID, { faces: [i], edge });
        } else {
          trianglesByEdges.get(edgeID)?.faces.push(i);
        }
      }
    }

    console.log(trianglesByEdges);

    // Collect hard edges

    const hardEdgesIDs: number[][] = [];

    const edgeIDs = trianglesByEdges.keys();
    for (const edgeID of edgeIDs) {
      const current = trianglesByEdges.get(edgeID)!;
      const facePair = current.faces;
      const normal1 = this.getNormalID(facePair[0]);
      const normal2 = this.getNormalID(facePair[1]);
      if (normal1 !== normal2) {
        hardEdgesIDs.push(current.edge);
        trianglesByEdges.delete(edgeID);
      }
    }

    console.log(trianglesByEdges);
    console.log(hardEdgesIDs);

    // Group adjacent faces

    let indexCount = 0;

    const facePairs = trianglesByEdges.values();
    for (const facePair of facePairs) {
      const face1 = facePair.faces[0];
      const face2 = facePair.faces[1];
      if (this.faceIndexMap.has(face1)) {
        const index = this.faceIndexMap.get(face1) as number;
        this.faces[index].push(face2);
      } else if (this.faceIndexMap.has(face2)) {
        const index = this.faceIndexMap.get(face2) as number;
        this.faces[index].push(face1);
      } else {
        this.faceIndexMap.set(face1, indexCount);
        this.faceIndexMap.set(face2, indexCount);
        this.faces[indexCount] = [];
        this.faces[indexCount].push(face1, face2);
        indexCount++;
      }
    }

    console.log(this.faces);
  }

  transform(transform: THREE.Matrix4) {
    const index = this.selection.geometry.index;
    if (!index) return;
    const uniqueIndices = Array.from(new Set<number>(index.array as number[]));
    const position = this.selection.geometry.attributes.position;
    const tempVector = new THREE.Vector3();
    for (let i = 0; i < uniqueIndices.length; i++) {
      const currentIndex = uniqueIndices[i];
      tempVector.fromBufferAttribute(position, currentIndex);
      tempVector.applyMatrix4(transform);
      position.setX(currentIndex, tempVector.x);
      position.setY(currentIndex, tempVector.y);
      position.setZ(currentIndex, tempVector.z);
    }
    position.needsUpdate = true;
  }

  selectFace(faceIndex: number) {
    const index = this.faceIndexMap.get(faceIndex * 3);
    if (index === undefined) return;
    const triangles = this.faces[index];

    const selectionIndex = [];
    for (const tri of triangles) {
      if (!this.geometry.index) {
        throw new Error("Geometry must be indexed!");
      }

      const index1 = this.geometry.index.getX(tri);
      const index2 = this.geometry.index.getY(tri);
      const index3 = this.geometry.index.getZ(tri);

      selectionIndex.push(index1, index2, index3);
    }

    this.selection.geometry.setIndex(selectionIndex);
  }

  private getNormalID(faceIndex: number) {
    const position = this.geometry.attributes.position;
    const index = this.geometry.index as THREE.BufferAttribute;

    const tri = new THREE.Triangle();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const normal = new THREE.Vector3();

    const index1 = index.getX(faceIndex);
    const index2 = index.getY(faceIndex);
    const index3 = index.getZ(faceIndex);

    a.fromBufferAttribute(position, index1);
    b.fromBufferAttribute(position, index2);
    c.fromBufferAttribute(position, index3);
    tri.set(a, b, c);
    tri.getNormal(normal);

    return `${normal.x},${normal.y},${normal.z}`;
  }
}
