import * as THREE from 'https://unpkg.com/three@0.135.0/build/three.module.js';

class BufferManager {
    /** The current size of the buffers. */
    get size() {
        const firstAttribute = this.attributes[0];
        return firstAttribute.count * 3;
    }
    get attributes() {
        return Object.values(this.geometry.attributes);
    }
    constructor(geometry) {
        this.geometry = geometry;
        /** Buffer increment when geometry size is exceeded, multiple of 3. */
        this.bufferIncrease = 300;
        /**
         * The maximum capacity of the buffers. If exceeded by the {@link size},
         * the buffers will be rescaled.
         */
        this.capacity = 0;
    }
    addAttribute(attribute) {
        this.geometry.setAttribute(attribute.name, attribute);
    }
    resetAttributes() {
        for (const attribute of this.attributes) {
            this.createAttribute(attribute.name);
        }
        this.capacity = 0;
    }
    createAttribute(name) {
        if (this.geometry.hasAttribute(name)) {
            this.geometry.deleteAttribute(name);
        }
        const attribute = new THREE.BufferAttribute(new Float32Array(0), 3);
        attribute.name = name;
        this.geometry.setAttribute(name, attribute);
    }
    updateCount(size) {
        for (const attribute of this.attributes) {
            attribute.count = size;
            attribute.needsUpdate = true;
        }
    }
    resizeIfNeeded(increase) {
        const newSize = this.size + increase * 3;
        const difference = newSize - this.capacity;
        if (difference >= 0) {
            const increase = Math.max(difference, this.bufferIncrease);
            this.capacity += increase;
            for (const attribute of this.attributes) {
                this.resizeBuffers(attribute);
            }
        }
    }
    resizeBuffers(attribute) {
        this.geometry.deleteAttribute(attribute.name);
        const array = new Float32Array(this.capacity);
        const newAttribute = new THREE.BufferAttribute(array, 3);
        newAttribute.name = attribute.name;
        newAttribute.count = attribute.count;
        this.geometry.setAttribute(attribute.name, newAttribute);
        for (let i = 0; i < this.capacity; i++) {
            const x = attribute.getX(i);
            const y = attribute.getY(i);
            const z = attribute.getZ(i);
            newAttribute.setXYZ(i, x, y, z);
        }
    }
}

/**
 * An object to keep track of entities and its position in a geometric buffer.
 */
class IdIndexMap {
    constructor() {
        this._idGenerator = 0;
        this._ids = [];
        this._indices = [];
    }
    /**
     * The number of items stored in this map
     */
    get size() {
        return this._ids.length;
    }
    /**
     * The list of IDs inside this map. IDs are generated as increasing natural
     * numbers starting from zero. The position of the ID in the array is
     * the index of that entity in the geometric buffer.
     * For instance, the ids of a map with 5 items would look like this:
     *
     * - [0, 1, 2, 3, 4]
     *
     * If the item with ID = 1 is deleted, the last item will replace the deleted
     * one to keep the continuity of the geometric buffer, resulting in this:
     *
     * - [0, 4, 2, 3]
     */
    get ids() {
        return this._ids;
    }
    /**
     * The list of indices of the geometric buffer. The position of the index in
     * the array is the ID of that entity. For instance, the ids of a map with 5
     * items would look like this:
     *
     * - [0, 1, 2, 3, 4]
     *
     * If the item with ID = 1 is deleted, the last item will replace the
     * deleted one to keep the continuity of the geometric buffer. The deleted
     * item will remain as null inside the array:
     *
     * - [0, null, 2, 3, 1]
     */
    get indices() {
        return this._indices;
    }
    /**
     * Adds a new item to the map, creating and assigning a new ID and a new index
     * to it. New items are assumed to be created at the end of the geometric
     * buffer.
     */
    add() {
        this._ids.push(this._idGenerator++);
        const index = this._ids.length - 1;
        this._indices.push(index);
        return index;
    }
    /**
     * Removes the specified item from the map and rearrange the indices to
     * keep the continuity of the geometric buffer.
     */
    remove(id) {
        const index = this.getIndex(id);
        if (index === null || index === undefined)
            return;
        const lastID = this._ids.pop();
        if (lastID === undefined) {
            throw new Error(`Error while removing item: ${id}`);
        }
        this._indices[id] = null;
        if (id === lastID)
            return;
        this._ids[index] = lastID;
        this._indices[lastID] = index;
    }
    /**
     * Resets this instance to the initial state.
     */
    reset() {
        this._idGenerator = 0;
        this._ids = [];
        this._indices = [];
    }
    /**
     * Gets the ID for the given index.
     * @param index index of the entity whose ID to find out.
     */
    getId(index) {
        return this._ids[index];
    }
    /**
     * Gets the index for the given ID.
     * @param id ID of the entity whose index to find out.
     */
    getIndex(id) {
        return this._indices[id];
    }
    /**
     * Gets the last index of the geometry buffer.
     */
    getLastIndex() {
        return this.size - 1;
    }
    /**
     * Gets the last ID in the geometry buffer.
     */
    getLastID() {
        return this._ids[this._ids.length - 1];
    }
}

