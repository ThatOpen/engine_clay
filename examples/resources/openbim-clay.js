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

var earcut$1 = {exports: {}};

earcut$1.exports = earcut;
earcut$1.exports.default = earcut;

function earcut(data, holeIndices, dim) {

    dim = dim || 2;

    var hasHoles = holeIndices && holeIndices.length,
        outerLen = hasHoles ? holeIndices[0] * dim : data.length,
        outerNode = linkedList(data, 0, outerLen, dim, true),
        triangles = [];

    if (!outerNode || outerNode.next === outerNode.prev) return triangles;

    var minX, minY, maxX, maxY, x, y, invSize;

    if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);

    // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
    if (data.length > 80 * dim) {
        minX = maxX = data[0];
        minY = maxY = data[1];

        for (var i = dim; i < outerLen; i += dim) {
            x = data[i];
            y = data[i + 1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }

        // minX, minY and invSize are later used to transform coords into integers for z-order calculation
        invSize = Math.max(maxX - minX, maxY - minY);
        invSize = invSize !== 0 ? 32767 / invSize : 0;
    }

    earcutLinked(outerNode, triangles, dim, minX, minY, invSize, 0);

    return triangles;
}

// create a circular doubly linked list from polygon points in the specified winding order
function linkedList(data, start, end, dim, clockwise) {
    var i, last;

    if (clockwise === (signedArea(data, start, end, dim) > 0)) {
        for (i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
    } else {
        for (i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
    }

    if (last && equals(last, last.next)) {
        removeNode(last);
        last = last.next;
    }

    return last;
}

// eliminate colinear or duplicate points
function filterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;

    var p = start,
        again;
    do {
        again = false;

        if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
            removeNode(p);
            p = end = p.prev;
            if (p === p.next) break;
            again = true;

        } else {
            p = p.next;
        }
    } while (again || p !== end);

    return end;
}

// main ear slicing loop which triangulates a polygon (given as a linked list)
function earcutLinked(ear, triangles, dim, minX, minY, invSize, pass) {
    if (!ear) return;

    // interlink polygon nodes in z-order
    if (!pass && invSize) indexCurve(ear, minX, minY, invSize);

    var stop = ear,
        prev, next;

    // iterate through ears, slicing them one by one
    while (ear.prev !== ear.next) {
        prev = ear.prev;
        next = ear.next;

        if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
            // cut off the triangle
            triangles.push(prev.i / dim | 0);
            triangles.push(ear.i / dim | 0);
            triangles.push(next.i / dim | 0);

            removeNode(ear);

            // skipping the next vertex leads to less sliver triangles
            ear = next.next;
            stop = next.next;

            continue;
        }

        ear = next;

        // if we looped through the whole remaining polygon and can't find any more ears
        if (ear === stop) {
            // try filtering points and slicing again
            if (!pass) {
                earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);

            // if this didn't work, try curing all small self-intersections locally
            } else if (pass === 1) {
                ear = cureLocalIntersections(filterPoints(ear), triangles, dim);
                earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);

            // as a last resort, try splitting the remaining polygon into two
            } else if (pass === 2) {
                splitEarcut(ear, triangles, dim, minX, minY, invSize);
            }

            break;
        }
    }
}

// check whether a polygon node forms a valid ear with adjacent nodes
function isEar(ear) {
    var a = ear.prev,
        b = ear,
        c = ear.next;

    if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

    // now make sure we don't have other points inside the potential ear
    var ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

    // triangle bbox; min & max are calculated like this for speed
    var x0 = ax < bx ? (ax < cx ? ax : cx) : (bx < cx ? bx : cx),
        y0 = ay < by ? (ay < cy ? ay : cy) : (by < cy ? by : cy),
        x1 = ax > bx ? (ax > cx ? ax : cx) : (bx > cx ? bx : cx),
        y1 = ay > by ? (ay > cy ? ay : cy) : (by > cy ? by : cy);

    var p = c.next;
    while (p !== a) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) &&
            area(p.prev, p, p.next) >= 0) return false;
        p = p.next;
    }

    return true;
}

