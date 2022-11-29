import * as THREE from 'https://unpkg.com/three@0.135.0/build/three.module.js';

class Clay extends THREE.Mesh {
    constructor(vertexCount = 100) {
        super();
        this.geometry = new THREE.BufferGeometry();
        this.size = vertexCount;
        this.initializeGeometry();
        this.material = Clay.defaultMaterial;
    }
    initializeGeometry() {
        const positionAttr = this.getBuffer(3);
        this.geometry.setAttribute("position", positionAttr);
        const normalBuffer = this.getBuffer(3);
        this.geometry.setAttribute("normal", normalBuffer);
    }
    getBuffer(dimension) {
        const positionBuffer = new Float32Array(this.size * dimension);
        return new THREE.BufferAttribute(positionBuffer, dimension);
    }
}
// Necessary if we want to avoid duplicate edges in indexed buffergeometries
Clay.defaultMaterial = new THREE.MeshPhongMaterial({
    flatShading: true,
    side: THREE.DoubleSide,
});

class Shell extends Clay {
    constructor(geometry) {
        var _a;
        super();
        this.selectionMaterial = new THREE.MeshPhongMaterial({
            color: "blue",
            depthTest: false,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            flatShading: true,
        });
        this.faces = [];
        this.faceIndexMap = new Map();
        if (!geometry.index) {
            throw new Error("The geometry must be indexed!");
        }
        this.geometry = geometry;
        // Deduplicate geometry
        const newPosition = [];
        const newIndex = [];
        const vertexIndexMap = new Map();
        let indexCounter = 0;
        const tolerance = 3;
        for (let i = 0; i < geometry.index.count; i++) {
            const currentIndex = geometry.index.getX(i);
            let vertexX = geometry.attributes.position.getX(currentIndex);
            let vertexY = geometry.attributes.position.getY(currentIndex);
            let vertexZ = geometry.attributes.position.getZ(currentIndex);
            const factor = 10 ** tolerance;
            vertexX = Math.trunc(vertexX * factor) / factor;
            vertexY = Math.trunc(vertexY * factor) / factor;
            vertexZ = Math.trunc(vertexZ * factor) / factor;
            const vertexID = [vertexX, vertexY, vertexZ].toString();
            if (vertexIndexMap.has(vertexID)) {
                const recicledIndex = vertexIndexMap.get(vertexID);
                newIndex.push(recicledIndex);
            }
            else {
                vertexIndexMap.set(vertexID, indexCounter);
                newIndex.push(indexCounter);
                newPosition.push(vertexX, vertexY, vertexZ);
                indexCounter++;
            }
        }
        // Clean up faces that are not triangles
        const indexToDelete = [];
        for (let i = 0; i < newIndex.length; i += 3) {
            if (newIndex[i] === newIndex[i + 1] ||
                newIndex[i] === newIndex[i + 2] ||
                newIndex[i + 1] === newIndex[i + 2]) {
                indexToDelete.push(i);
            }
        }
        let counter = 0;
        for (const index of indexToDelete) {
            newIndex.splice(index - counter, 3);
            counter += 3;
        }
        // Create new geometry
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
        // Sort triangles by shared edges
        const trianglesByEdges = new Map();
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
                }
                else {
                    (_a = trianglesByEdges.get(edgeID)) === null || _a === void 0 ? void 0 : _a.faces.push(i);
                }
            }
        }
        // Collect hard edges
        const hardEdgesIDs = [];
        const edgeIDs = trianglesByEdges.keys();
        for (const edgeID of edgeIDs) {
            const current = trianglesByEdges.get(edgeID);
            const facePair = current.faces;
            const normal1 = this.getNormalID(facePair[0]);
            const normal2 = this.getNormalID(facePair[1]);
            if (normal1 !== normal2) {
                hardEdgesIDs.push(current.edge);
                trianglesByEdges.delete(edgeID);
            }
        }
        // Group adjacent faces
        let indexCount = 0;
        const coplanarFaces = new Set();
        const facePairs = trianglesByEdges.values();
        for (const facePair of facePairs) {
            const face1 = facePair.faces[0];
            const face2 = facePair.faces[1];
            const face1Found = this.faceIndexMap.has(face1);
            const face2Found = this.faceIndexMap.has(face2);
            if (face1Found && face2Found) {
                continue;
            }
            else if (face1Found) {
                const index = this.faceIndexMap.get(face1);
                this.faceIndexMap.set(face2, index);
                this.faces[index].push(face2);
                coplanarFaces.add(face2);
            }
            else if (face2Found) {
                const index = this.faceIndexMap.get(face2);
                this.faceIndexMap.set(face1, index);
                this.faces[index].push(face1);
                coplanarFaces.add(face1);
            }
            else {
                this.faceIndexMap.set(face1, indexCount);
                this.faceIndexMap.set(face2, indexCount);
                this.faces[indexCount] = [];
                this.faces[indexCount].push(face1, face2);
                coplanarFaces.add(face1);
                coplanarFaces.add(face2);
                indexCount++;
            }
        }
        // Get the faces that are just one triangle
        for (let i = 0; i < geometry.index.count; i += 3) {
            if (!coplanarFaces.has(i)) {
                this.faceIndexMap.set(i, this.faces.length);
                this.faces.push([i]);
            }
        }
    }
    transform(transform) {
        const index = this.selection.geometry.index;
        if (!index)
            return;
        const uniqueIndices = Array.from(new Set(index.array));
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
    selectFace(faceIndex) {
        const index = this.faceIndexMap.get(faceIndex * 3);
        if (index === undefined)
            return;
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
    getNormalID(faceIndex) {
        const position = this.geometry.attributes.position;
        const index = this.geometry.index;
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

class Extrusion extends Clay {
    constructor() {
        super();
        console.log("Hey!");
    }
}

export { Clay, Extrusion, Shell };