class Selector {
    constructor() {
        this.data = new Set();
    }
    /**
     * Select or unselects the given faces.
     * @param active Whether to select or unselect.
     * @param ids List of faces IDs to select or unselect. If not
     * defined, all faces will be selected or deselected.
     * @param allItems all the existing items.
     */
    select(active, ids, allItems) {
        const all = new Set(allItems);
        const idsToUpdate = [];
        for (const id of ids) {
            const exists = all.has(id);
            if (!exists)
                continue;
            const isAlreadySelected = this.data.has(id);
            if (active) {
                if (isAlreadySelected)
                    continue;
                this.data.add(id);
                idsToUpdate.push(id);
            }
            else {
                if (!isAlreadySelected)
                    continue;
                this.data.delete(id);
                idsToUpdate.push(id);
            }
        }
        return idsToUpdate;
    }
    getUnselected(ids) {
        const notSelectedIDs = [];
        for (const id of ids) {
            if (!this.data.has(id)) {
                notSelectedIDs.push(id);
            }
        }
        return notSelectedIDs;
    }
}

class Vector {
    static getNormal(points) {
        const a = Vector.substract(points[0], points[1]);
        const b = Vector.substract(points[1], points[2]);
        const [x, y, z] = this.multiply(a, b);
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        return [x / magnitude, y / magnitude, z / magnitude];
    }
    static multiply(v1, v2) {
        const x = v1[1] * v2[2] - v1[2] * v2[1];
        const y = v1[2] * v2[0] - v1[0] * v2[2];
        const z = v1[0] * v2[1] - v1[1] * v2[0];
        return [x, y, z];
    }
    static normalize(vector) {
        const [x, y, z] = vector;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        return [x / magnitude, y / magnitude, z / magnitude];
    }
    static add(...vectors) {
        const result = [0, 0, 0];
        for (const vector of vectors) {
            result[0] += vector[0];
            result[1] += vector[1];
            result[2] += vector[2];
        }
        return result;
    }
    static substract(v1, v2) {
        const [x1, y1, z1] = v1;
        const [x2, y2, z2] = v2;
        return [x2 - x1, y2 - y1, z2 - z1];
    }
    static multiplyScalar(vector, scalar) {
        return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
    }
}

class Primitive {
    constructor() {
        /**
         * All the selected items within this primitive.
         */
        this.selected = new Selector();
        this._baseColor = new THREE.Color(0.5, 0.5, 0.5);
        this._selectColor = new THREE.Color(1, 0, 0);
        this.list = {};
    }
    /**
     * The color of all the points.
     */
    get baseColor() {
        return this._baseColor;
    }
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        this._baseColor.copy(color);
    }
    /**
     * The color of all the selected points.
     */
    get selectColor() {
        return this._selectColor;
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        this._selectColor.copy(color);
    }
    get _positionBuffer() {
        return this.mesh.geometry.attributes.position;
    }
    get _colorBuffer() {
        return this.mesh.geometry.attributes.color;
    }
    get _normalBuffer() {
        return this.mesh.geometry.attributes.normal;
    }
    get _attributes() {
        return Object.values(this.mesh.geometry.attributes);
    }
    get _ids() {
        const ids = [];
        for (const id in this.list) {
            ids.push(this.list[id].id);
        }
        return ids;
    }
}