function isEarHashed(ear, minX, minY, invSize) {
    var a = ear.prev,
        b = ear,
        c = ear.next;

    if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

    var ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

    // triangle bbox; min & max are calculated like this for speed
    var x0 = ax < bx ? (ax < cx ? ax : cx) : (bx < cx ? bx : cx),
        y0 = ay < by ? (ay < cy ? ay : cy) : (by < cy ? by : cy),
        x1 = ax > bx ? (ax > cx ? ax : cx) : (bx > cx ? bx : cx),
        y1 = ay > by ? (ay > cy ? ay : cy) : (by > cy ? by : cy);

    // z-order range for the current triangle bbox;
    var minZ = zOrder(x0, y0, minX, minY, invSize),
        maxZ = zOrder(x1, y1, minX, minY, invSize);

    var p = ear.prevZ,
        n = ear.nextZ;

    // look for points inside the triangle in both directions
    while (p && p.z >= minZ && n && n.z <= maxZ) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.prevZ;

        if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
            pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
        n = n.nextZ;
    }

    // look for remaining points in decreasing z-order
    while (p && p.z >= minZ) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.prevZ;
    }

    // look for remaining points in increasing z-order
    while (n && n.z <= maxZ) {
        if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
            pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
        n = n.nextZ;
    }

    return true;
}

// go through all polygon nodes and cure small local self-intersections
function cureLocalIntersections(start, triangles, dim) {
    var p = start;
    do {
        var a = p.prev,
            b = p.next.next;

        if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {

            triangles.push(a.i / dim | 0);
            triangles.push(p.i / dim | 0);
            triangles.push(b.i / dim | 0);

            // remove two nodes involved
            removeNode(p);
            removeNode(p.next);

            p = start = b;
        }
        p = p.next;
    } while (p !== start);

    return filterPoints(p);
}

// try splitting polygon into two and triangulate them independently
function splitEarcut(start, triangles, dim, minX, minY, invSize) {
    // look for a valid diagonal that divides the polygon into two
    var a = start;
    do {
        var b = a.next.next;
        while (b !== a.prev) {
            if (a.i !== b.i && isValidDiagonal(a, b)) {
                // split the polygon in two by the diagonal
                var c = splitPolygon(a, b);

                // filter colinear points around the cuts
                a = filterPoints(a, a.next);
                c = filterPoints(c, c.next);

                // run earcut on each half
                earcutLinked(a, triangles, dim, minX, minY, invSize, 0);
                earcutLinked(c, triangles, dim, minX, minY, invSize, 0);
                return;
            }
            b = b.next;
        }
        a = a.next;
    } while (a !== start);
}

// link every hole into the outer loop, producing a single-ring polygon without holes
function eliminateHoles(data, holeIndices, outerNode, dim) {
    var queue = [],
        i, len, start, end, list;

    for (i = 0, len = holeIndices.length; i < len; i++) {
        start = holeIndices[i] * dim;
        end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
        list = linkedList(data, start, end, dim, false);
        if (list === list.next) list.steiner = true;
        queue.push(getLeftmost(list));
    }

    queue.sort(compareX);

    // process holes from left to right
    for (i = 0; i < queue.length; i++) {
        outerNode = eliminateHole(queue[i], outerNode);
    }

    return outerNode;
}

function compareX(a, b) {
    return a.x - b.x;
}

// find a bridge between vertices that connects hole with an outer ring and and link it
function eliminateHole(hole, outerNode) {
    var bridge = findHoleBridge(hole, outerNode);
    if (!bridge) {
        return outerNode;
    }

    var bridgeReverse = splitPolygon(bridge, hole);

    // filter collinear points around the cuts
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
}

