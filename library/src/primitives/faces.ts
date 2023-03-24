import * as THREE from "three";
import { Earcut } from "three/src/extras/Earcut.js";
import { Vertices } from "./vertex";
import { ClayFace } from "./clayFace";

export class Faces {
  /** Mesh containing all faces */
  mesh: THREE.Mesh = new THREE.Mesh();

  private _points: Vertices = new Vertices();
  private _geometry = new THREE.BufferGeometry();
  private _clayFaces: ClayFace[] = [];

  constructor() {
    this.updatePositionBuffer();
    this.updateIndexBuffer();
    this.mesh = new THREE.Mesh(
      this._geometry,
      new THREE.MeshPhongMaterial({ side: THREE.DoubleSide })
    );
  }

  /**
   * Creates a new faces
   * @param ptList List of coplanar points for each face
   */
  addFaces(pointLists: [THREE.Vector3[]]) {
    for (const index in pointLists) {
      const pointList = pointLists[index];
      if (pointList.length > 2) {
        const newList = [];
        for (let i = 0; i < pointList.length; i++) {
          newList.push(this._points.length() + i);
        }
        this._points.add(pointList);
        const face = new ClayFace(newList);
        this._clayFaces.push(face);
      }
    }
    this.updateIndexBuffer(this._clayFaces.length - pointLists.length);
  }

  /**
   * Remove faces from the model
   * @param indices Indices of the faces to remove
   */
  removeFaces(indices: number[]) {
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const face = this._clayFaces[index];
      this._points.select(true, face.indexPoints);
      this.correctIndices(index);
      this._points.remove();
      this.removeTriangles(face.indexFaces);
      this._clayFaces.splice(index, 1);
    }
  }

  private removeTriangles(list: number[]) {
    const IndexList = this.createStartList(1);
    for (let i = 0; i < list.length; i++) {
      const index = (list[i] - i) * 3;
      IndexList.splice(index, 1);
      IndexList.splice(index + 1, 1);
      IndexList.splice(index + 2, 1);
    }
    this.correctFaceTriangles(list);
    this._geometry.setIndex(IndexList);
  }

  private correctFaceTriangles(list: number[]) {
    for (let k = 0; k < list.length; k++) {
      for (let i = 0; i < this._clayFaces.length; i++) {
        for (let j = 0; j < this._clayFaces[i].indexFaces.length; j++) {
          if (this._clayFaces[i].indexFaces[j] > list[k]) {
            this._clayFaces[i].indexFaces[j]--;
          }
        }
      }
      for (let i = 0; i < list.length; i++) {
        if (list[i] > list[k]) {
          list[i]--;
        }
      }
    }
  }

  private correctIndexFaces(faceIndex: number, pointer: number) {
    for (let i = 0; i < this._clayFaces.length; i++) {
      if (i !== faceIndex) {
        const face2 = this._clayFaces[i];
        for (let k = 0; k < face2.indexPoints.length; k++) {
          if (face2.indexPoints[k] > pointer) {
            face2.indexPoints[k]--;
          }
        }
      }
    }
  }

  private correctIndexTriangles(pointer: number) {
    const newIndices: number[] = this.createStartList(1);
    for (let i = 0; i < newIndices.length; i++) {
      if (newIndices[i] > pointer) {
        newIndices[i]--;
      }
    }
    this._geometry.setIndex(newIndices);
  }

  private correctIndices(index: number) {
    const face = this._clayFaces[index];
    for (let j = 0; j < face.indexPoints.length; j++) {
      for (let k = 0; k < face.indexPoints.length; k++) {
        if (face.indexPoints[k] > face.indexPoints[j]) {
          face.indexPoints[k]--;
        }
      }
      this.correctIndexFaces(index, face.indexPoints[j]);
      this.correctIndexTriangles(face.indexPoints[j]);
    }
  }

  private updatePositionBuffer() {
    this._geometry.setAttribute("position", this._points.getPositionBuffer());
  }

  private createStartList(startIndex: number) {
    const newIndices: number[] | null = [];
    if (startIndex > 0) {
      const tempIndexList = this._geometry.getIndex()?.array;
      if (tempIndexList) {
        for (let i = 0; i < tempIndexList.length; i++) {
          newIndices.push(tempIndexList[i]);
        }
      }
    }
    return newIndices;
  }

  private triangulateFace(face: ClayFace) {
    const coordinates = [];
    for (let j = 0; j < face.indexPoints.length; j++) {
      const index = face.indexPoints[j];
      const position = this._points.getPointByIndex(index);
      coordinates.push(position[0]);
      coordinates.push(position[1]);
      coordinates.push(position[2]);
    }
    const voidList: number[] = [];
    return Earcut.triangulate(coordinates, voidList, 3);
  }

  private addTriangulatedFace(
    face: ClayFace,
    indices: number[],
    newIndices: number[]
  ) {
    for (let j = 0; j < indices.length; j++) {
      const a = indices[j];
      const b = indices[j + 1];
      const c = indices[j + 2];
      const pointA = face.indexPoints[a];
      const pointB = face.indexPoints[b];
      const pointC = face.indexPoints[c];  
      face.indexFaces.push(newIndices.length / 3);
      newIndices.push(pointA);
      newIndices.push(pointB);
      newIndices.push(pointC);
      j += 2;
    }
  }

  private updateIndexBuffer(startIndex: number = 0) {
    const newIndices = this.createStartList(startIndex);
    for (let i = startIndex; i < this._clayFaces.length; i++) {
      const face = this._clayFaces[i];
      const indices = this.triangulateFace(face);
      // @ts-ignore
      this.addTriangulatedFace(face, indices, newIndices);
    }
    this._geometry.setIndex(newIndices);
  }
}