class Vertices extends Primitive {
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        super.baseColor = color;
        const allIDs = this.idMap.ids;
        const unselected = this.selected.getUnselected(allIDs);
        this.updateColor(unselected);
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        super.selectColor = color;
        this.updateColor(this.selected.data);
    }
    /**
     * Creates a new instance of vertices
     * @param size Visualization point size
     */
    constructor(size = 0.1) {
        super();
        /** The map between each vertex ID and its index. */
        this.idMap = new IdIndexMap();
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({
            size,
            vertexColors: true,
        });
        this.mesh = new THREE.Points(geometry, material);
        this.mesh.frustumCulled = false;
        this._buffers = new BufferManager(geometry);
        this._buffers.createAttribute("position");
        this._buffers.createAttribute("color");
    }
    /**
     * Gets the coordinates of the vertex with the given ID.
     * @param id the id of the point to retrieve.
     */
    get(id) {
        const index = this.idMap.getIndex(id);
        if (index === null)
            return null;
        return [
            this._positionBuffer.getX(index),
            this._positionBuffer.getY(index),
            this._positionBuffer.getZ(index),
        ];
    }
    /**
     * Add new points
     * @param coordinates Points to add.
     * @returns the list of ids of the created vertices.
     */
    add(coordinates) {
        this._buffers.resizeIfNeeded(coordinates.length);
        const ids = [];
        const { r, g, b } = this._baseColor;
        for (let i = 0; i < coordinates.length; i++) {
            const index = this.idMap.add();
            const id = this.idMap.getId(index);
            ids.push(id);
            const [x, y, z] = coordinates[i];
            this._positionBuffer.setXYZ(index, x, y, z);
            this._colorBuffer.setXYZ(index, r, g, b);
        }
        this._buffers.updateCount(this.idMap.size);
        return ids;
    }
    /**
     * Select or unselects the given vertices.
     * @param active Whether to select or unselect.
     * @param ids List of vertices IDs to select or deselect. If not
     * defined, all vertices will be selected or deselected.
     */
    select(active, ids = this.idMap.ids) {
        const idsToUpdate = this.selected.select(active, ids, this.idMap.ids);
        this.updateColor(idsToUpdate);
    }
    /**
     * Applies a transformation to the selected vertices.
     * @param transformation Transformation matrix to apply.
     * @param ids IDs of the vertices to transform.
     */
    transform(transformation, ids = this.selected.data) {
        const vector = new THREE.Vector3();
        for (const id of ids) {
            const index = this.idMap.getIndex(id);
            if (index === null)
                continue;
            const x = this._positionBuffer.getX(index);
            const y = this._positionBuffer.getY(index);
            const z = this._positionBuffer.getZ(index);
            vector.set(x, y, z);
            vector.applyMatrix4(transformation);
            this._positionBuffer.setXYZ(index, vector.x, vector.y, vector.z);
        }
        this._positionBuffer.needsUpdate = true;
    }
    /**
     * Quickly removes all the points and releases all the memory used.
     */
    clear() {
        this._buffers.resetAttributes();
        this.selected.data.clear();
        this.idMap.reset();
    }
    /**
     * Removes the selected points from the list
     */
    remove(ids = this.selected.data) {
        for (const id of ids) {
            for (const attribute of this._attributes) {
                this.removeFromBuffer(id, attribute);
            }
            this.idMap.remove(id);
        }
        this.select(false, ids);
        this._buffers.updateCount(this.idMap.size);
    }
    addAttribute(attribute) {
        this._buffers.addAttribute(attribute);
    }
    removeFromBuffer(id, buffer) {
        const lastIndex = this.idMap.getLastIndex();
        const index = this.idMap.getIndex(id);
        if (index !== null) {
            buffer.setXYZ(index, buffer.getX(lastIndex), buffer.getY(lastIndex), buffer.getZ(lastIndex));
        }
    }
    updateColor(ids = this.idMap.ids) {
        const colorBuffer = this._colorBuffer;
        for (const id of ids) {
            const isSelected = this.selected.data.has(id);
            const index = this.idMap.getIndex(id);
            if (index === null)
                continue;
            const color = isSelected ? this._selectColor : this._baseColor;
            colorBuffer.setXYZ(index, color.r, color.g, color.b);
        }
        colorBuffer.needsUpdate = true;
    }
}