// David Eberly's algorithm for finding a bridge between hole and outer polygon
function findHoleBridge(hole, outerNode) {
    var p = outerNode,
        hx = hole.x,
        hy = hole.y,
        qx = -Infinity,
        m;

    // find a segment intersected by a ray from the hole's leftmost point to the left;
    // segment's endpoint with lesser x will be potential connection point
    do {
        if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
            var x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
            if (x <= hx && x > qx) {
                qx = x;
                m = p.x < p.next.x ? p : p.next;
                if (x === hx) return m; // hole touches outer segment; pick leftmost endpoint
            }
        }
        p = p.next;
    } while (p !== outerNode);

    if (!m) return null;

    // look for points inside the triangle of hole point, segment intersection and endpoint;
    // if there are no points found, we have a valid connection;
    // otherwise choose the point of the minimum angle with the ray as connection point

    var stop = m,
        mx = m.x,
        my = m.y,
        tanMin = Infinity,
        tan;

    p = m;

    do {
        if (hx >= p.x && p.x >= mx && hx !== p.x &&
                pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {

            tan = Math.abs(hy - p.y) / (hx - p.x); // tangential

            if (locallyInside(p, hole) &&
                (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
                m = p;
                tanMin = tan;
            }
        }

        p = p.next;
    } while (p !== stop);

    return m;
}

// whether sector in vertex m contains sector in vertex p in the same coordinates
function sectorContainsSector(m, p) {
    return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
}

// interlink polygon nodes in z-order
function indexCurve(start, minX, minY, invSize) {
    var p = start;
    do {
        if (p.z === 0) p.z = zOrder(p.x, p.y, minX, minY, invSize);
        p.prevZ = p.prev;
        p.nextZ = p.next;
        p = p.next;
    } while (p !== start);

    p.prevZ.nextZ = null;
    p.prevZ = null;

    sortLinked(p);
}

// Simon Tatham's linked list merge sort algorithm
// http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
function sortLinked(list) {
    var i, p, q, e, tail, numMerges, pSize, qSize,
        inSize = 1;

    do {
        p = list;
        list = null;
        tail = null;
        numMerges = 0;

        while (p) {
            numMerges++;
            q = p;
            pSize = 0;
            for (i = 0; i < inSize; i++) {
                pSize++;
                q = q.nextZ;
                if (!q) break;
            }
            qSize = inSize;

            while (pSize > 0 || (qSize > 0 && q)) {

                if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) {
                    e = p;
                    p = p.nextZ;
                    pSize--;
                } else {
                    e = q;
                    q = q.nextZ;
                    qSize--;
                }

                if (tail) tail.nextZ = e;
                else list = e;

                e.prevZ = tail;
                tail = e;
            }

            p = q;
        }

        tail.nextZ = null;
        inSize *= 2;

    } while (numMerges > 1);

    return list;
}

// z-order of a point given coords and inverse of the longer side of data bbox
function zOrder(x, y, minX, minY, invSize) {
    // coords are transformed into non-negative 15-bit integer range
    x = (x - minX) * invSize | 0;
    y = (y - minY) * invSize | 0;

    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;

    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;

    return x | (y << 1);
}

// find the leftmost node of a polygon ring
function getLeftmost(start) {
    var p = start,
        leftmost = start;
    do {
        if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
        p = p.next;
    } while (p !== start);

    return leftmost;
}

// check if a point lies within a convex triangle
function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
    return (cx - px) * (ay - py) >= (ax - px) * (cy - py) &&
           (ax - px) * (by - py) >= (bx - px) * (ay - py) &&
           (bx - px) * (cy - py) >= (cx - px) * (by - py);
}

// check if a diagonal between two polygon nodes is valid (lies in polygon interior)
function isValidDiagonal(a, b) {
    return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) && // dones't intersect other edges
           (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && // locally visible
            (area(a.prev, a, b.prev) || area(a, b.prev, b)) || // does not create opposite-facing sectors
            equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0); // special zero-length case
}

