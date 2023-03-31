import * as THREE from 'https://unpkg.com/three@0.135.0/build/three.module.js';

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
        const lastID = this._ids.pop();
        if (index === null || index === undefined || lastID === undefined)
            return;
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
     * Gets the last ID of the geometry buffer.
     */
    getLastIndex() {
        return this.size - 1;
    }
}

class Vertices {
    /**
     * Number of points
     * @returns Number corresponding to the length
     */
    get length() {
        return this._positionBuffer.count;
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
        this.updateColor(false);
    }
    /**
     * The color of all the selected points.
     */
    get selectColor() {
        return this._baseColor;
    }
    /**
     * The color of all the selected points.
     */
    set selectColor(color) {
        this._selectColor.copy(color);
        this.updateColor(true);
    }
    get _positionBuffer() {
        return this._geometry.attributes.position;
    }
    get _colorBuffer() {
        return this._geometry.attributes.color;
    }
    get _geometry() {
        return this.points.geometry;
    }
    /**
     * Creates a new instance of vertices
     * @param size Visualization point size
     */
    constructor(size = 0.1) {
        /** Buffer increment when geometry size is exceeded, multiple of 3. */
        this.bufferIncrease = 300;
        this._baseColor = new THREE.Color(0.5, 0.5, 0.5);
        this._selectColor = new THREE.Color(1, 0, 0);
        this._capacity = 0;
        this._selected = new Set();
        this._items = new IdIndexMap();
        const geometry = new THREE.BufferGeometry();
        const material = this.newPointsMaterial(size);
        this.points = new THREE.Points(geometry, material);
        this.points.frustumCulled = false;
        this.resetAttributes();
    }
    /**
     * Gets the coordinates of the vertex with the given ID.
     * @param id the id of the point to retrieve.
     */
    get(id) {
        const index = this._items.getIndex(id);
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
     * @param coordinates Points to add
     */
    add(coordinates) {
        this.resizeBufferIfNecessary(coordinates.length);
        for (let i = 0; i < coordinates.length; i++) {
            const index = this._items.add();
            const { x, y, z } = coordinates[i];
            this._positionBuffer.setXYZ(index, x, y, z);
            const { r, g, b } = this._baseColor;
            this._colorBuffer.setXYZ(index, r, g, b);
        }
        this.updateBuffersCount();
    }
    /**
     * Creates a set of selected points
     * @param active When true we will select, when false we will unselect
     * @param ids List of point IDs to add to the selected set. If not
     * defined, all items will be selected or deselected.
     */
    select(active, ids) {
        if (active) {
            this.selectPoints(ids);
        }
        else {
            this.unselectPoints(ids);
        }
        this._colorBuffer.needsUpdate = true;
    }
    /**
     * Apply a displacement vector to the selected points
     * @param displacement Displacement vector
     */
    move(displacement) {
        const transform = new THREE.Matrix4();
        transform.setPosition(displacement);
        this.transform(transform);
    }
    /**
     * Rotate the selected points
     * @param rotation euler rotation
     */
    rotate(rotation) {
        const transform = new THREE.Matrix4();
        const { x, y, z } = rotation;
        transform.makeRotationFromEuler(new THREE.Euler(x, y, z));
        this.transform(transform);
    }
    /**
     * Scale the selected points
     * @param scale Scale vector
     */
    scale(scale) {
        const transform = new THREE.Matrix4();
        transform.scale(scale);
        this.transform(transform);
    }
    /**
     * Applies a transformation to the selected vertices.
     * @param transformation Transformation matrix to apply.
     */
    transform(transformation) {
        const vector = new THREE.Vector3();
        for (const id of this._selected) {
            const index = this._items.getIndex(id);
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
        this.resetAttributes();
        this._selected.clear();
        this._items.reset();
    }
    /**
     * Removes the selected points from the list
     */
    remove() {
        const selected = this._selected.values();
        for (const id of selected) {
            const index = this._items.getIndex(id);
            if (index === null)
                continue;
            const lastIndex = this._items.getLastIndex();
            this.removeFromPositionBuffer(index, lastIndex);
            this.removeFromColorBuffer(index, lastIndex);
            this._items.remove(id);
        }
        this.updateBuffersCount();
        this._positionBuffer.needsUpdate = true;
        this._colorBuffer.needsUpdate = true;
    }
    selectPoints(ids) {
        const selection = ids || this._items.ids;
        for (const id of selection) {
            const index = this._items.getIndex(id);
            if (index === null)
                continue;
            this._selected.add(id);
            this._colorBuffer.setX(index, this._selectColor.r);
            this._colorBuffer.setY(index, this._selectColor.g);
            this._colorBuffer.setZ(index, this._selectColor.b);
        }
    }
    unselectPoints(ids) {
        this.removeSelectColor(ids);
        if (!ids) {
            this._selected.clear();
            return;
        }
        for (const id of ids) {
            this._selected.delete(id);
        }
    }
    updateBuffersCount() {
        const size = this._items.size;
        this._positionBuffer.count = size;
        this._colorBuffer.count = size;
    }
    resetAttributes() {
        const positionBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
        const colorBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
        this._geometry.setAttribute("position", positionBuffer);
        this._geometry.setAttribute("color", colorBuffer);
        this._capacity = 0;
    }
    removeFromColorBuffer(index, lastIndex) {
        this._colorBuffer.setXYZ(index, this._colorBuffer.getX(lastIndex), this._colorBuffer.getY(lastIndex), this._colorBuffer.getZ(lastIndex));
    }
    removeFromPositionBuffer(index, lastIndex) {
        this._positionBuffer.setXYZ(index, this._positionBuffer.getX(lastIndex), this._positionBuffer.getY(lastIndex), this._positionBuffer.getZ(lastIndex));
    }
    resizeBufferIfNecessary(increase) {
        const position = this._geometry.getAttribute("position");
        const size = position.count * 3 + increase * 3;
        const difference = size - this._capacity;
        if (difference >= 0) {
            const increase = Math.max(difference, this.bufferIncrease);
            this.resizeBuffers(increase);
        }
    }
    resizeBuffers(increase = this.bufferIncrease) {
        this._capacity += increase;
        const oldPositionArray = this._geometry.getAttribute("position").array;
        const oldColorArray = this._geometry.getAttribute("color").array;
        this.resizeAttribute("position", this._positionBuffer);
        this.resizeAttribute("color", this._colorBuffer);
        for (let i = 0; i < this._positionBuffer.count; i++) {
            const x = oldPositionArray[i * 3];
            const y = oldPositionArray[i * 3 + 1];
            const z = oldPositionArray[i * 3 + 2];
            this._positionBuffer.setXYZ(i, x, y, z);
            const r = oldColorArray[i * 3];
            const g = oldColorArray[i * 3 + 1];
            const b = oldColorArray[i * 3 + 2];
            this._colorBuffer.setXYZ(i, r, g, b);
        }
    }
    resizeAttribute(name, buffer) {
        const count = buffer.count;
        this._geometry.deleteAttribute(name);
        const array = new Float32Array(this._capacity);
        const newBuffer = new THREE.BufferAttribute(array, 3);
        newBuffer.count = count;
        this._geometry.setAttribute(name, newBuffer);
    }
    updateColor(select) {
        const allIDs = this._items.ids;
        for (const id of allIDs) {
            const isSelected = this._selected.has(id);
            if (select !== isSelected)
                continue;
            const index = this._items.getIndex(id);
            if (!index)
                continue;
            const color = select ? this._selectColor : this._baseColor;
            this._colorBuffer.setXYZ(index, color.r, color.g, color.b);
        }
        this._colorBuffer.needsUpdate = true;
    }
    removeSelectColor(ids = Array.from(this._selected)) {
        for (const id of ids) {
            const index = this._items.getIndex(id);
            if (index === null)
                return;
            this._colorBuffer.setXYZ(index, this._baseColor.r, this._baseColor.g, this._baseColor.b);
        }
    }
    newPointsMaterial(size) {
        return new THREE.PointsMaterial({
            size,
            vertexColors: true,
        });
    }
}

/**
 * Port from https://github.com/mapbox/earcut (v2.2.4)
 */

const Earcut = {

	triangulate: function ( data, holeIndices, dim = 2 ) {

		const hasHoles = holeIndices && holeIndices.length;
		const outerLen = hasHoles ? holeIndices[ 0 ] * dim : data.length;
		let outerNode = linkedList( data, 0, outerLen, dim, true );
		const triangles = [];

		if ( ! outerNode || outerNode.next === outerNode.prev ) return triangles;

		let minX, minY, maxX, maxY, x, y, invSize;

		if ( hasHoles ) outerNode = eliminateHoles( data, holeIndices, outerNode, dim );

		// if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
		if ( data.length > 80 * dim ) {

			minX = maxX = data[ 0 ];
			minY = maxY = data[ 1 ];

			for ( let i = dim; i < outerLen; i += dim ) {

				x = data[ i ];
				y = data[ i + 1 ];
				if ( x < minX ) minX = x;
				if ( y < minY ) minY = y;
				if ( x > maxX ) maxX = x;
				if ( y > maxY ) maxY = y;

			}

			// minX, minY and invSize are later used to transform coords into integers for z-order calculation
			invSize = Math.max( maxX - minX, maxY - minY );
			invSize = invSize !== 0 ? 32767 / invSize : 0;

		}

		earcutLinked( outerNode, triangles, dim, minX, minY, invSize, 0 );

		return triangles;

	}

};

// create a circular doubly linked list from polygon points in the specified winding order
function linkedList( data, start, end, dim, clockwise ) {

	let i, last;

	if ( clockwise === ( signedArea( data, start, end, dim ) > 0 ) ) {

		for ( i = start; i < end; i += dim ) last = insertNode( i, data[ i ], data[ i + 1 ], last );

	} else {

		for ( i = end - dim; i >= start; i -= dim ) last = insertNode( i, data[ i ], data[ i + 1 ], last );

	}

	if ( last && equals( last, last.next ) ) {

		removeNode( last );
		last = last.next;

	}

	return last;

}

// eliminate colinear or duplicate points
function filterPoints( start, end ) {

	if ( ! start ) return start;
	if ( ! end ) end = start;

	let p = start,
		again;
	do {

		again = false;

		if ( ! p.steiner && ( equals( p, p.next ) || area( p.prev, p, p.next ) === 0 ) ) {

			removeNode( p );
			p = end = p.prev;
			if ( p === p.next ) break;
			again = true;

		} else {

			p = p.next;

		}

	} while ( again || p !== end );

	return end;

}

// main ear slicing loop which triangulates a polygon (given as a linked list)
function earcutLinked( ear, triangles, dim, minX, minY, invSize, pass ) {

	if ( ! ear ) return;

	// interlink polygon nodes in z-order
	if ( ! pass && invSize ) indexCurve( ear, minX, minY, invSize );

	let stop = ear,
		prev, next;

	// iterate through ears, slicing them one by one
	while ( ear.prev !== ear.next ) {

		prev = ear.prev;
		next = ear.next;

		if ( invSize ? isEarHashed( ear, minX, minY, invSize ) : isEar( ear ) ) {

			// cut off the triangle
			triangles.push( prev.i / dim | 0 );
			triangles.push( ear.i / dim | 0 );
			triangles.push( next.i / dim | 0 );

			removeNode( ear );

			// skipping the next vertex leads to less sliver triangles
			ear = next.next;
			stop = next.next;

			continue;

		}

		ear = next;

		// if we looped through the whole remaining polygon and can't find any more ears
		if ( ear === stop ) {

			// try filtering points and slicing again
			if ( ! pass ) {

				earcutLinked( filterPoints( ear ), triangles, dim, minX, minY, invSize, 1 );

				// if this didn't work, try curing all small self-intersections locally

			} else if ( pass === 1 ) {

				ear = cureLocalIntersections( filterPoints( ear ), triangles, dim );
				earcutLinked( ear, triangles, dim, minX, minY, invSize, 2 );

				// as a last resort, try splitting the remaining polygon into two

			} else if ( pass === 2 ) {

				splitEarcut( ear, triangles, dim, minX, minY, invSize );

			}

			break;

		}

	}

}

// check whether a polygon node forms a valid ear with adjacent nodes
function isEar( ear ) {

	const a = ear.prev,
		b = ear,
		c = ear.next;

	if ( area( a, b, c ) >= 0 ) return false; // reflex, can't be an ear

	// now make sure we don't have other points inside the potential ear
	const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

	// triangle bbox; min & max are calculated like this for speed
	const x0 = ax < bx ? ( ax < cx ? ax : cx ) : ( bx < cx ? bx : cx ),
		y0 = ay < by ? ( ay < cy ? ay : cy ) : ( by < cy ? by : cy ),
		x1 = ax > bx ? ( ax > cx ? ax : cx ) : ( bx > cx ? bx : cx ),
		y1 = ay > by ? ( ay > cy ? ay : cy ) : ( by > cy ? by : cy );

	let p = c.next;
	while ( p !== a ) {

		if ( p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 &&
			pointInTriangle( ax, ay, bx, by, cx, cy, p.x, p.y ) &&
			area( p.prev, p, p.next ) >= 0 ) return false;
		p = p.next;

	}

	return true;

}

function isEarHashed( ear, minX, minY, invSize ) {

	const a = ear.prev,
		b = ear,
		c = ear.next;

	if ( area( a, b, c ) >= 0 ) return false; // reflex, can't be an ear

	const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

	// triangle bbox; min & max are calculated like this for speed
	const x0 = ax < bx ? ( ax < cx ? ax : cx ) : ( bx < cx ? bx : cx ),
		y0 = ay < by ? ( ay < cy ? ay : cy ) : ( by < cy ? by : cy ),
		x1 = ax > bx ? ( ax > cx ? ax : cx ) : ( bx > cx ? bx : cx ),
		y1 = ay > by ? ( ay > cy ? ay : cy ) : ( by > cy ? by : cy );

	// z-order range for the current triangle bbox;
	const minZ = zOrder( x0, y0, minX, minY, invSize ),
		maxZ = zOrder( x1, y1, minX, minY, invSize );

	let p = ear.prevZ,
		n = ear.nextZ;

	// look for points inside the triangle in both directions
	while ( p && p.z >= minZ && n && n.z <= maxZ ) {

		if ( p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
			pointInTriangle( ax, ay, bx, by, cx, cy, p.x, p.y ) && area( p.prev, p, p.next ) >= 0 ) return false;
		p = p.prevZ;

		if ( n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
			pointInTriangle( ax, ay, bx, by, cx, cy, n.x, n.y ) && area( n.prev, n, n.next ) >= 0 ) return false;
		n = n.nextZ;

	}

	// look for remaining points in decreasing z-order
	while ( p && p.z >= minZ ) {

		if ( p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
			pointInTriangle( ax, ay, bx, by, cx, cy, p.x, p.y ) && area( p.prev, p, p.next ) >= 0 ) return false;
		p = p.prevZ;

	}

	// look for remaining points in increasing z-order
	while ( n && n.z <= maxZ ) {

		if ( n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
			pointInTriangle( ax, ay, bx, by, cx, cy, n.x, n.y ) && area( n.prev, n, n.next ) >= 0 ) return false;
		n = n.nextZ;

	}

	return true;

}

// go through all polygon nodes and cure small local self-intersections
function cureLocalIntersections( start, triangles, dim ) {

	let p = start;
	do {

		const a = p.prev,
			b = p.next.next;

		if ( ! equals( a, b ) && intersects( a, p, p.next, b ) && locallyInside( a, b ) && locallyInside( b, a ) ) {

			triangles.push( a.i / dim | 0 );
			triangles.push( p.i / dim | 0 );
			triangles.push( b.i / dim | 0 );

			// remove two nodes involved
			removeNode( p );
			removeNode( p.next );

			p = start = b;

		}

		p = p.next;

	} while ( p !== start );

	return filterPoints( p );

}

// try splitting polygon into two and triangulate them independently
function splitEarcut( start, triangles, dim, minX, minY, invSize ) {

	// look for a valid diagonal that divides the polygon into two
	let a = start;
	do {

		let b = a.next.next;
		while ( b !== a.prev ) {

			if ( a.i !== b.i && isValidDiagonal( a, b ) ) {

				// split the polygon in two by the diagonal
				let c = splitPolygon( a, b );

				// filter colinear points around the cuts
				a = filterPoints( a, a.next );
				c = filterPoints( c, c.next );

				// run earcut on each half
				earcutLinked( a, triangles, dim, minX, minY, invSize, 0 );
				earcutLinked( c, triangles, dim, minX, minY, invSize, 0 );
				return;

			}

			b = b.next;

		}

		a = a.next;

	} while ( a !== start );

}

// link every hole into the outer loop, producing a single-ring polygon without holes
function eliminateHoles( data, holeIndices, outerNode, dim ) {

	const queue = [];
	let i, len, start, end, list;

	for ( i = 0, len = holeIndices.length; i < len; i ++ ) {

		start = holeIndices[ i ] * dim;
		end = i < len - 1 ? holeIndices[ i + 1 ] * dim : data.length;
		list = linkedList( data, start, end, dim, false );
		if ( list === list.next ) list.steiner = true;
		queue.push( getLeftmost( list ) );

	}

	queue.sort( compareX );

	// process holes from left to right
	for ( i = 0; i < queue.length; i ++ ) {

		outerNode = eliminateHole( queue[ i ], outerNode );

	}

	return outerNode;

}

function compareX( a, b ) {

	return a.x - b.x;

}

// find a bridge between vertices that connects hole with an outer ring and link it
function eliminateHole( hole, outerNode ) {

	const bridge = findHoleBridge( hole, outerNode );
	if ( ! bridge ) {

		return outerNode;

	}

	const bridgeReverse = splitPolygon( bridge, hole );

	// filter collinear points around the cuts
	filterPoints( bridgeReverse, bridgeReverse.next );
	return filterPoints( bridge, bridge.next );

}

// David Eberly's algorithm for finding a bridge between hole and outer polygon
function findHoleBridge( hole, outerNode ) {

	let p = outerNode,
		qx = - Infinity,
		m;

	const hx = hole.x, hy = hole.y;

	// find a segment intersected by a ray from the hole's leftmost point to the left;
	// segment's endpoint with lesser x will be potential connection point
	do {

		if ( hy <= p.y && hy >= p.next.y && p.next.y !== p.y ) {

			const x = p.x + ( hy - p.y ) * ( p.next.x - p.x ) / ( p.next.y - p.y );
			if ( x <= hx && x > qx ) {

				qx = x;
				m = p.x < p.next.x ? p : p.next;
				if ( x === hx ) return m; // hole touches outer segment; pick leftmost endpoint

			}

		}

		p = p.next;

	} while ( p !== outerNode );

	if ( ! m ) return null;

	// look for points inside the triangle of hole point, segment intersection and endpoint;
	// if there are no points found, we have a valid connection;
	// otherwise choose the point of the minimum angle with the ray as connection point

	const stop = m,
		mx = m.x,
		my = m.y;
	let tanMin = Infinity, tan;

	p = m;

	do {

		if ( hx >= p.x && p.x >= mx && hx !== p.x &&
				pointInTriangle( hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y ) ) {

			tan = Math.abs( hy - p.y ) / ( hx - p.x ); // tangential

			if ( locallyInside( p, hole ) && ( tan < tanMin || ( tan === tanMin && ( p.x > m.x || ( p.x === m.x && sectorContainsSector( m, p ) ) ) ) ) ) {

				m = p;
				tanMin = tan;

			}

		}

		p = p.next;

	} while ( p !== stop );

	return m;

}

// whether sector in vertex m contains sector in vertex p in the same coordinates
function sectorContainsSector( m, p ) {

	return area( m.prev, m, p.prev ) < 0 && area( p.next, m, m.next ) < 0;

}

// interlink polygon nodes in z-order
function indexCurve( start, minX, minY, invSize ) {

	let p = start;
	do {

		if ( p.z === 0 ) p.z = zOrder( p.x, p.y, minX, minY, invSize );
		p.prevZ = p.prev;
		p.nextZ = p.next;
		p = p.next;

	} while ( p !== start );

	p.prevZ.nextZ = null;
	p.prevZ = null;

	sortLinked( p );

}

// Simon Tatham's linked list merge sort algorithm
// http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
function sortLinked( list ) {

	let i, p, q, e, tail, numMerges, pSize, qSize,
		inSize = 1;

	do {

		p = list;
		list = null;
		tail = null;
		numMerges = 0;

		while ( p ) {

			numMerges ++;
			q = p;
			pSize = 0;
			for ( i = 0; i < inSize; i ++ ) {

				pSize ++;
				q = q.nextZ;
				if ( ! q ) break;

			}

			qSize = inSize;

			while ( pSize > 0 || ( qSize > 0 && q ) ) {

				if ( pSize !== 0 && ( qSize === 0 || ! q || p.z <= q.z ) ) {

					e = p;
					p = p.nextZ;
					pSize --;

				} else {

					e = q;
					q = q.nextZ;
					qSize --;

				}

				if ( tail ) tail.nextZ = e;
				else list = e;

				e.prevZ = tail;
				tail = e;

			}

			p = q;

		}

		tail.nextZ = null;
		inSize *= 2;

	} while ( numMerges > 1 );

	return list;

}

// z-order of a point given coords and inverse of the longer side of data bbox
function zOrder( x, y, minX, minY, invSize ) {

	// coords are transformed into non-negative 15-bit integer range
	x = ( x - minX ) * invSize | 0;
	y = ( y - minY ) * invSize | 0;

	x = ( x | ( x << 8 ) ) & 0x00FF00FF;
	x = ( x | ( x << 4 ) ) & 0x0F0F0F0F;
	x = ( x | ( x << 2 ) ) & 0x33333333;
	x = ( x | ( x << 1 ) ) & 0x55555555;

	y = ( y | ( y << 8 ) ) & 0x00FF00FF;
	y = ( y | ( y << 4 ) ) & 0x0F0F0F0F;
	y = ( y | ( y << 2 ) ) & 0x33333333;
	y = ( y | ( y << 1 ) ) & 0x55555555;

	return x | ( y << 1 );

}

// find the leftmost node of a polygon ring
function getLeftmost( start ) {

	let p = start,
		leftmost = start;
	do {

		if ( p.x < leftmost.x || ( p.x === leftmost.x && p.y < leftmost.y ) ) leftmost = p;
		p = p.next;

	} while ( p !== start );

	return leftmost;

}

// check if a point lies within a convex triangle
function pointInTriangle( ax, ay, bx, by, cx, cy, px, py ) {

	return ( cx - px ) * ( ay - py ) >= ( ax - px ) * ( cy - py ) &&
           ( ax - px ) * ( by - py ) >= ( bx - px ) * ( ay - py ) &&
           ( bx - px ) * ( cy - py ) >= ( cx - px ) * ( by - py );

}

// check if a diagonal between two polygon nodes is valid (lies in polygon interior)
function isValidDiagonal( a, b ) {

	return a.next.i !== b.i && a.prev.i !== b.i && ! intersectsPolygon( a, b ) && // dones't intersect other edges
           ( locallyInside( a, b ) && locallyInside( b, a ) && middleInside( a, b ) && // locally visible
            ( area( a.prev, a, b.prev ) || area( a, b.prev, b ) ) || // does not create opposite-facing sectors
            equals( a, b ) && area( a.prev, a, a.next ) > 0 && area( b.prev, b, b.next ) > 0 ); // special zero-length case

}

// signed area of a triangle
function area( p, q, r ) {

	return ( q.y - p.y ) * ( r.x - q.x ) - ( q.x - p.x ) * ( r.y - q.y );

}

// check if two points are equal
function equals( p1, p2 ) {

	return p1.x === p2.x && p1.y === p2.y;

}

// check if two segments intersect
function intersects( p1, q1, p2, q2 ) {

	const o1 = sign( area( p1, q1, p2 ) );
	const o2 = sign( area( p1, q1, q2 ) );
	const o3 = sign( area( p2, q2, p1 ) );
	const o4 = sign( area( p2, q2, q1 ) );

	if ( o1 !== o2 && o3 !== o4 ) return true; // general case

	if ( o1 === 0 && onSegment( p1, p2, q1 ) ) return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
	if ( o2 === 0 && onSegment( p1, q2, q1 ) ) return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
	if ( o3 === 0 && onSegment( p2, p1, q2 ) ) return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
	if ( o4 === 0 && onSegment( p2, q1, q2 ) ) return true; // p2, q2 and q1 are collinear and q1 lies on p2q2

	return false;

}

// for collinear points p, q, r, check if point q lies on segment pr
function onSegment( p, q, r ) {

	return q.x <= Math.max( p.x, r.x ) && q.x >= Math.min( p.x, r.x ) && q.y <= Math.max( p.y, r.y ) && q.y >= Math.min( p.y, r.y );

}

function sign( num ) {

	return num > 0 ? 1 : num < 0 ? - 1 : 0;

}

// check if a polygon diagonal intersects any polygon segments
function intersectsPolygon( a, b ) {

	let p = a;
	do {

		if ( p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
			intersects( p, p.next, a, b ) ) return true;
		p = p.next;

	} while ( p !== a );

	return false;

}

// check if a polygon diagonal is locally inside the polygon
function locallyInside( a, b ) {

	return area( a.prev, a, a.next ) < 0 ?
		area( a, b, a.next ) >= 0 && area( a, a.prev, b ) >= 0 :
		area( a, b, a.prev ) < 0 || area( a, a.next, b ) < 0;

}

// check if the middle point of a polygon diagonal is inside the polygon
function middleInside( a, b ) {

	let p = a,
		inside = false;
	const px = ( a.x + b.x ) / 2,
		py = ( a.y + b.y ) / 2;
	do {

		if ( ( ( p.y > py ) !== ( p.next.y > py ) ) && p.next.y !== p.y &&
			( px < ( p.next.x - p.x ) * ( py - p.y ) / ( p.next.y - p.y ) + p.x ) )
			inside = ! inside;
		p = p.next;

	} while ( p !== a );

	return inside;

}

// link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
// if one belongs to the outer ring and another to a hole, it merges it into a single ring
function splitPolygon( a, b ) {

	const a2 = new Node( a.i, a.x, a.y ),
		b2 = new Node( b.i, b.x, b.y ),
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
function insertNode( i, x, y, last ) {

	const p = new Node( i, x, y );

	if ( ! last ) {

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

function removeNode( p ) {

	p.next.prev = p.prev;
	p.prev.next = p.next;

	if ( p.prevZ ) p.prevZ.nextZ = p.nextZ;
	if ( p.nextZ ) p.nextZ.prevZ = p.prevZ;

}

function Node( i, x, y ) {

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

function signedArea( data, start, end, dim ) {

	let sum = 0;
	for ( let i = start, j = end - dim; i < end; i += dim ) {

		sum += ( data[ j ] - data[ i ] ) * ( data[ i + 1 ] + data[ j + 1 ] );
		j = i;

	}

	return sum;

}

class Types {
    constructor(list) {
        this.indexPoints = [];
        this.indexFaces = [];
        this.indexPoints = list;
    }
}

class Faces {
    constructor() {
        /** Mesh containing all faces */
        this.mesh = new THREE.Mesh();
        this._points = new Vertices();
        this._geometry = new THREE.BufferGeometry();
        this._clayFaces = [];
        this.updatePositionBuffer();
        this.updateIndexBuffer();
        this.mesh = new THREE.Mesh(this._geometry, new THREE.MeshPhongMaterial({ side: THREE.DoubleSide }));
    }
    /**
     * Creates a new faces
     * @param ptList List of coplanar points for each face
     */
    addFaces(pointLists) {
        for (const index in pointLists) {
            const pointList = pointLists[index];
            if (pointList.length > 2) {
                const newList = [];
                for (let i = 0; i < pointList.length; i++) {
                    newList.push(this._points.length + i);
                }
                this._points.add(pointList);
                const face = new Types(newList);
                this._clayFaces.push(face);
            }
        }
        this.updateIndexBuffer(this._clayFaces.length - pointLists.length);
    }
    /**
     * Remove faces from the model
     * @param indices Indices of the faces to remove
     */
    removeFaces(indices) {
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
    removeTriangles(list) {
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
    correctFaceTriangles(list) {
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
    correctIndexFaces(faceIndex, pointer) {
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
    correctIndexTriangles(pointer) {
        const newIndices = this.createStartList(1);
        for (let i = 0; i < newIndices.length; i++) {
            if (newIndices[i] > pointer) {
                newIndices[i]--;
            }
        }
        this._geometry.setIndex(newIndices);
    }
    correctIndices(index) {
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
    updatePositionBuffer() {
        const positionBuffer = this._points.points.geometry.attributes.position;
        this._geometry.setAttribute("position", positionBuffer);
    }
    createStartList(startIndex) {
        var _a;
        const newIndices = [];
        if (startIndex > 0) {
            const tempIndexList = (_a = this._geometry.getIndex()) === null || _a === void 0 ? void 0 : _a.array;
            if (tempIndexList) {
                for (let i = 0; i < tempIndexList.length; i++) {
                    newIndices.push(tempIndexList[i]);
                }
            }
        }
        return newIndices;
    }
    triangulateFace(face) {
        const coordinates = [];
        for (let j = 0; j < face.indexPoints.length; j++) {
            const index = face.indexPoints[j];
            const position = this._points.get(index);
            if (position === null)
                continue;
            coordinates.push(position[0]);
            coordinates.push(position[1]);
            coordinates.push(position[2]);
        }
        const voidList = [];
        return Earcut.triangulate(coordinates, voidList, 3);
    }
    addTriangulatedFace(face, indices, newIndices) {
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
    updateIndexBuffer(startIndex = 0) {
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

export { Faces, Vertices };