class Lines extends Primitive {
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        super.baseColor = color;
        const allIDs = this.idMap.ids;
        const unselected = this.selected.getUnselected(allIDs);
        this.updateColor(unselected);
        this.vertices.baseColor = color;
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        super.selectColor = color;
        this.updateColor(this.selected.data);
        this.vertices.selectColor = color;
    }
    constructor() {
        super();
        /** {@link Primitive.mesh } */
        this.mesh = new THREE.LineSegments();
        /**
         * The list of segments.
         */
        this.list = {};
        /**
         * The geometric representation of the vertices that define this instance of lines.
         */
        this.vertices = new Vertices();
        /**
         * The map that keeps track of the segments ID and their position in the geometric buffer.
         */
        this.idMap = new IdIndexMap();
        /**
         * The list of points that define each line.
         */
        this.points = {};
        const material = new THREE.LineBasicMaterial({ vertexColors: true });
        const geometry = new THREE.BufferGeometry();
        this.mesh = new THREE.LineSegments(geometry, material);
        this._buffers = new BufferManager(geometry);
        this._buffers.createAttribute("position");
        this._buffers.createAttribute("color");
    }
    /**
     * Adds a segment between two {@link points}.
     * @param ids - the IDs of the {@link points} that define the segments.
     */
    add(ids) {
        const createdIDs = [];
        const newVerticesCount = (ids.length - 1) * 2;
        this._buffers.resizeIfNeeded(newVerticesCount);
        const { r, g, b } = this._baseColor;
        for (let i = 0; i < ids.length - 1; i++) {
            const startID = ids[i];
            const endID = ids[i + 1];
            const start = this.vertices.get(startID);
            const end = this.vertices.get(endID);
            if (start === null || end === null)
                continue;
            const index = this.idMap.add();
            const id = this.idMap.getId(index);
            createdIDs.push(id);
            const startPoint = this.points[startID];
            const endPoint = this.points[endID];
            startPoint.start.add(id);
            endPoint.end.add(id);
            this._positionBuffer.setXYZ(index * 2, start[0], start[1], start[2]);
            this._positionBuffer.setXYZ(index * 2 + 1, end[0], end[1], end[2]);
            this._colorBuffer.setXYZ(index * 2, r, g, b);
            this._colorBuffer.setXYZ(index * 2 + 1, r, g, b);
            this.list[id] = { id, start: startID, end: endID };
        }
        const allVerticesCount = this.idMap.size * 2;
        this._buffers.updateCount(allVerticesCount);
        return createdIDs;
    }
    get(id) {
        const index = this.idMap.getIndex(id);
        if (index === null)
            return null;
        const line = this.list[index];
        return [this.vertices.get(line.start), this.vertices.get(line.end)];
    }
    /**
     * Adds the points that can be used by one or many lines.
     * @param points the list of (x, y, z) coordinates of the points.
     */
    addPoints(points) {
        const ids = this.vertices.add(points);
        for (const id of ids) {
            this.points[id] = { start: new Set(), end: new Set() };
        }
    }
    /**
     * Select or unselects the given lines.
     * @param active Whether to select or unselect.
     * @param ids List of faces IDs to select or unselect. If not
     * defined, all lines will be selected or deselected.
     */
    select(active, ids = this._ids) {
        const allLines = this.idMap.ids;
        const lineIDs = ids || allLines;
        const idsToUpdate = this.selected.select(active, lineIDs, allLines);
        this.updateColor(idsToUpdate);
        const points = [];
        for (const id of idsToUpdate) {
            const line = this.list[id];
            points.push(line.start);
            points.push(line.end);
        }
        this.selectPoints(active, points);
    }
    selectPoints(active, ids) {
        this.vertices.select(active, ids);
    }
    /**
     * Removes the specified lines.
     * @param ids List of lines to remove. If no line is specified,
     * removes all the selected lines.
     */
    remove(ids = this.selected.data) {
        const position = this._positionBuffer;
        const color = this._colorBuffer;
        const points = [];
        for (const id of ids) {
            const line = this.list[id];
            if (line === undefined)
                continue;
            this.removeFromBuffer(id, position);
            this.removeFromBuffer(id, color);
            this.idMap.remove(id);
            const startPoint = this.points[line.start];
            points.push(line.start, line.end);
            startPoint.start.delete(id);
            const endPoint = this.points[line.end];
            endPoint.end.delete(id);
            delete this.list[id];
            this.selected.data.delete(id);
        }
        position.needsUpdate = true;
        color.needsUpdate = true;
        this.selectPoints(false, points);
    }
    /**
     * Removes the specified points and all lines that use them.
     * @param ids List of points to remove. If no point is specified,
     * removes all the selected points.
     */
    removePoints(ids = this.vertices.selected.data) {
        const lines = new Set();
        for (const id of ids) {
            const point = this.points[id];
            if (!point)
                continue;
            for (const id of point.start) {
                lines.add(id);
            }
            for (const id of point.end) {
                lines.add(id);
            }
        }
        this.vertices.remove(ids);
        this.remove(lines);
    }
    transform(matrix) {
        const indices = new Set();
        const points = new Set();
        for (const id of this.vertices.selected.data) {
            points.add(id);
            const point = this.points[id];
            for (const id of point.start) {
                const index = this.idMap.getIndex(id);
                if (index === null)
                    continue;
                indices.add(index * 2);
            }
            for (const id of point.end) {
                const index = this.idMap.getIndex(id);
                if (index === null)
                    continue;
                indices.add(index * 2 + 1);
            }
        }
        this.transformLines(matrix, indices);
        this.vertices.transform(matrix, points);
    }
    removeFromBuffer(id, buffer) {
        const index = this.idMap.getIndex(id);
        if (index === null)
            return;
        const lastIndex = this.idMap.getLastIndex();
        const indices = [index * 2, index * 2 + 1];
        const lastIndices = [lastIndex * 2, lastIndex * 2 + 1];
        for (let i = 0; i < 2; i++) {
            const x = buffer.getX(lastIndices[i]);
            const y = buffer.getY(lastIndices[i]);
            const z = buffer.getZ(lastIndices[i]);
            buffer.setXYZ(indices[i], x, y, z);
        }
        buffer.count -= 2;
    }
    transformLines(matrix, indices) {
        const vector = new THREE.Vector3();
        for (const index of indices) {
            const x = this._positionBuffer.getX(index);
            const y = this._positionBuffer.getY(index);
            const z = this._positionBuffer.getZ(index);
            vector.set(x, y, z);
            vector.applyMatrix4(matrix);
            this._positionBuffer.setXYZ(index, vector.x, vector.y, vector.z);
        }
        this._positionBuffer.needsUpdate = true;
    }
    updateColor(ids = this._ids) {
        const colorAttribute = this._colorBuffer;
        for (const id of ids) {
            const line = this.list[id];
            const isSelected = this.selected.data.has(line.id);
            const { r, g, b } = isSelected ? this._selectColor : this._baseColor;
            const index = this.idMap.getIndex(id);
            if (index === null)
                continue;
            colorAttribute.setXYZ(index * 2, r, g, b);
            colorAttribute.setXYZ(index * 2 + 1, r, g, b);
        }
        colorAttribute.needsUpdate = true;
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

class Faces extends Primitive {
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        super.baseColor = color;
        const unselected = this.selected.getUnselected(this._ids);
        this.updateColor(unselected);
        this.vertices.baseColor = color;
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        super.selectColor = color;
        this.updateColor(this.selected.data);
        this.vertices.selectColor = color;
    }
    get _index() {
        if (!this.mesh.geometry.index) {
            throw new Error("Geometery must be indexed!");
        }
        return this.mesh.geometry.index;
    }
    constructor() {
        super();
        /** {@link Primitive.mesh } */
        this.mesh = new THREE.Mesh();
        /**
         * The list of outer points that define the faces. Each point corresponds to a set of {@link Vertices}. This way,
         * we can provide an API of faces that share vertices, but under the hood the vertices are duplicated per face
         * (and thus being able to contain the normals as a vertex attribute).
         */
        this.points = {};
        /**
         * The list of faces. Each face is defined by a list of outer points.
         * TODO: Implement inner points.
         */
        this.list = {};
        /**
         * The geometric representation of the vertices that define this instance of faces.
         */
        this.vertices = new Vertices();
        this.selectedPoints = new Selector();
        this._faceIdGenerator = 0;
        this._pointIdGenerator = 0;
        this._nextIndex = 0;
        this.updateBuffers();
        const material = new THREE.MeshLambertMaterial({
            side: THREE.DoubleSide,
            vertexColors: true,
        });
        const geometry = new THREE.BufferGeometry();
        this.mesh = new THREE.Mesh(geometry, material);
        geometry.setIndex([]);
        const normals = new THREE.BufferAttribute(new Float32Array(0), 3);
        normals.name = "normal";
        this.vertices.addAttribute(normals);
    }
    /**
     * Quickly removes all the faces and releases all the memory used.
     */
    clear() {
        this.vertices.clear();
        this.updateBuffers();
    }
    /**
     * Adds a face.
     * @param ids - the IDs of the {@link points} that define that face. It's assumed that they are coplanar.
     */
    add(ids) {
        const id = this._faceIdGenerator++;
        for (const pointID of ids) {
            const point = this.points[pointID];
            point.faces.add(id);
        }
        const face = {
            id,
            vertices: new Set(),
            points: new Set(ids),
            start: 0,
            end: 0,
        };
        const coordinates = [];
        for (const pointID of face.points) {
            const point = this.points[pointID];
            coordinates.push(...point.coordinates);
            const [id] = this.vertices.add([point.coordinates]);
            point.vertices.add(id);
            face.vertices.add(id);
        }
        const allIndices = Array.from(this._index.array);
        face.start = allIndices.length;
        const faceIndices = this.triangulate(coordinates);
        const offset = this._nextIndex;
        for (const faceIndex of faceIndices) {
            const absoluteIndex = faceIndex + offset;
            if (absoluteIndex >= this._nextIndex) {
                this._nextIndex = absoluteIndex + 1;
            }
            allIndices.push(absoluteIndex);
        }
        face.end = allIndices.length;
        this.mesh.geometry.setIndex(allIndices);
        this.list[id] = face;
        this.updateBuffers();
        this.updateColor([id]);
        this.computeNormal([id]);
        return id;
    }
    /**
     * Removes faces.
     * @param ids List of faces to remove. If no face is specified,
     * removes all the selected faces.
     */
    remove(ids = this.selected.data) {
        const verticesToRemove = new Set();
        for (const id of ids) {
            const face = this.list[id];
            for (const vertex of face.vertices) {
                verticesToRemove.add(vertex);
            }
            for (const pointID of face.points) {
                const point = this.points[pointID];
                if (point) {
                    point.faces.delete(id);
                }
            }
            delete this.list[id];
        }
        for (const id of ids) {
            this.selected.data.delete(id);
        }
        const idsArray = [];
        const oldIndex = this._index.array;
        for (const index of oldIndex) {
            const id = this.vertices.idMap.getId(index);
            idsArray.push(id);
        }
        this.vertices.remove(verticesToRemove);
        const newIndex = [];
        for (const id of idsArray) {
            const index = this.vertices.idMap.getIndex(id);
            if (index !== null) {
                newIndex.push(index);
            }
        }
        this.mesh.geometry.setIndex(newIndex);
        this.updateBuffers();
        this.updateColor();
    }
    removePoints(ids = this.selectedPoints.data) {
        const facesToRemove = new Set();
        for (const id of ids) {
            const point = this.points[id];
            if (!point)
                continue;
            for (const face of point.faces) {
                facesToRemove.add(face);
            }
            delete this.points[id];
        }
        for (const id of ids) {
            this.selectedPoints.data.delete(id);
        }
        this.remove(facesToRemove);
    }
    /**
     * Select or unselects the given faces.
     * @param active Whether to select or unselect.
     * @param ids List of faces IDs to select or unselect. If not
     * defined, all faces will be selected or deselected.
     */
    select(active, ids = this._ids) {
        const idsToUpdate = this.selected.select(active, ids, this._ids);
        this.updateColor(idsToUpdate);
        const points = [];
        for (const id of ids) {
            const face = this.list[id];
            if (face) {
                points.push(...face.points);
            }
        }
        this.selectPoints(active, points);
    }
    /**
     * Adds the points that can be used by one or many faces
     */
    addPoints(points) {
        const newPoints = [];
        for (const [x, y, z] of points) {
            const id = this._pointIdGenerator++;
            this.points[id] = {
                id,
                coordinates: [x, y, z],
                vertices: new Set(),
                faces: new Set(),
            };
            newPoints.push(id);
        }
        return newPoints;
    }
    /**
     * Selects or unselects the given points.
     * @param active When true we will select, when false we will unselect
     * @param ids List of point IDs to add to the selected set. If not
     * defined, all points will be selected or deselected.
     */
    selectPoints(active, ids) {
        const allPoints = Object.values(this.points).map((p) => p.id);
        const pointsIDs = ids || allPoints;
        this.selectedPoints.select(active, pointsIDs, allPoints);
        const vertices = [];
        for (const id of pointsIDs) {
            const point = this.points[id];
            if (point === undefined)
                continue;
            for (const id of point.vertices) {
                vertices.push(id);
            }
        }
        this.vertices.select(active, vertices);
    }
    transform(matrix) {
        const vertices = new Set();
        for (const id of this.selectedPoints.data) {
            const point = this.points[id];
            for (const vertex of point.vertices) {
                vertices.add(vertex);
            }
        }
        this.vertices.transform(matrix, vertices);
        for (const pointID of this.selectedPoints.data) {
            const point = this.points[pointID];
            const vertexID = point.vertices.values().next().value;
            const coords = this.vertices.get(vertexID);
            if (coords === null)
                continue;
            point.coordinates = coords;
        }
    }
    updateBuffers() {
        const positionBuffer = this.vertices.mesh.geometry.attributes.position;
        const normalBuffer = this.vertices.mesh.geometry.attributes.normal;
        if (this._positionBuffer !== positionBuffer) {
            this.mesh.geometry.deleteAttribute("position");
            this.mesh.geometry.deleteAttribute("normal");
            this.mesh.geometry.deleteAttribute("color");
            this.mesh.geometry.setAttribute("position", positionBuffer);
            this.mesh.geometry.setAttribute("normal", normalBuffer);
            const colorBuffer = new Float32Array(positionBuffer.array.length * 3);
            const colorAttribute = new THREE.BufferAttribute(colorBuffer, 3);
            this.mesh.geometry.setAttribute("color", colorAttribute);
            this.updateColor();
        }
        this._colorBuffer.count = positionBuffer.count;
    }
    computeNormal(ids = this._ids) {
        const normalAttribute = this._normalBuffer;
        for (const id of ids) {
            const face = this.list[id];
            if (!face)
                continue;
            const coordinates = [];
            let counter = 0;
            for (const vertexID of face.vertices) {
                if (counter++ > 2)
                    break;
                const vertex = this.vertices.get(vertexID);
                if (vertex !== null) {
                    coordinates.push(vertex);
                }
            }
            const [x, y, z] = Vector.getNormal(coordinates);
            for (const vertexID of face.vertices) {
                const index = this.vertices.idMap.getIndex(vertexID);
                if (index === null)
                    continue;
                normalAttribute.setXYZ(index, x, y, z);
            }
        }
    }
    updateColor(ids = this._ids) {
        const colorAttribute = this._colorBuffer;
        for (const id of ids) {
            const face = this.list[id];
            const isSelected = this.selected.data.has(face.id);
            const { r, g, b } = isSelected ? this._selectColor : this._baseColor;
            for (const vertexID of face.vertices) {
                const index = this.vertices.idMap.getIndex(vertexID);
                if (index === null)
                    continue;
                colorAttribute.setXYZ(index, r, g, b);
            }
        }
        colorAttribute.needsUpdate = true;
    }
    triangulate(coordinates) {
        // Earcut only supports 2d triangulations, so let's project the face
        // into the cartesian plane that is more parallel to the face
        const dim = this.getProjectionDimension(coordinates);
        const projectedCoords = [];
        for (let i = 0; i < coordinates.length; i++) {
            if (i % 3 !== dim) {
                projectedCoords.push(coordinates[i]);
            }
        }
        return earcut$1.exports(projectedCoords, [], 2);
    }
    getProjectionDimension(coordinates) {
        const [x1, y1, z1] = this.getCoordinate(0, coordinates);
        const [x2, y2, z2] = this.getCoordinate(1, coordinates);
        const [x3, y3, z3] = this.getCoordinate(2, coordinates);
        const a = [x2 - x1, y2 - y1, z2 - z1];
        const b = [x3 - x2, y3 - y2, z3 - z2];
        const crossProd = [
            Math.abs(a[1] * b[2] - a[2] * b[1]),
            Math.abs(a[2] * b[0] - a[0] * b[2]),
            Math.abs(a[0] * b[1] - a[1] * b[0]),
        ];
        const max = Math.max(...crossProd);
        return crossProd.indexOf(max);
    }
    getCoordinate(index, coordinates) {
        const x = coordinates[index * 3];
        const y = coordinates[index * 3 + 1];
        const z = coordinates[index * 3 + 2];
        return [x, y, z];
    }
}