// signed area of a triangle
function area(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

// check if two points are equal
function equals(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
}

// check if two segments intersect
function intersects(p1, q1, p2, q2) {
    var o1 = sign(area(p1, q1, p2));
    var o2 = sign(area(p1, q1, q2));
    var o3 = sign(area(p2, q2, p1));
    var o4 = sign(area(p2, q2, q1));

    if (o1 !== o2 && o3 !== o4) return true; // general case

    if (o1 === 0 && onSegment(p1, p2, q1)) return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
    if (o2 === 0 && onSegment(p1, q2, q1)) return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
    if (o3 === 0 && onSegment(p2, p1, q2)) return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
    if (o4 === 0 && onSegment(p2, q1, q2)) return true; // p2, q2 and q1 are collinear and q1 lies on p2q2

    return false;
}

// for collinear points p, q, r, check if point q lies on segment pr
function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

function sign(num) {
    return num > 0 ? 1 : num < 0 ? -1 : 0;
}

// check if a polygon diagonal intersects any polygon segments
function intersectsPolygon(a, b) {
    var p = a;
    do {
        if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
                intersects(p, p.next, a, b)) return true;
        p = p.next;
    } while (p !== a);

    return false;
}

// check if a polygon diagonal is locally inside the polygon
function locallyInside(a, b) {
    return area(a.prev, a, a.next) < 0 ?
        area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 :
        area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

// check if the middle point of a polygon diagonal is inside the polygon
function middleInside(a, b) {
    var p = a,
        inside = false,
        px = (a.x + b.x) / 2,
        py = (a.y + b.y) / 2;
    do {
        if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y &&
                (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x))
            inside = !inside;
        p = p.next;
    } while (p !== a);

    return inside;
}

// link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
// if one belongs to the outer ring and another to a hole, it merges it into a single ring
function splitPolygon(a, b) {
    var a2 = new Node(a.i, a.x, a.y),
        b2 = new Node(b.i, b.x, b.y),
        an = a.next,
        bp = b.prev;

    a.next = b;
    b.prev = a;

    a2.next = an;
    an.prev = a2;

    b2.next = a2;
    a2.prev = b2;

    bp.next = b2;
    b2.prev = bp;

    return b2;
}

// create a node and optionally link it with previous one (in a circular doubly linked list)
function insertNode(i, x, y, last) {
    var p = new Node(i, x, y);

    if (!last) {
        p.prev = p;
        p.next = p;

    } else {
        p.next = last.next;
        p.prev = last;
        last.next.prev = p;
        last.next = p;
    }
    return p;
}

function removeNode(p) {
    p.next.prev = p.prev;
    p.prev.next = p.next;

    if (p.prevZ) p.prevZ.nextZ = p.nextZ;
    if (p.nextZ) p.nextZ.prevZ = p.prevZ;
}

function Node(i, x, y) {
    // vertex index in coordinates array
    this.i = i;

    // vertex coordinates
    this.x = x;
    this.y = y;

    // previous and next vertex nodes in a polygon ring
    this.prev = null;
    this.next = null;

    // z-order curve value
    this.z = 0;

    // previous and next nodes in z-order
    this.prevZ = null;
    this.nextZ = null;

    // indicates whether this is a steiner point
    this.steiner = false;
}

// return a percentage difference between the polygon area and its triangulation area;
// used to verify correctness of triangulation
earcut.deviation = function (data, holeIndices, dim, triangles) {
    var hasHoles = holeIndices && holeIndices.length;
    var outerLen = hasHoles ? holeIndices[0] * dim : data.length;

    var polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
    if (hasHoles) {
        for (var i = 0, len = holeIndices.length; i < len; i++) {
            var start = holeIndices[i] * dim;
            var end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
            polygonArea -= Math.abs(signedArea(data, start, end, dim));
        }
    }

    var trianglesArea = 0;
    for (i = 0; i < triangles.length; i += 3) {
        var a = triangles[i] * dim;
        var b = triangles[i + 1] * dim;
        var c = triangles[i + 2] * dim;
        trianglesArea += Math.abs(
            (data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
            (data[a] - data[b]) * (data[c + 1] - data[a + 1]));
    }

    return polygonArea === 0 && trianglesArea === 0 ? 0 :
        Math.abs((trianglesArea - polygonArea) / polygonArea);
};

function signedArea(data, start, end, dim) {
    var sum = 0;
    for (var i = start, j = end - dim; i < end; i += dim) {
        sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
        j = i;
    }
    return sum;
}

// turn a polygon in a multi-dimensional array form (e.g. as in GeoJSON) into a form Earcut accepts
earcut.flatten = function (data) {
    var dim = data[0][0].length,
        result = {vertices: [], holes: [], dimensions: dim},
        holeIndex = 0;

    for (var i = 0; i < data.length; i++) {
        for (var j = 0; j < data[i].length; j++) {
            for (var d = 0; d < dim; d++) result.vertices.push(data[i][j][d]);
        }
        if (i > 0) {
            holeIndex += data[i - 1].length;
            result.holes.push(holeIndex);
        }
    }
    return result;
};

// TODO: move, add and delete points from profile
// TODO: edit height
// TODO: Add inner profile points (holes)
class Extrusion extends Clay {
    constructor() {
        super(...arguments);
        this.points = [];
        this.profileMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            depthTest: false,
        });
        this.profileMesh = new THREE.Line(new THREE.BufferGeometry(), this.profileMaterial);
        this.pointsMesh = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xff0000, depthTest: false, size: 0.1 }));
        this.height = 1;
        this.normalPlane = new THREE.Plane();
    }
    regenerate() {
        // Create profile representation
        const loopedPoints = [...this.points, this.points[0]];
        this.profileMesh.geometry.setFromPoints(loopedPoints);
        this.pointsMesh.geometry.setFromPoints(this.points);
        // Clean up previous geometry
        this.geometry.deleteAttribute("position");
        this.geometry.deleteAttribute("normal");
        // Get profile direction
        const [p1, p2, p3] = this.points;
        this.normalPlane.setFromCoplanarPoints(p1, p2, p3);
        const normal = this.normalPlane.normal;
        const offset = normal.clone().multiplyScalar(this.height);
        // Get vertices
        const vertices = [];
        for (const { x, y, z } of this.points) {
            vertices.push(x, y, z);
        }
        for (const { x, y, z } of this.points) {
            vertices.push(x + offset.x, y + offset.y, z + offset.z);
        }
        const positionArray = new Float32Array(vertices);
        const positionAttr = new THREE.BufferAttribute(positionArray, 3);
        this.geometry.setAttribute("position", positionAttr);
        // Triangulate base profile (also applies to end profile)
        // Earcut only works with 2d, so we need to project the points into 2d
        const points = [];
        for (const point of this.points) {
            const { x, z } = point.clone().projectOnPlane(normal);
            points.push(x, z);
        }
        const triangleIndices = earcut$1.exports(points, undefined, 2);
        // Define indices
        const indices = [];
        // Base indices
        for (const index of triangleIndices) {
            indices.push(index);
        }
        const length = this.points.length;
        // End indices
        for (const index of triangleIndices) {
            indices.push(index + length);
        }
        // Transition indices are square faces composed by 2 triangles
        for (let i = 0; i < length - 1; i++) {
            indices.push(i, i + 1, i + 1 + length);
            indices.push(i + 1 + length, i + length, i);
        }
        // Last transition face
        indices.push(length - 1, 0, length);
        indices.push(length, 2 * length - 1, length - 1);
        this.geometry.setIndex(indices);
    }
}