// import { Vector3 } from "three";
class OffsetFaces extends Primitive {
    constructor() {
        super();
        this.faces = new Faces();
        this.lines = new Lines();
        /**
         * The list of axis.
         */
        this.axes = {};
        this.mesh = this.faces.mesh;
    }
    addPoints(points) {
        this.lines.addPoints(points);
    }
    addAxes(ids, width, offset = 0) {
        if (offset > width / 2) {
            throw new Error("The axis must be contained within the face generated!");
        }
        const linesIDs = this.lines.add(ids);
        for (const id of linesIDs) {
            this.axes[id] = {
                width,
                offset,
            };
        }
    }
    regenerate() {
        this.faces.clear();
        // A line that goes from A to B will define an offsetface like this:
        //     p1                             p2
        //     +------------------------------+
        //    |  A +-------------------+ B   |
        //   +------------------------------+
        //   p4                            p3
        // The next array means: [pointIndex, x, z]
        const offsetFaces = {};
        // Strategy: traverse all points, sort lines by angle and find the intersection
        // of each line with the next one
        for (const pointID in this.lines.points) {
            const id = parseInt(pointID, 10);
            const point = this.lines.points[id];
            const coords = this.lines.vertices.get(id);
            if (coords === null)
                continue;
            let vectors = [];
            this.getAllNormalizedVectors(vectors, point.start, false);
            this.getAllNormalizedVectors(vectors, point.end, true);
            vectors = this.order2DVectorsCounterClockwise(vectors);
            const upVector = [0, 1, 0];
            for (let i = 0; i < vectors.length; i++) {
                const currentLine = vectors[i];
                const currentVector = currentLine.vector;
                const isCurrentStart = point.start.has(currentLine.lineID);
                const { width } = this.axes[currentLine.lineID];
                if (!offsetFaces[currentLine.lineID]) {
                    offsetFaces[currentLine.lineID] = {};
                }
                const onlyOneLineInPoint = vectors.length === 1;
                if (onlyOneLineInPoint) {
                    const normal = Vector.multiply(upVector, currentVector);
                    const v1 = Vector.multiplyScalar(normal, width);
                    const v2 = Vector.multiplyScalar(normal, -width);
                    const p1 = Vector.add(coords, v1);
                    const p2 = Vector.add(coords, v2);
                    const index1 = isCurrentStart ? 1 : 3;
                    const index2 = isCurrentStart ? 4 : 2;
                    offsetFaces[currentLine.lineID][index1] = [p1[0], p1[2]];
                    offsetFaces[currentLine.lineID][index2] = [p2[0], p2[2]];
                    break;
                }
                const isLastVector = i === vectors.length - 1;
                const j = isLastVector ? 0 : i + 1;
                const nextLine = vectors[j];
                const nextVector = nextLine.vector;
                const nextWidth = this.axes[nextLine.lineID].width;
                // Express the outlines as a point and a direction
                // Beware the left-handed system for the direction
                const n1 = Vector.multiply(upVector, currentVector);
                const v1 = Vector.multiplyScalar(n1, width);
                const p1 = Vector.add(coords, v1);
                const n2 = Vector.multiply(nextVector, upVector);
                const v2 = Vector.multiplyScalar(n2, nextWidth);
                const p2 = Vector.add(coords, v2);
                // Convert point-direction to implicit 2D line ax + by = d
                // Beware that "y" is "z" in our 2D system
                // p . n = d
                const a1 = n1[0];
                const b1 = n1[2];
                const d1 = p1[0] * n1[0] + p1[2] * n1[2];
                const a2 = n2[0];
                const b2 = n2[2];
                const d2 = p2[0] * n2[0] + p2[2] * n2[2];
                // Find the intersection of the two lines
                const x = (b2 * d1 - b1 * d2) / (a1 * b2 - a2 * b1);
                const y = (a1 * d2 - a2 * d1) / (a1 * b2 - a2 * b1);
                // Save the intersection points in both lines
                if (!offsetFaces[nextLine.lineID]) {
                    offsetFaces[nextLine.lineID] = {};
                }
                const isNextStart = point.start.has(nextLine.lineID);
                const currentIndex = isCurrentStart ? 1 : 3;
                const nextIndex = isNextStart ? 4 : 2;
                offsetFaces[currentLine.lineID][currentIndex] = [x, y];
                offsetFaces[nextLine.lineID][nextIndex] = [x, y];
            }
        }
        console.log(offsetFaces);
        for (const lineID in offsetFaces) {
            const offsetFace = offsetFaces[lineID];
            const points = [];
            for (let i = 1; i < 5; i++) {
                const [x, z] = offsetFace[i];
                points.push([x, 0, z]);
            }
            const ids = this.faces.addPoints(points);
            this.faces.add(ids);
        }
    }
    order2DVectorsCounterClockwise(vectors) {
        const vectorsWithAngles = [];
        for (const line of vectors) {
            const { vector } = line;
            let angle = Math.atan2(vector[0], vector[2]);
            if (angle < 0)
                angle += 2 * Math.PI;
            console.log((angle * 180) / Math.PI);
            vectorsWithAngles.push({ angle, line });
        }
        vectorsWithAngles.sort((v1, v2) => (v1.angle > v2.angle ? 1 : -1));
        return vectorsWithAngles.map((item) => item.line);
    }
    getAllNormalizedVectors(vectors, ids, flip) {
        for (const lineID of ids) {
            const line = this.lines.list[lineID];
            const start = this.lines.vertices.get(line.start);
            const end = this.lines.vertices.get(line.end);
            if (start === null || end === null) {
                throw new Error(`Error with line ${lineID}`);
            }
            let vector = Vector.substract(start, end);
            if (flip) {
                vector = Vector.multiplyScalar(vector, -1);
            }
            vector = Vector.normalize(vector);
            vectors.push({ lineID, vector });
        }
    }
}