class Mouse {
    /**
     * The real position of the mouse of the Three.js canvas.
     */
    getPosition(canvas, event) {
        const position = new THREE.Vector2();
        const bounds = canvas.getBoundingClientRect();
        position.x = this.getPositionX(bounds, event);
        position.y = this.getPositionY(bounds, event);
        return position;
    }
    getPositionY(bound, event) {
        return -((event.clientY - bound.top) / (bound.bottom - bound.top)) * 2 + 1;
    }
    getPositionX(bound, event) {
        return ((event.clientX - bound.left) / (bound.right - bound.left)) * 2 - 1;
    }
}

class Points extends THREE.Points {
    get controls() {
        if (!this.controlData) {
            throw new Error("Controls were not initialized.");
        }
        return this.controlData;
    }
    set controls(data) {
        this.cleanUpControls();
        this.controlData = data;
        data.scene.add(this.helper);
        data.helper.attach(this.helper);
        data.helper.addEventListener("change", this.onControlChange);
    }
    constructor(points) {
        super();
        this.tolerance = 0.05;
        this.selected = [];
        this.mouse = new Mouse();
        this.helper = new THREE.Object3D();
        this.previousTransform = new THREE.Matrix4();
        this.tempVector3 = new THREE.Vector3();
        this.tempVector2 = new THREE.Vector2();
        this.onControlChange = () => {
            this.previousTransform.multiply(this.helper.matrix);
            this.transform(this.previousTransform);
            this.previousTransform = this.helper.matrix.clone().invert();
        };
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setFromPoints(points);
        this.resetSelection();
        this.material = new THREE.PointsMaterial({
            depthTest: false,
            size: 10,
            sizeAttenuation: false,
            vertexColors: true,
        });
    }
    toggleControls(active) {
        if (!active) {
            this.controls.helper.removeFromParent();
            this.controls.helper.enabled = false;
        }
        else if (this.selected.length) {
            this.controls.helper.enabled = true;
            // this.controls.helper.position.copy(this.selected[0]);
            this.controls.scene.add(this.controls.helper);
        }
    }
    transform(transform) {
        const position = this.geometry.attributes.position;
        for (let i = 0; i < this.selected.length; i++) {
            const index = this.selected[i];
            this.tempVector3.x = position.getX(index);
            this.tempVector3.y = position.getY(index);
            this.tempVector3.z = position.getZ(index);
            this.tempVector3.applyMatrix4(transform);
            position.setX(index, this.tempVector3.x);
            position.setY(index, this.tempVector3.y);
            position.setZ(index, this.tempVector3.z);
        }
        position.needsUpdate = true;
    }
    resetSelection() {
        this.selected.length = 0;
        const size = this.geometry.attributes.position.count;
        const colorBuffer = new Float32Array(size * 3);
        const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
        this.geometry.setAttribute("color", colorAttribute);
    }
    pick(event) {
        const mouse = this.mouse.getPosition(this.controls.canvas, event);
        const length = this.geometry.attributes.position.array.length;
        for (let i = 0; i < length - 2; i += 3) {
            this.getPositionVector(i);
            const distance = this.tempVector2.distanceTo(mouse);
            if (distance < this.tolerance) {
                this.highlight(i / 3);
            }
        }
    }
    getPositionVector(i) {
        const position = this.geometry.attributes.position;
        this.tempVector3.x = position.array[i];
        this.tempVector3.y = position.array[i + 1];
        this.tempVector3.z = position.array[i + 2];
        this.tempVector3.project(this.controls.camera);
        this.tempVector2.set(this.tempVector3.x, this.tempVector3.y);
    }
    highlight(index) {
        this.selected.push(index);
        const color = this.geometry.attributes.color;
        color.setX(index, 0);
        color.setY(index, 1);
        color.setZ(index, 0);
        color.needsUpdate = true;
    }
    cleanUpControls() {
        if (this.controlData) {
            this.controlData.helper.removeEventListener("change", this.onControlChange);
        }
    }
}

export { Clay, Extrusion, Points, Shell };