class Extrusions extends Primitive {
    constructor() {
        super();
        /** {@link Primitive.mesh } */
        this.mesh = new THREE.Mesh();
        /**
         * The list of outer points that define the faces. Each point corresponds to a set of {@link Vertices}. This way,
         * we can provide an API of faces that share vertices, but under the hood the vertices are duplicated per face
         * (and thus being able to contain the normals as a vertex attribute).
         */
        this.list = {};
        /**
         * The geometric representation of the vertices that define this instance of faces.
         */
        this.faces = new Faces();
        /**
         * The geometric representation of the vertices that define this instance of lines.
         */
        this.lines = new Lines();
        this.selectedExtrusions = new Selector();
        this._nextIndex = 0;
        const material = new THREE.MeshLambertMaterial({
            side: THREE.DoubleSide,
            vertexColors: true,
        });
        const geometry = new THREE.BufferGeometry();
        this.mesh = new THREE.Mesh(geometry, material);
        geometry.setIndex([]);
    }
    clear() {
        this.faces = new Faces();
        this.lines = new Lines();
        this.list = {};
    }
    add(faceId, linesIds) {
        const id = this._nextIndex;
        const extrude = {
            id,
            base: faceId,
            paths: linesIds,
            faces: new Set(),
            needsUpdate: true,
            parentExtrusion: -1,
            childrenExtrusionFaces: new Set(),
        };
        this._nextIndex++;
        this.list[id] = extrude;
        this.updateExtrusions();
    }
    /**
     * Update the extrusions by creating multiple consecutive extrusions based on the given list of extrusion objects.
     * Each extrusion object contains a base surface and a set of curve-paths.
     */
    updateExtrusions() {
        for (const id in this.list) {
            if (this.list[id].needsUpdate) {
                this.list[id].needsUpdate = false;
                const pathIds = this.list[id].paths; // get the array of path IDs
                const baseId = this.list[id].base;
                // this.faces.remove(this.list[id].faces);
                const newFaces = this.updateFaces(pathIds, baseId);
                if (newFaces) {
                    this.list[id].faces = newFaces;
                }
            }
        }
    }
    updateFaces(pathIds, baseId) {
        const newFaces = new Set();
        let lastVector = new THREE.Vector3();
        for (let i = 0; i < pathIds.length; i++) {
            const newPoints = []; // create an array to hold the new points of the extruded surface
            const pathId = pathIds[i];
            const linePoints = this.lines.get(pathId);
            if (linePoints === null ||
                linePoints[0] === null ||
                linePoints[1] === null) {
                return null;
            }
            const vector = new THREE.Vector3(linePoints[1][0] - linePoints[0][0], linePoints[1][1] - linePoints[0][1], linePoints[1][2] - linePoints[0][2]);
            const newBasePoints = [];
            this.createPoints(this.faces.list[baseId].points, newPoints, newBasePoints, vector, lastVector, i);
            lastVector = new THREE.Vector3(lastVector.x + vector.x, lastVector.y + vector.y, lastVector.z + vector.z);
            for (let i = 0; i < this.faces.list[baseId].points.size; i++) {
                const p1 = newBasePoints[i];
                const p2 = newBasePoints[(i + 1) % this.faces.list[baseId].points.size];
                const p3 = newPoints[(i + 1) % this.faces.list[baseId].points.size];
                const p4 = newPoints[i];
                newFaces.add(this.faces.add([p1, p2, p3, p4]));
            }
            newFaces.add(this.faces.add(newPoints));
        }
        return newFaces;
    }
    createPoints(points, newPoints, newBasePoints, vector, lastVector, index) {
        for (const pointID of points) {
            const point = this.faces.points[pointID].coordinates;
            let newBPoint = new THREE.Vector3(point[0], point[1], point[2]);
            if (index === 0) {
                const iter = points.values();
                for (let i = 0; i < points.size; i++) {
                    newBasePoints.push(iter.next().value);
                }
            }
            else {
                newBPoint = new THREE.Vector3(point[0] + lastVector.x, point[1] + lastVector.y, point[2] + lastVector.z);
                newBasePoints.push(this.faces.addPoints([[newBPoint.x, newBPoint.y, newBPoint.z]])[0]);
            }
            if (point === null) {
                return null;
            }
            const newPoint = new THREE.Vector3(newBPoint.x + vector.x, newBPoint.y + vector.y, newBPoint.z + vector.z);
            newPoints.push(this.faces.addPoints([[newPoint.x, newPoint.y, newPoint.z]])[0]);
        }
    }
}

export { BufferManager, Extrusions, Faces, IdIndexMap, Lines, OffsetFaces, Selector, Vector, Vertices };
