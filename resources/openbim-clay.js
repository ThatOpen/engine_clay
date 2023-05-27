import * as THREE from 'https://unpkg.com/three@0.135.0/build/three.module.js';
import { Vector3, Matrix4, Object3D, Raycaster as Raycaster$1, Quaternion, Euler, MeshBasicMaterial, LineBasicMaterial, CylinderGeometry, BoxGeometry, BufferGeometry, Float32BufferAttribute, Mesh, OctahedronGeometry, Line, SphereGeometry, TorusGeometry, PlaneGeometry, DoubleSide, Interpolant, Box3, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, WireframeGeometry, Sphere, UniformsLib, Vector2, ShaderLib, UniformsUtils, ShaderMaterial, Vector4, Line3, MathUtils, OrthographicCamera } from 'https://unpkg.com/three@0.135.0/build/three.module.js';

class BufferManager {
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
    /** The current size of the buffers. */
    get size() {
        const firstAttribute = this.attributes[0];
        return firstAttribute.count * 3;
    }
    get attributes() {
        return Object.values(this.geometry.attributes);
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
            const oldCapacity = this.capacity;
            this.capacity += increase;
            for (const attribute of this.attributes) {
                this.resizeBuffers(attribute, oldCapacity);
            }
        }
    }
    resizeBuffers(attribute, oldCapacity) {
        this.geometry.deleteAttribute(attribute.name);
        const array = new Float32Array(this.capacity);
        const newAttribute = new THREE.BufferAttribute(array, 3);
        newAttribute.name = attribute.name;
        newAttribute.count = attribute.count;
        this.geometry.setAttribute(attribute.name, newAttribute);
        for (let i = 0; i < oldCapacity; i++) {
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
    static get up() {
        return [0, 1, 0];
    }
    static round(vector, precission = 1000) {
        return [
            Math.round(vector[0] * precission) / precission,
            Math.round(vector[1] * precission) / precission,
            Math.round(vector[2] * precission) / precission,
        ];
    }
    static getNormal(points) {
        const a = Vector.subtract(points[0], points[1]);
        const b = Vector.subtract(points[1], points[2]);
        const [x, y, z] = this.multiply(a, b);
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        return [x / magnitude, y / magnitude, z / magnitude];
    }
    static dot(v1, v2) {
        return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    }
    static multiply(v1, v2) {
        const x = v1[1] * v2[2] - v1[2] * v2[1];
        const y = v1[2] * v2[0] - v1[0] * v2[2];
        const z = v1[0] * v2[1] - v1[1] * v2[0];
        return [x, y, z];
    }
    static normalize(vector) {
        const [x, y, z] = vector;
        const magnitude = Vector.magnitude(vector);
        return [x / magnitude, y / magnitude, z / magnitude];
    }
    static magnitude(vector) {
        const [x, y, z] = vector;
        return Math.sqrt(x * x + y * y + z * z);
    }
    static squaredMagnitude(vector) {
        const [x, y, z] = vector;
        return x * x + y * y + z * z;
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
    static subtract(v1, v2) {
        const [x1, y1, z1] = v1;
        const [x2, y2, z2] = v2;
        return [x2 - x1, y2 - y1, z2 - z1];
    }
    static multiplyScalar(vector, scalar) {
        return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
    }
}

class Raycaster {
    constructor() {
        this._mouse = new THREE.Vector2();
        this._mouseEvent = new THREE.Vector2();
        this._trackMouse = false;
        this.getMousePosition = (event) => {
            this._mouseEvent.x = event.clientX;
            this._mouseEvent.y = event.clientY;
        };
        this._caster = new THREE.Raycaster();
        if (!this._caster.params.Points) {
            throw new Error("Raycaster has undefined Points");
        }
        this._caster.params.Points.threshold = 0.2;
    }
    get trackMouse() {
        return this._trackMouse;
    }
    set trackMouse(active) {
        this._trackMouse = active;
        if (active) {
            window.addEventListener("mousemove", this.getMousePosition);
        }
        else {
            window.removeEventListener("mousemove", this.getMousePosition);
        }
    }
    cast(items) {
        if (!this.domElement || !this.camera) {
            throw new Error("DOM element and camera must be initialized!");
        }
        const x = this._mouseEvent.x;
        const y = this._mouseEvent.y;
        const b = this.domElement.getBoundingClientRect();
        this._mouse.x = ((x - b.left) / (b.right - b.left)) * 2 - 1;
        this._mouse.y = -((y - b.top) / (b.bottom - b.top)) * 2 + 1;
        this._caster.setFromCamera(this._mouse, this.camera);
        return this._caster.intersectObjects(items);
    }
}

/**
 * Simple event handler by
 * [Jason Kleban](https://gist.github.com/JasonKleban/50cee44960c225ac1993c922563aa540).
 * Keep in mind that:
 * - If you want to remove it later, you might want to declare the callback as
 * an object.
 * - If you want to maintain the reference to `this`, you will need to declare
 * the callback as an arrow function.
 */
class Event {
    constructor() {
        /**
         * Triggers all the callbacks assigned to this event.
         */
        this.trigger = ((data) => {
            // @ts-ignore
            this.handlers.slice(0).forEach((h) => h(data));
        });
        this.handlers = [];
    }
    /**
     * Add a callback to this event instance.
     * @param handler - the callback to be added to this event.
     */
    on(handler) {
        this.handlers.push(handler);
    }
    /**
     * Removes a callback from this event instance.
     * @param handler - the callback to be removed from this event.
     */
    off(handler) {
        this.handlers = this.handlers.filter((h) => h !== handler);
    }
    /**
     * Gets rid of all the suscribed events.
     */
    reset() {
        this.handlers.length = 0;
    }
}

/*!
 * camera-controls
 * https://github.com/yomotsu/camera-controls
 * (c) 2017 @yomotsu
 * Released under the MIT License.
 */
Object.freeze({
    NONE: 0,
    ROTATE: 1,
    TRUCK: 2,
    OFFSET: 4,
    DOLLY: 8,
    ZOOM: 16,
    TOUCH_ROTATE: 32,
    TOUCH_TRUCK: 64,
    TOUCH_OFFSET: 128,
    TOUCH_DOLLY: 256,
    TOUCH_ZOOM: 512,
    TOUCH_DOLLY_TRUCK: 1024,
    TOUCH_DOLLY_OFFSET: 2048,
    TOUCH_ZOOM_TRUCK: 4096,
    TOUCH_ZOOM_OFFSET: 8192,
});

const isBrowser = typeof window !== 'undefined';
isBrowser && /Mac/.test(navigator.platform);

class CSS2DObject extends Object3D {

	constructor( element = document.createElement( 'div' ) ) {

		super();

		this.element = element;

		this.element.style.position = 'absolute';
		this.element.style.userSelect = 'none';

		this.element.setAttribute( 'draggable', false );

		this.addEventListener( 'removed', function () {

			this.traverse( function ( object ) {

				if ( object.element instanceof Element && object.element.parentNode !== null ) {

					object.element.parentNode.removeChild( object.element );

				}

			} );

		} );

	}

	copy( source, recursive ) {

		super.copy( source, recursive );

		this.element = source.element.cloneNode( true );

		return this;

	}

}

CSS2DObject.prototype.isCSS2DObject = true;

//

new Vector3();
new Matrix4();
new Matrix4();
new Vector3();
new Vector3();

[
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
];

const _raycaster = new Raycaster$1();

const _tempVector = new Vector3();
const _tempVector2 = new Vector3();
const _tempQuaternion = new Quaternion();
const _unit = {
	X: new Vector3( 1, 0, 0 ),
	Y: new Vector3( 0, 1, 0 ),
	Z: new Vector3( 0, 0, 1 )
};

const _changeEvent = { type: 'change' };
const _mouseDownEvent = { type: 'mouseDown' };
const _mouseUpEvent = { type: 'mouseUp', mode: null };
const _objectChangeEvent = { type: 'objectChange' };

class TransformControls extends Object3D {

	constructor( camera, domElement ) {

		super();

		if ( domElement === undefined ) {

			console.warn( 'THREE.TransformControls: The second parameter "domElement" is now mandatory.' );
			domElement = document;

		}

		this.visible = false;
		this.domElement = domElement;
		this.domElement.style.touchAction = 'none'; // disable touch scroll

		const _gizmo = new TransformControlsGizmo();
		this._gizmo = _gizmo;
		this.add( _gizmo );

		const _plane = new TransformControlsPlane();
		this._plane = _plane;
		this.add( _plane );

		const scope = this;

		// Defined getter, setter and store for a property
		function defineProperty( propName, defaultValue ) {

			let propValue = defaultValue;

			Object.defineProperty( scope, propName, {

				get: function () {

					return propValue !== undefined ? propValue : defaultValue;

				},

				set: function ( value ) {

					if ( propValue !== value ) {

						propValue = value;
						_plane[ propName ] = value;
						_gizmo[ propName ] = value;

						scope.dispatchEvent( { type: propName + '-changed', value: value } );
						scope.dispatchEvent( _changeEvent );

					}

				}

			} );

			scope[ propName ] = defaultValue;
			_plane[ propName ] = defaultValue;
			_gizmo[ propName ] = defaultValue;

		}

		// Define properties with getters/setter
		// Setting the defined property will automatically trigger change event
		// Defined properties are passed down to gizmo and plane

		defineProperty( 'camera', camera );
		defineProperty( 'object', undefined );
		defineProperty( 'enabled', true );
		defineProperty( 'axis', null );
		defineProperty( 'mode', 'translate' );
		defineProperty( 'translationSnap', null );
		defineProperty( 'rotationSnap', null );
		defineProperty( 'scaleSnap', null );
		defineProperty( 'space', 'world' );
		defineProperty( 'size', 1 );
		defineProperty( 'dragging', false );
		defineProperty( 'showX', true );
		defineProperty( 'showY', true );
		defineProperty( 'showZ', true );

		// Reusable utility variables

		const worldPosition = new Vector3();
		const worldPositionStart = new Vector3();
		const worldQuaternion = new Quaternion();
		const worldQuaternionStart = new Quaternion();
		const cameraPosition = new Vector3();
		const cameraQuaternion = new Quaternion();
		const pointStart = new Vector3();
		const pointEnd = new Vector3();
		const rotationAxis = new Vector3();
		const rotationAngle = 0;
		const eye = new Vector3();

		// TODO: remove properties unused in plane and gizmo

		defineProperty( 'worldPosition', worldPosition );
		defineProperty( 'worldPositionStart', worldPositionStart );
		defineProperty( 'worldQuaternion', worldQuaternion );
		defineProperty( 'worldQuaternionStart', worldQuaternionStart );
		defineProperty( 'cameraPosition', cameraPosition );
		defineProperty( 'cameraQuaternion', cameraQuaternion );
		defineProperty( 'pointStart', pointStart );
		defineProperty( 'pointEnd', pointEnd );
		defineProperty( 'rotationAxis', rotationAxis );
		defineProperty( 'rotationAngle', rotationAngle );
		defineProperty( 'eye', eye );

		this._offset = new Vector3();
		this._startNorm = new Vector3();
		this._endNorm = new Vector3();
		this._cameraScale = new Vector3();

		this._parentPosition = new Vector3();
		this._parentQuaternion = new Quaternion();
		this._parentQuaternionInv = new Quaternion();
		this._parentScale = new Vector3();

		this._worldScaleStart = new Vector3();
		this._worldQuaternionInv = new Quaternion();
		this._worldScale = new Vector3();

		this._positionStart = new Vector3();
		this._quaternionStart = new Quaternion();
		this._scaleStart = new Vector3();

		this._getPointer = getPointer.bind( this );
		this._onPointerDown = onPointerDown.bind( this );
		this._onPointerHover = onPointerHover.bind( this );
		this._onPointerMove = onPointerMove.bind( this );
		this._onPointerUp = onPointerUp.bind( this );

		this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.addEventListener( 'pointermove', this._onPointerHover );
		this.domElement.addEventListener( 'pointerup', this._onPointerUp );

	}

	// updateMatrixWorld  updates key transformation variables
	updateMatrixWorld() {

		if ( this.object !== undefined ) {

			this.object.updateMatrixWorld();

			if ( this.object.parent === null ) {

				console.error( 'TransformControls: The attached 3D object must be a part of the scene graph.' );

			} else {

				this.object.parent.matrixWorld.decompose( this._parentPosition, this._parentQuaternion, this._parentScale );

			}

			this.object.matrixWorld.decompose( this.worldPosition, this.worldQuaternion, this._worldScale );

			this._parentQuaternionInv.copy( this._parentQuaternion ).invert();
			this._worldQuaternionInv.copy( this.worldQuaternion ).invert();

		}

		this.camera.updateMatrixWorld();
		this.camera.matrixWorld.decompose( this.cameraPosition, this.cameraQuaternion, this._cameraScale );

		this.eye.copy( this.cameraPosition ).sub( this.worldPosition ).normalize();

		super.updateMatrixWorld( this );

	}

	pointerHover( pointer ) {

		if ( this.object === undefined || this.dragging === true ) return;

		_raycaster.setFromCamera( pointer, this.camera );

		const intersect = intersectObjectWithRay( this._gizmo.picker[ this.mode ], _raycaster );

		if ( intersect ) {

			this.axis = intersect.object.name;

		} else {

			this.axis = null;

		}

	}

	pointerDown( pointer ) {

		if ( this.object === undefined || this.dragging === true || pointer.button !== 0 ) return;

		if ( this.axis !== null ) {

			_raycaster.setFromCamera( pointer, this.camera );

			const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );

			if ( planeIntersect ) {

				this.object.updateMatrixWorld();
				this.object.parent.updateMatrixWorld();

				this._positionStart.copy( this.object.position );
				this._quaternionStart.copy( this.object.quaternion );
				this._scaleStart.copy( this.object.scale );

				this.object.matrixWorld.decompose( this.worldPositionStart, this.worldQuaternionStart, this._worldScaleStart );

				this.pointStart.copy( planeIntersect.point ).sub( this.worldPositionStart );

			}

			this.dragging = true;
			_mouseDownEvent.mode = this.mode;
			this.dispatchEvent( _mouseDownEvent );

		}

	}

	pointerMove( pointer ) {

		const axis = this.axis;
		const mode = this.mode;
		const object = this.object;
		let space = this.space;

		if ( mode === 'scale' ) {

			space = 'local';

		} else if ( axis === 'E' || axis === 'XYZE' || axis === 'XYZ' ) {

			space = 'world';

		}

		if ( object === undefined || axis === null || this.dragging === false || pointer.button !== - 1 ) return;

		_raycaster.setFromCamera( pointer, this.camera );

		const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );

		if ( ! planeIntersect ) return;

		this.pointEnd.copy( planeIntersect.point ).sub( this.worldPositionStart );

		if ( mode === 'translate' ) {

			// Apply translate

			this._offset.copy( this.pointEnd ).sub( this.pointStart );

			if ( space === 'local' && axis !== 'XYZ' ) {

				this._offset.applyQuaternion( this._worldQuaternionInv );

			}

			if ( axis.indexOf( 'X' ) === - 1 ) this._offset.x = 0;
			if ( axis.indexOf( 'Y' ) === - 1 ) this._offset.y = 0;
			if ( axis.indexOf( 'Z' ) === - 1 ) this._offset.z = 0;

			if ( space === 'local' && axis !== 'XYZ' ) {

				this._offset.applyQuaternion( this._quaternionStart ).divide( this._parentScale );

			} else {

				this._offset.applyQuaternion( this._parentQuaternionInv ).divide( this._parentScale );

			}

			object.position.copy( this._offset ).add( this._positionStart );

			// Apply translation snap

			if ( this.translationSnap ) {

				if ( space === 'local' ) {

					object.position.applyQuaternion( _tempQuaternion.copy( this._quaternionStart ).invert() );

					if ( axis.search( 'X' ) !== - 1 ) {

						object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Y' ) !== - 1 ) {

						object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Z' ) !== - 1 ) {

						object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

					}

					object.position.applyQuaternion( this._quaternionStart );

				}

				if ( space === 'world' ) {

					if ( object.parent ) {

						object.position.add( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

					}

					if ( axis.search( 'X' ) !== - 1 ) {

						object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Y' ) !== - 1 ) {

						object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Z' ) !== - 1 ) {

						object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

					}

					if ( object.parent ) {

						object.position.sub( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

					}

				}

			}

		} else if ( mode === 'scale' ) {

			if ( axis.search( 'XYZ' ) !== - 1 ) {

				let d = this.pointEnd.length() / this.pointStart.length();

				if ( this.pointEnd.dot( this.pointStart ) < 0 ) d *= - 1;

				_tempVector2.set( d, d, d );

			} else {

				_tempVector.copy( this.pointStart );
				_tempVector2.copy( this.pointEnd );

				_tempVector.applyQuaternion( this._worldQuaternionInv );
				_tempVector2.applyQuaternion( this._worldQuaternionInv );

				_tempVector2.divide( _tempVector );

				if ( axis.search( 'X' ) === - 1 ) {

					_tempVector2.x = 1;

				}

				if ( axis.search( 'Y' ) === - 1 ) {

					_tempVector2.y = 1;

				}

				if ( axis.search( 'Z' ) === - 1 ) {

					_tempVector2.z = 1;

				}

			}

			// Apply scale

			object.scale.copy( this._scaleStart ).multiply( _tempVector2 );

			if ( this.scaleSnap ) {

				if ( axis.search( 'X' ) !== - 1 ) {

					object.scale.x = Math.round( object.scale.x / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

				if ( axis.search( 'Y' ) !== - 1 ) {

					object.scale.y = Math.round( object.scale.y / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

				if ( axis.search( 'Z' ) !== - 1 ) {

					object.scale.z = Math.round( object.scale.z / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

			}

		} else if ( mode === 'rotate' ) {

			this._offset.copy( this.pointEnd ).sub( this.pointStart );

			const ROTATION_SPEED = 20 / this.worldPosition.distanceTo( _tempVector.setFromMatrixPosition( this.camera.matrixWorld ) );

			if ( axis === 'E' ) {

				this.rotationAxis.copy( this.eye );
				this.rotationAngle = this.pointEnd.angleTo( this.pointStart );

				this._startNorm.copy( this.pointStart ).normalize();
				this._endNorm.copy( this.pointEnd ).normalize();

				this.rotationAngle *= ( this._endNorm.cross( this._startNorm ).dot( this.eye ) < 0 ? 1 : - 1 );

			} else if ( axis === 'XYZE' ) {

				this.rotationAxis.copy( this._offset ).cross( this.eye ).normalize();
				this.rotationAngle = this._offset.dot( _tempVector.copy( this.rotationAxis ).cross( this.eye ) ) * ROTATION_SPEED;

			} else if ( axis === 'X' || axis === 'Y' || axis === 'Z' ) {

				this.rotationAxis.copy( _unit[ axis ] );

				_tempVector.copy( _unit[ axis ] );

				if ( space === 'local' ) {

					_tempVector.applyQuaternion( this.worldQuaternion );

				}

				this.rotationAngle = this._offset.dot( _tempVector.cross( this.eye ).normalize() ) * ROTATION_SPEED;

			}

			// Apply rotation snap

			if ( this.rotationSnap ) this.rotationAngle = Math.round( this.rotationAngle / this.rotationSnap ) * this.rotationSnap;

			// Apply rotate
			if ( space === 'local' && axis !== 'E' && axis !== 'XYZE' ) {

				object.quaternion.copy( this._quaternionStart );
				object.quaternion.multiply( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) ).normalize();

			} else {

				this.rotationAxis.applyQuaternion( this._parentQuaternionInv );
				object.quaternion.copy( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) );
				object.quaternion.multiply( this._quaternionStart ).normalize();

			}

		}

		this.dispatchEvent( _changeEvent );
		this.dispatchEvent( _objectChangeEvent );

	}

	pointerUp( pointer ) {

		if ( pointer.button !== 0 ) return;

		if ( this.dragging && ( this.axis !== null ) ) {

			_mouseUpEvent.mode = this.mode;
			this.dispatchEvent( _mouseUpEvent );

		}

		this.dragging = false;
		this.axis = null;

	}

	dispose() {

		this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.removeEventListener( 'pointermove', this._onPointerHover );
		this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
		this.domElement.removeEventListener( 'pointerup', this._onPointerUp );

		this.traverse( function ( child ) {

			if ( child.geometry ) child.geometry.dispose();
			if ( child.material ) child.material.dispose();

		} );

	}

	// Set current object
	attach( object ) {

		this.object = object;
		this.visible = true;

		return this;

	}

	// Detatch from object
	detach() {

		this.object = undefined;
		this.visible = false;
		this.axis = null;

		return this;

	}

	getRaycaster() {

		return _raycaster;

	}

	// TODO: deprecate

	getMode() {

		return this.mode;

	}

	setMode( mode ) {

		this.mode = mode;

	}

	setTranslationSnap( translationSnap ) {

		this.translationSnap = translationSnap;

	}

	setRotationSnap( rotationSnap ) {

		this.rotationSnap = rotationSnap;

	}

	setScaleSnap( scaleSnap ) {

		this.scaleSnap = scaleSnap;

	}

	setSize( size ) {

		this.size = size;

	}

	setSpace( space ) {

		this.space = space;

	}

	update() {

		console.warn( 'THREE.TransformControls: update function has no more functionality and therefore has been deprecated.' );

	}

}

TransformControls.prototype.isTransformControls = true;

// mouse / touch event handlers

function getPointer( event ) {

	if ( this.domElement.ownerDocument.pointerLockElement ) {

		return {
			x: 0,
			y: 0,
			button: event.button
		};

	} else {

		const rect = this.domElement.getBoundingClientRect();

		return {
			x: ( event.clientX - rect.left ) / rect.width * 2 - 1,
			y: - ( event.clientY - rect.top ) / rect.height * 2 + 1,
			button: event.button
		};

	}

}

function onPointerHover( event ) {

	if ( ! this.enabled ) return;

	switch ( event.pointerType ) {

		case 'mouse':
		case 'pen':
			this.pointerHover( this._getPointer( event ) );
			break;

	}

}

function onPointerDown( event ) {

	if ( ! this.enabled ) return;

	this.domElement.setPointerCapture( event.pointerId );

	this.domElement.addEventListener( 'pointermove', this._onPointerMove );

	this.pointerHover( this._getPointer( event ) );
	this.pointerDown( this._getPointer( event ) );

}

function onPointerMove( event ) {

	if ( ! this.enabled ) return;

	this.pointerMove( this._getPointer( event ) );

}

function onPointerUp( event ) {

	if ( ! this.enabled ) return;

	this.domElement.releasePointerCapture( event.pointerId );

	this.domElement.removeEventListener( 'pointermove', this._onPointerMove );

	this.pointerUp( this._getPointer( event ) );

}

function intersectObjectWithRay( object, raycaster, includeInvisible ) {

	const allIntersections = raycaster.intersectObject( object, true );

	for ( let i = 0; i < allIntersections.length; i ++ ) {

		if ( allIntersections[ i ].object.visible || includeInvisible ) {

			return allIntersections[ i ];

		}

	}

	return false;

}

//

// Reusable utility variables

const _tempEuler = new Euler();
const _alignVector = new Vector3( 0, 1, 0 );
const _zeroVector = new Vector3( 0, 0, 0 );
const _lookAtMatrix = new Matrix4();
const _tempQuaternion2 = new Quaternion();
const _identityQuaternion = new Quaternion();
const _dirVector = new Vector3();
const _tempMatrix = new Matrix4();

const _unitX = new Vector3( 1, 0, 0 );
const _unitY = new Vector3( 0, 1, 0 );
const _unitZ = new Vector3( 0, 0, 1 );

const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();

class TransformControlsGizmo extends Object3D {

	constructor() {

		super();

		this.type = 'TransformControlsGizmo';

		// shared materials

		const gizmoMaterial = new MeshBasicMaterial( {
			depthTest: false,
			depthWrite: false,
			fog: false,
			toneMapped: false,
			transparent: true
		} );

		const gizmoLineMaterial = new LineBasicMaterial( {
			depthTest: false,
			depthWrite: false,
			fog: false,
			toneMapped: false,
			transparent: true
		} );

		// Make unique material for each axis/color

		const matInvisible = gizmoMaterial.clone();
		matInvisible.opacity = 0.15;

		const matHelper = gizmoLineMaterial.clone();
		matHelper.opacity = 0.5;

		const matRed = gizmoMaterial.clone();
		matRed.color.setHex( 0xff0000 );

		const matGreen = gizmoMaterial.clone();
		matGreen.color.setHex( 0x00ff00 );

		const matBlue = gizmoMaterial.clone();
		matBlue.color.setHex( 0x0000ff );

		const matRedTransparent = gizmoMaterial.clone();
		matRedTransparent.color.setHex( 0xff0000 );
		matRedTransparent.opacity = 0.5;

		const matGreenTransparent = gizmoMaterial.clone();
		matGreenTransparent.color.setHex( 0x00ff00 );
		matGreenTransparent.opacity = 0.5;

		const matBlueTransparent = gizmoMaterial.clone();
		matBlueTransparent.color.setHex( 0x0000ff );
		matBlueTransparent.opacity = 0.5;

		const matWhiteTransparent = gizmoMaterial.clone();
		matWhiteTransparent.opacity = 0.25;

		const matYellowTransparent = gizmoMaterial.clone();
		matYellowTransparent.color.setHex( 0xffff00 );
		matYellowTransparent.opacity = 0.25;

		const matYellow = gizmoMaterial.clone();
		matYellow.color.setHex( 0xffff00 );

		const matGray = gizmoMaterial.clone();
		matGray.color.setHex( 0x787878 );

		// reusable geometry

		const arrowGeometry = new CylinderGeometry( 0, 0.04, 0.1, 12 );
		arrowGeometry.translate( 0, 0.05, 0 );

		const scaleHandleGeometry = new BoxGeometry( 0.08, 0.08, 0.08 );
		scaleHandleGeometry.translate( 0, 0.04, 0 );

		const lineGeometry = new BufferGeometry();
		lineGeometry.setAttribute( 'position', new Float32BufferAttribute( [ 0, 0, 0,	1, 0, 0 ], 3 ) );

		const lineGeometry2 = new CylinderGeometry( 0.0075, 0.0075, 0.5, 3 );
		lineGeometry2.translate( 0, 0.25, 0 );

		function CircleGeometry( radius, arc ) {

			const geometry = new TorusGeometry( radius, 0.0075, 3, 64, arc * Math.PI * 2 );
			geometry.rotateY( Math.PI / 2 );
			geometry.rotateX( Math.PI / 2 );
			return geometry;

		}

		// Special geometry for transform helper. If scaled with position vector it spans from [0,0,0] to position

		function TranslateHelperGeometry() {

			const geometry = new BufferGeometry();

			geometry.setAttribute( 'position', new Float32BufferAttribute( [ 0, 0, 0, 1, 1, 1 ], 3 ) );

			return geometry;

		}

		// Gizmo definitions - custom hierarchy definitions for setupGizmo() function

		const gizmoTranslate = {
			X: [
				[ new Mesh( arrowGeometry, matRed ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( arrowGeometry, matRed ), [ - 0.5, 0, 0 ], [ 0, 0, Math.PI / 2 ]],
				[ new Mesh( lineGeometry2, matRed ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]
			],
			Y: [
				[ new Mesh( arrowGeometry, matGreen ), [ 0, 0.5, 0 ]],
				[ new Mesh( arrowGeometry, matGreen ), [ 0, - 0.5, 0 ], [ Math.PI, 0, 0 ]],
				[ new Mesh( lineGeometry2, matGreen ) ]
			],
			Z: [
				[ new Mesh( arrowGeometry, matBlue ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( arrowGeometry, matBlue ), [ 0, 0, - 0.5 ], [ - Math.PI / 2, 0, 0 ]],
				[ new Mesh( lineGeometry2, matBlue ), null, [ Math.PI / 2, 0, 0 ]]
			],
			XYZ: [
				[ new Mesh( new OctahedronGeometry( 0.1, 0 ), matWhiteTransparent.clone() ), [ 0, 0, 0 ]]
			],
			XY: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matBlueTransparent.clone() ), [ 0.15, 0.15, 0 ]]
			],
			YZ: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matRedTransparent.clone() ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
			],
			XZ: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matGreenTransparent.clone() ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
			]
		};

		const pickerTranslate = {
			X: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0.3, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ - 0.3, 0, 0 ], [ 0, 0, Math.PI / 2 ]]
			],
			Y: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0.3, 0 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, - 0.3, 0 ], [ 0, 0, Math.PI ]]
			],
			Z: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, 0.3 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, - 0.3 ], [ - Math.PI / 2, 0, 0 ]]
			],
			XYZ: [
				[ new Mesh( new OctahedronGeometry( 0.2, 0 ), matInvisible ) ]
			],
			XY: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0.15, 0 ]]
			],
			YZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
			],
			XZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
			]
		};

		const helperTranslate = {
			START: [
				[ new Mesh( new OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]
			],
			END: [
				[ new Mesh( new OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]
			],
			DELTA: [
				[ new Line( TranslateHelperGeometry(), matHelper ), null, null, null, 'helper' ]
			],
			X: [
				[ new Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
			],
			Y: [
				[ new Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]
			],
			Z: [
				[ new Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]
			]
		};

		const gizmoRotate = {
			XYZE: [
				[ new Mesh( CircleGeometry( 0.5, 1 ), matGray ), null, [ 0, Math.PI / 2, 0 ]]
			],
			X: [
				[ new Mesh( CircleGeometry( 0.5, 0.5 ), matRed ) ]
			],
			Y: [
				[ new Mesh( CircleGeometry( 0.5, 0.5 ), matGreen ), null, [ 0, 0, - Math.PI / 2 ]]
			],
			Z: [
				[ new Mesh( CircleGeometry( 0.5, 0.5 ), matBlue ), null, [ 0, Math.PI / 2, 0 ]]
			],
			E: [
				[ new Mesh( CircleGeometry( 0.75, 1 ), matYellowTransparent ), null, [ 0, Math.PI / 2, 0 ]]
			]
		};

		const helperRotate = {
			AXIS: [
				[ new Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
			]
		};

		const pickerRotate = {
			XYZE: [
				[ new Mesh( new SphereGeometry( 0.25, 10, 8 ), matInvisible ) ]
			],
			X: [
				[ new Mesh( new TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ]],
			],
			Y: [
				[ new Mesh( new TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]],
			],
			Z: [
				[ new Mesh( new TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
			],
			E: [
				[ new Mesh( new TorusGeometry( 0.75, 0.1, 2, 24 ), matInvisible ) ]
			]
		};

		const gizmoScale = {
			X: [
				[ new Mesh( scaleHandleGeometry, matRed ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( lineGeometry2, matRed ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( scaleHandleGeometry, matRed ), [ - 0.5, 0, 0 ], [ 0, 0, Math.PI / 2 ]],
			],
			Y: [
				[ new Mesh( scaleHandleGeometry, matGreen ), [ 0, 0.5, 0 ]],
				[ new Mesh( lineGeometry2, matGreen ) ],
				[ new Mesh( scaleHandleGeometry, matGreen ), [ 0, - 0.5, 0 ], [ 0, 0, Math.PI ]],
			],
			Z: [
				[ new Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( lineGeometry2, matBlue ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, - 0.5 ], [ - Math.PI / 2, 0, 0 ]]
			],
			XY: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matBlueTransparent ), [ 0.15, 0.15, 0 ]]
			],
			YZ: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matRedTransparent ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
			],
			XZ: [
				[ new Mesh( new BoxGeometry( 0.15, 0.15, 0.01 ), matGreenTransparent ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
			],
			XYZ: [
				[ new Mesh( new BoxGeometry( 0.1, 0.1, 0.1 ), matWhiteTransparent.clone() ) ],
			]
		};

		const pickerScale = {
			X: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0.3, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ - 0.3, 0, 0 ], [ 0, 0, Math.PI / 2 ]]
			],
			Y: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0.3, 0 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, - 0.3, 0 ], [ 0, 0, Math.PI ]]
			],
			Z: [
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, 0.3 ], [ Math.PI / 2, 0, 0 ]],
				[ new Mesh( new CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, - 0.3 ], [ - Math.PI / 2, 0, 0 ]]
			],
			XY: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0.15, 0 ]],
			],
			YZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]],
			],
			XZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]],
			],
			XYZ: [
				[ new Mesh( new BoxGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 0, 0, 0 ]],
			]
		};

		const helperScale = {
			X: [
				[ new Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
			],
			Y: [
				[ new Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]
			],
			Z: [
				[ new Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]
			]
		};

		// Creates an Object3D with gizmos described in custom hierarchy definition.

		function setupGizmo( gizmoMap ) {

			const gizmo = new Object3D();

			for ( const name in gizmoMap ) {

				for ( let i = gizmoMap[ name ].length; i --; ) {

					const object = gizmoMap[ name ][ i ][ 0 ].clone();
					const position = gizmoMap[ name ][ i ][ 1 ];
					const rotation = gizmoMap[ name ][ i ][ 2 ];
					const scale = gizmoMap[ name ][ i ][ 3 ];
					const tag = gizmoMap[ name ][ i ][ 4 ];

					// name and tag properties are essential for picking and updating logic.
					object.name = name;
					object.tag = tag;

					if ( position ) {

						object.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );

					}

					if ( rotation ) {

						object.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );

					}

					if ( scale ) {

						object.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );

					}

					object.updateMatrix();

					const tempGeometry = object.geometry.clone();
					tempGeometry.applyMatrix4( object.matrix );
					object.geometry = tempGeometry;
					object.renderOrder = Infinity;

					object.position.set( 0, 0, 0 );
					object.rotation.set( 0, 0, 0 );
					object.scale.set( 1, 1, 1 );

					gizmo.add( object );

				}

			}

			return gizmo;

		}

		// Gizmo creation

		this.gizmo = {};
		this.picker = {};
		this.helper = {};

		this.add( this.gizmo[ 'translate' ] = setupGizmo( gizmoTranslate ) );
		this.add( this.gizmo[ 'rotate' ] = setupGizmo( gizmoRotate ) );
		this.add( this.gizmo[ 'scale' ] = setupGizmo( gizmoScale ) );
		this.add( this.picker[ 'translate' ] = setupGizmo( pickerTranslate ) );
		this.add( this.picker[ 'rotate' ] = setupGizmo( pickerRotate ) );
		this.add( this.picker[ 'scale' ] = setupGizmo( pickerScale ) );
		this.add( this.helper[ 'translate' ] = setupGizmo( helperTranslate ) );
		this.add( this.helper[ 'rotate' ] = setupGizmo( helperRotate ) );
		this.add( this.helper[ 'scale' ] = setupGizmo( helperScale ) );

		// Pickers should be hidden always

		this.picker[ 'translate' ].visible = false;
		this.picker[ 'rotate' ].visible = false;
		this.picker[ 'scale' ].visible = false;

	}

	// updateMatrixWorld will update transformations and appearance of individual handles

	updateMatrixWorld( force ) {

		const space = ( this.mode === 'scale' ) ? 'local' : this.space; // scale always oriented to local rotation

		const quaternion = ( space === 'local' ) ? this.worldQuaternion : _identityQuaternion;

		// Show only gizmos for current transform mode

		this.gizmo[ 'translate' ].visible = this.mode === 'translate';
		this.gizmo[ 'rotate' ].visible = this.mode === 'rotate';
		this.gizmo[ 'scale' ].visible = this.mode === 'scale';

		this.helper[ 'translate' ].visible = this.mode === 'translate';
		this.helper[ 'rotate' ].visible = this.mode === 'rotate';
		this.helper[ 'scale' ].visible = this.mode === 'scale';


		let handles = [];
		handles = handles.concat( this.picker[ this.mode ].children );
		handles = handles.concat( this.gizmo[ this.mode ].children );
		handles = handles.concat( this.helper[ this.mode ].children );

		for ( let i = 0; i < handles.length; i ++ ) {

			const handle = handles[ i ];

			// hide aligned to camera

			handle.visible = true;
			handle.rotation.set( 0, 0, 0 );
			handle.position.copy( this.worldPosition );

			let factor;

			if ( this.camera.isOrthographicCamera ) {

				factor = ( this.camera.top - this.camera.bottom ) / this.camera.zoom;

			} else {

				factor = this.worldPosition.distanceTo( this.cameraPosition ) * Math.min( 1.9 * Math.tan( Math.PI * this.camera.fov / 360 ) / this.camera.zoom, 7 );

			}

			handle.scale.set( 1, 1, 1 ).multiplyScalar( factor * this.size / 4 );

			// TODO: simplify helpers and consider decoupling from gizmo

			if ( handle.tag === 'helper' ) {

				handle.visible = false;

				if ( handle.name === 'AXIS' ) {

					handle.position.copy( this.worldPositionStart );
					handle.visible = !! this.axis;

					if ( this.axis === 'X' ) {

						_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, 0 ) );
						handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

						if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'Y' ) {

						_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, Math.PI / 2 ) );
						handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

						if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'Z' ) {

						_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );
						handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

						if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'XYZE' ) {

						_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );
						_alignVector.copy( this.rotationAxis );
						handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( _zeroVector, _alignVector, _unitY ) );
						handle.quaternion.multiply( _tempQuaternion );
						handle.visible = this.dragging;

					}

					if ( this.axis === 'E' ) {

						handle.visible = false;

					}


				} else if ( handle.name === 'START' ) {

					handle.position.copy( this.worldPositionStart );
					handle.visible = this.dragging;

				} else if ( handle.name === 'END' ) {

					handle.position.copy( this.worldPosition );
					handle.visible = this.dragging;

				} else if ( handle.name === 'DELTA' ) {

					handle.position.copy( this.worldPositionStart );
					handle.quaternion.copy( this.worldQuaternionStart );
					_tempVector.set( 1e-10, 1e-10, 1e-10 ).add( this.worldPositionStart ).sub( this.worldPosition ).multiplyScalar( - 1 );
					_tempVector.applyQuaternion( this.worldQuaternionStart.clone().invert() );
					handle.scale.copy( _tempVector );
					handle.visible = this.dragging;

				} else {

					handle.quaternion.copy( quaternion );

					if ( this.dragging ) {

						handle.position.copy( this.worldPositionStart );

					} else {

						handle.position.copy( this.worldPosition );

					}

					if ( this.axis ) {

						handle.visible = this.axis.search( handle.name ) !== - 1;

					}

				}

				// If updating helper, skip rest of the loop
				continue;

			}

			// Align handles to current local or world rotation

			handle.quaternion.copy( quaternion );

			if ( this.mode === 'translate' || this.mode === 'scale' ) {

				// Hide translate and scale axis facing the camera

				const AXIS_HIDE_TRESHOLD = 0.99;
				const PLANE_HIDE_TRESHOLD = 0.2;

				if ( handle.name === 'X' ) {

					if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'Y' ) {

					if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'Z' ) {

					if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'XY' ) {

					if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'YZ' ) {

					if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'XZ' ) {

					if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

			} else if ( this.mode === 'rotate' ) {

				// Align handles to current local or world rotation

				_tempQuaternion2.copy( quaternion );
				_alignVector.copy( this.eye ).applyQuaternion( _tempQuaternion.copy( quaternion ).invert() );

				if ( handle.name.search( 'E' ) !== - 1 ) {

					handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( this.eye, _zeroVector, _unitY ) );

				}

				if ( handle.name === 'X' ) {

					_tempQuaternion.setFromAxisAngle( _unitX, Math.atan2( - _alignVector.y, _alignVector.z ) );
					_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
					handle.quaternion.copy( _tempQuaternion );

				}

				if ( handle.name === 'Y' ) {

					_tempQuaternion.setFromAxisAngle( _unitY, Math.atan2( _alignVector.x, _alignVector.z ) );
					_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
					handle.quaternion.copy( _tempQuaternion );

				}

				if ( handle.name === 'Z' ) {

					_tempQuaternion.setFromAxisAngle( _unitZ, Math.atan2( _alignVector.y, _alignVector.x ) );
					_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
					handle.quaternion.copy( _tempQuaternion );

				}

			}

			// Hide disabled axes
			handle.visible = handle.visible && ( handle.name.indexOf( 'X' ) === - 1 || this.showX );
			handle.visible = handle.visible && ( handle.name.indexOf( 'Y' ) === - 1 || this.showY );
			handle.visible = handle.visible && ( handle.name.indexOf( 'Z' ) === - 1 || this.showZ );
			handle.visible = handle.visible && ( handle.name.indexOf( 'E' ) === - 1 || ( this.showX && this.showY && this.showZ ) );

			// highlight selected axis

			handle.material._color = handle.material._color || handle.material.color.clone();
			handle.material._opacity = handle.material._opacity || handle.material.opacity;

			handle.material.color.copy( handle.material._color );
			handle.material.opacity = handle.material._opacity;

			if ( this.enabled && this.axis ) {

				if ( handle.name === this.axis ) {

					handle.material.color.setHex( 0xffff00 );
					handle.material.opacity = 1.0;

				} else if ( this.axis.split( '' ).some( function ( a ) {

					return handle.name === a;

				} ) ) {

					handle.material.color.setHex( 0xffff00 );
					handle.material.opacity = 1.0;

				}

			}

		}

		super.updateMatrixWorld( force );

	}

}

TransformControlsGizmo.prototype.isTransformControlsGizmo = true;

//

class TransformControlsPlane extends Mesh {

	constructor() {

		super(
			new PlaneGeometry( 100000, 100000, 2, 2 ),
			new MeshBasicMaterial( { visible: false, wireframe: true, side: DoubleSide, transparent: true, opacity: 0.1, toneMapped: false } )
		);

		this.type = 'TransformControlsPlane';

	}

	updateMatrixWorld( force ) {

		let space = this.space;

		this.position.copy( this.worldPosition );

		if ( this.mode === 'scale' ) space = 'local'; // scale always oriented to local rotation

		_v1.copy( _unitX ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );
		_v2.copy( _unitY ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );
		_v3.copy( _unitZ ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );

		// Align the plane for current transform mode, axis and space.

		_alignVector.copy( _v2 );

		switch ( this.mode ) {

			case 'translate':
			case 'scale':
				switch ( this.axis ) {

					case 'X':
						_alignVector.copy( this.eye ).cross( _v1 );
						_dirVector.copy( _v1 ).cross( _alignVector );
						break;
					case 'Y':
						_alignVector.copy( this.eye ).cross( _v2 );
						_dirVector.copy( _v2 ).cross( _alignVector );
						break;
					case 'Z':
						_alignVector.copy( this.eye ).cross( _v3 );
						_dirVector.copy( _v3 ).cross( _alignVector );
						break;
					case 'XY':
						_dirVector.copy( _v3 );
						break;
					case 'YZ':
						_dirVector.copy( _v1 );
						break;
					case 'XZ':
						_alignVector.copy( _v3 );
						_dirVector.copy( _v2 );
						break;
					case 'XYZ':
					case 'E':
						_dirVector.set( 0, 0, 0 );
						break;

				}

				break;
			case 'rotate':
			default:
				// special case for rotate
				_dirVector.set( 0, 0, 0 );

		}

		if ( _dirVector.length() === 0 ) {

			// If in rotate mode, make the plane parallel to camera
			this.quaternion.copy( this.cameraQuaternion );

		} else {

			_tempMatrix.lookAt( _tempVector.set( 0, 0, 0 ), _dirVector, _alignVector );

			this.quaternion.setFromRotationMatrix( _tempMatrix );

		}

		super.updateMatrixWorld( force );

	}

}

TransformControlsPlane.prototype.isTransformControlsPlane = true;

/*********************************/
/********** INTERPOLATION ********/
/*********************************/

// Spline Interpolation
// Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation
class GLTFCubicSplineInterpolant extends Interpolant {

	constructor( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

		super( parameterPositions, sampleValues, sampleSize, resultBuffer );

	}

	copySampleValue_( index ) {

		// Copies a sample value to the result buffer. See description of glTF
		// CUBICSPLINE values layout in interpolate_() function below.

		const result = this.resultBuffer,
			values = this.sampleValues,
			valueSize = this.valueSize,
			offset = index * valueSize * 3 + valueSize;

		for ( let i = 0; i !== valueSize; i ++ ) {

			result[ i ] = values[ offset + i ];

		}

		return result;

	}

}

GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

GLTFCubicSplineInterpolant.prototype.interpolate_ = function ( i1, t0, t, t1 ) {

	const result = this.resultBuffer;
	const values = this.sampleValues;
	const stride = this.valueSize;

	const stride2 = stride * 2;
	const stride3 = stride * 3;

	const td = t1 - t0;

	const p = ( t - t0 ) / td;
	const pp = p * p;
	const ppp = pp * p;

	const offset1 = i1 * stride3;
	const offset0 = offset1 - stride3;

	const s2 = - 2 * ppp + 3 * pp;
	const s3 = ppp - pp;
	const s0 = 1 - s2;
	const s1 = s3 - pp + p;

	// Layout of keyframe output values for CUBICSPLINE animations:
	//   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]
	for ( let i = 0; i !== stride; i ++ ) {

		const p0 = values[ offset0 + i + stride ]; // splineVertex_k
		const m0 = values[ offset0 + i + stride2 ] * td; // outTangent_k * (t_k+1 - t_k)
		const p1 = values[ offset1 + i + stride ]; // splineVertex_k+1
		const m1 = values[ offset1 + i ] * td; // inTangent_k+1 * (t_k+1 - t_k)

		result[ i ] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

	}

	return result;

};

new Quaternion();

const int32 = new Int32Array(2);
new Float32Array(int32.buffer);
new Float64Array(int32.buffer);
new Uint16Array(new Uint8Array([1, 0]).buffer)[0] === 1;

var Encoding;
(function (Encoding) {
    Encoding[Encoding["UTF8_BYTES"] = 1] = "UTF8_BYTES";
    Encoding[Encoding["UTF16_STRING"] = 2] = "UTF16_STRING";
})(Encoding || (Encoding = {}));

var __require = (x) => {
  if (typeof require !== "undefined")
    return require(x);
  throw new Error('Dynamic require of "' + x + '" is not supported');
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// dist/web-ifc-mt.js
var require_web_ifc_mt = __commonJS({
  "dist/web-ifc-mt.js"(exports, module) {
    var WebIFCWasm2 = function() {
      var _scriptDir = typeof document !== "undefined" && document.currentScript ? document.currentScript.src : void 0;
      if (typeof __filename !== "undefined")
        _scriptDir = _scriptDir || __filename;
      return function(WebIFCWasm3) {
        WebIFCWasm3 = WebIFCWasm3 || {};
        function GROWABLE_HEAP_I8() {
          if (wasmMemory.buffer != buffer) {
            updateGlobalBufferAndViews(wasmMemory.buffer);
          }
          return HEAP8;
        }
        function GROWABLE_HEAP_U8() {
          if (wasmMemory.buffer != buffer) {
            updateGlobalBufferAndViews(wasmMemory.buffer);
          }
          return HEAPU8;
        }
        function GROWABLE_HEAP_I16() {
          if (wasmMemory.buffer != buffer) {
            updateGlobalBufferAndViews(wasmMemory.buffer);
          }
          return HEAP16;
        }
        function GROWABLE_HEAP_U16() {
          if (wasmMemory.buffer != buffer) {
            updateGlobalBufferAndViews(wasmMemory.buffer);
          }
          return HEAPU16;
        }
        function GROWABLE_HEAP_I32() {
          if (wasmMemory.buffer != buffer) {
            updateGlobalBufferAndViews(wasmMemory.buffer);
          }
          return HEAP32;
        }
        function GROWABLE_HEAP_U32() {
          if (wasmMemory.buffer != buffer) {
            updateGlobalBufferAndViews(wasmMemory.buffer);
          }
          return HEAPU32;
        }
        function GROWABLE_HEAP_F32() {
          if (wasmMemory.buffer != buffer) {
            updateGlobalBufferAndViews(wasmMemory.buffer);
          }
          return HEAPF32;
        }
        function GROWABLE_HEAP_F64() {
          if (wasmMemory.buffer != buffer) {
            updateGlobalBufferAndViews(wasmMemory.buffer);
          }
          return HEAPF64;
        }
        var Module = typeof WebIFCWasm3 !== "undefined" ? WebIFCWasm3 : {};
        var readyPromiseResolve, readyPromiseReject;
        Module["ready"] = new Promise(function(resolve, reject) {
          readyPromiseResolve = resolve;
          readyPromiseReject = reject;
        });
        var moduleOverrides = {};
        var key;
        for (key in Module) {
          if (Module.hasOwnProperty(key)) {
            moduleOverrides[key] = Module[key];
          }
        }
        var thisProgram = "./this.program";
        var quit_ = function(status, toThrow) {
          throw toThrow;
        };
        var ENVIRONMENT_IS_WEB = typeof window === "object";
        var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
        var ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
        var ENVIRONMENT_IS_PTHREAD = Module["ENVIRONMENT_IS_PTHREAD"] || false;
        var scriptDirectory = "";
        function locateFile(path) {
          if (Module["locateFile"]) {
            return Module["locateFile"](path, scriptDirectory);
          }
          return scriptDirectory + path;
        }
        var read_, readAsync, readBinary;
        var nodeFS;
        var nodePath;
        if (ENVIRONMENT_IS_NODE) {
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = __require("path").dirname(scriptDirectory) + "/";
          } else {
            scriptDirectory = __dirname + "/";
          }
          read_ = function shell_read(filename, binary) {
            if (!nodeFS)
              nodeFS = __require("fs");
            if (!nodePath)
              nodePath = __require("path");
            filename = nodePath["normalize"](filename);
            return nodeFS["readFileSync"](filename, binary ? null : "utf8");
          };
          readBinary = function readBinary2(filename) {
            var ret = read_(filename, true);
            if (!ret.buffer) {
              ret = new Uint8Array(ret);
            }
            assert(ret.buffer);
            return ret;
          };
          readAsync = function readAsync2(filename, onload, onerror) {
            if (!nodeFS)
              nodeFS = __require("fs");
            if (!nodePath)
              nodePath = __require("path");
            filename = nodePath["normalize"](filename);
            nodeFS["readFile"](filename, function(err2, data) {
              if (err2)
                onerror(err2);
              else
                onload(data.buffer);
            });
          };
          if (process["argv"].length > 1) {
            thisProgram = process["argv"][1].replace(/\\/g, "/");
          }
          process["argv"].slice(2);
          process["on"]("uncaughtException", function(ex) {
            if (!(ex instanceof ExitStatus)) {
              throw ex;
            }
          });
          process["on"]("unhandledRejection", abort);
          quit_ = function(status, toThrow) {
            if (keepRuntimeAlive()) {
              process["exitCode"] = status;
              throw toThrow;
            }
            process["exit"](status);
          };
          Module["inspect"] = function() {
            return "[Emscripten Module object]";
          };
          var nodeWorkerThreads;
          try {
            nodeWorkerThreads = __require("worker_threads");
          } catch (e) {
            console.error('The "worker_threads" module is not supported in this node.js build - perhaps a newer version is needed?');
            throw e;
          }
          global.Worker = nodeWorkerThreads.Worker;
        } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = self.location.href;
          } else if (typeof document !== "undefined" && document.currentScript) {
            scriptDirectory = document.currentScript.src;
          }
          if (_scriptDir) {
            scriptDirectory = _scriptDir;
          }
          if (scriptDirectory.indexOf("blob:") !== 0) {
            scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
          } else {
            scriptDirectory = "";
          }
          if (ENVIRONMENT_IS_NODE) {
            read_ = function shell_read(filename, binary) {
              if (!nodeFS)
                nodeFS = __require("fs");
              if (!nodePath)
                nodePath = __require("path");
              filename = nodePath["normalize"](filename);
              return nodeFS["readFileSync"](filename, binary ? null : "utf8");
            };
            readBinary = function readBinary2(filename) {
              var ret = read_(filename, true);
              if (!ret.buffer) {
                ret = new Uint8Array(ret);
              }
              assert(ret.buffer);
              return ret;
            };
            readAsync = function readAsync2(filename, onload, onerror) {
              if (!nodeFS)
                nodeFS = __require("fs");
              if (!nodePath)
                nodePath = __require("path");
              filename = nodePath["normalize"](filename);
              nodeFS["readFile"](filename, function(err2, data) {
                if (err2)
                  onerror(err2);
                else
                  onload(data.buffer);
              });
            };
          } else {
            read_ = function(url) {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, false);
              xhr.send(null);
              return xhr.responseText;
            };
            if (ENVIRONMENT_IS_WORKER) {
              readBinary = function(url) {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(xhr.response);
              };
            }
            readAsync = function(url, onload, onerror) {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, true);
              xhr.responseType = "arraybuffer";
              xhr.onload = function() {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                  onload(xhr.response);
                  return;
                }
                onerror();
              };
              xhr.onerror = onerror;
              xhr.send(null);
            };
          }
        } else ;
        if (ENVIRONMENT_IS_NODE) {
          if (typeof performance === "undefined") {
            global.performance = __require("perf_hooks").performance;
          }
        }
        var out = Module["print"] || console.log.bind(console);
        var err = Module["printErr"] || console.warn.bind(console);
        for (key in moduleOverrides) {
          if (moduleOverrides.hasOwnProperty(key)) {
            Module[key] = moduleOverrides[key];
          }
        }
        moduleOverrides = null;
        if (Module["arguments"])
          Module["arguments"];
        if (Module["thisProgram"])
          thisProgram = Module["thisProgram"];
        if (Module["quit"])
          quit_ = Module["quit"];
        var STACK_ALIGN = 16;
        function alignMemory(size, factor) {
          if (!factor)
            factor = STACK_ALIGN;
          return Math.ceil(size / factor) * factor;
        }
        function warnOnce(text) {
          if (!warnOnce.shown)
            warnOnce.shown = {};
          if (!warnOnce.shown[text]) {
            warnOnce.shown[text] = 1;
            err(text);
          }
        }
        var tempRet0 = 0;
        var setTempRet0 = function(value) {
          tempRet0 = value;
        };
        var getTempRet0 = function() {
          return tempRet0;
        };
        var wasmBinary;
        if (Module["wasmBinary"])
          wasmBinary = Module["wasmBinary"];
        var noExitRuntime = Module["noExitRuntime"] || true;
        if (typeof WebAssembly !== "object") {
          abort("no native wasm support detected");
        }
        var wasmMemory;
        var wasmModule;
        var ABORT = false;
        function assert(condition, text) {
          if (!condition) {
            abort("Assertion failed: " + text);
          }
        }
        function TextDecoderWrapper(encoding) {
          var textDecoder = new TextDecoder(encoding);
          this.decode = function(data) {
            if (data.buffer instanceof SharedArrayBuffer) {
              data = new Uint8Array(data);
            }
            return textDecoder.decode.call(textDecoder, data);
          };
        }
        var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoderWrapper("utf8") : void 0;
        function UTF8ArrayToString(heap, idx, maxBytesToRead) {
          idx >>>= 0;
          var endIdx = idx + maxBytesToRead;
          var endPtr = idx;
          while (heap[endPtr >>> 0] && !(endPtr >= endIdx))
            ++endPtr;
          if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
            return UTF8Decoder.decode(heap.subarray(idx >>> 0, endPtr >>> 0));
          } else {
            var str = "";
            while (idx < endPtr) {
              var u0 = heap[idx++ >>> 0];
              if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue;
              }
              var u1 = heap[idx++ >>> 0] & 63;
              if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue;
              }
              var u2 = heap[idx++ >>> 0] & 63;
              if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2;
              } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++ >>> 0] & 63;
              }
              if (u0 < 65536) {
                str += String.fromCharCode(u0);
              } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
              }
            }
          }
          return str;
        }
        function UTF8ToString(ptr, maxBytesToRead) {
          ptr >>>= 0;
          return ptr ? UTF8ArrayToString(GROWABLE_HEAP_U8(), ptr, maxBytesToRead) : "";
        }
        function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
          outIdx >>>= 0;
          if (!(maxBytesToWrite > 0))
            return 0;
          var startIdx = outIdx;
          var endIdx = outIdx + maxBytesToWrite - 1;
          for (var i = 0; i < str.length; ++i) {
            var u = str.charCodeAt(i);
            if (u >= 55296 && u <= 57343) {
              var u1 = str.charCodeAt(++i);
              u = 65536 + ((u & 1023) << 10) | u1 & 1023;
            }
            if (u <= 127) {
              if (outIdx >= endIdx)
                break;
              heap[outIdx++ >>> 0] = u;
            } else if (u <= 2047) {
              if (outIdx + 1 >= endIdx)
                break;
              heap[outIdx++ >>> 0] = 192 | u >> 6;
              heap[outIdx++ >>> 0] = 128 | u & 63;
            } else if (u <= 65535) {
              if (outIdx + 2 >= endIdx)
                break;
              heap[outIdx++ >>> 0] = 224 | u >> 12;
              heap[outIdx++ >>> 0] = 128 | u >> 6 & 63;
              heap[outIdx++ >>> 0] = 128 | u & 63;
            } else {
              if (outIdx + 3 >= endIdx)
                break;
              heap[outIdx++ >>> 0] = 240 | u >> 18;
              heap[outIdx++ >>> 0] = 128 | u >> 12 & 63;
              heap[outIdx++ >>> 0] = 128 | u >> 6 & 63;
              heap[outIdx++ >>> 0] = 128 | u & 63;
            }
          }
          heap[outIdx >>> 0] = 0;
          return outIdx - startIdx;
        }
        function stringToUTF8(str, outPtr, maxBytesToWrite) {
          return stringToUTF8Array(str, GROWABLE_HEAP_U8(), outPtr, maxBytesToWrite);
        }
        function lengthBytesUTF8(str) {
          var len = 0;
          for (var i = 0; i < str.length; ++i) {
            var u = str.charCodeAt(i);
            if (u >= 55296 && u <= 57343)
              u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
            if (u <= 127)
              ++len;
            else if (u <= 2047)
              len += 2;
            else if (u <= 65535)
              len += 3;
            else
              len += 4;
          }
          return len;
        }
        var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoderWrapper("utf-16le") : void 0;
        function UTF16ToString(ptr, maxBytesToRead) {
          var endPtr = ptr;
          var idx = endPtr >> 1;
          var maxIdx = idx + maxBytesToRead / 2;
          while (!(idx >= maxIdx) && GROWABLE_HEAP_U16()[idx >>> 0])
            ++idx;
          endPtr = idx << 1;
          if (endPtr - ptr > 32 && UTF16Decoder) {
            return UTF16Decoder.decode(GROWABLE_HEAP_U8().subarray(ptr >>> 0, endPtr >>> 0));
          } else {
            var str = "";
            for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
              var codeUnit = GROWABLE_HEAP_I16()[ptr + i * 2 >>> 1];
              if (codeUnit == 0)
                break;
              str += String.fromCharCode(codeUnit);
            }
            return str;
          }
        }
        function stringToUTF16(str, outPtr, maxBytesToWrite) {
          if (maxBytesToWrite === void 0) {
            maxBytesToWrite = 2147483647;
          }
          if (maxBytesToWrite < 2)
            return 0;
          maxBytesToWrite -= 2;
          var startPtr = outPtr;
          var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
          for (var i = 0; i < numCharsToWrite; ++i) {
            var codeUnit = str.charCodeAt(i);
            GROWABLE_HEAP_I16()[outPtr >>> 1] = codeUnit;
            outPtr += 2;
          }
          GROWABLE_HEAP_I16()[outPtr >>> 1] = 0;
          return outPtr - startPtr;
        }
        function lengthBytesUTF16(str) {
          return str.length * 2;
        }
        function UTF32ToString(ptr, maxBytesToRead) {
          var i = 0;
          var str = "";
          while (!(i >= maxBytesToRead / 4)) {
            var utf32 = GROWABLE_HEAP_I32()[ptr + i * 4 >>> 2];
            if (utf32 == 0)
              break;
            ++i;
            if (utf32 >= 65536) {
              var ch = utf32 - 65536;
              str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
            } else {
              str += String.fromCharCode(utf32);
            }
          }
          return str;
        }
        function stringToUTF32(str, outPtr, maxBytesToWrite) {
          outPtr >>>= 0;
          if (maxBytesToWrite === void 0) {
            maxBytesToWrite = 2147483647;
          }
          if (maxBytesToWrite < 4)
            return 0;
          var startPtr = outPtr;
          var endPtr = startPtr + maxBytesToWrite - 4;
          for (var i = 0; i < str.length; ++i) {
            var codeUnit = str.charCodeAt(i);
            if (codeUnit >= 55296 && codeUnit <= 57343) {
              var trailSurrogate = str.charCodeAt(++i);
              codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
            }
            GROWABLE_HEAP_I32()[outPtr >>> 2] = codeUnit;
            outPtr += 4;
            if (outPtr + 4 > endPtr)
              break;
          }
          GROWABLE_HEAP_I32()[outPtr >>> 2] = 0;
          return outPtr - startPtr;
        }
        function lengthBytesUTF32(str) {
          var len = 0;
          for (var i = 0; i < str.length; ++i) {
            var codeUnit = str.charCodeAt(i);
            if (codeUnit >= 55296 && codeUnit <= 57343)
              ++i;
            len += 4;
          }
          return len;
        }
        function writeArrayToMemory(array, buffer2) {
          GROWABLE_HEAP_I8().set(array, buffer2 >>> 0);
        }
        function writeAsciiToMemory(str, buffer2, dontAddNull) {
          for (var i = 0; i < str.length; ++i) {
            GROWABLE_HEAP_I8()[buffer2++ >>> 0] = str.charCodeAt(i);
          }
          if (!dontAddNull)
            GROWABLE_HEAP_I8()[buffer2 >>> 0] = 0;
        }
        function alignUp(x, multiple) {
          if (x % multiple > 0) {
            x += multiple - x % multiple;
          }
          return x;
        }
        var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
        if (ENVIRONMENT_IS_PTHREAD) {
          buffer = Module["buffer"];
        }
        function updateGlobalBufferAndViews(buf) {
          buffer = buf;
          Module["HEAP8"] = HEAP8 = new Int8Array(buf);
          Module["HEAP16"] = HEAP16 = new Int16Array(buf);
          Module["HEAP32"] = HEAP32 = new Int32Array(buf);
          Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
          Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
          Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
          Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
          Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
        }
        var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;
        if (ENVIRONMENT_IS_PTHREAD) {
          wasmMemory = Module["wasmMemory"];
          buffer = Module["buffer"];
        } else {
          if (Module["wasmMemory"]) {
            wasmMemory = Module["wasmMemory"];
          } else {
            wasmMemory = new WebAssembly.Memory({ "initial": INITIAL_MEMORY / 65536, "maximum": 4294967296 / 65536, "shared": true });
            if (!(wasmMemory.buffer instanceof SharedArrayBuffer)) {
              err("requested a shared WebAssembly.Memory but the returned buffer is not a SharedArrayBuffer, indicating that while the browser has SharedArrayBuffer it does not have WebAssembly threads support - you may need to set a flag");
              if (ENVIRONMENT_IS_NODE) {
                console.log("(on node you may need: --experimental-wasm-threads --experimental-wasm-bulk-memory and also use a recent version)");
              }
              throw Error("bad memory");
            }
          }
        }
        if (wasmMemory) {
          buffer = wasmMemory.buffer;
        }
        INITIAL_MEMORY = buffer.byteLength;
        updateGlobalBufferAndViews(buffer);
        var wasmTable;
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATMAIN__ = [];
        var __ATPOSTRUN__ = [];
        var runtimeKeepaliveCounter = 0;
        function keepRuntimeAlive() {
          return noExitRuntime || runtimeKeepaliveCounter > 0;
        }
        function preRun() {
          if (ENVIRONMENT_IS_PTHREAD)
            return;
          if (Module["preRun"]) {
            if (typeof Module["preRun"] == "function")
              Module["preRun"] = [Module["preRun"]];
            while (Module["preRun"].length) {
              addOnPreRun(Module["preRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPRERUN__);
        }
        function initRuntime() {
          if (ENVIRONMENT_IS_PTHREAD)
            return;
          if (!Module["noFSInit"] && !FS.init.initialized)
            FS.init();
          FS.ignorePermissions = false;
          callRuntimeCallbacks(__ATINIT__);
        }
        function preMain() {
          if (ENVIRONMENT_IS_PTHREAD)
            return;
          callRuntimeCallbacks(__ATMAIN__);
        }
        function postRun() {
          if (ENVIRONMENT_IS_PTHREAD)
            return;
          if (Module["postRun"]) {
            if (typeof Module["postRun"] == "function")
              Module["postRun"] = [Module["postRun"]];
            while (Module["postRun"].length) {
              addOnPostRun(Module["postRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPOSTRUN__);
        }
        function addOnPreRun(cb) {
          __ATPRERUN__.unshift(cb);
        }
        function addOnInit(cb) {
          __ATINIT__.unshift(cb);
        }
        function addOnPostRun(cb) {
          __ATPOSTRUN__.unshift(cb);
        }
        var runDependencies = 0;
        var dependenciesFulfilled = null;
        function getUniqueRunDependency(id) {
          return id;
        }
        function addRunDependency(id) {
          runDependencies++;
          if (Module["monitorRunDependencies"]) {
            Module["monitorRunDependencies"](runDependencies);
          }
        }
        function removeRunDependency(id) {
          runDependencies--;
          if (Module["monitorRunDependencies"]) {
            Module["monitorRunDependencies"](runDependencies);
          }
          if (runDependencies == 0) {
            if (dependenciesFulfilled) {
              var callback = dependenciesFulfilled;
              dependenciesFulfilled = null;
              callback();
            }
          }
        }
        Module["preloadedImages"] = {};
        Module["preloadedAudios"] = {};
        function abort(what) {
          if (Module["onAbort"]) {
            Module["onAbort"](what);
          }
          if (ENVIRONMENT_IS_PTHREAD)
            console.error("Pthread aborting at " + new Error().stack);
          what += "";
          err(what);
          ABORT = true;
          what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
          var e = new WebAssembly.RuntimeError(what);
          readyPromiseReject(e);
          throw e;
        }
        var dataURIPrefix = "data:application/octet-stream;base64,";
        function isDataURI(filename) {
          return filename.startsWith(dataURIPrefix);
        }
        function isFileURI(filename) {
          return filename.startsWith("file://");
        }
        var wasmBinaryFile;
        wasmBinaryFile = "web-ifc-mt.wasm";
        if (!isDataURI(wasmBinaryFile)) {
          wasmBinaryFile = locateFile(wasmBinaryFile);
        }
        function getBinary(file) {
          try {
            if (file == wasmBinaryFile && wasmBinary) {
              return new Uint8Array(wasmBinary);
            }
            if (readBinary) {
              return readBinary(file);
            } else {
              throw "both async and sync fetching of the wasm failed";
            }
          } catch (err2) {
            abort(err2);
          }
        }
        function getBinaryPromise() {
          if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
            if (typeof fetch === "function" && !isFileURI(wasmBinaryFile)) {
              return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
                if (!response["ok"]) {
                  throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
                }
                return response["arrayBuffer"]();
              }).catch(function() {
                return getBinary(wasmBinaryFile);
              });
            } else {
              if (readAsync) {
                return new Promise(function(resolve, reject) {
                  readAsync(wasmBinaryFile, function(response) {
                    resolve(new Uint8Array(response));
                  }, reject);
                });
              }
            }
          }
          return Promise.resolve().then(function() {
            return getBinary(wasmBinaryFile);
          });
        }
        function createWasm() {
          var info = { "a": asmLibraryArg };
          function receiveInstance(instance, module2) {
            var exports3 = instance.exports;
            Module["asm"] = exports3;
            wasmTable = Module["asm"]["db"];
            addOnInit(Module["asm"]["ab"]);
            PThread.tlsInitFunctions.push(Module["asm"]["fb"]);
            wasmModule = module2;
            if (!ENVIRONMENT_IS_PTHREAD) {
              var numWorkersToLoad = PThread.unusedWorkers.length;
              PThread.unusedWorkers.forEach(function(w) {
                PThread.loadWasmModuleToWorker(w, function() {
                  if (!--numWorkersToLoad)
                    removeRunDependency();
                });
              });
            }
          }
          if (!ENVIRONMENT_IS_PTHREAD) {
            addRunDependency();
          }
          function receiveInstantiationResult(result) {
            receiveInstance(result["instance"], result["module"]);
          }
          function instantiateArrayBuffer(receiver) {
            return getBinaryPromise().then(function(binary) {
              var result = WebAssembly.instantiate(binary, info);
              return result;
            }).then(receiver, function(reason) {
              err("failed to asynchronously prepare wasm: " + reason);
              abort(reason);
            });
          }
          function instantiateAsync() {
            if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && typeof fetch === "function") {
              return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
                var result = WebAssembly.instantiateStreaming(response, info);
                return result.then(receiveInstantiationResult, function(reason) {
                  err("wasm streaming compile failed: " + reason);
                  err("falling back to ArrayBuffer instantiation");
                  return instantiateArrayBuffer(receiveInstantiationResult);
                });
              });
            } else {
              return instantiateArrayBuffer(receiveInstantiationResult);
            }
          }
          if (Module["instantiateWasm"]) {
            try {
              var exports2 = Module["instantiateWasm"](info, receiveInstance);
              return exports2;
            } catch (e) {
              err("Module.instantiateWasm callback failed with error: " + e);
              return false;
            }
          }
          instantiateAsync().catch(readyPromiseReject);
          return {};
        }
        var tempDouble;
        var tempI64;
        var ASM_CONSTS = { 56684: function() {
          throw "Canceled!";
        }, 56702: function($0, $1) {
          setTimeout(function() {
            __emscripten_do_dispatch_to_thread($0, $1);
          }, 0);
        } };
        function initPthreadsJS() {
          PThread.initRuntime();
        }
        function callRuntimeCallbacks(callbacks) {
          while (callbacks.length > 0) {
            var callback = callbacks.shift();
            if (typeof callback == "function") {
              callback(Module);
              continue;
            }
            var func = callback.func;
            if (typeof func === "number") {
              if (callback.arg === void 0) {
                wasmTable.get(func)();
              } else {
                wasmTable.get(func)(callback.arg);
              }
            } else {
              func(callback.arg === void 0 ? null : callback.arg);
            }
          }
        }
        function _emscripten_futex_wake(addr, count) {
          if (addr <= 0 || addr > GROWABLE_HEAP_I8().length || addr & true || count < 0)
            return -28;
          if (count == 0)
            return 0;
          if (count >= 2147483647)
            count = Infinity;
          var mainThreadWaitAddress = Atomics.load(GROWABLE_HEAP_I32(), __emscripten_main_thread_futex >> 2);
          var mainThreadWoken = 0;
          if (mainThreadWaitAddress == addr) {
            var loadedAddr = Atomics.compareExchange(GROWABLE_HEAP_I32(), __emscripten_main_thread_futex >> 2, mainThreadWaitAddress, 0);
            if (loadedAddr == mainThreadWaitAddress) {
              --count;
              mainThreadWoken = 1;
              if (count <= 0)
                return 1;
            }
          }
          var ret = Atomics.notify(GROWABLE_HEAP_I32(), addr >> 2, count);
          if (ret >= 0)
            return ret + mainThreadWoken;
          throw "Atomics.notify returned an unexpected value " + ret;
        }
        Module["_emscripten_futex_wake"] = _emscripten_futex_wake;
        function killThread(pthread_ptr) {
          if (ENVIRONMENT_IS_PTHREAD)
            throw "Internal Error! killThread() can only ever be called from main application thread!";
          if (!pthread_ptr)
            throw "Internal Error! Null pthread_ptr in killThread!";
          GROWABLE_HEAP_I32()[pthread_ptr + 12 >>> 2] = 0;
          var pthread = PThread.pthreads[pthread_ptr];
          pthread.worker.terminate();
          PThread.freeThreadData(pthread);
          PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(pthread.worker), 1);
          pthread.worker.pthread = void 0;
        }
        function cancelThread(pthread_ptr) {
          if (ENVIRONMENT_IS_PTHREAD)
            throw "Internal Error! cancelThread() can only ever be called from main application thread!";
          if (!pthread_ptr)
            throw "Internal Error! Null pthread_ptr in cancelThread!";
          var pthread = PThread.pthreads[pthread_ptr];
          pthread.worker.postMessage({ "cmd": "cancel" });
        }
        function cleanupThread(pthread_ptr) {
          if (ENVIRONMENT_IS_PTHREAD)
            throw "Internal Error! cleanupThread() can only ever be called from main application thread!";
          if (!pthread_ptr)
            throw "Internal Error! Null pthread_ptr in cleanupThread!";
          var pthread = PThread.pthreads[pthread_ptr];
          if (pthread) {
            GROWABLE_HEAP_I32()[pthread_ptr + 12 >>> 2] = 0;
            var worker = pthread.worker;
            PThread.returnWorkerToPool(worker);
          }
        }
        var PThread = { unusedWorkers: [], runningWorkers: [], tlsInitFunctions: [], initMainThreadBlock: function() {
          var pthreadPoolSize = navigator.hardwareConcurrency;
          for (var i = 0; i < pthreadPoolSize; ++i) {
            PThread.allocateUnusedWorker();
          }
        }, initRuntime: function() {
          var tb = _malloc(228);
          for (var i = 0; i < 228 / 4; ++i)
            GROWABLE_HEAP_U32()[tb / 4 + i >>> 0] = 0;
          GROWABLE_HEAP_I32()[tb + 12 >>> 2] = tb;
          var headPtr = tb + 152;
          GROWABLE_HEAP_I32()[headPtr >>> 2] = headPtr;
          var tlsMemory = _malloc(512);
          for (var i = 0; i < 128; ++i)
            GROWABLE_HEAP_U32()[tlsMemory / 4 + i >>> 0] = 0;
          Atomics.store(GROWABLE_HEAP_U32(), tb + 100 >> 2, tlsMemory);
          Atomics.store(GROWABLE_HEAP_U32(), tb + 40 >> 2, tb);
          __emscripten_thread_init(tb, !ENVIRONMENT_IS_WORKER, 1);
          _emscripten_register_main_browser_thread_id(tb);
        }, initWorker: function() {
        }, pthreads: {}, threadExitHandlers: [], runExitHandlers: function() {
          while (PThread.threadExitHandlers.length > 0) {
            PThread.threadExitHandlers.pop()();
          }
          ___pthread_tsd_run_dtors();
        }, runExitHandlersAndDeinitThread: function(tb, exitCode) {
          Atomics.store(GROWABLE_HEAP_U32(), tb + 56 >> 2, 1);
          Atomics.store(GROWABLE_HEAP_U32(), tb + 60 >> 2, 0);
          PThread.runExitHandlers();
          Atomics.store(GROWABLE_HEAP_U32(), tb + 4 >> 2, exitCode);
          Atomics.store(GROWABLE_HEAP_U32(), tb + 0 >> 2, 1);
          _emscripten_futex_wake(tb + 0, 2147483647);
          __emscripten_thread_init(0, 0, 0);
        }, setExitStatus: function(status) {
        }, threadExit: function(exitCode) {
          var tb = _pthread_self();
          if (tb) {
            PThread.runExitHandlersAndDeinitThread(tb, exitCode);
            if (ENVIRONMENT_IS_PTHREAD) {
              postMessage({ "cmd": "exit" });
            }
          }
        }, threadCancel: function() {
          PThread.runExitHandlersAndDeinitThread(_pthread_self(), -1);
          postMessage({ "cmd": "cancelDone" });
        }, terminateAllThreads: function() {
          for (var t in PThread.pthreads) {
            var pthread = PThread.pthreads[t];
            if (pthread && pthread.worker) {
              PThread.returnWorkerToPool(pthread.worker);
            }
          }
          PThread.pthreads = {};
          for (var i = 0; i < PThread.unusedWorkers.length; ++i) {
            var worker = PThread.unusedWorkers[i];
            worker.terminate();
          }
          PThread.unusedWorkers = [];
          for (var i = 0; i < PThread.runningWorkers.length; ++i) {
            var worker = PThread.runningWorkers[i];
            var pthread = worker.pthread;
            PThread.freeThreadData(pthread);
            worker.terminate();
          }
          PThread.runningWorkers = [];
        }, freeThreadData: function(pthread) {
          if (!pthread)
            return;
          if (pthread.threadInfoStruct) {
            var tlsMemory = GROWABLE_HEAP_I32()[pthread.threadInfoStruct + 100 >>> 2];
            GROWABLE_HEAP_I32()[pthread.threadInfoStruct + 100 >>> 2] = 0;
            _free(tlsMemory);
            _free(pthread.threadInfoStruct);
          }
          pthread.threadInfoStruct = 0;
          if (pthread.allocatedOwnStack && pthread.stackBase)
            _free(pthread.stackBase);
          pthread.stackBase = 0;
          if (pthread.worker)
            pthread.worker.pthread = null;
        }, returnWorkerToPool: function(worker) {
          PThread.runWithoutMainThreadQueuedCalls(function() {
            delete PThread.pthreads[worker.pthread.threadInfoStruct];
            PThread.unusedWorkers.push(worker);
            PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(worker), 1);
            PThread.freeThreadData(worker.pthread);
            worker.pthread = void 0;
          });
        }, runWithoutMainThreadQueuedCalls: function(func) {
          GROWABLE_HEAP_I32()[__emscripten_allow_main_runtime_queued_calls >>> 2] = 0;
          try {
            func();
          } finally {
            GROWABLE_HEAP_I32()[__emscripten_allow_main_runtime_queued_calls >>> 2] = 1;
          }
        }, receiveObjectTransfer: function(data) {
        }, threadInit: function() {
          for (var i in PThread.tlsInitFunctions) {
            PThread.tlsInitFunctions[i]();
          }
        }, loadWasmModuleToWorker: function(worker, onFinishedLoading) {
          worker.onmessage = function(e) {
            var d = e["data"];
            var cmd = d["cmd"];
            if (worker.pthread)
              PThread.currentProxiedOperationCallerThread = worker.pthread.threadInfoStruct;
            if (d["targetThread"] && d["targetThread"] != _pthread_self()) {
              var thread = PThread.pthreads[d.targetThread];
              if (thread) {
                thread.worker.postMessage(e.data, d["transferList"]);
              } else {
                console.error('Internal error! Worker sent a message "' + cmd + '" to target pthread ' + d["targetThread"] + ", but that thread no longer exists!");
              }
              PThread.currentProxiedOperationCallerThread = void 0;
              return;
            }
            if (cmd === "processQueuedMainThreadWork") {
              _emscripten_main_thread_process_queued_calls();
            } else if (cmd === "spawnThread") {
              spawnThread(e.data);
            } else if (cmd === "cleanupThread") {
              cleanupThread(d["thread"]);
            } else if (cmd === "killThread") {
              killThread(d["thread"]);
            } else if (cmd === "cancelThread") {
              cancelThread(d["thread"]);
            } else if (cmd === "loaded") {
              worker.loaded = true;
              if (onFinishedLoading)
                onFinishedLoading(worker);
              if (worker.runPthread) {
                worker.runPthread();
                delete worker.runPthread;
              }
            } else if (cmd === "print") {
              out("Thread " + d["threadId"] + ": " + d["text"]);
            } else if (cmd === "printErr") {
              err("Thread " + d["threadId"] + ": " + d["text"]);
            } else if (cmd === "alert") {
              alert("Thread " + d["threadId"] + ": " + d["text"]);
            } else if (cmd === "exit") {
              var detached = worker.pthread && Atomics.load(GROWABLE_HEAP_U32(), worker.pthread.threadInfoStruct + 64 >> 2);
              if (detached) {
                PThread.returnWorkerToPool(worker);
              }
            } else if (cmd === "exitProcess") {
              try {
                exit(d["returnCode"]);
              } catch (e2) {
                if (e2 instanceof ExitStatus)
                  return;
                throw e2;
              }
            } else if (cmd === "cancelDone") {
              PThread.returnWorkerToPool(worker);
            } else if (cmd === "objectTransfer") {
              PThread.receiveObjectTransfer(e.data);
            } else if (e.data.target === "setimmediate") {
              worker.postMessage(e.data);
            } else {
              err("worker sent an unknown command " + cmd);
            }
            PThread.currentProxiedOperationCallerThread = void 0;
          };
          worker.onerror = function(e) {
            err("pthread sent an error! " + e.filename + ":" + e.lineno + ": " + e.message);
          };
          if (ENVIRONMENT_IS_NODE) {
            worker.on("message", function(data) {
              worker.onmessage({ data });
            });
            worker.on("error", function(data) {
              worker.onerror(data);
            });
            worker.on("exit", function(data) {
            });
          }
          worker.postMessage({ "cmd": "load", "urlOrBlob": Module["mainScriptUrlOrBlob"] || _scriptDir, "wasmMemory": wasmMemory, "wasmModule": wasmModule });
        }, allocateUnusedWorker: function() {
          var pthreadMainJs = locateFile("web-ifc-mt.worker.js");
          PThread.unusedWorkers.push(new Worker(pthreadMainJs));
        }, getNewWorker: function() {
          if (PThread.unusedWorkers.length == 0) {
            PThread.allocateUnusedWorker();
            PThread.loadWasmModuleToWorker(PThread.unusedWorkers[0]);
          }
          return PThread.unusedWorkers.pop();
        }, busySpinWait: function(msecs) {
          var t = performance.now() + msecs;
          while (performance.now() < t) {
          }
        } };
        function establishStackSpace(stackTop, stackMax) {
          _emscripten_stack_set_limits(stackTop, stackMax);
          stackRestore(stackTop);
        }
        Module["establishStackSpace"] = establishStackSpace;
        function invokeEntryPoint(ptr, arg) {
          return wasmTable.get(ptr)(arg);
        }
        Module["invokeEntryPoint"] = invokeEntryPoint;
        function ___assert_fail(condition, filename, line, func) {
          abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"]);
        }
        var _emscripten_get_now;
        if (ENVIRONMENT_IS_NODE) {
          _emscripten_get_now = function() {
            var t = process["hrtime"]();
            return t[0] * 1e3 + t[1] / 1e6;
          };
        } else if (ENVIRONMENT_IS_PTHREAD) {
          _emscripten_get_now = function() {
            return performance.now() - Module["__performance_now_clock_drift"];
          };
        } else
          _emscripten_get_now = function() {
            return performance.now();
          };
        var _emscripten_get_now_is_monotonic = true;
        function setErrNo(value) {
          GROWABLE_HEAP_I32()[___errno_location() >>> 2] = value;
          return value;
        }
        function _clock_gettime(clk_id, tp) {
          var now;
          if (clk_id === 0) {
            now = Date.now();
          } else if ((clk_id === 1 || clk_id === 4) && _emscripten_get_now_is_monotonic) {
            now = _emscripten_get_now();
          } else {
            setErrNo(28);
            return -1;
          }
          GROWABLE_HEAP_I32()[tp >>> 2] = now / 1e3 | 0;
          GROWABLE_HEAP_I32()[tp + 4 >>> 2] = now % 1e3 * 1e3 * 1e3 | 0;
          return 0;
        }
        function ___cxa_allocate_exception(size) {
          return _malloc(size + 16) + 16;
        }
        function _atexit(func, arg) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(1, 1, func, arg);
        }
        function ExceptionInfo(excPtr) {
          this.excPtr = excPtr;
          this.ptr = excPtr - 16;
          this.set_type = function(type) {
            GROWABLE_HEAP_I32()[this.ptr + 4 >>> 2] = type;
          };
          this.get_type = function() {
            return GROWABLE_HEAP_I32()[this.ptr + 4 >>> 2];
          };
          this.set_destructor = function(destructor) {
            GROWABLE_HEAP_I32()[this.ptr + 8 >>> 2] = destructor;
          };
          this.get_destructor = function() {
            return GROWABLE_HEAP_I32()[this.ptr + 8 >>> 2];
          };
          this.set_refcount = function(refcount) {
            GROWABLE_HEAP_I32()[this.ptr >>> 2] = refcount;
          };
          this.set_caught = function(caught) {
            caught = caught ? 1 : 0;
            GROWABLE_HEAP_I8()[this.ptr + 12 >>> 0] = caught;
          };
          this.get_caught = function() {
            return GROWABLE_HEAP_I8()[this.ptr + 12 >>> 0] != 0;
          };
          this.set_rethrown = function(rethrown) {
            rethrown = rethrown ? 1 : 0;
            GROWABLE_HEAP_I8()[this.ptr + 13 >>> 0] = rethrown;
          };
          this.get_rethrown = function() {
            return GROWABLE_HEAP_I8()[this.ptr + 13 >>> 0] != 0;
          };
          this.init = function(type, destructor) {
            this.set_type(type);
            this.set_destructor(destructor);
            this.set_refcount(0);
            this.set_caught(false);
            this.set_rethrown(false);
          };
          this.add_ref = function() {
            Atomics.add(GROWABLE_HEAP_I32(), this.ptr + 0 >> 2, 1);
          };
          this.release_ref = function() {
            var prev = Atomics.sub(GROWABLE_HEAP_I32(), this.ptr + 0 >> 2, 1);
            return prev === 1;
          };
        }
        function CatchInfo(ptr) {
          this.free = function() {
            _free(this.ptr);
            this.ptr = 0;
          };
          this.set_base_ptr = function(basePtr) {
            GROWABLE_HEAP_I32()[this.ptr >>> 2] = basePtr;
          };
          this.get_base_ptr = function() {
            return GROWABLE_HEAP_I32()[this.ptr >>> 2];
          };
          this.set_adjusted_ptr = function(adjustedPtr) {
            GROWABLE_HEAP_I32()[this.ptr + 4 >>> 2] = adjustedPtr;
          };
          this.get_adjusted_ptr_addr = function() {
            return this.ptr + 4;
          };
          this.get_adjusted_ptr = function() {
            return GROWABLE_HEAP_I32()[this.ptr + 4 >>> 2];
          };
          this.get_exception_ptr = function() {
            var isPointer = ___cxa_is_pointer_type(this.get_exception_info().get_type());
            if (isPointer) {
              return GROWABLE_HEAP_I32()[this.get_base_ptr() >>> 2];
            }
            var adjusted = this.get_adjusted_ptr();
            if (adjusted !== 0)
              return adjusted;
            return this.get_base_ptr();
          };
          this.get_exception_info = function() {
            return new ExceptionInfo(this.get_base_ptr());
          };
          if (ptr === void 0) {
            this.ptr = _malloc(8);
            this.set_adjusted_ptr(0);
          } else {
            this.ptr = ptr;
          }
        }
        var exceptionCaught = [];
        function exception_addRef(info) {
          info.add_ref();
        }
        var uncaughtExceptionCount = 0;
        function ___cxa_begin_catch(ptr) {
          var catchInfo = new CatchInfo(ptr);
          var info = catchInfo.get_exception_info();
          if (!info.get_caught()) {
            info.set_caught(true);
            uncaughtExceptionCount--;
          }
          info.set_rethrown(false);
          exceptionCaught.push(catchInfo);
          exception_addRef(info);
          return catchInfo.get_exception_ptr();
        }
        var exceptionLast = 0;
        function ___cxa_free_exception(ptr) {
          return _free(new ExceptionInfo(ptr).ptr);
        }
        function exception_decRef(info) {
          if (info.release_ref() && !info.get_rethrown()) {
            var destructor = info.get_destructor();
            if (destructor) {
              wasmTable.get(destructor)(info.excPtr);
            }
            ___cxa_free_exception(info.excPtr);
          }
        }
        function ___cxa_end_catch() {
          _setThrew(0);
          var catchInfo = exceptionCaught.pop();
          exception_decRef(catchInfo.get_exception_info());
          catchInfo.free();
          exceptionLast = 0;
        }
        function ___resumeException(catchInfoPtr) {
          var catchInfo = new CatchInfo(catchInfoPtr);
          var ptr = catchInfo.get_base_ptr();
          if (!exceptionLast) {
            exceptionLast = ptr;
          }
          catchInfo.free();
          throw ptr;
        }
        function ___cxa_find_matching_catch_2() {
          var thrown = exceptionLast;
          if (!thrown) {
            setTempRet0(0);
            return 0 | 0;
          }
          var info = new ExceptionInfo(thrown);
          var thrownType = info.get_type();
          var catchInfo = new CatchInfo();
          catchInfo.set_base_ptr(thrown);
          catchInfo.set_adjusted_ptr(thrown);
          if (!thrownType) {
            setTempRet0(0);
            return catchInfo.ptr | 0;
          }
          var typeArray = Array.prototype.slice.call(arguments);
          for (var i = 0; i < typeArray.length; i++) {
            var caughtType = typeArray[i];
            if (caughtType === 0 || caughtType === thrownType) {
              break;
            }
            if (___cxa_can_catch(caughtType, thrownType, catchInfo.get_adjusted_ptr_addr())) {
              setTempRet0(caughtType);
              return catchInfo.ptr | 0;
            }
          }
          setTempRet0(thrownType);
          return catchInfo.ptr | 0;
        }
        function ___cxa_find_matching_catch_3() {
          var thrown = exceptionLast;
          if (!thrown) {
            setTempRet0(0);
            return 0 | 0;
          }
          var info = new ExceptionInfo(thrown);
          var thrownType = info.get_type();
          var catchInfo = new CatchInfo();
          catchInfo.set_base_ptr(thrown);
          catchInfo.set_adjusted_ptr(thrown);
          if (!thrownType) {
            setTempRet0(0);
            return catchInfo.ptr | 0;
          }
          var typeArray = Array.prototype.slice.call(arguments);
          for (var i = 0; i < typeArray.length; i++) {
            var caughtType = typeArray[i];
            if (caughtType === 0 || caughtType === thrownType) {
              break;
            }
            if (___cxa_can_catch(caughtType, thrownType, catchInfo.get_adjusted_ptr_addr())) {
              setTempRet0(caughtType);
              return catchInfo.ptr | 0;
            }
          }
          setTempRet0(thrownType);
          return catchInfo.ptr | 0;
        }
        function ___cxa_rethrow() {
          var catchInfo = exceptionCaught.pop();
          if (!catchInfo) {
            abort("no exception to throw");
          }
          var info = catchInfo.get_exception_info();
          var ptr = catchInfo.get_base_ptr();
          if (!info.get_rethrown()) {
            exceptionCaught.push(catchInfo);
            info.set_rethrown(true);
            info.set_caught(false);
            uncaughtExceptionCount++;
          } else {
            catchInfo.free();
          }
          exceptionLast = ptr;
          throw ptr;
        }
        function ___cxa_thread_atexit(routine, arg) {
          PThread.threadExitHandlers.push(function() {
            wasmTable.get(routine)(arg);
          });
        }
        function ___cxa_throw(ptr, type, destructor) {
          var info = new ExceptionInfo(ptr);
          info.init(type, destructor);
          exceptionLast = ptr;
          uncaughtExceptionCount++;
          throw ptr;
        }
        function ___cxa_uncaught_exceptions() {
          return uncaughtExceptionCount;
        }
        var PATH = { splitPath: function(filename) {
          var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
          return splitPathRe.exec(filename).slice(1);
        }, normalizeArray: function(parts, allowAboveRoot) {
          var up = 0;
          for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
              parts.splice(i, 1);
            } else if (last === "..") {
              parts.splice(i, 1);
              up++;
            } else if (up) {
              parts.splice(i, 1);
              up--;
            }
          }
          if (allowAboveRoot) {
            for (; up; up--) {
              parts.unshift("..");
            }
          }
          return parts;
        }, normalize: function(path) {
          var isAbsolute = path.charAt(0) === "/", trailingSlash = path.substr(-1) === "/";
          path = PATH.normalizeArray(path.split("/").filter(function(p) {
            return !!p;
          }), !isAbsolute).join("/");
          if (!path && !isAbsolute) {
            path = ".";
          }
          if (path && trailingSlash) {
            path += "/";
          }
          return (isAbsolute ? "/" : "") + path;
        }, dirname: function(path) {
          var result = PATH.splitPath(path), root = result[0], dir = result[1];
          if (!root && !dir) {
            return ".";
          }
          if (dir) {
            dir = dir.substr(0, dir.length - 1);
          }
          return root + dir;
        }, basename: function(path) {
          if (path === "/")
            return "/";
          path = PATH.normalize(path);
          path = path.replace(/\/$/, "");
          var lastSlash = path.lastIndexOf("/");
          if (lastSlash === -1)
            return path;
          return path.substr(lastSlash + 1);
        }, extname: function(path) {
          return PATH.splitPath(path)[3];
        }, join: function() {
          var paths = Array.prototype.slice.call(arguments, 0);
          return PATH.normalize(paths.join("/"));
        }, join2: function(l, r) {
          return PATH.normalize(l + "/" + r);
        } };
        function getRandomDevice() {
          if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
            var randomBuffer = new Uint8Array(1);
            return function() {
              crypto.getRandomValues(randomBuffer);
              return randomBuffer[0];
            };
          } else if (ENVIRONMENT_IS_NODE) {
            try {
              var crypto_module = require_crypto();
              return function() {
                return crypto_module["randomBytes"](1)[0];
              };
            } catch (e) {
            }
          }
          return function() {
            abort("randomDevice");
          };
        }
        var PATH_FS = { resolve: function() {
          var resolvedPath = "", resolvedAbsolute = false;
          for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path = i >= 0 ? arguments[i] : FS.cwd();
            if (typeof path !== "string") {
              throw new TypeError("Arguments to path.resolve must be strings");
            } else if (!path) {
              return "";
            }
            resolvedPath = path + "/" + resolvedPath;
            resolvedAbsolute = path.charAt(0) === "/";
          }
          resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function(p) {
            return !!p;
          }), !resolvedAbsolute).join("/");
          return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
        }, relative: function(from, to) {
          from = PATH_FS.resolve(from).substr(1);
          to = PATH_FS.resolve(to).substr(1);
          function trim(arr) {
            var start = 0;
            for (; start < arr.length; start++) {
              if (arr[start] !== "")
                break;
            }
            var end = arr.length - 1;
            for (; end >= 0; end--) {
              if (arr[end] !== "")
                break;
            }
            if (start > end)
              return [];
            return arr.slice(start, end - start + 1);
          }
          var fromParts = trim(from.split("/"));
          var toParts = trim(to.split("/"));
          var length = Math.min(fromParts.length, toParts.length);
          var samePartsLength = length;
          for (var i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
              samePartsLength = i;
              break;
            }
          }
          var outputParts = [];
          for (var i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push("..");
          }
          outputParts = outputParts.concat(toParts.slice(samePartsLength));
          return outputParts.join("/");
        } };
        var TTY = { ttys: [], init: function() {
        }, shutdown: function() {
        }, register: function(dev, ops) {
          TTY.ttys[dev] = { input: [], output: [], ops };
          FS.registerDevice(dev, TTY.stream_ops);
        }, stream_ops: { open: function(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        }, close: function(stream) {
          stream.tty.ops.flush(stream.tty);
        }, flush: function(stream) {
          stream.tty.ops.flush(stream.tty);
        }, read: function(stream, buffer2, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === void 0 && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === void 0)
              break;
            bytesRead++;
            buffer2[offset + i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        }, write: function(stream, buffer2, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer2[offset + i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        } }, default_tty_ops: { get_char: function(tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              var BUFSIZE = 256;
              var buf = Buffer.alloc(BUFSIZE);
              var bytesRead = 0;
              try {
                bytesRead = nodeFS.readSync(process.stdin.fd, buf, 0, BUFSIZE, null);
              } catch (e) {
                if (e.toString().includes("EOF"))
                  bytesRead = 0;
                else
                  throw e;
              }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString("utf-8");
              } else {
                result = null;
              }
            } else if (typeof window != "undefined" && typeof window.prompt == "function") {
              result = window.prompt("Input: ");
              if (result !== null) {
                result += "\n";
              }
            } else if (typeof readline == "function") {
              result = readline();
              if (result !== null) {
                result += "\n";
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        }, put_char: function(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0)
              tty.output.push(val);
          }
        }, flush: function(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        } }, default_tty1_ops: { put_char: function(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0)
              tty.output.push(val);
          }
        }, flush: function(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        } } };
        function zeroMemory(address, size) {
          GROWABLE_HEAP_U8().fill(0, address, address + size);
        }
        function mmapAlloc(size) {
          size = alignMemory(size, 65536);
          var ptr = _memalign(65536, size);
          if (!ptr)
            return 0;
          zeroMemory(ptr, size);
          return ptr;
        }
        var MEMFS = { ops_table: null, mount: function(mount) {
          return MEMFS.createNode(null, "/", 16384 | 511, 0);
        }, createNode: function(parent, name2, mode, dev) {
          if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
            throw new FS.ErrnoError(63);
          }
          if (!MEMFS.ops_table) {
            MEMFS.ops_table = { dir: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, lookup: MEMFS.node_ops.lookup, mknod: MEMFS.node_ops.mknod, rename: MEMFS.node_ops.rename, unlink: MEMFS.node_ops.unlink, rmdir: MEMFS.node_ops.rmdir, readdir: MEMFS.node_ops.readdir, symlink: MEMFS.node_ops.symlink }, stream: { llseek: MEMFS.stream_ops.llseek } }, file: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: { llseek: MEMFS.stream_ops.llseek, read: MEMFS.stream_ops.read, write: MEMFS.stream_ops.write, allocate: MEMFS.stream_ops.allocate, mmap: MEMFS.stream_ops.mmap, msync: MEMFS.stream_ops.msync } }, link: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, readlink: MEMFS.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: FS.chrdev_stream_ops } };
          }
          var node = FS.createNode(parent, name2, mode, dev);
          if (FS.isDir(node.mode)) {
            node.node_ops = MEMFS.ops_table.dir.node;
            node.stream_ops = MEMFS.ops_table.dir.stream;
            node.contents = {};
          } else if (FS.isFile(node.mode)) {
            node.node_ops = MEMFS.ops_table.file.node;
            node.stream_ops = MEMFS.ops_table.file.stream;
            node.usedBytes = 0;
            node.contents = null;
          } else if (FS.isLink(node.mode)) {
            node.node_ops = MEMFS.ops_table.link.node;
            node.stream_ops = MEMFS.ops_table.link.stream;
          } else if (FS.isChrdev(node.mode)) {
            node.node_ops = MEMFS.ops_table.chrdev.node;
            node.stream_ops = MEMFS.ops_table.chrdev.stream;
          }
          node.timestamp = Date.now();
          if (parent) {
            parent.contents[name2] = node;
            parent.timestamp = node.timestamp;
          }
          return node;
        }, getFileDataAsTypedArray: function(node) {
          if (!node.contents)
            return new Uint8Array(0);
          if (node.contents.subarray)
            return node.contents.subarray(0, node.usedBytes);
          return new Uint8Array(node.contents);
        }, expandFileStorage: function(node, newCapacity) {
          newCapacity >>>= 0;
          var prevCapacity = node.contents ? node.contents.length : 0;
          if (prevCapacity >= newCapacity)
            return;
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
          if (prevCapacity != 0)
            newCapacity = Math.max(newCapacity, 256);
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity);
          if (node.usedBytes > 0)
            node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        }, resizeFileStorage: function(node, newSize) {
          newSize >>>= 0;
          if (node.usedBytes == newSize)
            return;
          if (newSize == 0) {
            node.contents = null;
            node.usedBytes = 0;
          } else {
            var oldContents = node.contents;
            node.contents = new Uint8Array(newSize);
            if (oldContents) {
              node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
            }
            node.usedBytes = newSize;
          }
        }, node_ops: { getattr: function(node) {
          var attr = {};
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        }, setattr: function(node, attr) {
          if (attr.mode !== void 0) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== void 0) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== void 0) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        }, lookup: function(parent, name2) {
          throw FS.genericErrors[44];
        }, mknod: function(parent, name2, mode, dev) {
          return MEMFS.createNode(parent, name2, mode, dev);
        }, rename: function(old_node, new_dir, new_name) {
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now();
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        }, unlink: function(parent, name2) {
          delete parent.contents[name2];
          parent.timestamp = Date.now();
        }, rmdir: function(parent, name2) {
          var node = FS.lookupNode(parent, name2);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name2];
          parent.timestamp = Date.now();
        }, readdir: function(node) {
          var entries = [".", ".."];
          for (var key2 in node.contents) {
            if (!node.contents.hasOwnProperty(key2)) {
              continue;
            }
            entries.push(key2);
          }
          return entries;
        }, symlink: function(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
          node.link = oldpath;
          return node;
        }, readlink: function(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        } }, stream_ops: { read: function(stream, buffer2, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes)
            return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          if (size > 8 && contents.subarray) {
            buffer2.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++)
              buffer2[offset + i] = contents[position + i];
          }
          return size;
        }, write: function(stream, buffer2, offset, length, position, canOwn) {
          if (buffer2.buffer === GROWABLE_HEAP_I8().buffer) {
            canOwn = false;
          }
          if (!length)
            return 0;
          var node = stream.node;
          node.timestamp = Date.now();
          if (buffer2.subarray && (!node.contents || node.contents.subarray)) {
            if (canOwn) {
              node.contents = buffer2.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) {
              node.contents = buffer2.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) {
              node.contents.set(buffer2.subarray(offset, offset + length), position);
              return length;
            }
          }
          MEMFS.expandFileStorage(node, position + length);
          if (node.contents.subarray && buffer2.subarray) {
            node.contents.set(buffer2.subarray(offset, offset + length), position);
          } else {
            for (var i = 0; i < length; i++) {
              node.contents[position + i] = buffer2[offset + i];
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        }, llseek: function(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        }, allocate: function(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        }, mmap: function(stream, address, length, position, prot, flags) {
          if (address !== 0) {
            throw new FS.ErrnoError(28);
          }
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          if (!(flags & 2) && contents.buffer === buffer) {
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            ptr >>>= 0;
            GROWABLE_HEAP_I8().set(contents, ptr >>> 0);
          }
          return { ptr, allocated };
        }, msync: function(stream, buffer2, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (mmapFlags & 2) {
            return 0;
          }
          MEMFS.stream_ops.write(stream, buffer2, 0, length, offset, false);
          return 0;
        } } };
        function asyncLoad(url, onload, onerror, noRunDep) {
          var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
          readAsync(url, function(arrayBuffer) {
            assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
            onload(new Uint8Array(arrayBuffer));
            if (dep)
              removeRunDependency();
          }, function(event) {
            if (onerror) {
              onerror();
            } else {
              throw 'Loading data file "' + url + '" failed.';
            }
          });
          if (dep)
            addRunDependency();
        }
        var FS = { root: null, mounts: [], devices: {}, streams: [], nextInode: 1, nameTable: null, currentPath: "/", initialized: false, ignorePermissions: true, trackingDelegate: {}, tracking: { openFlags: { READ: 1, WRITE: 2 } }, ErrnoError: null, genericErrors: {}, filesystems: null, syncFSRequests: 0, lookupPath: function(path, opts) {
          path = PATH_FS.resolve(FS.cwd(), path);
          opts = opts || {};
          if (!path)
            return { path: "", node: null };
          var defaults = { follow_mount: true, recurse_count: 0 };
          for (var key2 in defaults) {
            if (opts[key2] === void 0) {
              opts[key2] = defaults[key2];
            }
          }
          if (opts.recurse_count > 8) {
            throw new FS.ErrnoError(32);
          }
          var parts = PATH.normalizeArray(path.split("/").filter(function(p) {
            return !!p;
          }), false);
          var current = FS.root;
          var current_path = "/";
          for (var i = 0; i < parts.length; i++) {
            var islast = i === parts.length - 1;
            if (islast && opts.parent) {
              break;
            }
            current = FS.lookupNode(current, parts[i]);
            current_path = PATH.join2(current_path, parts[i]);
            if (FS.isMountpoint(current)) {
              if (!islast || islast && opts.follow_mount) {
                current = current.mounted.root;
              }
            }
            if (!islast || opts.follow) {
              var count = 0;
              while (FS.isLink(current.mode)) {
                var link = FS.readlink(current_path);
                current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
                var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
                current = lookup.node;
                if (count++ > 40) {
                  throw new FS.ErrnoError(32);
                }
              }
            }
          }
          return { path: current_path, node: current };
        }, getPath: function(node) {
          var path;
          while (true) {
            if (FS.isRoot(node)) {
              var mount = node.mount.mountpoint;
              if (!path)
                return mount;
              return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
            }
            path = path ? node.name + "/" + path : node.name;
            node = node.parent;
          }
        }, hashName: function(parentid, name2) {
          var hash = 0;
          for (var i = 0; i < name2.length; i++) {
            hash = (hash << 5) - hash + name2.charCodeAt(i) | 0;
          }
          return (parentid + hash >>> 0) % FS.nameTable.length;
        }, hashAddNode: function(node) {
          var hash = FS.hashName(node.parent.id, node.name);
          node.name_next = FS.nameTable[hash];
          FS.nameTable[hash] = node;
        }, hashRemoveNode: function(node) {
          var hash = FS.hashName(node.parent.id, node.name);
          if (FS.nameTable[hash] === node) {
            FS.nameTable[hash] = node.name_next;
          } else {
            var current = FS.nameTable[hash];
            while (current) {
              if (current.name_next === node) {
                current.name_next = node.name_next;
                break;
              }
              current = current.name_next;
            }
          }
        }, lookupNode: function(parent, name2) {
          var errCode = FS.mayLookup(parent);
          if (errCode) {
            throw new FS.ErrnoError(errCode, parent);
          }
          var hash = FS.hashName(parent.id, name2);
          for (var node = FS.nameTable[hash]; node; node = node.name_next) {
            var nodeName = node.name;
            if (node.parent.id === parent.id && nodeName === name2) {
              return node;
            }
          }
          return FS.lookup(parent, name2);
        }, createNode: function(parent, name2, mode, rdev) {
          var node = new FS.FSNode(parent, name2, mode, rdev);
          FS.hashAddNode(node);
          return node;
        }, destroyNode: function(node) {
          FS.hashRemoveNode(node);
        }, isRoot: function(node) {
          return node === node.parent;
        }, isMountpoint: function(node) {
          return !!node.mounted;
        }, isFile: function(mode) {
          return (mode & 61440) === 32768;
        }, isDir: function(mode) {
          return (mode & 61440) === 16384;
        }, isLink: function(mode) {
          return (mode & 61440) === 40960;
        }, isChrdev: function(mode) {
          return (mode & 61440) === 8192;
        }, isBlkdev: function(mode) {
          return (mode & 61440) === 24576;
        }, isFIFO: function(mode) {
          return (mode & 61440) === 4096;
        }, isSocket: function(mode) {
          return (mode & 49152) === 49152;
        }, flagModes: { "r": 0, "r+": 2, "w": 577, "w+": 578, "a": 1089, "a+": 1090 }, modeStringToFlags: function(str) {
          var flags = FS.flagModes[str];
          if (typeof flags === "undefined") {
            throw new Error("Unknown file open mode: " + str);
          }
          return flags;
        }, flagsToPermissionString: function(flag) {
          var perms = ["r", "w", "rw"][flag & 3];
          if (flag & 512) {
            perms += "w";
          }
          return perms;
        }, nodePermissions: function(node, perms) {
          if (FS.ignorePermissions) {
            return 0;
          }
          if (perms.includes("r") && !(node.mode & 292)) {
            return 2;
          } else if (perms.includes("w") && !(node.mode & 146)) {
            return 2;
          } else if (perms.includes("x") && !(node.mode & 73)) {
            return 2;
          }
          return 0;
        }, mayLookup: function(dir) {
          var errCode = FS.nodePermissions(dir, "x");
          if (errCode)
            return errCode;
          if (!dir.node_ops.lookup)
            return 2;
          return 0;
        }, mayCreate: function(dir, name2) {
          try {
            var node = FS.lookupNode(dir, name2);
            return 20;
          } catch (e) {
          }
          return FS.nodePermissions(dir, "wx");
        }, mayDelete: function(dir, name2, isdir) {
          var node;
          try {
            node = FS.lookupNode(dir, name2);
          } catch (e) {
            return e.errno;
          }
          var errCode = FS.nodePermissions(dir, "wx");
          if (errCode) {
            return errCode;
          }
          if (isdir) {
            if (!FS.isDir(node.mode)) {
              return 54;
            }
            if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
              return 10;
            }
          } else {
            if (FS.isDir(node.mode)) {
              return 31;
            }
          }
          return 0;
        }, mayOpen: function(node, flags) {
          if (!node) {
            return 44;
          }
          if (FS.isLink(node.mode)) {
            return 32;
          } else if (FS.isDir(node.mode)) {
            if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
              return 31;
            }
          }
          return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
        }, MAX_OPEN_FDS: 4096, nextfd: function(fd_start, fd_end) {
          fd_start = fd_start || 0;
          fd_end = fd_end || FS.MAX_OPEN_FDS;
          for (var fd = fd_start; fd <= fd_end; fd++) {
            if (!FS.streams[fd]) {
              return fd;
            }
          }
          throw new FS.ErrnoError(33);
        }, getStream: function(fd) {
          return FS.streams[fd];
        }, createStream: function(stream, fd_start, fd_end) {
          if (!FS.FSStream) {
            FS.FSStream = function() {
            };
            FS.FSStream.prototype = { object: { get: function() {
              return this.node;
            }, set: function(val) {
              this.node = val;
            } }, isRead: { get: function() {
              return (this.flags & 2097155) !== 1;
            } }, isWrite: { get: function() {
              return (this.flags & 2097155) !== 0;
            } }, isAppend: { get: function() {
              return this.flags & 1024;
            } } };
          }
          var newStream = new FS.FSStream();
          for (var p in stream) {
            newStream[p] = stream[p];
          }
          stream = newStream;
          var fd = FS.nextfd(fd_start, fd_end);
          stream.fd = fd;
          FS.streams[fd] = stream;
          return stream;
        }, closeStream: function(fd) {
          FS.streams[fd] = null;
        }, chrdev_stream_ops: { open: function(stream) {
          var device = FS.getDevice(stream.node.rdev);
          stream.stream_ops = device.stream_ops;
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        }, llseek: function() {
          throw new FS.ErrnoError(70);
        } }, major: function(dev) {
          return dev >> 8;
        }, minor: function(dev) {
          return dev & 255;
        }, makedev: function(ma, mi) {
          return ma << 8 | mi;
        }, registerDevice: function(dev, ops) {
          FS.devices[dev] = { stream_ops: ops };
        }, getDevice: function(dev) {
          return FS.devices[dev];
        }, getMounts: function(mount) {
          var mounts = [];
          var check = [mount];
          while (check.length) {
            var m = check.pop();
            mounts.push(m);
            check.push.apply(check, m.mounts);
          }
          return mounts;
        }, syncfs: function(populate, callback) {
          if (typeof populate === "function") {
            callback = populate;
            populate = false;
          }
          FS.syncFSRequests++;
          if (FS.syncFSRequests > 1) {
            err("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work");
          }
          var mounts = FS.getMounts(FS.root.mount);
          var completed = 0;
          function doCallback(errCode) {
            FS.syncFSRequests--;
            return callback(errCode);
          }
          function done(errCode) {
            if (errCode) {
              if (!done.errored) {
                done.errored = true;
                return doCallback(errCode);
              }
              return;
            }
            if (++completed >= mounts.length) {
              doCallback(null);
            }
          }
          mounts.forEach(function(mount) {
            if (!mount.type.syncfs) {
              return done(null);
            }
            mount.type.syncfs(mount, populate, done);
          });
        }, mount: function(type, opts, mountpoint) {
          var root = mountpoint === "/";
          var pseudo = !mountpoint;
          var node;
          if (root && FS.root) {
            throw new FS.ErrnoError(10);
          } else if (!root && !pseudo) {
            var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
            mountpoint = lookup.path;
            node = lookup.node;
            if (FS.isMountpoint(node)) {
              throw new FS.ErrnoError(10);
            }
            if (!FS.isDir(node.mode)) {
              throw new FS.ErrnoError(54);
            }
          }
          var mount = { type, opts, mountpoint, mounts: [] };
          var mountRoot = type.mount(mount);
          mountRoot.mount = mount;
          mount.root = mountRoot;
          if (root) {
            FS.root = mountRoot;
          } else if (node) {
            node.mounted = mount;
            if (node.mount) {
              node.mount.mounts.push(mount);
            }
          }
          return mountRoot;
        }, unmount: function(mountpoint) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
          if (!FS.isMountpoint(lookup.node)) {
            throw new FS.ErrnoError(28);
          }
          var node = lookup.node;
          var mount = node.mounted;
          var mounts = FS.getMounts(mount);
          Object.keys(FS.nameTable).forEach(function(hash) {
            var current = FS.nameTable[hash];
            while (current) {
              var next = current.name_next;
              if (mounts.includes(current.mount)) {
                FS.destroyNode(current);
              }
              current = next;
            }
          });
          node.mounted = null;
          var idx = node.mount.mounts.indexOf(mount);
          node.mount.mounts.splice(idx, 1);
        }, lookup: function(parent, name2) {
          return parent.node_ops.lookup(parent, name2);
        }, mknod: function(path, mode, dev) {
          var lookup = FS.lookupPath(path, { parent: true });
          var parent = lookup.node;
          var name2 = PATH.basename(path);
          if (!name2 || name2 === "." || name2 === "..") {
            throw new FS.ErrnoError(28);
          }
          var errCode = FS.mayCreate(parent, name2);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.mknod) {
            throw new FS.ErrnoError(63);
          }
          return parent.node_ops.mknod(parent, name2, mode, dev);
        }, create: function(path, mode) {
          mode = mode !== void 0 ? mode : 438;
          mode &= 4095;
          mode |= 32768;
          return FS.mknod(path, mode, 0);
        }, mkdir: function(path, mode) {
          mode = mode !== void 0 ? mode : 511;
          mode &= 511 | 512;
          mode |= 16384;
          return FS.mknod(path, mode, 0);
        }, mkdirTree: function(path, mode) {
          var dirs = path.split("/");
          var d = "";
          for (var i = 0; i < dirs.length; ++i) {
            if (!dirs[i])
              continue;
            d += "/" + dirs[i];
            try {
              FS.mkdir(d, mode);
            } catch (e) {
              if (e.errno != 20)
                throw e;
            }
          }
        }, mkdev: function(path, mode, dev) {
          if (typeof dev === "undefined") {
            dev = mode;
            mode = 438;
          }
          mode |= 8192;
          return FS.mknod(path, mode, dev);
        }, symlink: function(oldpath, newpath) {
          if (!PATH_FS.resolve(oldpath)) {
            throw new FS.ErrnoError(44);
          }
          var lookup = FS.lookupPath(newpath, { parent: true });
          var parent = lookup.node;
          if (!parent) {
            throw new FS.ErrnoError(44);
          }
          var newname = PATH.basename(newpath);
          var errCode = FS.mayCreate(parent, newname);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.symlink) {
            throw new FS.ErrnoError(63);
          }
          return parent.node_ops.symlink(parent, newname, oldpath);
        }, rename: function(old_path, new_path) {
          var old_dirname = PATH.dirname(old_path);
          var new_dirname = PATH.dirname(new_path);
          var old_name = PATH.basename(old_path);
          var new_name = PATH.basename(new_path);
          var lookup, old_dir, new_dir;
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
          if (!old_dir || !new_dir)
            throw new FS.ErrnoError(44);
          if (old_dir.mount !== new_dir.mount) {
            throw new FS.ErrnoError(75);
          }
          var old_node = FS.lookupNode(old_dir, old_name);
          var relative = PATH_FS.relative(old_path, new_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(28);
          }
          relative = PATH_FS.relative(new_path, old_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(55);
          }
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name);
          } catch (e) {
          }
          if (old_node === new_node) {
            return;
          }
          var isdir = FS.isDir(old_node.mode);
          var errCode = FS.mayDelete(old_dir, old_name, isdir);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!old_dir.node_ops.rename) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
            throw new FS.ErrnoError(10);
          }
          if (new_dir !== old_dir) {
            errCode = FS.nodePermissions(old_dir, "w");
            if (errCode) {
              throw new FS.ErrnoError(errCode);
            }
          }
          try {
            if (FS.trackingDelegate["willMovePath"]) {
              FS.trackingDelegate["willMovePath"](old_path, new_path);
            }
          } catch (e) {
            err("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
          }
          FS.hashRemoveNode(old_node);
          try {
            old_dir.node_ops.rename(old_node, new_dir, new_name);
          } catch (e) {
            throw e;
          } finally {
            FS.hashAddNode(old_node);
          }
          try {
            if (FS.trackingDelegate["onMovePath"])
              FS.trackingDelegate["onMovePath"](old_path, new_path);
          } catch (e) {
            err("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
          }
        }, rmdir: function(path) {
          var lookup = FS.lookupPath(path, { parent: true });
          var parent = lookup.node;
          var name2 = PATH.basename(path);
          var node = FS.lookupNode(parent, name2);
          var errCode = FS.mayDelete(parent, name2, true);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.rmdir) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
          try {
            if (FS.trackingDelegate["willDeletePath"]) {
              FS.trackingDelegate["willDeletePath"](path);
            }
          } catch (e) {
            err("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
          }
          parent.node_ops.rmdir(parent, name2);
          FS.destroyNode(node);
          try {
            if (FS.trackingDelegate["onDeletePath"])
              FS.trackingDelegate["onDeletePath"](path);
          } catch (e) {
            err("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
          }
        }, readdir: function(path) {
          var lookup = FS.lookupPath(path, { follow: true });
          var node = lookup.node;
          if (!node.node_ops.readdir) {
            throw new FS.ErrnoError(54);
          }
          return node.node_ops.readdir(node);
        }, unlink: function(path) {
          var lookup = FS.lookupPath(path, { parent: true });
          var parent = lookup.node;
          var name2 = PATH.basename(path);
          var node = FS.lookupNode(parent, name2);
          var errCode = FS.mayDelete(parent, name2, false);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.unlink) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
          try {
            if (FS.trackingDelegate["willDeletePath"]) {
              FS.trackingDelegate["willDeletePath"](path);
            }
          } catch (e) {
            err("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
          }
          parent.node_ops.unlink(parent, name2);
          FS.destroyNode(node);
          try {
            if (FS.trackingDelegate["onDeletePath"])
              FS.trackingDelegate["onDeletePath"](path);
          } catch (e) {
            err("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
          }
        }, readlink: function(path) {
          var lookup = FS.lookupPath(path);
          var link = lookup.node;
          if (!link) {
            throw new FS.ErrnoError(44);
          }
          if (!link.node_ops.readlink) {
            throw new FS.ErrnoError(28);
          }
          return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
        }, stat: function(path, dontFollow) {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          var node = lookup.node;
          if (!node) {
            throw new FS.ErrnoError(44);
          }
          if (!node.node_ops.getattr) {
            throw new FS.ErrnoError(63);
          }
          return node.node_ops.getattr(node);
        }, lstat: function(path) {
          return FS.stat(path, true);
        }, chmod: function(path, mode, dontFollow) {
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, { follow: !dontFollow });
            node = lookup.node;
          } else {
            node = path;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          node.node_ops.setattr(node, { mode: mode & 4095 | node.mode & ~4095, timestamp: Date.now() });
        }, lchmod: function(path, mode) {
          FS.chmod(path, mode, true);
        }, fchmod: function(fd, mode) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(8);
          }
          FS.chmod(stream.node, mode);
        }, chown: function(path, uid, gid, dontFollow) {
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, { follow: !dontFollow });
            node = lookup.node;
          } else {
            node = path;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          node.node_ops.setattr(node, { timestamp: Date.now() });
        }, lchown: function(path, uid, gid) {
          FS.chown(path, uid, gid, true);
        }, fchown: function(fd, uid, gid) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(8);
          }
          FS.chown(stream.node, uid, gid);
        }, truncate: function(path, len) {
          if (len < 0) {
            throw new FS.ErrnoError(28);
          }
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, { follow: true });
            node = lookup.node;
          } else {
            node = path;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isDir(node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!FS.isFile(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          var errCode = FS.nodePermissions(node, "w");
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          node.node_ops.setattr(node, { size: len, timestamp: Date.now() });
        }, ftruncate: function(fd, len) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(8);
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(28);
          }
          FS.truncate(stream.node, len);
        }, utime: function(path, atime, mtime) {
          var lookup = FS.lookupPath(path, { follow: true });
          var node = lookup.node;
          node.node_ops.setattr(node, { timestamp: Math.max(atime, mtime) });
        }, open: function(path, flags, mode, fd_start, fd_end) {
          if (path === "") {
            throw new FS.ErrnoError(44);
          }
          flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
          mode = typeof mode === "undefined" ? 438 : mode;
          if (flags & 64) {
            mode = mode & 4095 | 32768;
          } else {
            mode = 0;
          }
          var node;
          if (typeof path === "object") {
            node = path;
          } else {
            path = PATH.normalize(path);
            try {
              var lookup = FS.lookupPath(path, { follow: !(flags & 131072) });
              node = lookup.node;
            } catch (e) {
            }
          }
          var created = false;
          if (flags & 64) {
            if (node) {
              if (flags & 128) {
                throw new FS.ErrnoError(20);
              }
            } else {
              node = FS.mknod(path, mode, 0);
              created = true;
            }
          }
          if (!node) {
            throw new FS.ErrnoError(44);
          }
          if (FS.isChrdev(node.mode)) {
            flags &= ~512;
          }
          if (flags & 65536 && !FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
          if (!created) {
            var errCode = FS.mayOpen(node, flags);
            if (errCode) {
              throw new FS.ErrnoError(errCode);
            }
          }
          if (flags & 512) {
            FS.truncate(node, 0);
          }
          flags &= ~(128 | 512 | 131072);
          var stream = FS.createStream({ node, path: FS.getPath(node), flags, seekable: true, position: 0, stream_ops: node.stream_ops, ungotten: [], error: false }, fd_start, fd_end);
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
          if (Module["logReadFiles"] && !(flags & 1)) {
            if (!FS.readFiles)
              FS.readFiles = {};
            if (!(path in FS.readFiles)) {
              FS.readFiles[path] = 1;
              err("FS.trackingDelegate error on read file: " + path);
            }
          }
          try {
            if (FS.trackingDelegate["onOpenFile"]) {
              var trackingFlags = 0;
              if ((flags & 2097155) !== 1) {
                trackingFlags |= FS.tracking.openFlags.READ;
              }
              if ((flags & 2097155) !== 0) {
                trackingFlags |= FS.tracking.openFlags.WRITE;
              }
              FS.trackingDelegate["onOpenFile"](path, trackingFlags);
            }
          } catch (e) {
            err("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
          }
          return stream;
        }, close: function(stream) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (stream.getdents)
            stream.getdents = null;
          try {
            if (stream.stream_ops.close) {
              stream.stream_ops.close(stream);
            }
          } catch (e) {
            throw e;
          } finally {
            FS.closeStream(stream.fd);
          }
          stream.fd = null;
        }, isClosed: function(stream) {
          return stream.fd === null;
        }, llseek: function(stream, offset, whence) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (!stream.seekable || !stream.stream_ops.llseek) {
            throw new FS.ErrnoError(70);
          }
          if (whence != 0 && whence != 1 && whence != 2) {
            throw new FS.ErrnoError(28);
          }
          stream.position = stream.stream_ops.llseek(stream, offset, whence);
          stream.ungotten = [];
          return stream.position;
        }, read: function(stream, buffer2, offset, length, position) {
          offset >>>= 0;
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28);
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(8);
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!stream.stream_ops.read) {
            throw new FS.ErrnoError(28);
          }
          var seeking = typeof position !== "undefined";
          if (!seeking) {
            position = stream.position;
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(70);
          }
          var bytesRead = stream.stream_ops.read(stream, buffer2, offset, length, position);
          if (!seeking)
            stream.position += bytesRead;
          return bytesRead;
        }, write: function(stream, buffer2, offset, length, position, canOwn) {
          offset >>>= 0;
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28);
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8);
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!stream.stream_ops.write) {
            throw new FS.ErrnoError(28);
          }
          if (stream.seekable && stream.flags & 1024) {
            FS.llseek(stream, 0, 2);
          }
          var seeking = typeof position !== "undefined";
          if (!seeking) {
            position = stream.position;
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(70);
          }
          var bytesWritten = stream.stream_ops.write(stream, buffer2, offset, length, position, canOwn);
          if (!seeking)
            stream.position += bytesWritten;
          try {
            if (stream.path && FS.trackingDelegate["onWriteToFile"])
              FS.trackingDelegate["onWriteToFile"](stream.path);
          } catch (e) {
            err("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message);
          }
          return bytesWritten;
        }, allocate: function(stream, offset, length) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (offset < 0 || length <= 0) {
            throw new FS.ErrnoError(28);
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8);
          }
          if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (!stream.stream_ops.allocate) {
            throw new FS.ErrnoError(138);
          }
          stream.stream_ops.allocate(stream, offset, length);
        }, mmap: function(stream, address, length, position, prot, flags) {
          address >>>= 0;
          if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
            throw new FS.ErrnoError(2);
          }
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(2);
          }
          if (!stream.stream_ops.mmap) {
            throw new FS.ErrnoError(43);
          }
          return stream.stream_ops.mmap(stream, address, length, position, prot, flags);
        }, msync: function(stream, buffer2, offset, length, mmapFlags) {
          offset >>>= 0;
          if (!stream || !stream.stream_ops.msync) {
            return 0;
          }
          return stream.stream_ops.msync(stream, buffer2, offset, length, mmapFlags);
        }, munmap: function(stream) {
          return 0;
        }, ioctl: function(stream, cmd, arg) {
          if (!stream.stream_ops.ioctl) {
            throw new FS.ErrnoError(59);
          }
          return stream.stream_ops.ioctl(stream, cmd, arg);
        }, readFile: function(path, opts) {
          opts = opts || {};
          opts.flags = opts.flags || 0;
          opts.encoding = opts.encoding || "binary";
          if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
            throw new Error('Invalid encoding type "' + opts.encoding + '"');
          }
          var ret;
          var stream = FS.open(path, opts.flags);
          var stat = FS.stat(path);
          var length = stat.size;
          var buf = new Uint8Array(length);
          FS.read(stream, buf, 0, length, 0);
          if (opts.encoding === "utf8") {
            ret = UTF8ArrayToString(buf, 0);
          } else if (opts.encoding === "binary") {
            ret = buf;
          }
          FS.close(stream);
          return ret;
        }, writeFile: function(path, data, opts) {
          opts = opts || {};
          opts.flags = opts.flags || 577;
          var stream = FS.open(path, opts.flags, opts.mode);
          if (typeof data === "string") {
            var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
            var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
            FS.write(stream, buf, 0, actualNumBytes, void 0, opts.canOwn);
          } else if (ArrayBuffer.isView(data)) {
            FS.write(stream, data, 0, data.byteLength, void 0, opts.canOwn);
          } else {
            throw new Error("Unsupported data type");
          }
          FS.close(stream);
        }, cwd: function() {
          return FS.currentPath;
        }, chdir: function(path) {
          var lookup = FS.lookupPath(path, { follow: true });
          if (lookup.node === null) {
            throw new FS.ErrnoError(44);
          }
          if (!FS.isDir(lookup.node.mode)) {
            throw new FS.ErrnoError(54);
          }
          var errCode = FS.nodePermissions(lookup.node, "x");
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          FS.currentPath = lookup.path;
        }, createDefaultDirectories: function() {
          FS.mkdir("/tmp");
          FS.mkdir("/home");
          FS.mkdir("/home/web_user");
        }, createDefaultDevices: function() {
          FS.mkdir("/dev");
          FS.registerDevice(FS.makedev(1, 3), { read: function() {
            return 0;
          }, write: function(stream, buffer2, offset, length, pos) {
            return length;
          } });
          FS.mkdev("/dev/null", FS.makedev(1, 3));
          TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
          TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
          FS.mkdev("/dev/tty", FS.makedev(5, 0));
          FS.mkdev("/dev/tty1", FS.makedev(6, 0));
          var random_device = getRandomDevice();
          FS.createDevice("/dev", "random", random_device);
          FS.createDevice("/dev", "urandom", random_device);
          FS.mkdir("/dev/shm");
          FS.mkdir("/dev/shm/tmp");
        }, createSpecialDirectories: function() {
          FS.mkdir("/proc");
          var proc_self = FS.mkdir("/proc/self");
          FS.mkdir("/proc/self/fd");
          FS.mount({ mount: function() {
            var node = FS.createNode(proc_self, "fd", 16384 | 511, 73);
            node.node_ops = { lookup: function(parent, name2) {
              var fd = +name2;
              var stream = FS.getStream(fd);
              if (!stream)
                throw new FS.ErrnoError(8);
              var ret = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: function() {
                return stream.path;
              } } };
              ret.parent = ret;
              return ret;
            } };
            return node;
          } }, {}, "/proc/self/fd");
        }, createStandardStreams: function() {
          if (Module["stdin"]) {
            FS.createDevice("/dev", "stdin", Module["stdin"]);
          } else {
            FS.symlink("/dev/tty", "/dev/stdin");
          }
          if (Module["stdout"]) {
            FS.createDevice("/dev", "stdout", null, Module["stdout"]);
          } else {
            FS.symlink("/dev/tty", "/dev/stdout");
          }
          if (Module["stderr"]) {
            FS.createDevice("/dev", "stderr", null, Module["stderr"]);
          } else {
            FS.symlink("/dev/tty1", "/dev/stderr");
          }
          FS.open("/dev/stdin", 0);
          FS.open("/dev/stdout", 1);
          FS.open("/dev/stderr", 1);
        }, ensureErrnoError: function() {
          if (FS.ErrnoError)
            return;
          FS.ErrnoError = function ErrnoError(errno, node) {
            this.node = node;
            this.setErrno = function(errno2) {
              this.errno = errno2;
            };
            this.setErrno(errno);
            this.message = "FS error";
          };
          FS.ErrnoError.prototype = new Error();
          FS.ErrnoError.prototype.constructor = FS.ErrnoError;
          [44].forEach(function(code) {
            FS.genericErrors[code] = new FS.ErrnoError(code);
            FS.genericErrors[code].stack = "<generic error, no stack>";
          });
        }, staticInit: function() {
          FS.ensureErrnoError();
          FS.nameTable = new Array(4096);
          FS.mount(MEMFS, {}, "/");
          FS.createDefaultDirectories();
          FS.createDefaultDevices();
          FS.createSpecialDirectories();
          FS.filesystems = { "MEMFS": MEMFS };
        }, init: function(input, output, error) {
          FS.init.initialized = true;
          FS.ensureErrnoError();
          Module["stdin"] = input || Module["stdin"];
          Module["stdout"] = output || Module["stdout"];
          Module["stderr"] = error || Module["stderr"];
          FS.createStandardStreams();
        }, quit: function() {
          FS.init.initialized = false;
          var fflush = Module["_fflush"];
          if (fflush)
            fflush(0);
          for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (!stream) {
              continue;
            }
            FS.close(stream);
          }
        }, getMode: function(canRead, canWrite) {
          var mode = 0;
          if (canRead)
            mode |= 292 | 73;
          if (canWrite)
            mode |= 146;
          return mode;
        }, findObject: function(path, dontResolveLastLink) {
          var ret = FS.analyzePath(path, dontResolveLastLink);
          if (ret.exists) {
            return ret.object;
          } else {
            return null;
          }
        }, analyzePath: function(path, dontResolveLastLink) {
          try {
            var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
            path = lookup.path;
          } catch (e) {
          }
          var ret = { isRoot: false, exists: false, error: 0, name: null, path: null, object: null, parentExists: false, parentPath: null, parentObject: null };
          try {
            var lookup = FS.lookupPath(path, { parent: true });
            ret.parentExists = true;
            ret.parentPath = lookup.path;
            ret.parentObject = lookup.node;
            ret.name = PATH.basename(path);
            lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
            ret.exists = true;
            ret.path = lookup.path;
            ret.object = lookup.node;
            ret.name = lookup.node.name;
            ret.isRoot = lookup.path === "/";
          } catch (e) {
            ret.error = e.errno;
          }
          return ret;
        }, createPath: function(parent, path, canRead, canWrite) {
          parent = typeof parent === "string" ? parent : FS.getPath(parent);
          var parts = path.split("/").reverse();
          while (parts.length) {
            var part = parts.pop();
            if (!part)
              continue;
            var current = PATH.join2(parent, part);
            try {
              FS.mkdir(current);
            } catch (e) {
            }
            parent = current;
          }
          return current;
        }, createFile: function(parent, name2, properties, canRead, canWrite) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name2);
          var mode = FS.getMode(canRead, canWrite);
          return FS.create(path, mode);
        }, createDataFile: function(parent, name2, data, canRead, canWrite, canOwn) {
          var path = name2 ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name2) : parent;
          var mode = FS.getMode(canRead, canWrite);
          var node = FS.create(path, mode);
          if (data) {
            if (typeof data === "string") {
              var arr = new Array(data.length);
              for (var i = 0, len = data.length; i < len; ++i)
                arr[i] = data.charCodeAt(i);
              data = arr;
            }
            FS.chmod(node, mode | 146);
            var stream = FS.open(node, 577);
            FS.write(stream, data, 0, data.length, 0, canOwn);
            FS.close(stream);
            FS.chmod(node, mode);
          }
          return node;
        }, createDevice: function(parent, name2, input, output) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name2);
          var mode = FS.getMode(!!input, !!output);
          if (!FS.createDevice.major)
            FS.createDevice.major = 64;
          var dev = FS.makedev(FS.createDevice.major++, 0);
          FS.registerDevice(dev, { open: function(stream) {
            stream.seekable = false;
          }, close: function(stream) {
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          }, read: function(stream, buffer2, offset, length, pos) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === void 0 && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === void 0)
                break;
              bytesRead++;
              buffer2[offset + i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          }, write: function(stream, buffer2, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer2[offset + i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          } });
          return FS.mkdev(path, mode, dev);
        }, forceLoadFile: function(obj) {
          if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
            return true;
          if (typeof XMLHttpRequest !== "undefined") {
            throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
          } else if (read_) {
            try {
              obj.contents = intArrayFromString(read_(obj.url), true);
              obj.usedBytes = obj.contents.length;
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
          } else {
            throw new Error("Cannot load without read() or XMLHttpRequest.");
          }
        }, createLazyFile: function(parent, name2, url, canRead, canWrite) {
          function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = [];
          }
          LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length - 1 || idx < 0) {
              return void 0;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = idx / this.chunkSize | 0;
            return this.getter(chunkNum)[chunkOffset];
          };
          LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter;
          };
          LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
            var xhr = new XMLHttpRequest();
            xhr.open("HEAD", url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
              throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
            var chunkSize = 1024 * 1024;
            if (!hasByteServing)
              chunkSize = datalength;
            var doXHR = function(from, to) {
              if (from > to)
                throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
              if (to > datalength - 1)
                throw new Error("only " + datalength + " bytes available! programmer error!");
              var xhr2 = new XMLHttpRequest();
              xhr2.open("GET", url, false);
              if (datalength !== chunkSize)
                xhr2.setRequestHeader("Range", "bytes=" + from + "-" + to);
              if (typeof Uint8Array != "undefined")
                xhr2.responseType = "arraybuffer";
              if (xhr2.overrideMimeType) {
                xhr2.overrideMimeType("text/plain; charset=x-user-defined");
              }
              xhr2.send(null);
              if (!(xhr2.status >= 200 && xhr2.status < 300 || xhr2.status === 304))
                throw new Error("Couldn't load " + url + ". Status: " + xhr2.status);
              if (xhr2.response !== void 0) {
                return new Uint8Array(xhr2.response || []);
              } else {
                return intArrayFromString(xhr2.responseText || "", true);
              }
            };
            var lazyArray2 = this;
            lazyArray2.setDataGetter(function(chunkNum) {
              var start = chunkNum * chunkSize;
              var end = (chunkNum + 1) * chunkSize - 1;
              end = Math.min(end, datalength - 1);
              if (typeof lazyArray2.chunks[chunkNum] === "undefined") {
                lazyArray2.chunks[chunkNum] = doXHR(start, end);
              }
              if (typeof lazyArray2.chunks[chunkNum] === "undefined")
                throw new Error("doXHR failed!");
              return lazyArray2.chunks[chunkNum];
            });
            if (usesGzip || !datalength) {
              chunkSize = datalength = 1;
              datalength = this.getter(0).length;
              chunkSize = datalength;
              out("LazyFiles on gzip forces download of the whole file when length is accessed");
            }
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true;
          };
          if (typeof XMLHttpRequest !== "undefined") {
            if (!ENVIRONMENT_IS_WORKER)
              throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
            var lazyArray = new LazyUint8Array();
            Object.defineProperties(lazyArray, { length: { get: function() {
              if (!this.lengthKnown) {
                this.cacheLength();
              }
              return this._length;
            } }, chunkSize: { get: function() {
              if (!this.lengthKnown) {
                this.cacheLength();
              }
              return this._chunkSize;
            } } });
            var properties = { isDevice: false, contents: lazyArray };
          } else {
            var properties = { isDevice: false, url };
          }
          var node = FS.createFile(parent, name2, properties, canRead, canWrite);
          if (properties.contents) {
            node.contents = properties.contents;
          } else if (properties.url) {
            node.contents = null;
            node.url = properties.url;
          }
          Object.defineProperties(node, { usedBytes: { get: function() {
            return this.contents.length;
          } } });
          var stream_ops = {};
          var keys = Object.keys(node.stream_ops);
          keys.forEach(function(key2) {
            var fn = node.stream_ops[key2];
            stream_ops[key2] = function forceLoadLazyFile() {
              FS.forceLoadFile(node);
              return fn.apply(null, arguments);
            };
          });
          stream_ops.read = function stream_ops_read(stream, buffer2, offset, length, position) {
            FS.forceLoadFile(node);
            var contents = stream.node.contents;
            if (position >= contents.length)
              return 0;
            var size = Math.min(contents.length - position, length);
            if (contents.slice) {
              for (var i = 0; i < size; i++) {
                buffer2[offset + i] = contents[position + i];
              }
            } else {
              for (var i = 0; i < size; i++) {
                buffer2[offset + i] = contents.get(position + i);
              }
            }
            return size;
          };
          node.stream_ops = stream_ops;
          return node;
        }, createPreloadedFile: function(parent, name2, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
          Browser.init();
          var fullname = name2 ? PATH_FS.resolve(PATH.join2(parent, name2)) : parent;
          function processData(byteArray) {
            function finish(byteArray2) {
              if (preFinish)
                preFinish();
              if (!dontCreateFile) {
                FS.createDataFile(parent, name2, byteArray2, canRead, canWrite, canOwn);
              }
              if (onload)
                onload();
              removeRunDependency();
            }
            var handled = false;
            Module["preloadPlugins"].forEach(function(plugin) {
              if (handled)
                return;
              if (plugin["canHandle"](fullname)) {
                plugin["handle"](byteArray, fullname, finish, function() {
                  if (onerror)
                    onerror();
                  removeRunDependency();
                });
                handled = true;
              }
            });
            if (!handled)
              finish(byteArray);
          }
          addRunDependency();
          if (typeof url == "string") {
            asyncLoad(url, function(byteArray) {
              processData(byteArray);
            }, onerror);
          } else {
            processData(url);
          }
        }, indexedDB: function() {
          return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        }, DB_NAME: function() {
          return "EM_FS_" + window.location.pathname;
        }, DB_VERSION: 20, DB_STORE_NAME: "FILE_DATA", saveFilesToDB: function(paths, onload, onerror) {
          onload = onload || function() {
          };
          onerror = onerror || function() {
          };
          var indexedDB = FS.indexedDB();
          try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
          } catch (e) {
            return onerror(e);
          }
          openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
            out("creating db");
            var db = openRequest.result;
            db.createObjectStore(FS.DB_STORE_NAME);
          };
          openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0, fail = 0, total = paths.length;
            function finish() {
              if (fail == 0)
                onload();
              else
                onerror();
            }
            paths.forEach(function(path) {
              var putRequest = files.put(FS.analyzePath(path).object.contents, path);
              putRequest.onsuccess = function putRequest_onsuccess() {
                ok++;
                if (ok + fail == total)
                  finish();
              };
              putRequest.onerror = function putRequest_onerror() {
                fail++;
                if (ok + fail == total)
                  finish();
              };
            });
            transaction.onerror = onerror;
          };
          openRequest.onerror = onerror;
        }, loadFilesFromDB: function(paths, onload, onerror) {
          onload = onload || function() {
          };
          onerror = onerror || function() {
          };
          var indexedDB = FS.indexedDB();
          try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
          } catch (e) {
            return onerror(e);
          }
          openRequest.onupgradeneeded = onerror;
          openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            try {
              var transaction = db.transaction([FS.DB_STORE_NAME], "readonly");
            } catch (e) {
              onerror(e);
              return;
            }
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0, fail = 0, total = paths.length;
            function finish() {
              if (fail == 0)
                onload();
              else
                onerror();
            }
            paths.forEach(function(path) {
              var getRequest = files.get(path);
              getRequest.onsuccess = function getRequest_onsuccess() {
                if (FS.analyzePath(path).exists) {
                  FS.unlink(path);
                }
                FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                ok++;
                if (ok + fail == total)
                  finish();
              };
              getRequest.onerror = function getRequest_onerror() {
                fail++;
                if (ok + fail == total)
                  finish();
              };
            });
            transaction.onerror = onerror;
          };
          openRequest.onerror = onerror;
        } };
        var SYSCALLS = { mappings: {}, DEFAULT_POLLMASK: 5, umask: 511, calculateAt: function(dirfd, path, allowEmpty) {
          if (path[0] === "/") {
            return path;
          }
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream)
              throw new FS.ErrnoError(8);
            dir = dirstream.path;
          }
          if (path.length == 0) {
            if (!allowEmpty) {
              throw new FS.ErrnoError(44);
            }
            return dir;
          }
          return PATH.join2(dir, path);
        }, doStat: function(func, path, buf) {
          try {
            var stat = func(path);
          } catch (e) {
            if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
              return -54;
            }
            throw e;
          }
          GROWABLE_HEAP_I32()[buf >>> 2] = stat.dev;
          GROWABLE_HEAP_I32()[buf + 4 >>> 2] = 0;
          GROWABLE_HEAP_I32()[buf + 8 >>> 2] = stat.ino;
          GROWABLE_HEAP_I32()[buf + 12 >>> 2] = stat.mode;
          GROWABLE_HEAP_I32()[buf + 16 >>> 2] = stat.nlink;
          GROWABLE_HEAP_I32()[buf + 20 >>> 2] = stat.uid;
          GROWABLE_HEAP_I32()[buf + 24 >>> 2] = stat.gid;
          GROWABLE_HEAP_I32()[buf + 28 >>> 2] = stat.rdev;
          GROWABLE_HEAP_I32()[buf + 32 >>> 2] = 0;
          tempI64 = [stat.size >>> 0, (tempDouble = stat.size, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], GROWABLE_HEAP_I32()[buf + 40 >>> 2] = tempI64[0], GROWABLE_HEAP_I32()[buf + 44 >>> 2] = tempI64[1];
          GROWABLE_HEAP_I32()[buf + 48 >>> 2] = 4096;
          GROWABLE_HEAP_I32()[buf + 52 >>> 2] = stat.blocks;
          GROWABLE_HEAP_I32()[buf + 56 >>> 2] = stat.atime.getTime() / 1e3 | 0;
          GROWABLE_HEAP_I32()[buf + 60 >>> 2] = 0;
          GROWABLE_HEAP_I32()[buf + 64 >>> 2] = stat.mtime.getTime() / 1e3 | 0;
          GROWABLE_HEAP_I32()[buf + 68 >>> 2] = 0;
          GROWABLE_HEAP_I32()[buf + 72 >>> 2] = stat.ctime.getTime() / 1e3 | 0;
          GROWABLE_HEAP_I32()[buf + 76 >>> 2] = 0;
          tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], GROWABLE_HEAP_I32()[buf + 80 >>> 2] = tempI64[0], GROWABLE_HEAP_I32()[buf + 84 >>> 2] = tempI64[1];
          return 0;
        }, doMsync: function(addr, stream, len, flags, offset) {
          var buffer2 = GROWABLE_HEAP_U8().slice(addr, addr + len);
          FS.msync(stream, buffer2, offset, len, flags);
        }, doMkdir: function(path, mode) {
          path = PATH.normalize(path);
          if (path[path.length - 1] === "/")
            path = path.substr(0, path.length - 1);
          FS.mkdir(path, mode, 0);
          return 0;
        }, doMknod: function(path, mode, dev) {
          switch (mode & 61440) {
            case 32768:
            case 8192:
            case 24576:
            case 4096:
            case 49152:
              break;
            default:
              return -28;
          }
          FS.mknod(path, mode, dev);
          return 0;
        }, doReadlink: function(path, buf, bufsize) {
          if (bufsize <= 0)
            return -28;
          var ret = FS.readlink(path);
          var len = Math.min(bufsize, lengthBytesUTF8(ret));
          var endChar = GROWABLE_HEAP_I8()[buf + len >>> 0];
          stringToUTF8(ret, buf, bufsize + 1);
          GROWABLE_HEAP_I8()[buf + len >>> 0] = endChar;
          return len;
        }, doAccess: function(path, amode) {
          if (amode & ~7) {
            return -28;
          }
          var node;
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
          if (!node) {
            return -44;
          }
          var perms = "";
          if (amode & 4)
            perms += "r";
          if (amode & 2)
            perms += "w";
          if (amode & 1)
            perms += "x";
          if (perms && FS.nodePermissions(node, perms)) {
            return -2;
          }
          return 0;
        }, doDup: function(path, flags, suggestFD) {
          var suggest = FS.getStream(suggestFD);
          if (suggest)
            FS.close(suggest);
          return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
        }, doReadv: function(stream, iov, iovcnt, offset) {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = GROWABLE_HEAP_I32()[iov + i * 8 >>> 2];
            var len = GROWABLE_HEAP_I32()[iov + (i * 8 + 4) >>> 2];
            var curr = FS.read(stream, GROWABLE_HEAP_I8(), ptr, len, offset);
            if (curr < 0)
              return -1;
            ret += curr;
            if (curr < len)
              break;
          }
          return ret;
        }, doWritev: function(stream, iov, iovcnt, offset) {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = GROWABLE_HEAP_I32()[iov + i * 8 >>> 2];
            var len = GROWABLE_HEAP_I32()[iov + (i * 8 + 4) >>> 2];
            var curr = FS.write(stream, GROWABLE_HEAP_I8(), ptr, len, offset);
            if (curr < 0)
              return -1;
            ret += curr;
          }
          return ret;
        }, varargs: void 0, get: function() {
          SYSCALLS.varargs += 4;
          var ret = GROWABLE_HEAP_I32()[SYSCALLS.varargs - 4 >>> 2];
          return ret;
        }, getStr: function(ptr) {
          var ret = UTF8ToString(ptr);
          return ret;
        }, getStreamFromFD: function(fd) {
          var stream = FS.getStream(fd);
          if (!stream)
            throw new FS.ErrnoError(8);
          return stream;
        }, get64: function(low, high) {
          return low;
        } };
        function ___sys_fcntl64(fd, cmd, varargs) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(2, 1, fd, cmd, varargs);
          SYSCALLS.varargs = varargs;
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            switch (cmd) {
              case 0: {
                var arg = SYSCALLS.get();
                if (arg < 0) {
                  return -28;
                }
                var newStream;
                newStream = FS.open(stream.path, stream.flags, 0, arg);
                return newStream.fd;
              }
              case 1:
              case 2:
                return 0;
              case 3:
                return stream.flags;
              case 4: {
                var arg = SYSCALLS.get();
                stream.flags |= arg;
                return 0;
              }
              case 12: {
                var arg = SYSCALLS.get();
                var offset = 0;
                GROWABLE_HEAP_I16()[arg + offset >>> 1] = 2;
                return 0;
              }
              case 13:
              case 14:
                return 0;
              case 16:
              case 8:
                return -28;
              case 9:
                setErrNo(28);
                return -1;
              default: {
                return -28;
              }
            }
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return -e.errno;
          }
        }
        function ___sys_ioctl(fd, op, varargs) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(3, 1, fd, op, varargs);
          SYSCALLS.varargs = varargs;
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            switch (op) {
              case 21509:
              case 21505: {
                if (!stream.tty)
                  return -59;
                return 0;
              }
              case 21510:
              case 21511:
              case 21512:
              case 21506:
              case 21507:
              case 21508: {
                if (!stream.tty)
                  return -59;
                return 0;
              }
              case 21519: {
                if (!stream.tty)
                  return -59;
                var argp = SYSCALLS.get();
                GROWABLE_HEAP_I32()[argp >>> 2] = 0;
                return 0;
              }
              case 21520: {
                if (!stream.tty)
                  return -59;
                return -28;
              }
              case 21531: {
                var argp = SYSCALLS.get();
                return FS.ioctl(stream, op, argp);
              }
              case 21523: {
                if (!stream.tty)
                  return -59;
                return 0;
              }
              case 21524: {
                if (!stream.tty)
                  return -59;
                return 0;
              }
              default:
                abort("bad ioctl syscall " + op);
            }
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return -e.errno;
          }
        }
        function ___sys_open(path, flags, varargs) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(4, 1, path, flags, varargs);
          SYSCALLS.varargs = varargs;
          try {
            var pathname = SYSCALLS.getStr(path);
            var mode = varargs ? SYSCALLS.get() : 0;
            var stream = FS.open(pathname, flags, mode);
            return stream.fd;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return -e.errno;
          }
        }
        var tupleRegistrations = {};
        function runDestructors(destructors) {
          while (destructors.length) {
            var ptr = destructors.pop();
            var del = destructors.pop();
            del(ptr);
          }
        }
        function simpleReadValueFromPointer(pointer) {
          return this["fromWireType"](GROWABLE_HEAP_U32()[pointer >>> 2]);
        }
        var awaitingDependencies = {};
        var registeredTypes = {};
        var typeDependencies = {};
        var char_0 = 48;
        var char_9 = 57;
        function makeLegalFunctionName(name2) {
          if (name2 === void 0) {
            return "_unknown";
          }
          name2 = name2.replace(/[^a-zA-Z0-9_]/g, "$");
          var f = name2.charCodeAt(0);
          if (f >= char_0 && f <= char_9) {
            return "_" + name2;
          } else {
            return name2;
          }
        }
        function createNamedFunction(name2, body) {
          name2 = makeLegalFunctionName(name2);
          return new Function("body", "return function " + name2 + '() {\n    "use strict";    return body.apply(this, arguments);\n};\n')(body);
        }
        function extendError(baseErrorType, errorName) {
          var errorClass = createNamedFunction(errorName, function(message) {
            this.name = errorName;
            this.message = message;
            var stack = new Error(message).stack;
            if (stack !== void 0) {
              this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "");
            }
          });
          errorClass.prototype = Object.create(baseErrorType.prototype);
          errorClass.prototype.constructor = errorClass;
          errorClass.prototype.toString = function() {
            if (this.message === void 0) {
              return this.name;
            } else {
              return this.name + ": " + this.message;
            }
          };
          return errorClass;
        }
        var InternalError = void 0;
        function throwInternalError(message) {
          throw new InternalError(message);
        }
        function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
          myTypes.forEach(function(type) {
            typeDependencies[type] = dependentTypes;
          });
          function onComplete(typeConverters2) {
            var myTypeConverters = getTypeConverters(typeConverters2);
            if (myTypeConverters.length !== myTypes.length) {
              throwInternalError("Mismatched type converter count");
            }
            for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
            }
          }
          var typeConverters = new Array(dependentTypes.length);
          var unregisteredTypes = [];
          var registered = 0;
          dependentTypes.forEach(function(dt, i) {
            if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
            } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                typeConverters[i] = registeredTypes[dt];
                ++registered;
                if (registered === unregisteredTypes.length) {
                  onComplete(typeConverters);
                }
              });
            }
          });
          if (unregisteredTypes.length === 0) {
            onComplete(typeConverters);
          }
        }
        function __embind_finalize_value_array(rawTupleType) {
          var reg = tupleRegistrations[rawTupleType];
          delete tupleRegistrations[rawTupleType];
          var elements = reg.elements;
          var elementsLength = elements.length;
          var elementTypes = elements.map(function(elt) {
            return elt.getterReturnType;
          }).concat(elements.map(function(elt) {
            return elt.setterArgumentType;
          }));
          var rawConstructor = reg.rawConstructor;
          var rawDestructor = reg.rawDestructor;
          whenDependentTypesAreResolved([rawTupleType], elementTypes, function(elementTypes2) {
            elements.forEach(function(elt, i) {
              var getterReturnType = elementTypes2[i];
              var getter = elt.getter;
              var getterContext = elt.getterContext;
              var setterArgumentType = elementTypes2[i + elementsLength];
              var setter = elt.setter;
              var setterContext = elt.setterContext;
              elt.read = function(ptr) {
                return getterReturnType["fromWireType"](getter(getterContext, ptr));
              };
              elt.write = function(ptr, o) {
                var destructors = [];
                setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, o));
                runDestructors(destructors);
              };
            });
            return [{ name: reg.name, "fromWireType": function(ptr) {
              var rv = new Array(elementsLength);
              for (var i = 0; i < elementsLength; ++i) {
                rv[i] = elements[i].read(ptr);
              }
              rawDestructor(ptr);
              return rv;
            }, "toWireType": function(destructors, o) {
              if (elementsLength !== o.length) {
                throw new TypeError("Incorrect number of tuple elements for " + reg.name + ": expected=" + elementsLength + ", actual=" + o.length);
              }
              var ptr = rawConstructor();
              for (var i = 0; i < elementsLength; ++i) {
                elements[i].write(ptr, o[i]);
              }
              if (destructors !== null) {
                destructors.push(rawDestructor, ptr);
              }
              return ptr;
            }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: rawDestructor }];
          });
        }
        var structRegistrations = {};
        function __embind_finalize_value_object(structType) {
          var reg = structRegistrations[structType];
          delete structRegistrations[structType];
          var rawConstructor = reg.rawConstructor;
          var rawDestructor = reg.rawDestructor;
          var fieldRecords = reg.fields;
          var fieldTypes = fieldRecords.map(function(field) {
            return field.getterReturnType;
          }).concat(fieldRecords.map(function(field) {
            return field.setterArgumentType;
          }));
          whenDependentTypesAreResolved([structType], fieldTypes, function(fieldTypes2) {
            var fields = {};
            fieldRecords.forEach(function(field, i) {
              var fieldName = field.fieldName;
              var getterReturnType = fieldTypes2[i];
              var getter = field.getter;
              var getterContext = field.getterContext;
              var setterArgumentType = fieldTypes2[i + fieldRecords.length];
              var setter = field.setter;
              var setterContext = field.setterContext;
              fields[fieldName] = { read: function(ptr) {
                return getterReturnType["fromWireType"](getter(getterContext, ptr));
              }, write: function(ptr, o) {
                var destructors = [];
                setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, o));
                runDestructors(destructors);
              } };
            });
            return [{ name: reg.name, "fromWireType": function(ptr) {
              var rv = {};
              for (var i in fields) {
                rv[i] = fields[i].read(ptr);
              }
              rawDestructor(ptr);
              return rv;
            }, "toWireType": function(destructors, o) {
              for (var fieldName in fields) {
                if (!(fieldName in o)) {
                  throw new TypeError('Missing field:  "' + fieldName + '"');
                }
              }
              var ptr = rawConstructor();
              for (fieldName in fields) {
                fields[fieldName].write(ptr, o[fieldName]);
              }
              if (destructors !== null) {
                destructors.push(rawDestructor, ptr);
              }
              return ptr;
            }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: rawDestructor }];
          });
        }
        function __embind_register_bigint(primitiveType, name2, size, minRange, maxRange) {
        }
        function getShiftFromSize(size) {
          switch (size) {
            case 1:
              return 0;
            case 2:
              return 1;
            case 4:
              return 2;
            case 8:
              return 3;
            default:
              throw new TypeError("Unknown type size: " + size);
          }
        }
        function embind_init_charCodes() {
          var codes = new Array(256);
          for (var i = 0; i < 256; ++i) {
            codes[i] = String.fromCharCode(i);
          }
          embind_charCodes = codes;
        }
        var embind_charCodes = void 0;
        function readLatin1String(ptr) {
          var ret = "";
          var c = ptr;
          while (GROWABLE_HEAP_U8()[c >>> 0]) {
            ret += embind_charCodes[GROWABLE_HEAP_U8()[c++ >>> 0]];
          }
          return ret;
        }
        var BindingError = void 0;
        function throwBindingError(message) {
          throw new BindingError(message);
        }
        function registerType(rawType, registeredInstance, options) {
          options = options || {};
          if (!("argPackAdvance" in registeredInstance)) {
            throw new TypeError("registerType registeredInstance requires argPackAdvance");
          }
          var name2 = registeredInstance.name;
          if (!rawType) {
            throwBindingError('type "' + name2 + '" must have a positive integer typeid pointer');
          }
          if (registeredTypes.hasOwnProperty(rawType)) {
            if (options.ignoreDuplicateRegistrations) {
              return;
            } else {
              throwBindingError("Cannot register type '" + name2 + "' twice");
            }
          }
          registeredTypes[rawType] = registeredInstance;
          delete typeDependencies[rawType];
          if (awaitingDependencies.hasOwnProperty(rawType)) {
            var callbacks = awaitingDependencies[rawType];
            delete awaitingDependencies[rawType];
            callbacks.forEach(function(cb) {
              cb();
            });
          }
        }
        function __embind_register_bool(rawType, name2, size, trueValue, falseValue) {
          var shift = getShiftFromSize(size);
          name2 = readLatin1String(name2);
          registerType(rawType, { name: name2, "fromWireType": function(wt) {
            return !!wt;
          }, "toWireType": function(destructors, o) {
            return o ? trueValue : falseValue;
          }, "argPackAdvance": 8, "readValueFromPointer": function(pointer) {
            var heap;
            if (size === 1) {
              heap = GROWABLE_HEAP_I8();
            } else if (size === 2) {
              heap = GROWABLE_HEAP_I16();
            } else if (size === 4) {
              heap = GROWABLE_HEAP_I32();
            } else {
              throw new TypeError("Unknown boolean type size: " + name2);
            }
            return this["fromWireType"](heap[pointer >>> shift]);
          }, destructorFunction: null });
        }
        function ClassHandle_isAliasOf(other) {
          if (!(this instanceof ClassHandle)) {
            return false;
          }
          if (!(other instanceof ClassHandle)) {
            return false;
          }
          var leftClass = this.$$.ptrType.registeredClass;
          var left = this.$$.ptr;
          var rightClass = other.$$.ptrType.registeredClass;
          var right = other.$$.ptr;
          while (leftClass.baseClass) {
            left = leftClass.upcast(left);
            leftClass = leftClass.baseClass;
          }
          while (rightClass.baseClass) {
            right = rightClass.upcast(right);
            rightClass = rightClass.baseClass;
          }
          return leftClass === rightClass && left === right;
        }
        function shallowCopyInternalPointer(o) {
          return { count: o.count, deleteScheduled: o.deleteScheduled, preservePointerOnDelete: o.preservePointerOnDelete, ptr: o.ptr, ptrType: o.ptrType, smartPtr: o.smartPtr, smartPtrType: o.smartPtrType };
        }
        function throwInstanceAlreadyDeleted(obj) {
          function getInstanceTypeName(handle) {
            return handle.$$.ptrType.registeredClass.name;
          }
          throwBindingError(getInstanceTypeName(obj) + " instance already deleted");
        }
        var finalizationGroup = false;
        function detachFinalizer(handle) {
        }
        function runDestructor($$) {
          if ($$.smartPtr) {
            $$.smartPtrType.rawDestructor($$.smartPtr);
          } else {
            $$.ptrType.registeredClass.rawDestructor($$.ptr);
          }
        }
        function releaseClassHandle($$) {
          $$.count.value -= 1;
          var toDelete = $$.count.value === 0;
          if (toDelete) {
            runDestructor($$);
          }
        }
        function attachFinalizer(handle) {
          if (typeof FinalizationGroup === "undefined") {
            attachFinalizer = function(handle2) {
              return handle2;
            };
            return handle;
          }
          finalizationGroup = new FinalizationGroup(function(iter) {
            for (var result = iter.next(); !result.done; result = iter.next()) {
              var $$ = result.value;
              if (!$$.ptr) {
                console.warn("object already deleted: " + $$.ptr);
              } else {
                releaseClassHandle($$);
              }
            }
          });
          attachFinalizer = function(handle2) {
            finalizationGroup.register(handle2, handle2.$$, handle2.$$);
            return handle2;
          };
          detachFinalizer = function(handle2) {
            finalizationGroup.unregister(handle2.$$);
          };
          return attachFinalizer(handle);
        }
        function ClassHandle_clone() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
          if (this.$$.preservePointerOnDelete) {
            this.$$.count.value += 1;
            return this;
          } else {
            var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), { $$: { value: shallowCopyInternalPointer(this.$$) } }));
            clone.$$.count.value += 1;
            clone.$$.deleteScheduled = false;
            return clone;
          }
        }
        function ClassHandle_delete() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
          if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
            throwBindingError("Object already scheduled for deletion");
          }
          detachFinalizer(this);
          releaseClassHandle(this.$$);
          if (!this.$$.preservePointerOnDelete) {
            this.$$.smartPtr = void 0;
            this.$$.ptr = void 0;
          }
        }
        function ClassHandle_isDeleted() {
          return !this.$$.ptr;
        }
        var delayFunction = void 0;
        var deletionQueue = [];
        function flushPendingDeletes() {
          while (deletionQueue.length) {
            var obj = deletionQueue.pop();
            obj.$$.deleteScheduled = false;
            obj["delete"]();
          }
        }
        function ClassHandle_deleteLater() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
          if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
            throwBindingError("Object already scheduled for deletion");
          }
          deletionQueue.push(this);
          if (deletionQueue.length === 1 && delayFunction) {
            delayFunction(flushPendingDeletes);
          }
          this.$$.deleteScheduled = true;
          return this;
        }
        function init_ClassHandle() {
          ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
          ClassHandle.prototype["clone"] = ClassHandle_clone;
          ClassHandle.prototype["delete"] = ClassHandle_delete;
          ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
          ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater;
        }
        function ClassHandle() {
        }
        var registeredPointers = {};
        function ensureOverloadTable(proto, methodName, humanName) {
          if (proto[methodName].overloadTable === void 0) {
            var prevFunc = proto[methodName];
            proto[methodName] = function() {
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
            };
            proto[methodName].overloadTable = [];
            proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
          }
        }
        function exposePublicSymbol(name2, value, numArguments) {
          if (Module.hasOwnProperty(name2)) {
            if (numArguments === void 0 || Module[name2].overloadTable !== void 0 && Module[name2].overloadTable[numArguments] !== void 0) {
              throwBindingError("Cannot register public name '" + name2 + "' twice");
            }
            ensureOverloadTable(Module, name2, name2);
            if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
            }
            Module[name2].overloadTable[numArguments] = value;
          } else {
            Module[name2] = value;
            if (numArguments !== void 0) {
              Module[name2].numArguments = numArguments;
            }
          }
        }
        function RegisteredClass(name2, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
          this.name = name2;
          this.constructor = constructor;
          this.instancePrototype = instancePrototype;
          this.rawDestructor = rawDestructor;
          this.baseClass = baseClass;
          this.getActualType = getActualType;
          this.upcast = upcast;
          this.downcast = downcast;
          this.pureVirtualFunctions = [];
        }
        function upcastPointer(ptr, ptrClass, desiredClass) {
          while (ptrClass !== desiredClass) {
            if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
            }
            ptr = ptrClass.upcast(ptr);
            ptrClass = ptrClass.baseClass;
          }
          return ptr;
        }
        function constNoSmartPtrRawPointerToWireType(destructors, handle) {
          if (handle === null) {
            if (this.isReference) {
              throwBindingError("null is not a valid " + this.name);
            }
            return 0;
          }
          if (!handle.$$) {
            throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
          }
          if (!handle.$$.ptr) {
            throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
          }
          var handleClass = handle.$$.ptrType.registeredClass;
          var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
          return ptr;
        }
        function genericPointerToWireType(destructors, handle) {
          var ptr;
          if (handle === null) {
            if (this.isReference) {
              throwBindingError("null is not a valid " + this.name);
            }
            if (this.isSmartPointer) {
              ptr = this.rawConstructor();
              if (destructors !== null) {
                destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
            } else {
              return 0;
            }
          }
          if (!handle.$$) {
            throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
          }
          if (!handle.$$.ptr) {
            throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
          }
          if (!this.isConst && handle.$$.ptrType.isConst) {
            throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
          }
          var handleClass = handle.$$.ptrType.registeredClass;
          ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
          if (this.isSmartPointer) {
            if (handle.$$.smartPtr === void 0) {
              throwBindingError("Passing raw pointer to smart pointer is illegal");
            }
            switch (this.sharingPolicy) {
              case 0:
                if (handle.$$.smartPtrType === this) {
                  ptr = handle.$$.smartPtr;
                } else {
                  throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
                }
                break;
              case 1:
                ptr = handle.$$.smartPtr;
                break;
              case 2:
                if (handle.$$.smartPtrType === this) {
                  ptr = handle.$$.smartPtr;
                } else {
                  var clonedHandle = handle["clone"]();
                  ptr = this.rawShare(ptr, __emval_register(function() {
                    clonedHandle["delete"]();
                  }));
                  if (destructors !== null) {
                    destructors.push(this.rawDestructor, ptr);
                  }
                }
                break;
              default:
                throwBindingError("Unsupporting sharing policy");
            }
          }
          return ptr;
        }
        function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
          if (handle === null) {
            if (this.isReference) {
              throwBindingError("null is not a valid " + this.name);
            }
            return 0;
          }
          if (!handle.$$) {
            throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
          }
          if (!handle.$$.ptr) {
            throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
          }
          if (handle.$$.ptrType.isConst) {
            throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name);
          }
          var handleClass = handle.$$.ptrType.registeredClass;
          var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
          return ptr;
        }
        function RegisteredPointer_getPointee(ptr) {
          if (this.rawGetPointee) {
            ptr = this.rawGetPointee(ptr);
          }
          return ptr;
        }
        function RegisteredPointer_destructor(ptr) {
          if (this.rawDestructor) {
            this.rawDestructor(ptr);
          }
        }
        function RegisteredPointer_deleteObject(handle) {
          if (handle !== null) {
            handle["delete"]();
          }
        }
        function downcastPointer(ptr, ptrClass, desiredClass) {
          if (ptrClass === desiredClass) {
            return ptr;
          }
          if (desiredClass.baseClass === void 0) {
            return null;
          }
          var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
          if (rv === null) {
            return null;
          }
          return desiredClass.downcast(rv);
        }
        function getInheritedInstanceCount() {
          return Object.keys(registeredInstances).length;
        }
        function getLiveInheritedInstances() {
          var rv = [];
          for (var k in registeredInstances) {
            if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
            }
          }
          return rv;
        }
        function setDelayFunction(fn) {
          delayFunction = fn;
          if (deletionQueue.length && delayFunction) {
            delayFunction(flushPendingDeletes);
          }
        }
        function init_embind() {
          Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
          Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
          Module["flushPendingDeletes"] = flushPendingDeletes;
          Module["setDelayFunction"] = setDelayFunction;
        }
        var registeredInstances = {};
        function getBasestPointer(class_, ptr) {
          if (ptr === void 0) {
            throwBindingError("ptr should not be undefined");
          }
          while (class_.baseClass) {
            ptr = class_.upcast(ptr);
            class_ = class_.baseClass;
          }
          return ptr;
        }
        function getInheritedInstance(class_, ptr) {
          ptr = getBasestPointer(class_, ptr);
          return registeredInstances[ptr];
        }
        function makeClassHandle(prototype, record) {
          if (!record.ptrType || !record.ptr) {
            throwInternalError("makeClassHandle requires ptr and ptrType");
          }
          var hasSmartPtrType = !!record.smartPtrType;
          var hasSmartPtr = !!record.smartPtr;
          if (hasSmartPtrType !== hasSmartPtr) {
            throwInternalError("Both smartPtrType and smartPtr must be specified");
          }
          record.count = { value: 1 };
          return attachFinalizer(Object.create(prototype, { $$: { value: record } }));
        }
        function RegisteredPointer_fromWireType(ptr) {
          var rawPointer = this.getPointee(ptr);
          if (!rawPointer) {
            this.destructor(ptr);
            return null;
          }
          var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
          if (registeredInstance !== void 0) {
            if (registeredInstance.$$.count.value === 0) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance["clone"]();
            } else {
              var rv = registeredInstance["clone"]();
              this.destructor(ptr);
              return rv;
            }
          }
          function makeDefaultHandle() {
            if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, { ptrType: this.pointeeType, ptr: rawPointer, smartPtrType: this, smartPtr: ptr });
            } else {
              return makeClassHandle(this.registeredClass.instancePrototype, { ptrType: this, ptr });
            }
          }
          var actualType = this.registeredClass.getActualType(rawPointer);
          var registeredPointerRecord = registeredPointers[actualType];
          if (!registeredPointerRecord) {
            return makeDefaultHandle.call(this);
          }
          var toType;
          if (this.isConst) {
            toType = registeredPointerRecord.constPointerType;
          } else {
            toType = registeredPointerRecord.pointerType;
          }
          var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
          if (dp === null) {
            return makeDefaultHandle.call(this);
          }
          if (this.isSmartPointer) {
            return makeClassHandle(toType.registeredClass.instancePrototype, { ptrType: toType, ptr: dp, smartPtrType: this, smartPtr: ptr });
          } else {
            return makeClassHandle(toType.registeredClass.instancePrototype, { ptrType: toType, ptr: dp });
          }
        }
        function init_RegisteredPointer() {
          RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
          RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
          RegisteredPointer.prototype["argPackAdvance"] = 8;
          RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
          RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
          RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType;
        }
        function RegisteredPointer(name2, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
          this.name = name2;
          this.registeredClass = registeredClass;
          this.isReference = isReference;
          this.isConst = isConst;
          this.isSmartPointer = isSmartPointer;
          this.pointeeType = pointeeType;
          this.sharingPolicy = sharingPolicy;
          this.rawGetPointee = rawGetPointee;
          this.rawConstructor = rawConstructor;
          this.rawShare = rawShare;
          this.rawDestructor = rawDestructor;
          if (!isSmartPointer && registeredClass.baseClass === void 0) {
            if (isConst) {
              this["toWireType"] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
            } else {
              this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
            }
          } else {
            this["toWireType"] = genericPointerToWireType;
          }
        }
        function replacePublicSymbol(name2, value, numArguments) {
          if (!Module.hasOwnProperty(name2)) {
            throwInternalError("Replacing nonexistant public symbol");
          }
          if (Module[name2].overloadTable !== void 0 && numArguments !== void 0) {
            Module[name2].overloadTable[numArguments] = value;
          } else {
            Module[name2] = value;
            Module[name2].argCount = numArguments;
          }
        }
        function dynCallLegacy(sig, ptr, args) {
          var f = Module["dynCall_" + sig];
          return args && args.length ? f.apply(null, [ptr].concat(args)) : f.call(null, ptr);
        }
        function dynCall(sig, ptr, args) {
          if (sig.includes("j")) {
            return dynCallLegacy(sig, ptr, args);
          }
          return wasmTable.get(ptr).apply(null, args);
        }
        function getDynCaller(sig, ptr) {
          var argCache = [];
          return function() {
            argCache.length = arguments.length;
            for (var i = 0; i < arguments.length; i++) {
              argCache[i] = arguments[i];
            }
            return dynCall(sig, ptr, argCache);
          };
        }
        function embind__requireFunction(signature, rawFunction) {
          signature = readLatin1String(signature);
          function makeDynCaller() {
            if (signature.includes("j")) {
              return getDynCaller(signature, rawFunction);
            }
            return wasmTable.get(rawFunction);
          }
          var fp = makeDynCaller();
          if (typeof fp !== "function") {
            throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
          }
          return fp;
        }
        var UnboundTypeError = void 0;
        function getTypeName(type) {
          var ptr = ___getTypeName(type);
          var rv = readLatin1String(ptr);
          _free(ptr);
          return rv;
        }
        function throwUnboundTypeError(message, types) {
          var unboundTypes = [];
          var seen = {};
          function visit(type) {
            if (seen[type]) {
              return;
            }
            if (registeredTypes[type]) {
              return;
            }
            if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
            }
            unboundTypes.push(type);
            seen[type] = true;
          }
          types.forEach(visit);
          throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]));
        }
        function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name2, destructorSignature, rawDestructor) {
          name2 = readLatin1String(name2);
          getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
          if (upcast) {
            upcast = embind__requireFunction(upcastSignature, upcast);
          }
          if (downcast) {
            downcast = embind__requireFunction(downcastSignature, downcast);
          }
          rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
          var legalFunctionName = makeLegalFunctionName(name2);
          exposePublicSymbol(legalFunctionName, function() {
            throwUnboundTypeError("Cannot construct " + name2 + " due to unbound types", [baseClassRawType]);
          });
          whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function(base) {
            base = base[0];
            var baseClass;
            var basePrototype;
            if (baseClassRawType) {
              baseClass = base.registeredClass;
              basePrototype = baseClass.instancePrototype;
            } else {
              basePrototype = ClassHandle.prototype;
            }
            var constructor = createNamedFunction(legalFunctionName, function() {
              if (Object.getPrototypeOf(this) !== instancePrototype) {
                throw new BindingError("Use 'new' to construct " + name2);
              }
              if (registeredClass.constructor_body === void 0) {
                throw new BindingError(name2 + " has no accessible constructor");
              }
              var body = registeredClass.constructor_body[arguments.length];
              if (body === void 0) {
                throw new BindingError("Tried to invoke ctor of " + name2 + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
              }
              return body.apply(this, arguments);
            });
            var instancePrototype = Object.create(basePrototype, { constructor: { value: constructor } });
            constructor.prototype = instancePrototype;
            var registeredClass = new RegisteredClass(name2, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
            var referenceConverter = new RegisteredPointer(name2, registeredClass, true, false, false);
            var pointerConverter = new RegisteredPointer(name2 + "*", registeredClass, false, false, false);
            var constPointerConverter = new RegisteredPointer(name2 + " const*", registeredClass, false, true, false);
            registeredPointers[rawType] = { pointerType: pointerConverter, constPointerType: constPointerConverter };
            replacePublicSymbol(legalFunctionName, constructor);
            return [referenceConverter, pointerConverter, constPointerConverter];
          });
        }
        function heap32VectorToArray(count, firstElement) {
          var array = [];
          for (var i = 0; i < count; i++) {
            array.push(GROWABLE_HEAP_I32()[(firstElement >> 2) + i >>> 0]);
          }
          return array;
        }
        function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
          assert(argCount > 0);
          var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
          invoker = embind__requireFunction(invokerSignature, invoker);
          var args = [rawConstructor];
          var destructors = [];
          whenDependentTypesAreResolved([], [rawClassType], function(classType) {
            classType = classType[0];
            var humanName = "constructor " + classType.name;
            if (classType.registeredClass.constructor_body === void 0) {
              classType.registeredClass.constructor_body = [];
            }
            if (classType.registeredClass.constructor_body[argCount - 1] !== void 0) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
            }
            classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes);
            };
            whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                if (arguments.length !== argCount - 1) {
                  throwBindingError(humanName + " called with " + arguments.length + " arguments, expected " + (argCount - 1));
                }
                destructors.length = 0;
                args.length = argCount;
                for (var i = 1; i < argCount; ++i) {
                  args[i] = argTypes[i]["toWireType"](destructors, arguments[i - 1]);
                }
                var ptr = invoker.apply(null, args);
                runDestructors(destructors);
                return argTypes[0]["fromWireType"](ptr);
              };
              return [];
            });
            return [];
          });
        }
        function new_(constructor, argumentList) {
          if (!(constructor instanceof Function)) {
            throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function");
          }
          var dummy = createNamedFunction(constructor.name || "unknownFunctionName", function() {
          });
          dummy.prototype = constructor.prototype;
          var obj = new dummy();
          var r = constructor.apply(obj, argumentList);
          return r instanceof Object ? r : obj;
        }
        function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
          var argCount = argTypes.length;
          if (argCount < 2) {
            throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
          }
          var isClassMethodFunc = argTypes[1] !== null && classType !== null;
          var needsDestructorStack = false;
          for (var i = 1; i < argTypes.length; ++i) {
            if (argTypes[i] !== null && argTypes[i].destructorFunction === void 0) {
              needsDestructorStack = true;
              break;
            }
          }
          var returns = argTypes[0].name !== "void";
          var argsList = "";
          var argsListWired = "";
          for (var i = 0; i < argCount - 2; ++i) {
            argsList += (i !== 0 ? ", " : "") + "arg" + i;
            argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired";
          }
          var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\nif (arguments.length !== " + (argCount - 2) + ") {\nthrowBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n}\n";
          if (needsDestructorStack) {
            invokerFnBody += "var destructors = [];\n";
          }
          var dtorStack = needsDestructorStack ? "destructors" : "null";
          var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
          var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
          if (isClassMethodFunc) {
            invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n";
          }
          for (var i = 0; i < argCount - 2; ++i) {
            invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
            args1.push("argType" + i);
            args2.push(argTypes[i + 2]);
          }
          if (isClassMethodFunc) {
            argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
          }
          invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";
          if (needsDestructorStack) {
            invokerFnBody += "runDestructors(destructors);\n";
          } else {
            for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
              var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
              if (argTypes[i].destructorFunction !== null) {
                invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
                args1.push(paramName + "_dtor");
                args2.push(argTypes[i].destructorFunction);
              }
            }
          }
          if (returns) {
            invokerFnBody += "var ret = retType.fromWireType(rv);\nreturn ret;\n";
          }
          invokerFnBody += "}\n";
          args1.push(invokerFnBody);
          var invokerFunction = new_(Function, args1).apply(null, args2);
          return invokerFunction;
        }
        function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
          var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
          methodName = readLatin1String(methodName);
          rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
          whenDependentTypesAreResolved([], [rawClassType], function(classType) {
            classType = classType[0];
            var humanName = classType.name + "." + methodName;
            if (methodName.startsWith("@@")) {
              methodName = Symbol[methodName.substring(2)];
            }
            if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
            }
            function unboundTypesHandler() {
              throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes);
            }
            var proto = classType.registeredClass.instancePrototype;
            var method = proto[methodName];
            if (method === void 0 || method.overloadTable === void 0 && method.className !== classType.name && method.argCount === argCount - 2) {
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
            } else {
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
            }
            whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
              if (proto[methodName].overloadTable === void 0) {
                memberFunction.argCount = argCount - 2;
                proto[methodName] = memberFunction;
              } else {
                proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
              return [];
            });
            return [];
          });
        }
        var emval_free_list = [];
        var emval_handle_array = [{}, { value: void 0 }, { value: null }, { value: true }, { value: false }];
        function __emval_decref(handle) {
          if (handle > 4 && --emval_handle_array[handle].refcount === 0) {
            emval_handle_array[handle] = void 0;
            emval_free_list.push(handle);
          }
        }
        function count_emval_handles() {
          var count = 0;
          for (var i = 5; i < emval_handle_array.length; ++i) {
            if (emval_handle_array[i] !== void 0) {
              ++count;
            }
          }
          return count;
        }
        function get_first_emval() {
          for (var i = 5; i < emval_handle_array.length; ++i) {
            if (emval_handle_array[i] !== void 0) {
              return emval_handle_array[i];
            }
          }
          return null;
        }
        function init_emval() {
          Module["count_emval_handles"] = count_emval_handles;
          Module["get_first_emval"] = get_first_emval;
        }
        function __emval_register(value) {
          switch (value) {
            case void 0: {
              return 1;
            }
            case null: {
              return 2;
            }
            case true: {
              return 3;
            }
            case false: {
              return 4;
            }
            default: {
              var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
              emval_handle_array[handle] = { refcount: 1, value };
              return handle;
            }
          }
        }
        function __embind_register_emval(rawType, name2) {
          name2 = readLatin1String(name2);
          registerType(rawType, { name: name2, "fromWireType": function(handle) {
            var rv = emval_handle_array[handle].value;
            __emval_decref(handle);
            return rv;
          }, "toWireType": function(destructors, value) {
            return __emval_register(value);
          }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: null });
        }
        function enumReadValueFromPointer(name2, shift, signed) {
          switch (shift) {
            case 0:
              return function(pointer) {
                var heap = signed ? GROWABLE_HEAP_I8() : GROWABLE_HEAP_U8();
                return this["fromWireType"](heap[pointer >>> 0]);
              };
            case 1:
              return function(pointer) {
                var heap = signed ? GROWABLE_HEAP_I16() : GROWABLE_HEAP_U16();
                return this["fromWireType"](heap[pointer >>> 1]);
              };
            case 2:
              return function(pointer) {
                var heap = signed ? GROWABLE_HEAP_I32() : GROWABLE_HEAP_U32();
                return this["fromWireType"](heap[pointer >>> 2]);
              };
            default:
              throw new TypeError("Unknown integer type: " + name2);
          }
        }
        function __embind_register_enum(rawType, name2, size, isSigned) {
          var shift = getShiftFromSize(size);
          name2 = readLatin1String(name2);
          function ctor() {
          }
          ctor.values = {};
          registerType(rawType, { name: name2, constructor: ctor, "fromWireType": function(c) {
            return this.constructor.values[c];
          }, "toWireType": function(destructors, c) {
            return c.value;
          }, "argPackAdvance": 8, "readValueFromPointer": enumReadValueFromPointer(name2, shift, isSigned), destructorFunction: null });
          exposePublicSymbol(name2, ctor);
        }
        function requireRegisteredType(rawType, humanName) {
          var impl = registeredTypes[rawType];
          if (impl === void 0) {
            throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
          }
          return impl;
        }
        function __embind_register_enum_value(rawEnumType, name2, enumValue) {
          var enumType = requireRegisteredType(rawEnumType, "enum");
          name2 = readLatin1String(name2);
          var Enum = enumType.constructor;
          var Value2 = Object.create(enumType.constructor.prototype, { value: { value: enumValue }, constructor: { value: createNamedFunction(enumType.name + "_" + name2, function() {
          }) } });
          Enum.values[enumValue] = Value2;
          Enum[name2] = Value2;
        }
        function _embind_repr(v) {
          if (v === null) {
            return "null";
          }
          var t = typeof v;
          if (t === "object" || t === "array" || t === "function") {
            return v.toString();
          } else {
            return "" + v;
          }
        }
        function floatReadValueFromPointer(name2, shift) {
          switch (shift) {
            case 2:
              return function(pointer) {
                return this["fromWireType"](GROWABLE_HEAP_F32()[pointer >>> 2]);
              };
            case 3:
              return function(pointer) {
                return this["fromWireType"](GROWABLE_HEAP_F64()[pointer >>> 3]);
              };
            default:
              throw new TypeError("Unknown float type: " + name2);
          }
        }
        function __embind_register_float(rawType, name2, size) {
          var shift = getShiftFromSize(size);
          name2 = readLatin1String(name2);
          registerType(rawType, { name: name2, "fromWireType": function(value) {
            return value;
          }, "toWireType": function(destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
              throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
            }
            return value;
          }, "argPackAdvance": 8, "readValueFromPointer": floatReadValueFromPointer(name2, shift), destructorFunction: null });
        }
        function __embind_register_function(name2, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
          var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
          name2 = readLatin1String(name2);
          rawInvoker = embind__requireFunction(signature, rawInvoker);
          exposePublicSymbol(name2, function() {
            throwUnboundTypeError("Cannot call " + name2 + " due to unbound types", argTypes);
          }, argCount - 1);
          whenDependentTypesAreResolved([], argTypes, function(argTypes2) {
            var invokerArgsArray = [argTypes2[0], null].concat(argTypes2.slice(1));
            replacePublicSymbol(name2, craftInvokerFunction(name2, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
            return [];
          });
        }
        function integerReadValueFromPointer(name2, shift, signed) {
          switch (shift) {
            case 0:
              return signed ? function readS8FromPointer(pointer) {
                return GROWABLE_HEAP_I8()[pointer >>> 0];
              } : function readU8FromPointer(pointer) {
                return GROWABLE_HEAP_U8()[pointer >>> 0];
              };
            case 1:
              return signed ? function readS16FromPointer(pointer) {
                return GROWABLE_HEAP_I16()[pointer >>> 1];
              } : function readU16FromPointer(pointer) {
                return GROWABLE_HEAP_U16()[pointer >>> 1];
              };
            case 2:
              return signed ? function readS32FromPointer(pointer) {
                return GROWABLE_HEAP_I32()[pointer >>> 2];
              } : function readU32FromPointer(pointer) {
                return GROWABLE_HEAP_U32()[pointer >>> 2];
              };
            default:
              throw new TypeError("Unknown integer type: " + name2);
          }
        }
        function __embind_register_integer(primitiveType, name2, size, minRange, maxRange) {
          name2 = readLatin1String(name2);
          if (maxRange === -1) {
            maxRange = 4294967295;
          }
          var shift = getShiftFromSize(size);
          var fromWireType = function(value) {
            return value;
          };
          if (minRange === 0) {
            var bitshift = 32 - 8 * size;
            fromWireType = function(value) {
              return value << bitshift >>> bitshift;
            };
          }
          var isUnsignedType = name2.includes("unsigned");
          registerType(primitiveType, { name: name2, "fromWireType": fromWireType, "toWireType": function(destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
              throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
            }
            if (value < minRange || value > maxRange) {
              throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name2 + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!");
            }
            return isUnsignedType ? value >>> 0 : value | 0;
          }, "argPackAdvance": 8, "readValueFromPointer": integerReadValueFromPointer(name2, shift, minRange !== 0), destructorFunction: null });
        }
        function __embind_register_memory_view(rawType, dataTypeIndex, name2) {
          var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
          var TA = typeMapping[dataTypeIndex];
          function decodeMemoryView(handle) {
            handle = handle >> 2;
            var heap = GROWABLE_HEAP_U32();
            var size = heap[handle >>> 0];
            var data = heap[handle + 1 >>> 0];
            return new TA(buffer, data, size);
          }
          name2 = readLatin1String(name2);
          registerType(rawType, { name: name2, "fromWireType": decodeMemoryView, "argPackAdvance": 8, "readValueFromPointer": decodeMemoryView }, { ignoreDuplicateRegistrations: true });
        }
        function __embind_register_std_string(rawType, name2) {
          name2 = readLatin1String(name2);
          var stdStringIsUTF8 = name2 === "std::string";
          registerType(rawType, { name: name2, "fromWireType": function(value) {
            var length = GROWABLE_HEAP_U32()[value >>> 2];
            var str;
            if (stdStringIsUTF8) {
              var decodeStartPtr = value + 4;
              for (var i = 0; i <= length; ++i) {
                var currentBytePtr = value + 4 + i;
                if (i == length || GROWABLE_HEAP_U8()[currentBytePtr >>> 0] == 0) {
                  var maxRead = currentBytePtr - decodeStartPtr;
                  var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                  if (str === void 0) {
                    str = stringSegment;
                  } else {
                    str += String.fromCharCode(0);
                    str += stringSegment;
                  }
                  decodeStartPtr = currentBytePtr + 1;
                }
              }
            } else {
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {
                a[i] = String.fromCharCode(GROWABLE_HEAP_U8()[value + 4 + i >>> 0]);
              }
              str = a.join("");
            }
            _free(value);
            return str;
          }, "toWireType": function(destructors, value) {
            if (value instanceof ArrayBuffer) {
              value = new Uint8Array(value);
            }
            var getLength;
            var valueIsOfTypeString = typeof value === "string";
            if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
              throwBindingError("Cannot pass non-string to std::string");
            }
            if (stdStringIsUTF8 && valueIsOfTypeString) {
              getLength = function() {
                return lengthBytesUTF8(value);
              };
            } else {
              getLength = function() {
                return value.length;
              };
            }
            var length = getLength();
            var ptr = _malloc(4 + length + 1);
            ptr >>>= 0;
            GROWABLE_HEAP_U32()[ptr >>> 2] = length;
            if (stdStringIsUTF8 && valueIsOfTypeString) {
              stringToUTF8(value, ptr + 4, length + 1);
            } else {
              if (valueIsOfTypeString) {
                for (var i = 0; i < length; ++i) {
                  var charCode = value.charCodeAt(i);
                  if (charCode > 255) {
                    _free(ptr);
                    throwBindingError("String has UTF-16 code units that do not fit in 8 bits");
                  }
                  GROWABLE_HEAP_U8()[ptr + 4 + i >>> 0] = charCode;
                }
              } else {
                for (var i = 0; i < length; ++i) {
                  GROWABLE_HEAP_U8()[ptr + 4 + i >>> 0] = value[i];
                }
              }
            }
            if (destructors !== null) {
              destructors.push(_free, ptr);
            }
            return ptr;
          }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: function(ptr) {
            _free(ptr);
          } });
        }
        function __embind_register_std_wstring(rawType, charSize, name2) {
          name2 = readLatin1String(name2);
          var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
          if (charSize === 2) {
            decodeString = UTF16ToString;
            encodeString = stringToUTF16;
            lengthBytesUTF = lengthBytesUTF16;
            getHeap = function() {
              return GROWABLE_HEAP_U16();
            };
            shift = 1;
          } else if (charSize === 4) {
            decodeString = UTF32ToString;
            encodeString = stringToUTF32;
            lengthBytesUTF = lengthBytesUTF32;
            getHeap = function() {
              return GROWABLE_HEAP_U32();
            };
            shift = 2;
          }
          registerType(rawType, { name: name2, "fromWireType": function(value) {
            var length = GROWABLE_HEAP_U32()[value >>> 2];
            var HEAP = getHeap();
            var str;
            var decodeStartPtr = value + 4;
            for (var i = 0; i <= length; ++i) {
              var currentBytePtr = value + 4 + i * charSize;
              if (i == length || HEAP[currentBytePtr >>> shift] == 0) {
                var maxReadBytes = currentBytePtr - decodeStartPtr;
                var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
                if (str === void 0) {
                  str = stringSegment;
                } else {
                  str += String.fromCharCode(0);
                  str += stringSegment;
                }
                decodeStartPtr = currentBytePtr + charSize;
              }
            }
            _free(value);
            return str;
          }, "toWireType": function(destructors, value) {
            if (!(typeof value === "string")) {
              throwBindingError("Cannot pass non-string to C++ string type " + name2);
            }
            var length = lengthBytesUTF(value);
            var ptr = _malloc(4 + length + charSize);
            ptr >>>= 0;
            GROWABLE_HEAP_U32()[ptr >>> 2] = length >> shift;
            encodeString(value, ptr + 4, length + charSize);
            if (destructors !== null) {
              destructors.push(_free, ptr);
            }
            return ptr;
          }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: function(ptr) {
            _free(ptr);
          } });
        }
        function __embind_register_value_array(rawType, name2, constructorSignature, rawConstructor, destructorSignature, rawDestructor) {
          tupleRegistrations[rawType] = { name: readLatin1String(name2), rawConstructor: embind__requireFunction(constructorSignature, rawConstructor), rawDestructor: embind__requireFunction(destructorSignature, rawDestructor), elements: [] };
        }
        function __embind_register_value_array_element(rawTupleType, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
          tupleRegistrations[rawTupleType].elements.push({ getterReturnType, getter: embind__requireFunction(getterSignature, getter), getterContext, setterArgumentType, setter: embind__requireFunction(setterSignature, setter), setterContext });
        }
        function __embind_register_value_object(rawType, name2, constructorSignature, rawConstructor, destructorSignature, rawDestructor) {
          structRegistrations[rawType] = { name: readLatin1String(name2), rawConstructor: embind__requireFunction(constructorSignature, rawConstructor), rawDestructor: embind__requireFunction(destructorSignature, rawDestructor), fields: [] };
        }
        function __embind_register_value_object_field(structType, fieldName, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
          structRegistrations[structType].fields.push({ fieldName: readLatin1String(fieldName), getterReturnType, getter: embind__requireFunction(getterSignature, getter), getterContext, setterArgumentType, setter: embind__requireFunction(setterSignature, setter), setterContext });
        }
        function __embind_register_void(rawType, name2) {
          name2 = readLatin1String(name2);
          registerType(rawType, { isVoid: true, name: name2, "argPackAdvance": 0, "fromWireType": function() {
            return void 0;
          }, "toWireType": function(destructors, o) {
            return void 0;
          } });
        }
        function __emscripten_notify_thread_queue(targetThreadId, mainThreadId) {
          if (targetThreadId == mainThreadId) {
            postMessage({ "cmd": "processQueuedMainThreadWork" });
          } else if (ENVIRONMENT_IS_PTHREAD) {
            postMessage({ "targetThread": targetThreadId, "cmd": "processThreadQueue" });
          } else {
            var pthread = PThread.pthreads[targetThreadId];
            var worker = pthread && pthread.worker;
            if (!worker) {
              return;
            }
            worker.postMessage({ "cmd": "processThreadQueue" });
          }
          return 1;
        }
        function requireHandle(handle) {
          if (!handle) {
            throwBindingError("Cannot use deleted val. handle = " + handle);
          }
          return emval_handle_array[handle].value;
        }
        function __emval_as(handle, returnType, destructorsRef) {
          handle = requireHandle(handle);
          returnType = requireRegisteredType(returnType, "emval::as");
          var destructors = [];
          var rd = __emval_register(destructors);
          GROWABLE_HEAP_I32()[destructorsRef >>> 2] = rd;
          return returnType["toWireType"](destructors, handle);
        }
        function __emval_lookupTypes(argCount, argTypes) {
          var a = new Array(argCount);
          for (var i = 0; i < argCount; ++i) {
            a[i] = requireRegisteredType(GROWABLE_HEAP_I32()[(argTypes >> 2) + i >>> 0], "parameter " + i);
          }
          return a;
        }
        function __emval_call(handle, argCount, argTypes, argv) {
          handle = requireHandle(handle);
          var types = __emval_lookupTypes(argCount, argTypes);
          var args = new Array(argCount);
          for (var i = 0; i < argCount; ++i) {
            var type = types[i];
            args[i] = type["readValueFromPointer"](argv);
            argv += type["argPackAdvance"];
          }
          var rv = handle.apply(void 0, args);
          return __emval_register(rv);
        }
        var emval_symbols = {};
        function getStringOrSymbol(address) {
          var symbol = emval_symbols[address];
          if (symbol === void 0) {
            return readLatin1String(address);
          } else {
            return symbol;
          }
        }
        function emval_get_global() {
          if (typeof globalThis === "object") {
            return globalThis;
          }
          return function() {
            return Function;
          }()("return this")();
        }
        function __emval_get_global(name2) {
          if (name2 === 0) {
            return __emval_register(emval_get_global());
          } else {
            name2 = getStringOrSymbol(name2);
            return __emval_register(emval_get_global()[name2]);
          }
        }
        function __emval_get_property(handle, key2) {
          handle = requireHandle(handle);
          key2 = requireHandle(key2);
          return __emval_register(handle[key2]);
        }
        function __emval_incref(handle) {
          if (handle > 4) {
            emval_handle_array[handle].refcount += 1;
          }
        }
        function __emval_instanceof(object, constructor) {
          object = requireHandle(object);
          constructor = requireHandle(constructor);
          return object instanceof constructor;
        }
        function __emval_is_number(handle) {
          handle = requireHandle(handle);
          return typeof handle === "number";
        }
        function __emval_new_array() {
          return __emval_register([]);
        }
        function __emval_new_cstring(v) {
          return __emval_register(getStringOrSymbol(v));
        }
        function __emval_new_object() {
          return __emval_register({});
        }
        function __emval_run_destructors(handle) {
          var destructors = emval_handle_array[handle].value;
          runDestructors(destructors);
          __emval_decref(handle);
        }
        function __emval_set_property(handle, key2, value) {
          handle = requireHandle(handle);
          key2 = requireHandle(key2);
          value = requireHandle(value);
          handle[key2] = value;
        }
        function __emval_take_value(type, argv) {
          type = requireRegisteredType(type, "_emval_take_value");
          var v = type["readValueFromPointer"](argv);
          return __emval_register(v);
        }
        function _abort() {
          abort();
        }
        var readAsmConstArgsArray = [];
        function readAsmConstArgs(sigPtr, buf) {
          readAsmConstArgsArray.length = 0;
          var ch;
          buf >>= 2;
          while (ch = GROWABLE_HEAP_U8()[sigPtr++ >>> 0]) {
            var double = ch < 105;
            if (double && buf & 1)
              buf++;
            readAsmConstArgsArray.push(double ? GROWABLE_HEAP_F64()[buf++ >>> 1] : GROWABLE_HEAP_I32()[buf >>> 0]);
            ++buf;
          }
          return readAsmConstArgsArray;
        }
        function _emscripten_asm_const_int(code, sigPtr, argbuf) {
          var args = readAsmConstArgs(sigPtr, argbuf);
          return ASM_CONSTS[code].apply(null, args);
        }
        function _emscripten_check_blocking_allowed() {
          if (ENVIRONMENT_IS_NODE)
            return;
          if (ENVIRONMENT_IS_WORKER)
            return;
          warnOnce("Blocking on the main thread is very dangerous, see https://emscripten.org/docs/porting/pthreads.html#blocking-on-the-main-browser-thread");
        }
        function _emscripten_conditional_set_current_thread_status(expectedStatus, newStatus) {
        }
        function _emscripten_futex_wait(addr, val, timeout) {
          if (addr <= 0 || addr > GROWABLE_HEAP_I8().length || addr & true)
            return -28;
          if (!ENVIRONMENT_IS_WEB) {
            var ret = Atomics.wait(GROWABLE_HEAP_I32(), addr >> 2, val, timeout);
            if (ret === "timed-out")
              return -73;
            if (ret === "not-equal")
              return -6;
            if (ret === "ok")
              return 0;
            throw "Atomics.wait returned an unexpected value " + ret;
          } else {
            if (Atomics.load(GROWABLE_HEAP_I32(), addr >> 2) != val) {
              return -6;
            }
            var tNow = performance.now();
            var tEnd = tNow + timeout;
            var lastAddr = Atomics.exchange(GROWABLE_HEAP_I32(), __emscripten_main_thread_futex >> 2, addr);
            while (1) {
              tNow = performance.now();
              if (tNow > tEnd) {
                lastAddr = Atomics.exchange(GROWABLE_HEAP_I32(), __emscripten_main_thread_futex >> 2, 0);
                return -73;
              }
              lastAddr = Atomics.exchange(GROWABLE_HEAP_I32(), __emscripten_main_thread_futex >> 2, 0);
              if (lastAddr == 0) {
                break;
              }
              _emscripten_main_thread_process_queued_calls();
              if (Atomics.load(GROWABLE_HEAP_I32(), addr >> 2) != val) {
                return -6;
              }
              lastAddr = Atomics.exchange(GROWABLE_HEAP_I32(), __emscripten_main_thread_futex >> 2, addr);
            }
            return 0;
          }
        }
        function _emscripten_memcpy_big(dest, src, num) {
          GROWABLE_HEAP_U8().copyWithin(dest >>> 0, src >>> 0, src + num >>> 0);
        }
        function _emscripten_proxy_to_main_thread_js(index, sync) {
          var numCallArgs = arguments.length - 2;
          var stack = stackSave();
          var serializedNumCallArgs = numCallArgs;
          var args = stackAlloc(serializedNumCallArgs * 8);
          var b = args >> 3;
          for (var i = 0; i < numCallArgs; i++) {
            var arg = arguments[2 + i];
            GROWABLE_HEAP_F64()[b + i >>> 0] = arg;
          }
          var ret = _emscripten_run_in_main_runtime_thread_js(index, serializedNumCallArgs, args, sync);
          stackRestore(stack);
          return ret;
        }
        var _emscripten_receive_on_main_thread_js_callArgs = [];
        function _emscripten_receive_on_main_thread_js(index, numCallArgs, args) {
          _emscripten_receive_on_main_thread_js_callArgs.length = numCallArgs;
          var b = args >> 3;
          for (var i = 0; i < numCallArgs; i++) {
            _emscripten_receive_on_main_thread_js_callArgs[i] = GROWABLE_HEAP_F64()[b + i >>> 0];
          }
          var isEmAsmConst = index < 0;
          var func = !isEmAsmConst ? proxiedFunctionTable[index] : ASM_CONSTS[-index - 1];
          return func.apply(null, _emscripten_receive_on_main_thread_js_callArgs);
        }
        function emscripten_realloc_buffer(size) {
          try {
            wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
            updateGlobalBufferAndViews(wasmMemory.buffer);
            return 1;
          } catch (e) {
          }
        }
        function _emscripten_resize_heap(requestedSize) {
          var oldSize = GROWABLE_HEAP_U8().length;
          requestedSize = requestedSize >>> 0;
          if (requestedSize <= oldSize) {
            return false;
          }
          var maxHeapSize = 4294901760;
          if (requestedSize > maxHeapSize) {
            return false;
          }
          for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
            var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
            overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
            var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
            var replacement = emscripten_realloc_buffer(newSize);
            if (replacement) {
              return true;
            }
          }
          return false;
        }
        var JSEvents = { inEventHandler: 0, removeAllEventListeners: function() {
          for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
            JSEvents._removeHandler(i);
          }
          JSEvents.eventHandlers = [];
          JSEvents.deferredCalls = [];
        }, registerRemoveEventListeners: function() {
          if (!JSEvents.removeEventListenersRegistered) {
            JSEvents.removeEventListenersRegistered = true;
          }
        }, deferredCalls: [], deferCall: function(targetFunction, precedence, argsList) {
          function arraysHaveEqualContent(arrA, arrB) {
            if (arrA.length != arrB.length)
              return false;
            for (var i2 in arrA) {
              if (arrA[i2] != arrB[i2])
                return false;
            }
            return true;
          }
          for (var i in JSEvents.deferredCalls) {
            var call = JSEvents.deferredCalls[i];
            if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
              return;
            }
          }
          JSEvents.deferredCalls.push({ targetFunction, precedence, argsList });
          JSEvents.deferredCalls.sort(function(x, y) {
            return x.precedence < y.precedence;
          });
        }, removeDeferredCalls: function(targetFunction) {
          for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
            if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
              JSEvents.deferredCalls.splice(i, 1);
              --i;
            }
          }
        }, canPerformEventHandlerRequests: function() {
          return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls;
        }, runDeferredCalls: function() {
          if (!JSEvents.canPerformEventHandlerRequests()) {
            return;
          }
          for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
            var call = JSEvents.deferredCalls[i];
            JSEvents.deferredCalls.splice(i, 1);
            --i;
            call.targetFunction.apply(null, call.argsList);
          }
        }, eventHandlers: [], removeAllHandlersOnTarget: function(target, eventTypeString) {
          for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
              JSEvents._removeHandler(i--);
            }
          }
        }, _removeHandler: function(i) {
          var h = JSEvents.eventHandlers[i];
          h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
          JSEvents.eventHandlers.splice(i, 1);
        }, registerOrRemoveHandler: function(eventHandler) {
          var jsEventHandler = function jsEventHandler2(event) {
            ++JSEvents.inEventHandler;
            JSEvents.currentEventHandler = eventHandler;
            JSEvents.runDeferredCalls();
            eventHandler.handlerFunc(event);
            JSEvents.runDeferredCalls();
            --JSEvents.inEventHandler;
          };
          if (eventHandler.callbackfunc) {
            eventHandler.eventListenerFunc = jsEventHandler;
            eventHandler.target.addEventListener(eventHandler.eventTypeString, jsEventHandler, eventHandler.useCapture);
            JSEvents.eventHandlers.push(eventHandler);
            JSEvents.registerRemoveEventListeners();
          } else {
            for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
              if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
                JSEvents._removeHandler(i--);
              }
            }
          }
        }, queueEventHandlerOnThread_iiii: function(targetThread, eventHandlerFunc, eventTypeId, eventData, userData) {
          var stackTop = stackSave();
          var varargs = stackAlloc(12);
          GROWABLE_HEAP_I32()[varargs >>> 2] = eventTypeId;
          GROWABLE_HEAP_I32()[varargs + 4 >>> 2] = eventData;
          GROWABLE_HEAP_I32()[varargs + 8 >>> 2] = userData;
          __emscripten_call_on_thread(0, targetThread, 637534208, eventHandlerFunc, eventData, varargs);
          stackRestore(stackTop);
        }, getTargetThreadForEventCallback: function(targetThread) {
          switch (targetThread) {
            case 1:
              return 0;
            case 2:
              return PThread.currentProxiedOperationCallerThread;
            default:
              return targetThread;
          }
        }, getNodeNameForTarget: function(target) {
          if (!target)
            return "";
          if (target == window)
            return "#window";
          if (target == screen)
            return "#screen";
          return target && target.nodeName ? target.nodeName : "";
        }, fullscreenEnabled: function() {
          return document.fullscreenEnabled || document.webkitFullscreenEnabled;
        } };
        function stringToNewUTF8(jsString) {
          var length = lengthBytesUTF8(jsString) + 1;
          var cString = _malloc(length);
          stringToUTF8(jsString, cString, length);
          return cString;
        }
        function _emscripten_set_offscreencanvas_size_on_target_thread_js(targetThread, targetCanvas, width, height) {
          var stackTop = stackSave();
          var varargs = stackAlloc(12);
          var targetCanvasPtr = 0;
          if (targetCanvas) {
            targetCanvasPtr = stringToNewUTF8(targetCanvas);
          }
          GROWABLE_HEAP_I32()[varargs >>> 2] = targetCanvasPtr;
          GROWABLE_HEAP_I32()[varargs + 4 >>> 2] = width;
          GROWABLE_HEAP_I32()[varargs + 8 >>> 2] = height;
          __emscripten_call_on_thread(0, targetThread, 657457152, 0, targetCanvasPtr, varargs);
          stackRestore(stackTop);
        }
        function _emscripten_set_offscreencanvas_size_on_target_thread(targetThread, targetCanvas, width, height) {
          targetCanvas = targetCanvas ? UTF8ToString(targetCanvas) : "";
          _emscripten_set_offscreencanvas_size_on_target_thread_js(targetThread, targetCanvas, width, height);
        }
        function maybeCStringToJsString(cString) {
          return cString > 2 ? UTF8ToString(cString) : cString;
        }
        var specialHTMLTargets = [0, typeof document !== "undefined" ? document : 0, typeof window !== "undefined" ? window : 0];
        function findEventTarget(target) {
          target = maybeCStringToJsString(target);
          var domElement = specialHTMLTargets[target] || (typeof document !== "undefined" ? document.querySelector(target) : void 0);
          return domElement;
        }
        function findCanvasEventTarget(target) {
          return findEventTarget(target);
        }
        function _emscripten_set_canvas_element_size_calling_thread(target, width, height) {
          var canvas = findCanvasEventTarget(target);
          if (!canvas)
            return -4;
          if (canvas.canvasSharedPtr) {
            GROWABLE_HEAP_I32()[canvas.canvasSharedPtr >>> 2] = width;
            GROWABLE_HEAP_I32()[canvas.canvasSharedPtr + 4 >>> 2] = height;
          }
          if (canvas.offscreenCanvas || !canvas.controlTransferredOffscreen) {
            if (canvas.offscreenCanvas)
              canvas = canvas.offscreenCanvas;
            var autoResizeViewport = false;
            if (canvas.GLctxObject && canvas.GLctxObject.GLctx) {
              var prevViewport = canvas.GLctxObject.GLctx.getParameter(2978);
              autoResizeViewport = prevViewport[0] === 0 && prevViewport[1] === 0 && prevViewport[2] === canvas.width && prevViewport[3] === canvas.height;
            }
            canvas.width = width;
            canvas.height = height;
            if (autoResizeViewport) {
              canvas.GLctxObject.GLctx.viewport(0, 0, width, height);
            }
          } else if (canvas.canvasSharedPtr) {
            var targetThread = GROWABLE_HEAP_I32()[canvas.canvasSharedPtr + 8 >>> 2];
            _emscripten_set_offscreencanvas_size_on_target_thread(targetThread, target, width, height);
            return 1;
          } else {
            return -4;
          }
          return 0;
        }
        function _emscripten_set_canvas_element_size_main_thread(target, width, height) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(5, 1, target, width, height);
          return _emscripten_set_canvas_element_size_calling_thread(target, width, height);
        }
        function _emscripten_set_canvas_element_size(target, width, height) {
          var canvas = findCanvasEventTarget(target);
          if (canvas) {
            return _emscripten_set_canvas_element_size_calling_thread(target, width, height);
          } else {
            return _emscripten_set_canvas_element_size_main_thread(target, width, height);
          }
        }
        function _emscripten_set_current_thread_status(newStatus) {
        }
        function __webgl_enable_ANGLE_instanced_arrays(ctx) {
          var ext = ctx.getExtension("ANGLE_instanced_arrays");
          if (ext) {
            ctx["vertexAttribDivisor"] = function(index, divisor) {
              ext["vertexAttribDivisorANGLE"](index, divisor);
            };
            ctx["drawArraysInstanced"] = function(mode, first, count, primcount) {
              ext["drawArraysInstancedANGLE"](mode, first, count, primcount);
            };
            ctx["drawElementsInstanced"] = function(mode, count, type, indices, primcount) {
              ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
            };
            return 1;
          }
        }
        function __webgl_enable_OES_vertex_array_object(ctx) {
          var ext = ctx.getExtension("OES_vertex_array_object");
          if (ext) {
            ctx["createVertexArray"] = function() {
              return ext["createVertexArrayOES"]();
            };
            ctx["deleteVertexArray"] = function(vao) {
              ext["deleteVertexArrayOES"](vao);
            };
            ctx["bindVertexArray"] = function(vao) {
              ext["bindVertexArrayOES"](vao);
            };
            ctx["isVertexArray"] = function(vao) {
              return ext["isVertexArrayOES"](vao);
            };
            return 1;
          }
        }
        function __webgl_enable_WEBGL_draw_buffers(ctx) {
          var ext = ctx.getExtension("WEBGL_draw_buffers");
          if (ext) {
            ctx["drawBuffers"] = function(n, bufs) {
              ext["drawBuffersWEBGL"](n, bufs);
            };
            return 1;
          }
        }
        function __webgl_enable_WEBGL_multi_draw(ctx) {
          return !!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));
        }
        var GL = { counter: 1, buffers: [], programs: [], framebuffers: [], renderbuffers: [], textures: [], shaders: [], vaos: [], contexts: {}, offscreenCanvases: {}, queries: [], stringCache: {}, unpackAlignment: 4, recordError: function recordError(errorCode) {
          if (!GL.lastError) {
            GL.lastError = errorCode;
          }
        }, getNewId: function(table) {
          var ret = GL.counter++;
          for (var i = table.length; i < ret; i++) {
            table[i] = null;
          }
          return ret;
        }, getSource: function(shader, count, string, length) {
          var source = "";
          for (var i = 0; i < count; ++i) {
            var len = length ? GROWABLE_HEAP_I32()[length + i * 4 >>> 2] : -1;
            source += UTF8ToString(GROWABLE_HEAP_I32()[string + i * 4 >>> 2], len < 0 ? void 0 : len);
          }
          return source;
        }, createContext: function(canvas, webGLContextAttributes) {
          if (!canvas.getContextSafariWebGL2Fixed) {
            canvas.getContextSafariWebGL2Fixed = canvas.getContext;
            canvas.getContext = function(ver, attrs) {
              var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
              return ver == "webgl" == gl instanceof WebGLRenderingContext ? gl : null;
            };
          }
          var ctx = canvas.getContext("webgl", webGLContextAttributes);
          if (!ctx)
            return 0;
          var handle = GL.registerContext(ctx, webGLContextAttributes);
          return handle;
        }, registerContext: function(ctx, webGLContextAttributes) {
          var handle = _malloc(8);
          GROWABLE_HEAP_I32()[handle + 4 >>> 2] = _pthread_self();
          var context = { handle, attributes: webGLContextAttributes, version: webGLContextAttributes.majorVersion, GLctx: ctx };
          if (ctx.canvas)
            ctx.canvas.GLctxObject = context;
          GL.contexts[handle] = context;
          if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
            GL.initExtensions(context);
          }
          return handle;
        }, makeContextCurrent: function(contextHandle) {
          GL.currentContext = GL.contexts[contextHandle];
          Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
          return !(contextHandle && !GLctx);
        }, getContext: function(contextHandle) {
          return GL.contexts[contextHandle];
        }, deleteContext: function(contextHandle) {
          if (GL.currentContext === GL.contexts[contextHandle])
            GL.currentContext = null;
          if (typeof JSEvents === "object")
            JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
          if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas)
            GL.contexts[contextHandle].GLctx.canvas.GLctxObject = void 0;
          _free(GL.contexts[contextHandle].handle);
          GL.contexts[contextHandle] = null;
        }, initExtensions: function(context) {
          if (!context)
            context = GL.currentContext;
          if (context.initExtensionsDone)
            return;
          context.initExtensionsDone = true;
          var GLctx2 = context.GLctx;
          __webgl_enable_ANGLE_instanced_arrays(GLctx2);
          __webgl_enable_OES_vertex_array_object(GLctx2);
          __webgl_enable_WEBGL_draw_buffers(GLctx2);
          {
            GLctx2.disjointTimerQueryExt = GLctx2.getExtension("EXT_disjoint_timer_query");
          }
          __webgl_enable_WEBGL_multi_draw(GLctx2);
          var exts = GLctx2.getSupportedExtensions() || [];
          exts.forEach(function(ext) {
            if (!ext.includes("lose_context") && !ext.includes("debug")) {
              GLctx2.getExtension(ext);
            }
          });
        } };
        var __emscripten_webgl_power_preferences = ["default", "low-power", "high-performance"];
        function _emscripten_webgl_do_create_context(target, attributes) {
          var a = attributes >> 2;
          var powerPreference = GROWABLE_HEAP_I32()[a + (24 >> 2) >>> 0];
          var contextAttributes = { "alpha": !!GROWABLE_HEAP_I32()[a + (0 >> 2) >>> 0], "depth": !!GROWABLE_HEAP_I32()[a + (4 >> 2) >>> 0], "stencil": !!GROWABLE_HEAP_I32()[a + (8 >> 2) >>> 0], "antialias": !!GROWABLE_HEAP_I32()[a + (12 >> 2) >>> 0], "premultipliedAlpha": !!GROWABLE_HEAP_I32()[a + (16 >> 2) >>> 0], "preserveDrawingBuffer": !!GROWABLE_HEAP_I32()[a + (20 >> 2) >>> 0], "powerPreference": __emscripten_webgl_power_preferences[powerPreference], "failIfMajorPerformanceCaveat": !!GROWABLE_HEAP_I32()[a + (28 >> 2) >>> 0], majorVersion: GROWABLE_HEAP_I32()[a + (32 >> 2) >>> 0], minorVersion: GROWABLE_HEAP_I32()[a + (36 >> 2) >>> 0], enableExtensionsByDefault: GROWABLE_HEAP_I32()[a + (40 >> 2) >>> 0], explicitSwapControl: GROWABLE_HEAP_I32()[a + (44 >> 2) >>> 0], proxyContextToMainThread: GROWABLE_HEAP_I32()[a + (48 >> 2) >>> 0], renderViaOffscreenBackBuffer: GROWABLE_HEAP_I32()[a + (52 >> 2) >>> 0] };
          var canvas = findCanvasEventTarget(target);
          if (!canvas) {
            return 0;
          }
          if (contextAttributes.explicitSwapControl) {
            return 0;
          }
          var contextHandle = GL.createContext(canvas, contextAttributes);
          return contextHandle;
        }
        function _emscripten_webgl_create_context(a0, a1) {
          return _emscripten_webgl_do_create_context(a0, a1);
        }
        var ENV = {};
        function getExecutableName() {
          return thisProgram || "./this.program";
        }
        function getEnvStrings() {
          if (!getEnvStrings.strings) {
            var lang = (typeof navigator === "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
            var env = { "USER": "web_user", "LOGNAME": "web_user", "PATH": "/", "PWD": "/", "HOME": "/home/web_user", "LANG": lang, "_": getExecutableName() };
            for (var x in ENV) {
              if (ENV[x] === void 0)
                delete env[x];
              else
                env[x] = ENV[x];
            }
            var strings = [];
            for (var x in env) {
              strings.push(x + "=" + env[x]);
            }
            getEnvStrings.strings = strings;
          }
          return getEnvStrings.strings;
        }
        function _environ_get(__environ, environ_buf) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(6, 1, __environ, environ_buf);
          try {
            var bufSize = 0;
            getEnvStrings().forEach(function(string, i) {
              var ptr = environ_buf + bufSize;
              GROWABLE_HEAP_I32()[__environ + i * 4 >>> 2] = ptr;
              writeAsciiToMemory(string, ptr);
              bufSize += string.length + 1;
            });
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _environ_sizes_get(penviron_count, penviron_buf_size) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(7, 1, penviron_count, penviron_buf_size);
          try {
            var strings = getEnvStrings();
            GROWABLE_HEAP_I32()[penviron_count >>> 2] = strings.length;
            var bufSize = 0;
            strings.forEach(function(string) {
              bufSize += string.length + 1;
            });
            GROWABLE_HEAP_I32()[penviron_buf_size >>> 2] = bufSize;
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _fd_close(fd) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(8, 1, fd);
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            FS.close(stream);
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _fd_read(fd, iov, iovcnt, pnum) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(9, 1, fd, iov, iovcnt, pnum);
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = SYSCALLS.doReadv(stream, iov, iovcnt);
            GROWABLE_HEAP_I32()[pnum >>> 2] = num;
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(10, 1, fd, offset_low, offset_high, whence, newOffset);
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var HIGH_OFFSET = 4294967296;
            var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
            var DOUBLE_LIMIT = 9007199254740992;
            if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
              return -61;
            }
            FS.llseek(stream, offset, whence);
            tempI64 = [stream.position >>> 0, (tempDouble = stream.position, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], GROWABLE_HEAP_I32()[newOffset >>> 2] = tempI64[0], GROWABLE_HEAP_I32()[newOffset + 4 >>> 2] = tempI64[1];
            if (stream.getdents && offset === 0 && whence === 0)
              stream.getdents = null;
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _fd_write(fd, iov, iovcnt, pnum) {
          if (ENVIRONMENT_IS_PTHREAD)
            return _emscripten_proxy_to_main_thread_js(11, 1, fd, iov, iovcnt, pnum);
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = SYSCALLS.doWritev(stream, iov, iovcnt);
            GROWABLE_HEAP_I32()[pnum >>> 2] = num;
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _getTempRet0() {
          return getTempRet0();
        }
        function _llvm_eh_typeid_for(type) {
          return type;
        }
        function spawnThread(threadParams) {
          if (ENVIRONMENT_IS_PTHREAD)
            throw "Internal Error! spawnThread() can only ever be called from main application thread!";
          var worker = PThread.getNewWorker();
          if (!worker) {
            return 6;
          }
          if (worker.pthread !== void 0)
            throw "Internal error!";
          if (!threadParams.pthread_ptr)
            throw "Internal error, no pthread ptr!";
          PThread.runningWorkers.push(worker);
          var tlsMemory = _malloc(128 * 4);
          for (var i = 0; i < 128; ++i) {
            GROWABLE_HEAP_I32()[tlsMemory + i * 4 >>> 2] = 0;
          }
          var stackHigh = threadParams.stackBase + threadParams.stackSize;
          var pthread = PThread.pthreads[threadParams.pthread_ptr] = { worker, stackBase: threadParams.stackBase, stackSize: threadParams.stackSize, allocatedOwnStack: threadParams.allocatedOwnStack, threadInfoStruct: threadParams.pthread_ptr };
          var tis = pthread.threadInfoStruct >> 2;
          Atomics.store(GROWABLE_HEAP_U32(), tis + (64 >> 2), threadParams.detached);
          Atomics.store(GROWABLE_HEAP_U32(), tis + (100 >> 2), tlsMemory);
          Atomics.store(GROWABLE_HEAP_U32(), tis + (40 >> 2), pthread.threadInfoStruct);
          Atomics.store(GROWABLE_HEAP_U32(), tis + (80 >> 2), threadParams.stackSize);
          Atomics.store(GROWABLE_HEAP_U32(), tis + (76 >> 2), stackHigh);
          Atomics.store(GROWABLE_HEAP_U32(), tis + (104 >> 2), threadParams.stackSize);
          Atomics.store(GROWABLE_HEAP_U32(), tis + (104 + 8 >> 2), stackHigh);
          Atomics.store(GROWABLE_HEAP_U32(), tis + (104 + 12 >> 2), threadParams.detached);
          var global_libc = _emscripten_get_global_libc();
          var global_locale = global_libc + 40;
          Atomics.store(GROWABLE_HEAP_U32(), tis + (172 >> 2), global_locale);
          worker.pthread = pthread;
          var msg = { "cmd": "run", "start_routine": threadParams.startRoutine, "arg": threadParams.arg, "threadInfoStruct": threadParams.pthread_ptr, "stackBase": threadParams.stackBase, "stackSize": threadParams.stackSize };
          worker.runPthread = function() {
            msg.time = performance.now();
            worker.postMessage(msg, threadParams.transferList);
          };
          if (worker.loaded) {
            worker.runPthread();
            delete worker.runPthread;
          }
          return 0;
        }
        function _pthread_create(pthread_ptr, attr, start_routine, arg) {
          if (typeof SharedArrayBuffer === "undefined") {
            err("Current environment does not support SharedArrayBuffer, pthreads are not available!");
            return 6;
          }
          if (!pthread_ptr) {
            err("pthread_create called with a null thread pointer!");
            return 28;
          }
          var transferList = [];
          var error = 0;
          if (ENVIRONMENT_IS_PTHREAD && (transferList.length === 0 || error)) {
            return _emscripten_sync_run_in_main_thread_4(687865856, pthread_ptr, attr, start_routine, arg);
          }
          var stackSize = 0;
          var stackBase = 0;
          var detached = 0;
          if (attr && attr != -1) {
            stackSize = GROWABLE_HEAP_I32()[attr >>> 2];
            stackSize += 81920;
            stackBase = GROWABLE_HEAP_I32()[attr + 8 >>> 2];
            detached = GROWABLE_HEAP_I32()[attr + 12 >>> 2] !== 0;
          } else {
            stackSize = 2097152;
          }
          var allocatedOwnStack = stackBase == 0;
          if (allocatedOwnStack) {
            stackBase = _memalign(16, stackSize);
          } else {
            stackBase -= stackSize;
            assert(stackBase > 0);
          }
          var threadInfoStruct = _malloc(228);
          for (var i = 0; i < 228 >> 2; ++i)
            GROWABLE_HEAP_U32()[(threadInfoStruct >> 2) + i >>> 0] = 0;
          GROWABLE_HEAP_I32()[pthread_ptr >>> 2] = threadInfoStruct;
          GROWABLE_HEAP_I32()[threadInfoStruct + 12 >>> 2] = threadInfoStruct;
          var headPtr = threadInfoStruct + 152;
          GROWABLE_HEAP_I32()[headPtr >>> 2] = headPtr;
          var threadParams = { stackBase, stackSize, allocatedOwnStack, detached, startRoutine: start_routine, pthread_ptr: threadInfoStruct, arg, transferList };
          if (ENVIRONMENT_IS_PTHREAD) {
            threadParams.cmd = "spawnThread";
            postMessage(threadParams, transferList);
            return 0;
          }
          return spawnThread(threadParams);
        }
        function _setTempRet0(val) {
          setTempRet0(val);
        }
        function __isLeapYear(year) {
          return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        }
        function __arraySum(array, index) {
          var sum = 0;
          for (var i = 0; i <= index; sum += array[i++]) {
          }
          return sum;
        }
        var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        function __addDays(date, days) {
          var newDate = new Date(date.getTime());
          while (days > 0) {
            var leap = __isLeapYear(newDate.getFullYear());
            var currentMonth = newDate.getMonth();
            var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
            if (days > daysInCurrentMonth - newDate.getDate()) {
              days -= daysInCurrentMonth - newDate.getDate() + 1;
              newDate.setDate(1);
              if (currentMonth < 11) {
                newDate.setMonth(currentMonth + 1);
              } else {
                newDate.setMonth(0);
                newDate.setFullYear(newDate.getFullYear() + 1);
              }
            } else {
              newDate.setDate(newDate.getDate() + days);
              return newDate;
            }
          }
          return newDate;
        }
        function _strftime(s, maxsize, format, tm) {
          var tm_zone = GROWABLE_HEAP_I32()[tm + 40 >>> 2];
          var date = { tm_sec: GROWABLE_HEAP_I32()[tm >>> 2], tm_min: GROWABLE_HEAP_I32()[tm + 4 >>> 2], tm_hour: GROWABLE_HEAP_I32()[tm + 8 >>> 2], tm_mday: GROWABLE_HEAP_I32()[tm + 12 >>> 2], tm_mon: GROWABLE_HEAP_I32()[tm + 16 >>> 2], tm_year: GROWABLE_HEAP_I32()[tm + 20 >>> 2], tm_wday: GROWABLE_HEAP_I32()[tm + 24 >>> 2], tm_yday: GROWABLE_HEAP_I32()[tm + 28 >>> 2], tm_isdst: GROWABLE_HEAP_I32()[tm + 32 >>> 2], tm_gmtoff: GROWABLE_HEAP_I32()[tm + 36 >>> 2], tm_zone: tm_zone ? UTF8ToString(tm_zone) : "" };
          var pattern = UTF8ToString(format);
          var EXPANSION_RULES_1 = { "%c": "%a %b %d %H:%M:%S %Y", "%D": "%m/%d/%y", "%F": "%Y-%m-%d", "%h": "%b", "%r": "%I:%M:%S %p", "%R": "%H:%M", "%T": "%H:%M:%S", "%x": "%m/%d/%y", "%X": "%H:%M:%S", "%Ec": "%c", "%EC": "%C", "%Ex": "%m/%d/%y", "%EX": "%H:%M:%S", "%Ey": "%y", "%EY": "%Y", "%Od": "%d", "%Oe": "%e", "%OH": "%H", "%OI": "%I", "%Om": "%m", "%OM": "%M", "%OS": "%S", "%Ou": "%u", "%OU": "%U", "%OV": "%V", "%Ow": "%w", "%OW": "%W", "%Oy": "%y" };
          for (var rule in EXPANSION_RULES_1) {
            pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule]);
          }
          var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          function leadingSomething(value, digits, character) {
            var str = typeof value === "number" ? value.toString() : value || "";
            while (str.length < digits) {
              str = character[0] + str;
            }
            return str;
          }
          function leadingNulls(value, digits) {
            return leadingSomething(value, digits, "0");
          }
          function compareByDay(date1, date2) {
            function sgn(value) {
              return value < 0 ? -1 : value > 0 ? 1 : 0;
            }
            var compare;
            if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
              if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                compare = sgn(date1.getDate() - date2.getDate());
              }
            }
            return compare;
          }
          function getFirstWeekStartDate(janFourth) {
            switch (janFourth.getDay()) {
              case 0:
                return new Date(janFourth.getFullYear() - 1, 11, 29);
              case 1:
                return janFourth;
              case 2:
                return new Date(janFourth.getFullYear(), 0, 3);
              case 3:
                return new Date(janFourth.getFullYear(), 0, 2);
              case 4:
                return new Date(janFourth.getFullYear(), 0, 1);
              case 5:
                return new Date(janFourth.getFullYear() - 1, 11, 31);
              case 6:
                return new Date(janFourth.getFullYear() - 1, 11, 30);
            }
          }
          function getWeekBasedYear(date2) {
            var thisDate = __addDays(new Date(date2.tm_year + 1900, 0, 1), date2.tm_yday);
            var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
            var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
            var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
            var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
            if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
              if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                return thisDate.getFullYear() + 1;
              } else {
                return thisDate.getFullYear();
              }
            } else {
              return thisDate.getFullYear() - 1;
            }
          }
          var EXPANSION_RULES_2 = { "%a": function(date2) {
            return WEEKDAYS[date2.tm_wday].substring(0, 3);
          }, "%A": function(date2) {
            return WEEKDAYS[date2.tm_wday];
          }, "%b": function(date2) {
            return MONTHS[date2.tm_mon].substring(0, 3);
          }, "%B": function(date2) {
            return MONTHS[date2.tm_mon];
          }, "%C": function(date2) {
            var year = date2.tm_year + 1900;
            return leadingNulls(year / 100 | 0, 2);
          }, "%d": function(date2) {
            return leadingNulls(date2.tm_mday, 2);
          }, "%e": function(date2) {
            return leadingSomething(date2.tm_mday, 2, " ");
          }, "%g": function(date2) {
            return getWeekBasedYear(date2).toString().substring(2);
          }, "%G": function(date2) {
            return getWeekBasedYear(date2);
          }, "%H": function(date2) {
            return leadingNulls(date2.tm_hour, 2);
          }, "%I": function(date2) {
            var twelveHour = date2.tm_hour;
            if (twelveHour == 0)
              twelveHour = 12;
            else if (twelveHour > 12)
              twelveHour -= 12;
            return leadingNulls(twelveHour, 2);
          }, "%j": function(date2) {
            return leadingNulls(date2.tm_mday + __arraySum(__isLeapYear(date2.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date2.tm_mon - 1), 3);
          }, "%m": function(date2) {
            return leadingNulls(date2.tm_mon + 1, 2);
          }, "%M": function(date2) {
            return leadingNulls(date2.tm_min, 2);
          }, "%n": function() {
            return "\n";
          }, "%p": function(date2) {
            if (date2.tm_hour >= 0 && date2.tm_hour < 12) {
              return "AM";
            } else {
              return "PM";
            }
          }, "%S": function(date2) {
            return leadingNulls(date2.tm_sec, 2);
          }, "%t": function() {
            return "	";
          }, "%u": function(date2) {
            return date2.tm_wday || 7;
          }, "%U": function(date2) {
            var janFirst = new Date(date2.tm_year + 1900, 0, 1);
            var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
            var endDate = new Date(date2.tm_year + 1900, date2.tm_mon, date2.tm_mday);
            if (compareByDay(firstSunday, endDate) < 0) {
              var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
              var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
              var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
              return leadingNulls(Math.ceil(days / 7), 2);
            }
            return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00";
          }, "%V": function(date2) {
            var janFourthThisYear = new Date(date2.tm_year + 1900, 0, 4);
            var janFourthNextYear = new Date(date2.tm_year + 1901, 0, 4);
            var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
            var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
            var endDate = __addDays(new Date(date2.tm_year + 1900, 0, 1), date2.tm_yday);
            if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
              return "53";
            }
            if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
              return "01";
            }
            var daysDifference;
            if (firstWeekStartThisYear.getFullYear() < date2.tm_year + 1900) {
              daysDifference = date2.tm_yday + 32 - firstWeekStartThisYear.getDate();
            } else {
              daysDifference = date2.tm_yday + 1 - firstWeekStartThisYear.getDate();
            }
            return leadingNulls(Math.ceil(daysDifference / 7), 2);
          }, "%w": function(date2) {
            return date2.tm_wday;
          }, "%W": function(date2) {
            var janFirst = new Date(date2.tm_year, 0, 1);
            var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
            var endDate = new Date(date2.tm_year + 1900, date2.tm_mon, date2.tm_mday);
            if (compareByDay(firstMonday, endDate) < 0) {
              var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
              var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
              var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
              return leadingNulls(Math.ceil(days / 7), 2);
            }
            return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00";
          }, "%y": function(date2) {
            return (date2.tm_year + 1900).toString().substring(2);
          }, "%Y": function(date2) {
            return date2.tm_year + 1900;
          }, "%z": function(date2) {
            var off = date2.tm_gmtoff;
            var ahead = off >= 0;
            off = Math.abs(off) / 60;
            off = off / 60 * 100 + off % 60;
            return (ahead ? "+" : "-") + String("0000" + off).slice(-4);
          }, "%Z": function(date2) {
            return date2.tm_zone;
          }, "%%": function() {
            return "%";
          } };
          for (var rule in EXPANSION_RULES_2) {
            if (pattern.includes(rule)) {
              pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date));
            }
          }
          var bytes = intArrayFromString(pattern, false);
          if (bytes.length > maxsize) {
            return 0;
          }
          writeArrayToMemory(bytes, s);
          return bytes.length - 1;
        }
        function _strftime_l(s, maxsize, format, tm) {
          return _strftime(s, maxsize, format, tm);
        }
        if (!ENVIRONMENT_IS_PTHREAD)
          PThread.initMainThreadBlock();
        var FSNode = function(parent, name2, mode, rdev) {
          if (!parent) {
            parent = this;
          }
          this.parent = parent;
          this.mount = parent.mount;
          this.mounted = null;
          this.id = FS.nextInode++;
          this.name = name2;
          this.mode = mode;
          this.node_ops = {};
          this.stream_ops = {};
          this.rdev = rdev;
        };
        var readMode = 292 | 73;
        var writeMode = 146;
        Object.defineProperties(FSNode.prototype, { read: { get: function() {
          return (this.mode & readMode) === readMode;
        }, set: function(val) {
          val ? this.mode |= readMode : this.mode &= ~readMode;
        } }, write: { get: function() {
          return (this.mode & writeMode) === writeMode;
        }, set: function(val) {
          val ? this.mode |= writeMode : this.mode &= ~writeMode;
        } }, isFolder: { get: function() {
          return FS.isDir(this.mode);
        } }, isDevice: { get: function() {
          return FS.isChrdev(this.mode);
        } } });
        FS.FSNode = FSNode;
        FS.staticInit();
        Module["FS_createPath"] = FS.createPath;
        Module["FS_createDataFile"] = FS.createDataFile;
        Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
        Module["FS_createLazyFile"] = FS.createLazyFile;
        Module["FS_createDevice"] = FS.createDevice;
        Module["FS_unlink"] = FS.unlink;
        InternalError = Module["InternalError"] = extendError(Error, "InternalError");
        embind_init_charCodes();
        BindingError = Module["BindingError"] = extendError(Error, "BindingError");
        init_ClassHandle();
        init_RegisteredPointer();
        init_embind();
        UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
        init_emval();
        var GLctx;
        var proxiedFunctionTable = [null, _atexit, ___sys_fcntl64, ___sys_ioctl, ___sys_open, _emscripten_set_canvas_element_size_main_thread, _environ_get, _environ_sizes_get, _fd_close, _fd_read, _fd_seek, _fd_write];
        function intArrayFromString(stringy, dontAddNull, length) {
          var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
          var u8array = new Array(len);
          var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
          if (dontAddNull)
            u8array.length = numBytesWritten;
          return u8array;
        }
        var asmLibraryArg = { "z": ___assert_fail, "n": ___cxa_allocate_exception, "v": ___cxa_begin_catch, "y": ___cxa_end_catch, "c": ___cxa_find_matching_catch_2, "m": ___cxa_find_matching_catch_3, "C": ___cxa_free_exception, "ba": ___cxa_rethrow, "La": ___cxa_thread_atexit, "o": ___cxa_throw, "ta": ___cxa_uncaught_exceptions, "i": ___resumeException, "da": ___sys_fcntl64, "ua": ___sys_ioctl, "va": ___sys_open, "Oa": __embind_finalize_value_array, "Ra": __embind_finalize_value_object, "_a": __embind_register_bigint, "Ja": __embind_register_bool, "O": __embind_register_class, "N": __embind_register_class_constructor, "q": __embind_register_class_function, "Ia": __embind_register_emval, "Ma": __embind_register_enum, "T": __embind_register_enum_value, "ja": __embind_register_float, "t": __embind_register_function, "B": __embind_register_integer, "x": __embind_register_memory_view, "ka": __embind_register_std_string, "Y": __embind_register_std_wstring, "Pa": __embind_register_value_array, "Na": __embind_register_value_array_element, "M": __embind_register_value_object, "Qa": __embind_register_value_object_field, "Ka": __embind_register_void, "Ca": __emscripten_notify_thread_queue, "U": __emval_as, "la": __emval_call, "xa": __emval_decref, "$a": __emval_get_global, "Ua": __emval_get_property, "aa": __emval_incref, "pa": __emval_instanceof, "Xa": __emval_is_number, "Wa": __emval_new_array, "Z": __emval_new_cstring, "Va": __emval_new_object, "Ta": __emval_run_destructors, "Sa": __emval_set_property, "D": __emval_take_value, "ia": _abort, "ca": _clock_gettime, "ga": _emscripten_asm_const_int, "wa": _emscripten_check_blocking_allowed, "fa": _emscripten_conditional_set_current_thread_status, "K": _emscripten_futex_wait, "J": _emscripten_futex_wake, "S": _emscripten_get_now, "ra": _emscripten_memcpy_big, "ya": _emscripten_receive_on_main_thread_js, "sa": _emscripten_resize_heap, "za": _emscripten_set_canvas_element_size, "ea": _emscripten_set_current_thread_status, "Aa": _emscripten_webgl_create_context, "Ea": _environ_get, "Fa": _environ_sizes_get, "ha": _fd_close, "Ha": _fd_read, "Za": _fd_seek, "Ga": _fd_write, "b": _getTempRet0, "qa": initPthreadsJS, "I": invoke_diii, "E": invoke_i, "d": invoke_ii, "Q": invoke_iid, "j": invoke_iii, "k": invoke_iiii, "R": invoke_iiiii, "na": invoke_iiiiid, "G": invoke_iiiiii, "A": invoke_iiiiiii, "_": invoke_iiiiiiii, "P": invoke_iiiiiiiii, "W": invoke_iiiiiiiiiiii, "Ya": invoke_j, "g": invoke_v, "f": invoke_vi, "L": invoke_viddi, "H": invoke_viffiid, "h": invoke_vii, "s": invoke_viidd, "e": invoke_viii, "l": invoke_viiii, "$": invoke_viiiid, "X": invoke_viiiidii, "F": invoke_viiiii, "w": invoke_viiiiii, "r": invoke_viiiiiii, "u": invoke_viiiiiiiii, "p": invoke_viiiiiiiiii, "V": invoke_viiiiiiiiiiiiiii, "oa": _llvm_eh_typeid_for, "a": wasmMemory || Module["wasmMemory"], "Ba": _pthread_create, "ma": _setTempRet0, "Da": _strftime_l };
        createWasm();
        Module["___wasm_call_ctors"] = function() {
          return (Module["___wasm_call_ctors"] = Module["asm"]["ab"]).apply(null, arguments);
        };
        Module["_main"] = function() {
          return (Module["_main"] = Module["asm"]["bb"]).apply(null, arguments);
        };
        var _malloc = Module["_malloc"] = function() {
          return (_malloc = Module["_malloc"] = Module["asm"]["cb"]).apply(null, arguments);
        };
        var _free = Module["_free"] = function() {
          return (_free = Module["_free"] = Module["asm"]["eb"]).apply(null, arguments);
        };
        Module["_emscripten_tls_init"] = function() {
          return (Module["_emscripten_tls_init"] = Module["asm"]["fb"]).apply(null, arguments);
        };
        var ___getTypeName = Module["___getTypeName"] = function() {
          return (___getTypeName = Module["___getTypeName"] = Module["asm"]["gb"]).apply(null, arguments);
        };
        Module["___embind_register_native_and_builtin_types"] = function() {
          return (Module["___embind_register_native_and_builtin_types"] = Module["asm"]["hb"]).apply(null, arguments);
        };
        Module["_emscripten_current_thread_process_queued_calls"] = function() {
          return (Module["_emscripten_current_thread_process_queued_calls"] = Module["asm"]["ib"]).apply(null, arguments);
        };
        var _emscripten_register_main_browser_thread_id = Module["_emscripten_register_main_browser_thread_id"] = function() {
          return (_emscripten_register_main_browser_thread_id = Module["_emscripten_register_main_browser_thread_id"] = Module["asm"]["jb"]).apply(null, arguments);
        };
        var __emscripten_do_dispatch_to_thread = Module["__emscripten_do_dispatch_to_thread"] = function() {
          return (__emscripten_do_dispatch_to_thread = Module["__emscripten_do_dispatch_to_thread"] = Module["asm"]["kb"]).apply(null, arguments);
        };
        var _emscripten_sync_run_in_main_thread_4 = Module["_emscripten_sync_run_in_main_thread_4"] = function() {
          return (_emscripten_sync_run_in_main_thread_4 = Module["_emscripten_sync_run_in_main_thread_4"] = Module["asm"]["lb"]).apply(null, arguments);
        };
        var _emscripten_main_thread_process_queued_calls = Module["_emscripten_main_thread_process_queued_calls"] = function() {
          return (_emscripten_main_thread_process_queued_calls = Module["_emscripten_main_thread_process_queued_calls"] = Module["asm"]["mb"]).apply(null, arguments);
        };
        var _emscripten_run_in_main_runtime_thread_js = Module["_emscripten_run_in_main_runtime_thread_js"] = function() {
          return (_emscripten_run_in_main_runtime_thread_js = Module["_emscripten_run_in_main_runtime_thread_js"] = Module["asm"]["nb"]).apply(null, arguments);
        };
        var __emscripten_call_on_thread = Module["__emscripten_call_on_thread"] = function() {
          return (__emscripten_call_on_thread = Module["__emscripten_call_on_thread"] = Module["asm"]["ob"]).apply(null, arguments);
        };
        var __emscripten_thread_init = Module["__emscripten_thread_init"] = function() {
          return (__emscripten_thread_init = Module["__emscripten_thread_init"] = Module["asm"]["pb"]).apply(null, arguments);
        };
        var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = function() {
          return (_emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = Module["asm"]["qb"]).apply(null, arguments);
        };
        var ___errno_location = Module["___errno_location"] = function() {
          return (___errno_location = Module["___errno_location"] = Module["asm"]["rb"]).apply(null, arguments);
        };
        var _pthread_self = Module["_pthread_self"] = function() {
          return (_pthread_self = Module["_pthread_self"] = Module["asm"]["sb"]).apply(null, arguments);
        };
        var ___pthread_tsd_run_dtors = Module["___pthread_tsd_run_dtors"] = function() {
          return (___pthread_tsd_run_dtors = Module["___pthread_tsd_run_dtors"] = Module["asm"]["tb"]).apply(null, arguments);
        };
        var stackSave = Module["stackSave"] = function() {
          return (stackSave = Module["stackSave"] = Module["asm"]["ub"]).apply(null, arguments);
        };
        var stackRestore = Module["stackRestore"] = function() {
          return (stackRestore = Module["stackRestore"] = Module["asm"]["vb"]).apply(null, arguments);
        };
        var stackAlloc = Module["stackAlloc"] = function() {
          return (stackAlloc = Module["stackAlloc"] = Module["asm"]["wb"]).apply(null, arguments);
        };
        var _emscripten_stack_set_limits = Module["_emscripten_stack_set_limits"] = function() {
          return (_emscripten_stack_set_limits = Module["_emscripten_stack_set_limits"] = Module["asm"]["xb"]).apply(null, arguments);
        };
        var _setThrew = Module["_setThrew"] = function() {
          return (_setThrew = Module["_setThrew"] = Module["asm"]["yb"]).apply(null, arguments);
        };
        var ___cxa_can_catch = Module["___cxa_can_catch"] = function() {
          return (___cxa_can_catch = Module["___cxa_can_catch"] = Module["asm"]["zb"]).apply(null, arguments);
        };
        var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function() {
          return (___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = Module["asm"]["Ab"]).apply(null, arguments);
        };
        var _memalign = Module["_memalign"] = function() {
          return (_memalign = Module["_memalign"] = Module["asm"]["Bb"]).apply(null, arguments);
        };
        Module["dynCall_jiji"] = function() {
          return (Module["dynCall_jiji"] = Module["asm"]["Cb"]).apply(null, arguments);
        };
        var dynCall_j = Module["dynCall_j"] = function() {
          return (dynCall_j = Module["dynCall_j"] = Module["asm"]["Db"]).apply(null, arguments);
        };
        Module["dynCall_viijii"] = function() {
          return (Module["dynCall_viijii"] = Module["asm"]["Eb"]).apply(null, arguments);
        };
        Module["dynCall_iiiiij"] = function() {
          return (Module["dynCall_iiiiij"] = Module["asm"]["Fb"]).apply(null, arguments);
        };
        Module["dynCall_iiiiijj"] = function() {
          return (Module["dynCall_iiiiijj"] = Module["asm"]["Gb"]).apply(null, arguments);
        };
        Module["dynCall_iiiiiijj"] = function() {
          return (Module["dynCall_iiiiiijj"] = Module["asm"]["Hb"]).apply(null, arguments);
        };
        var __emscripten_allow_main_runtime_queued_calls = Module["__emscripten_allow_main_runtime_queued_calls"] = 56672;
        var __emscripten_main_thread_futex = Module["__emscripten_main_thread_futex"] = 60132;
        function invoke_ii(index, a1) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_vi(index, a1) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_v(index) {
          var sp = stackSave();
          try {
            wasmTable.get(index)();
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viii(index, a1, a2, a3) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiii(index, a1, a2, a3, a4) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iii(index, a1, a2) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_vii(index, a1, a2) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiii(index, a1, a2, a3, a4) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_diii(index, a1, a2, a3) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_i(index) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)();
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiii(index, a1, a2, a3) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iid(index, a1, a2) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5, a6);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiidii(index, a1, a2, a3, a4, a5, a6, a7) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viffiid(index, a1, a2, a3, a4, a5, a6) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viddi(index, a1, a2, a3, a4) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiii(index, a1, a2, a3, a4, a5) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viidd(index, a1, a2, a3, a4) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiid(index, a1, a2, a3, a4, a5) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiid(index, a1, a2, a3, a4, a5) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_j(index) {
          var sp = stackSave();
          try {
            return dynCall_j(index);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        Module["addRunDependency"] = addRunDependency;
        Module["removeRunDependency"] = removeRunDependency;
        Module["FS_createPath"] = FS.createPath;
        Module["FS_createDataFile"] = FS.createDataFile;
        Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
        Module["FS_createLazyFile"] = FS.createLazyFile;
        Module["FS_createDevice"] = FS.createDevice;
        Module["FS_unlink"] = FS.unlink;
        Module["keepRuntimeAlive"] = keepRuntimeAlive;
        Module["FS"] = FS;
        Module["PThread"] = PThread;
        Module["PThread"] = PThread;
        Module["wasmMemory"] = wasmMemory;
        Module["ExitStatus"] = ExitStatus;
        var calledRun;
        function ExitStatus(status) {
          this.name = "ExitStatus";
          this.message = "Program terminated with exit(" + status + ")";
          this.status = status;
        }
        dependenciesFulfilled = function runCaller() {
          if (!calledRun)
            run();
          if (!calledRun)
            dependenciesFulfilled = runCaller;
        };
        function callMain(args) {
          var entryFunction = Module["_main"];
          var argc = 0;
          var argv = 0;
          try {
            var ret = entryFunction(argc, argv);
            exit(ret, true);
          } catch (e) {
            if (e instanceof ExitStatus || e == "unwind") {
              return;
            }
            var toLog = e;
            if (e && typeof e === "object" && e.stack) {
              toLog = [e, e.stack];
            }
            err("exception thrown: " + toLog);
            quit_(1, e);
          } finally {
          }
        }
        function run(args) {
          if (runDependencies > 0) {
            return;
          }
          if (ENVIRONMENT_IS_PTHREAD) {
            readyPromiseResolve(Module);
            initRuntime();
            postMessage({ "cmd": "loaded" });
            return;
          }
          preRun();
          if (runDependencies > 0) {
            return;
          }
          function doRun() {
            if (calledRun)
              return;
            calledRun = true;
            Module["calledRun"] = true;
            if (ABORT)
              return;
            initRuntime();
            preMain();
            readyPromiseResolve(Module);
            if (Module["onRuntimeInitialized"])
              Module["onRuntimeInitialized"]();
            if (shouldRunNow)
              callMain();
            postRun();
          }
          if (Module["setStatus"]) {
            Module["setStatus"]("Running...");
            setTimeout(function() {
              setTimeout(function() {
                Module["setStatus"]("");
              }, 1);
              doRun();
            }, 1);
          } else {
            doRun();
          }
        }
        Module["run"] = run;
        function exit(status, implicit) {
          if (!implicit) {
            if (ENVIRONMENT_IS_PTHREAD) {
              postMessage({ "cmd": "exitProcess", "returnCode": status });
              throw new ExitStatus(status);
            }
          }
          if (keepRuntimeAlive()) ; else {
            PThread.terminateAllThreads();
            if (Module["onExit"])
              Module["onExit"](status);
            ABORT = true;
          }
          quit_(status, new ExitStatus(status));
        }
        if (Module["preInit"]) {
          if (typeof Module["preInit"] == "function")
            Module["preInit"] = [Module["preInit"]];
          while (Module["preInit"].length > 0) {
            Module["preInit"].pop()();
          }
        }
        var shouldRunNow = true;
        if (Module["noInitialRun"])
          shouldRunNow = false;
        if (ENVIRONMENT_IS_PTHREAD) {
          noExitRuntime = false;
          PThread.initWorker();
        }
        run();
        return WebIFCWasm3.ready;
      };
    }();
    if (typeof exports === "object" && typeof module === "object")
      module.exports = WebIFCWasm2;
    else if (typeof define === "function" && define["amd"])
      define([], function() {
        return WebIFCWasm2;
      });
    else if (typeof exports === "object")
      exports["WebIFCWasm"] = WebIFCWasm2;
  }
});

// dist/web-ifc.js
var require_web_ifc = __commonJS({
  "dist/web-ifc.js"(exports, module) {
    var WebIFCWasm2 = function() {
      var _scriptDir = typeof document !== "undefined" && document.currentScript ? document.currentScript.src : void 0;
      if (typeof __filename !== "undefined")
        _scriptDir = _scriptDir || __filename;
      return function(WebIFCWasm3) {
        WebIFCWasm3 = WebIFCWasm3 || {};
        var Module = typeof WebIFCWasm3 !== "undefined" ? WebIFCWasm3 : {};
        var readyPromiseResolve, readyPromiseReject;
        Module["ready"] = new Promise(function(resolve, reject) {
          readyPromiseResolve = resolve;
          readyPromiseReject = reject;
        });
        var moduleOverrides = {};
        var key;
        for (key in Module) {
          if (Module.hasOwnProperty(key)) {
            moduleOverrides[key] = Module[key];
          }
        }
        var thisProgram = "./this.program";
        var quit_ = function(status, toThrow) {
          throw toThrow;
        };
        var ENVIRONMENT_IS_WEB = typeof window === "object";
        var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
        var ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
        var scriptDirectory = "";
        function locateFile(path) {
          if (Module["locateFile"]) {
            return Module["locateFile"](path, scriptDirectory);
          }
          return scriptDirectory + path;
        }
        var read_, readAsync, readBinary;
        var nodeFS;
        var nodePath;
        if (ENVIRONMENT_IS_NODE) {
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = __require("path").dirname(scriptDirectory) + "/";
          } else {
            scriptDirectory = __dirname + "/";
          }
          read_ = function shell_read(filename, binary) {
            if (!nodeFS)
              nodeFS = __require("fs");
            if (!nodePath)
              nodePath = __require("path");
            filename = nodePath["normalize"](filename);
            return nodeFS["readFileSync"](filename, binary ? null : "utf8");
          };
          readBinary = function readBinary2(filename) {
            var ret = read_(filename, true);
            if (!ret.buffer) {
              ret = new Uint8Array(ret);
            }
            assert(ret.buffer);
            return ret;
          };
          readAsync = function readAsync2(filename, onload, onerror) {
            if (!nodeFS)
              nodeFS = __require("fs");
            if (!nodePath)
              nodePath = __require("path");
            filename = nodePath["normalize"](filename);
            nodeFS["readFile"](filename, function(err2, data) {
              if (err2)
                onerror(err2);
              else
                onload(data.buffer);
            });
          };
          if (process["argv"].length > 1) {
            thisProgram = process["argv"][1].replace(/\\/g, "/");
          }
          process["argv"].slice(2);
          process["on"]("uncaughtException", function(ex) {
            if (!(ex instanceof ExitStatus)) {
              throw ex;
            }
          });
          process["on"]("unhandledRejection", abort);
          quit_ = function(status, toThrow) {
            if (keepRuntimeAlive()) {
              process["exitCode"] = status;
              throw toThrow;
            }
            process["exit"](status);
          };
          Module["inspect"] = function() {
            return "[Emscripten Module object]";
          };
        } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = self.location.href;
          } else if (typeof document !== "undefined" && document.currentScript) {
            scriptDirectory = document.currentScript.src;
          }
          if (_scriptDir) {
            scriptDirectory = _scriptDir;
          }
          if (scriptDirectory.indexOf("blob:") !== 0) {
            scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
          } else {
            scriptDirectory = "";
          }
          {
            read_ = function(url) {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, false);
              xhr.send(null);
              return xhr.responseText;
            };
            if (ENVIRONMENT_IS_WORKER) {
              readBinary = function(url) {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(xhr.response);
              };
            }
            readAsync = function(url, onload, onerror) {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, true);
              xhr.responseType = "arraybuffer";
              xhr.onload = function() {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                  onload(xhr.response);
                  return;
                }
                onerror();
              };
              xhr.onerror = onerror;
              xhr.send(null);
            };
          }
        } else ;
        var out = Module["print"] || console.log.bind(console);
        var err = Module["printErr"] || console.warn.bind(console);
        for (key in moduleOverrides) {
          if (moduleOverrides.hasOwnProperty(key)) {
            Module[key] = moduleOverrides[key];
          }
        }
        moduleOverrides = null;
        if (Module["arguments"])
          Module["arguments"];
        if (Module["thisProgram"])
          thisProgram = Module["thisProgram"];
        if (Module["quit"])
          quit_ = Module["quit"];
        var tempRet0 = 0;
        var setTempRet0 = function(value) {
          tempRet0 = value;
        };
        var getTempRet0 = function() {
          return tempRet0;
        };
        var wasmBinary;
        if (Module["wasmBinary"])
          wasmBinary = Module["wasmBinary"];
        var noExitRuntime = Module["noExitRuntime"] || true;
        if (typeof WebAssembly !== "object") {
          abort("no native wasm support detected");
        }
        var wasmMemory;
        var ABORT = false;
        function assert(condition, text) {
          if (!condition) {
            abort("Assertion failed: " + text);
          }
        }
        var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : void 0;
        function UTF8ArrayToString(heap, idx, maxBytesToRead) {
          idx >>>= 0;
          var endIdx = idx + maxBytesToRead;
          var endPtr = idx;
          while (heap[endPtr >>> 0] && !(endPtr >= endIdx))
            ++endPtr;
          if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
            return UTF8Decoder.decode(heap.subarray(idx >>> 0, endPtr >>> 0));
          } else {
            var str = "";
            while (idx < endPtr) {
              var u0 = heap[idx++ >>> 0];
              if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue;
              }
              var u1 = heap[idx++ >>> 0] & 63;
              if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue;
              }
              var u2 = heap[idx++ >>> 0] & 63;
              if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2;
              } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++ >>> 0] & 63;
              }
              if (u0 < 65536) {
                str += String.fromCharCode(u0);
              } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
              }
            }
          }
          return str;
        }
        function UTF8ToString(ptr, maxBytesToRead) {
          ptr >>>= 0;
          return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
        }
        function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
          outIdx >>>= 0;
          if (!(maxBytesToWrite > 0))
            return 0;
          var startIdx = outIdx;
          var endIdx = outIdx + maxBytesToWrite - 1;
          for (var i = 0; i < str.length; ++i) {
            var u = str.charCodeAt(i);
            if (u >= 55296 && u <= 57343) {
              var u1 = str.charCodeAt(++i);
              u = 65536 + ((u & 1023) << 10) | u1 & 1023;
            }
            if (u <= 127) {
              if (outIdx >= endIdx)
                break;
              heap[outIdx++ >>> 0] = u;
            } else if (u <= 2047) {
              if (outIdx + 1 >= endIdx)
                break;
              heap[outIdx++ >>> 0] = 192 | u >> 6;
              heap[outIdx++ >>> 0] = 128 | u & 63;
            } else if (u <= 65535) {
              if (outIdx + 2 >= endIdx)
                break;
              heap[outIdx++ >>> 0] = 224 | u >> 12;
              heap[outIdx++ >>> 0] = 128 | u >> 6 & 63;
              heap[outIdx++ >>> 0] = 128 | u & 63;
            } else {
              if (outIdx + 3 >= endIdx)
                break;
              heap[outIdx++ >>> 0] = 240 | u >> 18;
              heap[outIdx++ >>> 0] = 128 | u >> 12 & 63;
              heap[outIdx++ >>> 0] = 128 | u >> 6 & 63;
              heap[outIdx++ >>> 0] = 128 | u & 63;
            }
          }
          heap[outIdx >>> 0] = 0;
          return outIdx - startIdx;
        }
        function stringToUTF8(str, outPtr, maxBytesToWrite) {
          return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
        }
        function lengthBytesUTF8(str) {
          var len = 0;
          for (var i = 0; i < str.length; ++i) {
            var u = str.charCodeAt(i);
            if (u >= 55296 && u <= 57343)
              u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
            if (u <= 127)
              ++len;
            else if (u <= 2047)
              len += 2;
            else if (u <= 65535)
              len += 3;
            else
              len += 4;
          }
          return len;
        }
        var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : void 0;
        function UTF16ToString(ptr, maxBytesToRead) {
          var endPtr = ptr;
          var idx = endPtr >> 1;
          var maxIdx = idx + maxBytesToRead / 2;
          while (!(idx >= maxIdx) && HEAPU16[idx >>> 0])
            ++idx;
          endPtr = idx << 1;
          if (endPtr - ptr > 32 && UTF16Decoder) {
            return UTF16Decoder.decode(HEAPU8.subarray(ptr >>> 0, endPtr >>> 0));
          } else {
            var str = "";
            for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
              var codeUnit = HEAP16[ptr + i * 2 >>> 1];
              if (codeUnit == 0)
                break;
              str += String.fromCharCode(codeUnit);
            }
            return str;
          }
        }
        function stringToUTF16(str, outPtr, maxBytesToWrite) {
          if (maxBytesToWrite === void 0) {
            maxBytesToWrite = 2147483647;
          }
          if (maxBytesToWrite < 2)
            return 0;
          maxBytesToWrite -= 2;
          var startPtr = outPtr;
          var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
          for (var i = 0; i < numCharsToWrite; ++i) {
            var codeUnit = str.charCodeAt(i);
            HEAP16[outPtr >>> 1] = codeUnit;
            outPtr += 2;
          }
          HEAP16[outPtr >>> 1] = 0;
          return outPtr - startPtr;
        }
        function lengthBytesUTF16(str) {
          return str.length * 2;
        }
        function UTF32ToString(ptr, maxBytesToRead) {
          var i = 0;
          var str = "";
          while (!(i >= maxBytesToRead / 4)) {
            var utf32 = HEAP32[ptr + i * 4 >>> 2];
            if (utf32 == 0)
              break;
            ++i;
            if (utf32 >= 65536) {
              var ch = utf32 - 65536;
              str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
            } else {
              str += String.fromCharCode(utf32);
            }
          }
          return str;
        }
        function stringToUTF32(str, outPtr, maxBytesToWrite) {
          outPtr >>>= 0;
          if (maxBytesToWrite === void 0) {
            maxBytesToWrite = 2147483647;
          }
          if (maxBytesToWrite < 4)
            return 0;
          var startPtr = outPtr;
          var endPtr = startPtr + maxBytesToWrite - 4;
          for (var i = 0; i < str.length; ++i) {
            var codeUnit = str.charCodeAt(i);
            if (codeUnit >= 55296 && codeUnit <= 57343) {
              var trailSurrogate = str.charCodeAt(++i);
              codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
            }
            HEAP32[outPtr >>> 2] = codeUnit;
            outPtr += 4;
            if (outPtr + 4 > endPtr)
              break;
          }
          HEAP32[outPtr >>> 2] = 0;
          return outPtr - startPtr;
        }
        function lengthBytesUTF32(str) {
          var len = 0;
          for (var i = 0; i < str.length; ++i) {
            var codeUnit = str.charCodeAt(i);
            if (codeUnit >= 55296 && codeUnit <= 57343)
              ++i;
            len += 4;
          }
          return len;
        }
        function writeArrayToMemory(array, buffer2) {
          HEAP8.set(array, buffer2 >>> 0);
        }
        function writeAsciiToMemory(str, buffer2, dontAddNull) {
          for (var i = 0; i < str.length; ++i) {
            HEAP8[buffer2++ >>> 0] = str.charCodeAt(i);
          }
          if (!dontAddNull)
            HEAP8[buffer2 >>> 0] = 0;
        }
        function alignUp(x, multiple) {
          if (x % multiple > 0) {
            x += multiple - x % multiple;
          }
          return x;
        }
        var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
        function updateGlobalBufferAndViews(buf) {
          buffer = buf;
          Module["HEAP8"] = HEAP8 = new Int8Array(buf);
          Module["HEAP16"] = HEAP16 = new Int16Array(buf);
          Module["HEAP32"] = HEAP32 = new Int32Array(buf);
          Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
          Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
          Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
          Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
          Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
        }
        Module["INITIAL_MEMORY"] || 16777216;
        var wasmTable;
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATMAIN__ = [];
        var __ATPOSTRUN__ = [];
        var runtimeKeepaliveCounter = 0;
        function keepRuntimeAlive() {
          return noExitRuntime || runtimeKeepaliveCounter > 0;
        }
        function preRun() {
          if (Module["preRun"]) {
            if (typeof Module["preRun"] == "function")
              Module["preRun"] = [Module["preRun"]];
            while (Module["preRun"].length) {
              addOnPreRun(Module["preRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPRERUN__);
        }
        function initRuntime() {
          if (!Module["noFSInit"] && !FS.init.initialized)
            FS.init();
          FS.ignorePermissions = false;
          callRuntimeCallbacks(__ATINIT__);
        }
        function preMain() {
          callRuntimeCallbacks(__ATMAIN__);
        }
        function postRun() {
          if (Module["postRun"]) {
            if (typeof Module["postRun"] == "function")
              Module["postRun"] = [Module["postRun"]];
            while (Module["postRun"].length) {
              addOnPostRun(Module["postRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPOSTRUN__);
        }
        function addOnPreRun(cb) {
          __ATPRERUN__.unshift(cb);
        }
        function addOnInit(cb) {
          __ATINIT__.unshift(cb);
        }
        function addOnPostRun(cb) {
          __ATPOSTRUN__.unshift(cb);
        }
        var runDependencies = 0;
        var dependenciesFulfilled = null;
        function getUniqueRunDependency(id) {
          return id;
        }
        function addRunDependency(id) {
          runDependencies++;
          if (Module["monitorRunDependencies"]) {
            Module["monitorRunDependencies"](runDependencies);
          }
        }
        function removeRunDependency(id) {
          runDependencies--;
          if (Module["monitorRunDependencies"]) {
            Module["monitorRunDependencies"](runDependencies);
          }
          if (runDependencies == 0) {
            if (dependenciesFulfilled) {
              var callback = dependenciesFulfilled;
              dependenciesFulfilled = null;
              callback();
            }
          }
        }
        Module["preloadedImages"] = {};
        Module["preloadedAudios"] = {};
        function abort(what) {
          if (Module["onAbort"]) {
            Module["onAbort"](what);
          }
          what += "";
          err(what);
          ABORT = true;
          what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
          var e = new WebAssembly.RuntimeError(what);
          readyPromiseReject(e);
          throw e;
        }
        var dataURIPrefix = "data:application/octet-stream;base64,";
        function isDataURI(filename) {
          return filename.startsWith(dataURIPrefix);
        }
        function isFileURI(filename) {
          return filename.startsWith("file://");
        }
        var wasmBinaryFile;
        wasmBinaryFile = "web-ifc.wasm";
        if (!isDataURI(wasmBinaryFile)) {
          wasmBinaryFile = locateFile(wasmBinaryFile);
        }
        function getBinary(file) {
          try {
            if (file == wasmBinaryFile && wasmBinary) {
              return new Uint8Array(wasmBinary);
            }
            if (readBinary) {
              return readBinary(file);
            } else {
              throw "both async and sync fetching of the wasm failed";
            }
          } catch (err2) {
            abort(err2);
          }
        }
        function getBinaryPromise() {
          if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
            if (typeof fetch === "function" && !isFileURI(wasmBinaryFile)) {
              return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
                if (!response["ok"]) {
                  throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
                }
                return response["arrayBuffer"]();
              }).catch(function() {
                return getBinary(wasmBinaryFile);
              });
            } else {
              if (readAsync) {
                return new Promise(function(resolve, reject) {
                  readAsync(wasmBinaryFile, function(response) {
                    resolve(new Uint8Array(response));
                  }, reject);
                });
              }
            }
          }
          return Promise.resolve().then(function() {
            return getBinary(wasmBinaryFile);
          });
        }
        function createWasm() {
          var info = { "a": asmLibraryArg };
          function receiveInstance(instance, module2) {
            var exports3 = instance.exports;
            Module["asm"] = exports3;
            wasmMemory = Module["asm"]["Na"];
            updateGlobalBufferAndViews(wasmMemory.buffer);
            wasmTable = Module["asm"]["Ra"];
            addOnInit(Module["asm"]["Oa"]);
            removeRunDependency();
          }
          addRunDependency();
          function receiveInstantiationResult(result) {
            receiveInstance(result["instance"]);
          }
          function instantiateArrayBuffer(receiver) {
            return getBinaryPromise().then(function(binary) {
              var result = WebAssembly.instantiate(binary, info);
              return result;
            }).then(receiver, function(reason) {
              err("failed to asynchronously prepare wasm: " + reason);
              abort(reason);
            });
          }
          function instantiateAsync() {
            if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && typeof fetch === "function") {
              return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
                var result = WebAssembly.instantiateStreaming(response, info);
                return result.then(receiveInstantiationResult, function(reason) {
                  err("wasm streaming compile failed: " + reason);
                  err("falling back to ArrayBuffer instantiation");
                  return instantiateArrayBuffer(receiveInstantiationResult);
                });
              });
            } else {
              return instantiateArrayBuffer(receiveInstantiationResult);
            }
          }
          if (Module["instantiateWasm"]) {
            try {
              var exports2 = Module["instantiateWasm"](info, receiveInstance);
              return exports2;
            } catch (e) {
              err("Module.instantiateWasm callback failed with error: " + e);
              return false;
            }
          }
          instantiateAsync().catch(readyPromiseReject);
          return {};
        }
        var tempDouble;
        var tempI64;
        function callRuntimeCallbacks(callbacks) {
          while (callbacks.length > 0) {
            var callback = callbacks.shift();
            if (typeof callback == "function") {
              callback(Module);
              continue;
            }
            var func = callback.func;
            if (typeof func === "number") {
              if (callback.arg === void 0) {
                wasmTable.get(func)();
              } else {
                wasmTable.get(func)(callback.arg);
              }
            } else {
              func(callback.arg === void 0 ? null : callback.arg);
            }
          }
        }
        function ___assert_fail(condition, filename, line, func) {
          abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"]);
        }
        function ___cxa_allocate_exception(size) {
          return _malloc(size + 16) + 16;
        }
        function ExceptionInfo(excPtr) {
          this.excPtr = excPtr;
          this.ptr = excPtr - 16;
          this.set_type = function(type) {
            HEAP32[this.ptr + 4 >>> 2] = type;
          };
          this.get_type = function() {
            return HEAP32[this.ptr + 4 >>> 2];
          };
          this.set_destructor = function(destructor) {
            HEAP32[this.ptr + 8 >>> 2] = destructor;
          };
          this.get_destructor = function() {
            return HEAP32[this.ptr + 8 >>> 2];
          };
          this.set_refcount = function(refcount) {
            HEAP32[this.ptr >>> 2] = refcount;
          };
          this.set_caught = function(caught) {
            caught = caught ? 1 : 0;
            HEAP8[this.ptr + 12 >>> 0] = caught;
          };
          this.get_caught = function() {
            return HEAP8[this.ptr + 12 >>> 0] != 0;
          };
          this.set_rethrown = function(rethrown) {
            rethrown = rethrown ? 1 : 0;
            HEAP8[this.ptr + 13 >>> 0] = rethrown;
          };
          this.get_rethrown = function() {
            return HEAP8[this.ptr + 13 >>> 0] != 0;
          };
          this.init = function(type, destructor) {
            this.set_type(type);
            this.set_destructor(destructor);
            this.set_refcount(0);
            this.set_caught(false);
            this.set_rethrown(false);
          };
          this.add_ref = function() {
            var value = HEAP32[this.ptr >>> 2];
            HEAP32[this.ptr >>> 2] = value + 1;
          };
          this.release_ref = function() {
            var prev = HEAP32[this.ptr >>> 2];
            HEAP32[this.ptr >>> 2] = prev - 1;
            return prev === 1;
          };
        }
        function CatchInfo(ptr) {
          this.free = function() {
            _free(this.ptr);
            this.ptr = 0;
          };
          this.set_base_ptr = function(basePtr) {
            HEAP32[this.ptr >>> 2] = basePtr;
          };
          this.get_base_ptr = function() {
            return HEAP32[this.ptr >>> 2];
          };
          this.set_adjusted_ptr = function(adjustedPtr) {
            HEAP32[this.ptr + 4 >>> 2] = adjustedPtr;
          };
          this.get_adjusted_ptr_addr = function() {
            return this.ptr + 4;
          };
          this.get_adjusted_ptr = function() {
            return HEAP32[this.ptr + 4 >>> 2];
          };
          this.get_exception_ptr = function() {
            var isPointer = ___cxa_is_pointer_type(this.get_exception_info().get_type());
            if (isPointer) {
              return HEAP32[this.get_base_ptr() >>> 2];
            }
            var adjusted = this.get_adjusted_ptr();
            if (adjusted !== 0)
              return adjusted;
            return this.get_base_ptr();
          };
          this.get_exception_info = function() {
            return new ExceptionInfo(this.get_base_ptr());
          };
          if (ptr === void 0) {
            this.ptr = _malloc(8);
            this.set_adjusted_ptr(0);
          } else {
            this.ptr = ptr;
          }
        }
        var exceptionCaught = [];
        function exception_addRef(info) {
          info.add_ref();
        }
        var uncaughtExceptionCount = 0;
        function ___cxa_begin_catch(ptr) {
          var catchInfo = new CatchInfo(ptr);
          var info = catchInfo.get_exception_info();
          if (!info.get_caught()) {
            info.set_caught(true);
            uncaughtExceptionCount--;
          }
          info.set_rethrown(false);
          exceptionCaught.push(catchInfo);
          exception_addRef(info);
          return catchInfo.get_exception_ptr();
        }
        var exceptionLast = 0;
        function ___cxa_free_exception(ptr) {
          return _free(new ExceptionInfo(ptr).ptr);
        }
        function exception_decRef(info) {
          if (info.release_ref() && !info.get_rethrown()) {
            var destructor = info.get_destructor();
            if (destructor) {
              wasmTable.get(destructor)(info.excPtr);
            }
            ___cxa_free_exception(info.excPtr);
          }
        }
        function ___cxa_end_catch() {
          _setThrew(0);
          var catchInfo = exceptionCaught.pop();
          exception_decRef(catchInfo.get_exception_info());
          catchInfo.free();
          exceptionLast = 0;
        }
        function ___resumeException(catchInfoPtr) {
          var catchInfo = new CatchInfo(catchInfoPtr);
          var ptr = catchInfo.get_base_ptr();
          if (!exceptionLast) {
            exceptionLast = ptr;
          }
          catchInfo.free();
          throw ptr;
        }
        function ___cxa_find_matching_catch_2() {
          var thrown = exceptionLast;
          if (!thrown) {
            setTempRet0(0);
            return 0 | 0;
          }
          var info = new ExceptionInfo(thrown);
          var thrownType = info.get_type();
          var catchInfo = new CatchInfo();
          catchInfo.set_base_ptr(thrown);
          catchInfo.set_adjusted_ptr(thrown);
          if (!thrownType) {
            setTempRet0(0);
            return catchInfo.ptr | 0;
          }
          var typeArray = Array.prototype.slice.call(arguments);
          for (var i = 0; i < typeArray.length; i++) {
            var caughtType = typeArray[i];
            if (caughtType === 0 || caughtType === thrownType) {
              break;
            }
            if (___cxa_can_catch(caughtType, thrownType, catchInfo.get_adjusted_ptr_addr())) {
              setTempRet0(caughtType);
              return catchInfo.ptr | 0;
            }
          }
          setTempRet0(thrownType);
          return catchInfo.ptr | 0;
        }
        function ___cxa_find_matching_catch_3() {
          var thrown = exceptionLast;
          if (!thrown) {
            setTempRet0(0);
            return 0 | 0;
          }
          var info = new ExceptionInfo(thrown);
          var thrownType = info.get_type();
          var catchInfo = new CatchInfo();
          catchInfo.set_base_ptr(thrown);
          catchInfo.set_adjusted_ptr(thrown);
          if (!thrownType) {
            setTempRet0(0);
            return catchInfo.ptr | 0;
          }
          var typeArray = Array.prototype.slice.call(arguments);
          for (var i = 0; i < typeArray.length; i++) {
            var caughtType = typeArray[i];
            if (caughtType === 0 || caughtType === thrownType) {
              break;
            }
            if (___cxa_can_catch(caughtType, thrownType, catchInfo.get_adjusted_ptr_addr())) {
              setTempRet0(caughtType);
              return catchInfo.ptr | 0;
            }
          }
          setTempRet0(thrownType);
          return catchInfo.ptr | 0;
        }
        function ___cxa_rethrow() {
          var catchInfo = exceptionCaught.pop();
          if (!catchInfo) {
            abort("no exception to throw");
          }
          var info = catchInfo.get_exception_info();
          var ptr = catchInfo.get_base_ptr();
          if (!info.get_rethrown()) {
            exceptionCaught.push(catchInfo);
            info.set_rethrown(true);
            info.set_caught(false);
            uncaughtExceptionCount++;
          } else {
            catchInfo.free();
          }
          exceptionLast = ptr;
          throw ptr;
        }
        function ___cxa_throw(ptr, type, destructor) {
          var info = new ExceptionInfo(ptr);
          info.init(type, destructor);
          exceptionLast = ptr;
          uncaughtExceptionCount++;
          throw ptr;
        }
        function ___cxa_uncaught_exceptions() {
          return uncaughtExceptionCount;
        }
        function setErrNo(value) {
          HEAP32[___errno_location() >>> 2] = value;
          return value;
        }
        var PATH = { splitPath: function(filename) {
          var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
          return splitPathRe.exec(filename).slice(1);
        }, normalizeArray: function(parts, allowAboveRoot) {
          var up = 0;
          for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
              parts.splice(i, 1);
            } else if (last === "..") {
              parts.splice(i, 1);
              up++;
            } else if (up) {
              parts.splice(i, 1);
              up--;
            }
          }
          if (allowAboveRoot) {
            for (; up; up--) {
              parts.unshift("..");
            }
          }
          return parts;
        }, normalize: function(path) {
          var isAbsolute = path.charAt(0) === "/", trailingSlash = path.substr(-1) === "/";
          path = PATH.normalizeArray(path.split("/").filter(function(p) {
            return !!p;
          }), !isAbsolute).join("/");
          if (!path && !isAbsolute) {
            path = ".";
          }
          if (path && trailingSlash) {
            path += "/";
          }
          return (isAbsolute ? "/" : "") + path;
        }, dirname: function(path) {
          var result = PATH.splitPath(path), root = result[0], dir = result[1];
          if (!root && !dir) {
            return ".";
          }
          if (dir) {
            dir = dir.substr(0, dir.length - 1);
          }
          return root + dir;
        }, basename: function(path) {
          if (path === "/")
            return "/";
          path = PATH.normalize(path);
          path = path.replace(/\/$/, "");
          var lastSlash = path.lastIndexOf("/");
          if (lastSlash === -1)
            return path;
          return path.substr(lastSlash + 1);
        }, extname: function(path) {
          return PATH.splitPath(path)[3];
        }, join: function() {
          var paths = Array.prototype.slice.call(arguments, 0);
          return PATH.normalize(paths.join("/"));
        }, join2: function(l, r) {
          return PATH.normalize(l + "/" + r);
        } };
        function getRandomDevice() {
          if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
            var randomBuffer = new Uint8Array(1);
            return function() {
              crypto.getRandomValues(randomBuffer);
              return randomBuffer[0];
            };
          } else if (ENVIRONMENT_IS_NODE) {
            try {
              var crypto_module = require_crypto();
              return function() {
                return crypto_module["randomBytes"](1)[0];
              };
            } catch (e) {
            }
          }
          return function() {
            abort("randomDevice");
          };
        }
        var PATH_FS = { resolve: function() {
          var resolvedPath = "", resolvedAbsolute = false;
          for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path = i >= 0 ? arguments[i] : FS.cwd();
            if (typeof path !== "string") {
              throw new TypeError("Arguments to path.resolve must be strings");
            } else if (!path) {
              return "";
            }
            resolvedPath = path + "/" + resolvedPath;
            resolvedAbsolute = path.charAt(0) === "/";
          }
          resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function(p) {
            return !!p;
          }), !resolvedAbsolute).join("/");
          return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
        }, relative: function(from, to) {
          from = PATH_FS.resolve(from).substr(1);
          to = PATH_FS.resolve(to).substr(1);
          function trim(arr) {
            var start = 0;
            for (; start < arr.length; start++) {
              if (arr[start] !== "")
                break;
            }
            var end = arr.length - 1;
            for (; end >= 0; end--) {
              if (arr[end] !== "")
                break;
            }
            if (start > end)
              return [];
            return arr.slice(start, end - start + 1);
          }
          var fromParts = trim(from.split("/"));
          var toParts = trim(to.split("/"));
          var length = Math.min(fromParts.length, toParts.length);
          var samePartsLength = length;
          for (var i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
              samePartsLength = i;
              break;
            }
          }
          var outputParts = [];
          for (var i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push("..");
          }
          outputParts = outputParts.concat(toParts.slice(samePartsLength));
          return outputParts.join("/");
        } };
        var TTY = { ttys: [], init: function() {
        }, shutdown: function() {
        }, register: function(dev, ops) {
          TTY.ttys[dev] = { input: [], output: [], ops };
          FS.registerDevice(dev, TTY.stream_ops);
        }, stream_ops: { open: function(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        }, close: function(stream) {
          stream.tty.ops.flush(stream.tty);
        }, flush: function(stream) {
          stream.tty.ops.flush(stream.tty);
        }, read: function(stream, buffer2, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === void 0 && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === void 0)
              break;
            bytesRead++;
            buffer2[offset + i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        }, write: function(stream, buffer2, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer2[offset + i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        } }, default_tty_ops: { get_char: function(tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              var BUFSIZE = 256;
              var buf = Buffer.alloc(BUFSIZE);
              var bytesRead = 0;
              try {
                bytesRead = nodeFS.readSync(process.stdin.fd, buf, 0, BUFSIZE, null);
              } catch (e) {
                if (e.toString().includes("EOF"))
                  bytesRead = 0;
                else
                  throw e;
              }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString("utf-8");
              } else {
                result = null;
              }
            } else if (typeof window != "undefined" && typeof window.prompt == "function") {
              result = window.prompt("Input: ");
              if (result !== null) {
                result += "\n";
              }
            } else if (typeof readline == "function") {
              result = readline();
              if (result !== null) {
                result += "\n";
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        }, put_char: function(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0)
              tty.output.push(val);
          }
        }, flush: function(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        } }, default_tty1_ops: { put_char: function(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0)
              tty.output.push(val);
          }
        }, flush: function(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        } } };
        function mmapAlloc(size) {
          abort();
        }
        var MEMFS = { ops_table: null, mount: function(mount) {
          return MEMFS.createNode(null, "/", 16384 | 511, 0);
        }, createNode: function(parent, name2, mode, dev) {
          if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
            throw new FS.ErrnoError(63);
          }
          if (!MEMFS.ops_table) {
            MEMFS.ops_table = { dir: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, lookup: MEMFS.node_ops.lookup, mknod: MEMFS.node_ops.mknod, rename: MEMFS.node_ops.rename, unlink: MEMFS.node_ops.unlink, rmdir: MEMFS.node_ops.rmdir, readdir: MEMFS.node_ops.readdir, symlink: MEMFS.node_ops.symlink }, stream: { llseek: MEMFS.stream_ops.llseek } }, file: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: { llseek: MEMFS.stream_ops.llseek, read: MEMFS.stream_ops.read, write: MEMFS.stream_ops.write, allocate: MEMFS.stream_ops.allocate, mmap: MEMFS.stream_ops.mmap, msync: MEMFS.stream_ops.msync } }, link: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, readlink: MEMFS.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: FS.chrdev_stream_ops } };
          }
          var node = FS.createNode(parent, name2, mode, dev);
          if (FS.isDir(node.mode)) {
            node.node_ops = MEMFS.ops_table.dir.node;
            node.stream_ops = MEMFS.ops_table.dir.stream;
            node.contents = {};
          } else if (FS.isFile(node.mode)) {
            node.node_ops = MEMFS.ops_table.file.node;
            node.stream_ops = MEMFS.ops_table.file.stream;
            node.usedBytes = 0;
            node.contents = null;
          } else if (FS.isLink(node.mode)) {
            node.node_ops = MEMFS.ops_table.link.node;
            node.stream_ops = MEMFS.ops_table.link.stream;
          } else if (FS.isChrdev(node.mode)) {
            node.node_ops = MEMFS.ops_table.chrdev.node;
            node.stream_ops = MEMFS.ops_table.chrdev.stream;
          }
          node.timestamp = Date.now();
          if (parent) {
            parent.contents[name2] = node;
            parent.timestamp = node.timestamp;
          }
          return node;
        }, getFileDataAsTypedArray: function(node) {
          if (!node.contents)
            return new Uint8Array(0);
          if (node.contents.subarray)
            return node.contents.subarray(0, node.usedBytes);
          return new Uint8Array(node.contents);
        }, expandFileStorage: function(node, newCapacity) {
          newCapacity >>>= 0;
          var prevCapacity = node.contents ? node.contents.length : 0;
          if (prevCapacity >= newCapacity)
            return;
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
          if (prevCapacity != 0)
            newCapacity = Math.max(newCapacity, 256);
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity);
          if (node.usedBytes > 0)
            node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        }, resizeFileStorage: function(node, newSize) {
          newSize >>>= 0;
          if (node.usedBytes == newSize)
            return;
          if (newSize == 0) {
            node.contents = null;
            node.usedBytes = 0;
          } else {
            var oldContents = node.contents;
            node.contents = new Uint8Array(newSize);
            if (oldContents) {
              node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
            }
            node.usedBytes = newSize;
          }
        }, node_ops: { getattr: function(node) {
          var attr = {};
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        }, setattr: function(node, attr) {
          if (attr.mode !== void 0) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== void 0) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== void 0) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        }, lookup: function(parent, name2) {
          throw FS.genericErrors[44];
        }, mknod: function(parent, name2, mode, dev) {
          return MEMFS.createNode(parent, name2, mode, dev);
        }, rename: function(old_node, new_dir, new_name) {
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now();
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        }, unlink: function(parent, name2) {
          delete parent.contents[name2];
          parent.timestamp = Date.now();
        }, rmdir: function(parent, name2) {
          var node = FS.lookupNode(parent, name2);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name2];
          parent.timestamp = Date.now();
        }, readdir: function(node) {
          var entries = [".", ".."];
          for (var key2 in node.contents) {
            if (!node.contents.hasOwnProperty(key2)) {
              continue;
            }
            entries.push(key2);
          }
          return entries;
        }, symlink: function(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
          node.link = oldpath;
          return node;
        }, readlink: function(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        } }, stream_ops: { read: function(stream, buffer2, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes)
            return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          if (size > 8 && contents.subarray) {
            buffer2.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++)
              buffer2[offset + i] = contents[position + i];
          }
          return size;
        }, write: function(stream, buffer2, offset, length, position, canOwn) {
          if (buffer2.buffer === HEAP8.buffer) {
            canOwn = false;
          }
          if (!length)
            return 0;
          var node = stream.node;
          node.timestamp = Date.now();
          if (buffer2.subarray && (!node.contents || node.contents.subarray)) {
            if (canOwn) {
              node.contents = buffer2.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) {
              node.contents = buffer2.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) {
              node.contents.set(buffer2.subarray(offset, offset + length), position);
              return length;
            }
          }
          MEMFS.expandFileStorage(node, position + length);
          if (node.contents.subarray && buffer2.subarray) {
            node.contents.set(buffer2.subarray(offset, offset + length), position);
          } else {
            for (var i = 0; i < length; i++) {
              node.contents[position + i] = buffer2[offset + i];
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        }, llseek: function(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        }, allocate: function(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        }, mmap: function(stream, address, length, position, prot, flags) {
          if (address !== 0) {
            throw new FS.ErrnoError(28);
          }
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          if (!(flags & 2) && contents.buffer === buffer) {
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = mmapAlloc();
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            ptr >>>= 0;
            HEAP8.set(contents, ptr >>> 0);
          }
          return { ptr, allocated };
        }, msync: function(stream, buffer2, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (mmapFlags & 2) {
            return 0;
          }
          MEMFS.stream_ops.write(stream, buffer2, 0, length, offset, false);
          return 0;
        } } };
        function asyncLoad(url, onload, onerror, noRunDep) {
          var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
          readAsync(url, function(arrayBuffer) {
            assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
            onload(new Uint8Array(arrayBuffer));
            if (dep)
              removeRunDependency();
          }, function(event) {
            if (onerror) {
              onerror();
            } else {
              throw 'Loading data file "' + url + '" failed.';
            }
          });
          if (dep)
            addRunDependency();
        }
        var FS = { root: null, mounts: [], devices: {}, streams: [], nextInode: 1, nameTable: null, currentPath: "/", initialized: false, ignorePermissions: true, trackingDelegate: {}, tracking: { openFlags: { READ: 1, WRITE: 2 } }, ErrnoError: null, genericErrors: {}, filesystems: null, syncFSRequests: 0, lookupPath: function(path, opts) {
          path = PATH_FS.resolve(FS.cwd(), path);
          opts = opts || {};
          if (!path)
            return { path: "", node: null };
          var defaults = { follow_mount: true, recurse_count: 0 };
          for (var key2 in defaults) {
            if (opts[key2] === void 0) {
              opts[key2] = defaults[key2];
            }
          }
          if (opts.recurse_count > 8) {
            throw new FS.ErrnoError(32);
          }
          var parts = PATH.normalizeArray(path.split("/").filter(function(p) {
            return !!p;
          }), false);
          var current = FS.root;
          var current_path = "/";
          for (var i = 0; i < parts.length; i++) {
            var islast = i === parts.length - 1;
            if (islast && opts.parent) {
              break;
            }
            current = FS.lookupNode(current, parts[i]);
            current_path = PATH.join2(current_path, parts[i]);
            if (FS.isMountpoint(current)) {
              if (!islast || islast && opts.follow_mount) {
                current = current.mounted.root;
              }
            }
            if (!islast || opts.follow) {
              var count = 0;
              while (FS.isLink(current.mode)) {
                var link = FS.readlink(current_path);
                current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
                var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
                current = lookup.node;
                if (count++ > 40) {
                  throw new FS.ErrnoError(32);
                }
              }
            }
          }
          return { path: current_path, node: current };
        }, getPath: function(node) {
          var path;
          while (true) {
            if (FS.isRoot(node)) {
              var mount = node.mount.mountpoint;
              if (!path)
                return mount;
              return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
            }
            path = path ? node.name + "/" + path : node.name;
            node = node.parent;
          }
        }, hashName: function(parentid, name2) {
          var hash = 0;
          for (var i = 0; i < name2.length; i++) {
            hash = (hash << 5) - hash + name2.charCodeAt(i) | 0;
          }
          return (parentid + hash >>> 0) % FS.nameTable.length;
        }, hashAddNode: function(node) {
          var hash = FS.hashName(node.parent.id, node.name);
          node.name_next = FS.nameTable[hash];
          FS.nameTable[hash] = node;
        }, hashRemoveNode: function(node) {
          var hash = FS.hashName(node.parent.id, node.name);
          if (FS.nameTable[hash] === node) {
            FS.nameTable[hash] = node.name_next;
          } else {
            var current = FS.nameTable[hash];
            while (current) {
              if (current.name_next === node) {
                current.name_next = node.name_next;
                break;
              }
              current = current.name_next;
            }
          }
        }, lookupNode: function(parent, name2) {
          var errCode = FS.mayLookup(parent);
          if (errCode) {
            throw new FS.ErrnoError(errCode, parent);
          }
          var hash = FS.hashName(parent.id, name2);
          for (var node = FS.nameTable[hash]; node; node = node.name_next) {
            var nodeName = node.name;
            if (node.parent.id === parent.id && nodeName === name2) {
              return node;
            }
          }
          return FS.lookup(parent, name2);
        }, createNode: function(parent, name2, mode, rdev) {
          var node = new FS.FSNode(parent, name2, mode, rdev);
          FS.hashAddNode(node);
          return node;
        }, destroyNode: function(node) {
          FS.hashRemoveNode(node);
        }, isRoot: function(node) {
          return node === node.parent;
        }, isMountpoint: function(node) {
          return !!node.mounted;
        }, isFile: function(mode) {
          return (mode & 61440) === 32768;
        }, isDir: function(mode) {
          return (mode & 61440) === 16384;
        }, isLink: function(mode) {
          return (mode & 61440) === 40960;
        }, isChrdev: function(mode) {
          return (mode & 61440) === 8192;
        }, isBlkdev: function(mode) {
          return (mode & 61440) === 24576;
        }, isFIFO: function(mode) {
          return (mode & 61440) === 4096;
        }, isSocket: function(mode) {
          return (mode & 49152) === 49152;
        }, flagModes: { "r": 0, "r+": 2, "w": 577, "w+": 578, "a": 1089, "a+": 1090 }, modeStringToFlags: function(str) {
          var flags = FS.flagModes[str];
          if (typeof flags === "undefined") {
            throw new Error("Unknown file open mode: " + str);
          }
          return flags;
        }, flagsToPermissionString: function(flag) {
          var perms = ["r", "w", "rw"][flag & 3];
          if (flag & 512) {
            perms += "w";
          }
          return perms;
        }, nodePermissions: function(node, perms) {
          if (FS.ignorePermissions) {
            return 0;
          }
          if (perms.includes("r") && !(node.mode & 292)) {
            return 2;
          } else if (perms.includes("w") && !(node.mode & 146)) {
            return 2;
          } else if (perms.includes("x") && !(node.mode & 73)) {
            return 2;
          }
          return 0;
        }, mayLookup: function(dir) {
          var errCode = FS.nodePermissions(dir, "x");
          if (errCode)
            return errCode;
          if (!dir.node_ops.lookup)
            return 2;
          return 0;
        }, mayCreate: function(dir, name2) {
          try {
            var node = FS.lookupNode(dir, name2);
            return 20;
          } catch (e) {
          }
          return FS.nodePermissions(dir, "wx");
        }, mayDelete: function(dir, name2, isdir) {
          var node;
          try {
            node = FS.lookupNode(dir, name2);
          } catch (e) {
            return e.errno;
          }
          var errCode = FS.nodePermissions(dir, "wx");
          if (errCode) {
            return errCode;
          }
          if (isdir) {
            if (!FS.isDir(node.mode)) {
              return 54;
            }
            if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
              return 10;
            }
          } else {
            if (FS.isDir(node.mode)) {
              return 31;
            }
          }
          return 0;
        }, mayOpen: function(node, flags) {
          if (!node) {
            return 44;
          }
          if (FS.isLink(node.mode)) {
            return 32;
          } else if (FS.isDir(node.mode)) {
            if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
              return 31;
            }
          }
          return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
        }, MAX_OPEN_FDS: 4096, nextfd: function(fd_start, fd_end) {
          fd_start = fd_start || 0;
          fd_end = fd_end || FS.MAX_OPEN_FDS;
          for (var fd = fd_start; fd <= fd_end; fd++) {
            if (!FS.streams[fd]) {
              return fd;
            }
          }
          throw new FS.ErrnoError(33);
        }, getStream: function(fd) {
          return FS.streams[fd];
        }, createStream: function(stream, fd_start, fd_end) {
          if (!FS.FSStream) {
            FS.FSStream = function() {
            };
            FS.FSStream.prototype = { object: { get: function() {
              return this.node;
            }, set: function(val) {
              this.node = val;
            } }, isRead: { get: function() {
              return (this.flags & 2097155) !== 1;
            } }, isWrite: { get: function() {
              return (this.flags & 2097155) !== 0;
            } }, isAppend: { get: function() {
              return this.flags & 1024;
            } } };
          }
          var newStream = new FS.FSStream();
          for (var p in stream) {
            newStream[p] = stream[p];
          }
          stream = newStream;
          var fd = FS.nextfd(fd_start, fd_end);
          stream.fd = fd;
          FS.streams[fd] = stream;
          return stream;
        }, closeStream: function(fd) {
          FS.streams[fd] = null;
        }, chrdev_stream_ops: { open: function(stream) {
          var device = FS.getDevice(stream.node.rdev);
          stream.stream_ops = device.stream_ops;
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        }, llseek: function() {
          throw new FS.ErrnoError(70);
        } }, major: function(dev) {
          return dev >> 8;
        }, minor: function(dev) {
          return dev & 255;
        }, makedev: function(ma, mi) {
          return ma << 8 | mi;
        }, registerDevice: function(dev, ops) {
          FS.devices[dev] = { stream_ops: ops };
        }, getDevice: function(dev) {
          return FS.devices[dev];
        }, getMounts: function(mount) {
          var mounts = [];
          var check = [mount];
          while (check.length) {
            var m = check.pop();
            mounts.push(m);
            check.push.apply(check, m.mounts);
          }
          return mounts;
        }, syncfs: function(populate, callback) {
          if (typeof populate === "function") {
            callback = populate;
            populate = false;
          }
          FS.syncFSRequests++;
          if (FS.syncFSRequests > 1) {
            err("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work");
          }
          var mounts = FS.getMounts(FS.root.mount);
          var completed = 0;
          function doCallback(errCode) {
            FS.syncFSRequests--;
            return callback(errCode);
          }
          function done(errCode) {
            if (errCode) {
              if (!done.errored) {
                done.errored = true;
                return doCallback(errCode);
              }
              return;
            }
            if (++completed >= mounts.length) {
              doCallback(null);
            }
          }
          mounts.forEach(function(mount) {
            if (!mount.type.syncfs) {
              return done(null);
            }
            mount.type.syncfs(mount, populate, done);
          });
        }, mount: function(type, opts, mountpoint) {
          var root = mountpoint === "/";
          var pseudo = !mountpoint;
          var node;
          if (root && FS.root) {
            throw new FS.ErrnoError(10);
          } else if (!root && !pseudo) {
            var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
            mountpoint = lookup.path;
            node = lookup.node;
            if (FS.isMountpoint(node)) {
              throw new FS.ErrnoError(10);
            }
            if (!FS.isDir(node.mode)) {
              throw new FS.ErrnoError(54);
            }
          }
          var mount = { type, opts, mountpoint, mounts: [] };
          var mountRoot = type.mount(mount);
          mountRoot.mount = mount;
          mount.root = mountRoot;
          if (root) {
            FS.root = mountRoot;
          } else if (node) {
            node.mounted = mount;
            if (node.mount) {
              node.mount.mounts.push(mount);
            }
          }
          return mountRoot;
        }, unmount: function(mountpoint) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
          if (!FS.isMountpoint(lookup.node)) {
            throw new FS.ErrnoError(28);
          }
          var node = lookup.node;
          var mount = node.mounted;
          var mounts = FS.getMounts(mount);
          Object.keys(FS.nameTable).forEach(function(hash) {
            var current = FS.nameTable[hash];
            while (current) {
              var next = current.name_next;
              if (mounts.includes(current.mount)) {
                FS.destroyNode(current);
              }
              current = next;
            }
          });
          node.mounted = null;
          var idx = node.mount.mounts.indexOf(mount);
          node.mount.mounts.splice(idx, 1);
        }, lookup: function(parent, name2) {
          return parent.node_ops.lookup(parent, name2);
        }, mknod: function(path, mode, dev) {
          var lookup = FS.lookupPath(path, { parent: true });
          var parent = lookup.node;
          var name2 = PATH.basename(path);
          if (!name2 || name2 === "." || name2 === "..") {
            throw new FS.ErrnoError(28);
          }
          var errCode = FS.mayCreate(parent, name2);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.mknod) {
            throw new FS.ErrnoError(63);
          }
          return parent.node_ops.mknod(parent, name2, mode, dev);
        }, create: function(path, mode) {
          mode = mode !== void 0 ? mode : 438;
          mode &= 4095;
          mode |= 32768;
          return FS.mknod(path, mode, 0);
        }, mkdir: function(path, mode) {
          mode = mode !== void 0 ? mode : 511;
          mode &= 511 | 512;
          mode |= 16384;
          return FS.mknod(path, mode, 0);
        }, mkdirTree: function(path, mode) {
          var dirs = path.split("/");
          var d = "";
          for (var i = 0; i < dirs.length; ++i) {
            if (!dirs[i])
              continue;
            d += "/" + dirs[i];
            try {
              FS.mkdir(d, mode);
            } catch (e) {
              if (e.errno != 20)
                throw e;
            }
          }
        }, mkdev: function(path, mode, dev) {
          if (typeof dev === "undefined") {
            dev = mode;
            mode = 438;
          }
          mode |= 8192;
          return FS.mknod(path, mode, dev);
        }, symlink: function(oldpath, newpath) {
          if (!PATH_FS.resolve(oldpath)) {
            throw new FS.ErrnoError(44);
          }
          var lookup = FS.lookupPath(newpath, { parent: true });
          var parent = lookup.node;
          if (!parent) {
            throw new FS.ErrnoError(44);
          }
          var newname = PATH.basename(newpath);
          var errCode = FS.mayCreate(parent, newname);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.symlink) {
            throw new FS.ErrnoError(63);
          }
          return parent.node_ops.symlink(parent, newname, oldpath);
        }, rename: function(old_path, new_path) {
          var old_dirname = PATH.dirname(old_path);
          var new_dirname = PATH.dirname(new_path);
          var old_name = PATH.basename(old_path);
          var new_name = PATH.basename(new_path);
          var lookup, old_dir, new_dir;
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
          if (!old_dir || !new_dir)
            throw new FS.ErrnoError(44);
          if (old_dir.mount !== new_dir.mount) {
            throw new FS.ErrnoError(75);
          }
          var old_node = FS.lookupNode(old_dir, old_name);
          var relative = PATH_FS.relative(old_path, new_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(28);
          }
          relative = PATH_FS.relative(new_path, old_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(55);
          }
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name);
          } catch (e) {
          }
          if (old_node === new_node) {
            return;
          }
          var isdir = FS.isDir(old_node.mode);
          var errCode = FS.mayDelete(old_dir, old_name, isdir);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!old_dir.node_ops.rename) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
            throw new FS.ErrnoError(10);
          }
          if (new_dir !== old_dir) {
            errCode = FS.nodePermissions(old_dir, "w");
            if (errCode) {
              throw new FS.ErrnoError(errCode);
            }
          }
          try {
            if (FS.trackingDelegate["willMovePath"]) {
              FS.trackingDelegate["willMovePath"](old_path, new_path);
            }
          } catch (e) {
            err("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
          }
          FS.hashRemoveNode(old_node);
          try {
            old_dir.node_ops.rename(old_node, new_dir, new_name);
          } catch (e) {
            throw e;
          } finally {
            FS.hashAddNode(old_node);
          }
          try {
            if (FS.trackingDelegate["onMovePath"])
              FS.trackingDelegate["onMovePath"](old_path, new_path);
          } catch (e) {
            err("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
          }
        }, rmdir: function(path) {
          var lookup = FS.lookupPath(path, { parent: true });
          var parent = lookup.node;
          var name2 = PATH.basename(path);
          var node = FS.lookupNode(parent, name2);
          var errCode = FS.mayDelete(parent, name2, true);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.rmdir) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
          try {
            if (FS.trackingDelegate["willDeletePath"]) {
              FS.trackingDelegate["willDeletePath"](path);
            }
          } catch (e) {
            err("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
          }
          parent.node_ops.rmdir(parent, name2);
          FS.destroyNode(node);
          try {
            if (FS.trackingDelegate["onDeletePath"])
              FS.trackingDelegate["onDeletePath"](path);
          } catch (e) {
            err("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
          }
        }, readdir: function(path) {
          var lookup = FS.lookupPath(path, { follow: true });
          var node = lookup.node;
          if (!node.node_ops.readdir) {
            throw new FS.ErrnoError(54);
          }
          return node.node_ops.readdir(node);
        }, unlink: function(path) {
          var lookup = FS.lookupPath(path, { parent: true });
          var parent = lookup.node;
          var name2 = PATH.basename(path);
          var node = FS.lookupNode(parent, name2);
          var errCode = FS.mayDelete(parent, name2, false);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.unlink) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
          try {
            if (FS.trackingDelegate["willDeletePath"]) {
              FS.trackingDelegate["willDeletePath"](path);
            }
          } catch (e) {
            err("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
          }
          parent.node_ops.unlink(parent, name2);
          FS.destroyNode(node);
          try {
            if (FS.trackingDelegate["onDeletePath"])
              FS.trackingDelegate["onDeletePath"](path);
          } catch (e) {
            err("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
          }
        }, readlink: function(path) {
          var lookup = FS.lookupPath(path);
          var link = lookup.node;
          if (!link) {
            throw new FS.ErrnoError(44);
          }
          if (!link.node_ops.readlink) {
            throw new FS.ErrnoError(28);
          }
          return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
        }, stat: function(path, dontFollow) {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          var node = lookup.node;
          if (!node) {
            throw new FS.ErrnoError(44);
          }
          if (!node.node_ops.getattr) {
            throw new FS.ErrnoError(63);
          }
          return node.node_ops.getattr(node);
        }, lstat: function(path) {
          return FS.stat(path, true);
        }, chmod: function(path, mode, dontFollow) {
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, { follow: !dontFollow });
            node = lookup.node;
          } else {
            node = path;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          node.node_ops.setattr(node, { mode: mode & 4095 | node.mode & ~4095, timestamp: Date.now() });
        }, lchmod: function(path, mode) {
          FS.chmod(path, mode, true);
        }, fchmod: function(fd, mode) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(8);
          }
          FS.chmod(stream.node, mode);
        }, chown: function(path, uid, gid, dontFollow) {
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, { follow: !dontFollow });
            node = lookup.node;
          } else {
            node = path;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          node.node_ops.setattr(node, { timestamp: Date.now() });
        }, lchown: function(path, uid, gid) {
          FS.chown(path, uid, gid, true);
        }, fchown: function(fd, uid, gid) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(8);
          }
          FS.chown(stream.node, uid, gid);
        }, truncate: function(path, len) {
          if (len < 0) {
            throw new FS.ErrnoError(28);
          }
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, { follow: true });
            node = lookup.node;
          } else {
            node = path;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isDir(node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!FS.isFile(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          var errCode = FS.nodePermissions(node, "w");
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          node.node_ops.setattr(node, { size: len, timestamp: Date.now() });
        }, ftruncate: function(fd, len) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(8);
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(28);
          }
          FS.truncate(stream.node, len);
        }, utime: function(path, atime, mtime) {
          var lookup = FS.lookupPath(path, { follow: true });
          var node = lookup.node;
          node.node_ops.setattr(node, { timestamp: Math.max(atime, mtime) });
        }, open: function(path, flags, mode, fd_start, fd_end) {
          if (path === "") {
            throw new FS.ErrnoError(44);
          }
          flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
          mode = typeof mode === "undefined" ? 438 : mode;
          if (flags & 64) {
            mode = mode & 4095 | 32768;
          } else {
            mode = 0;
          }
          var node;
          if (typeof path === "object") {
            node = path;
          } else {
            path = PATH.normalize(path);
            try {
              var lookup = FS.lookupPath(path, { follow: !(flags & 131072) });
              node = lookup.node;
            } catch (e) {
            }
          }
          var created = false;
          if (flags & 64) {
            if (node) {
              if (flags & 128) {
                throw new FS.ErrnoError(20);
              }
            } else {
              node = FS.mknod(path, mode, 0);
              created = true;
            }
          }
          if (!node) {
            throw new FS.ErrnoError(44);
          }
          if (FS.isChrdev(node.mode)) {
            flags &= ~512;
          }
          if (flags & 65536 && !FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
          if (!created) {
            var errCode = FS.mayOpen(node, flags);
            if (errCode) {
              throw new FS.ErrnoError(errCode);
            }
          }
          if (flags & 512) {
            FS.truncate(node, 0);
          }
          flags &= ~(128 | 512 | 131072);
          var stream = FS.createStream({ node, path: FS.getPath(node), flags, seekable: true, position: 0, stream_ops: node.stream_ops, ungotten: [], error: false }, fd_start, fd_end);
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
          if (Module["logReadFiles"] && !(flags & 1)) {
            if (!FS.readFiles)
              FS.readFiles = {};
            if (!(path in FS.readFiles)) {
              FS.readFiles[path] = 1;
              err("FS.trackingDelegate error on read file: " + path);
            }
          }
          try {
            if (FS.trackingDelegate["onOpenFile"]) {
              var trackingFlags = 0;
              if ((flags & 2097155) !== 1) {
                trackingFlags |= FS.tracking.openFlags.READ;
              }
              if ((flags & 2097155) !== 0) {
                trackingFlags |= FS.tracking.openFlags.WRITE;
              }
              FS.trackingDelegate["onOpenFile"](path, trackingFlags);
            }
          } catch (e) {
            err("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
          }
          return stream;
        }, close: function(stream) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (stream.getdents)
            stream.getdents = null;
          try {
            if (stream.stream_ops.close) {
              stream.stream_ops.close(stream);
            }
          } catch (e) {
            throw e;
          } finally {
            FS.closeStream(stream.fd);
          }
          stream.fd = null;
        }, isClosed: function(stream) {
          return stream.fd === null;
        }, llseek: function(stream, offset, whence) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (!stream.seekable || !stream.stream_ops.llseek) {
            throw new FS.ErrnoError(70);
          }
          if (whence != 0 && whence != 1 && whence != 2) {
            throw new FS.ErrnoError(28);
          }
          stream.position = stream.stream_ops.llseek(stream, offset, whence);
          stream.ungotten = [];
          return stream.position;
        }, read: function(stream, buffer2, offset, length, position) {
          offset >>>= 0;
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28);
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(8);
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!stream.stream_ops.read) {
            throw new FS.ErrnoError(28);
          }
          var seeking = typeof position !== "undefined";
          if (!seeking) {
            position = stream.position;
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(70);
          }
          var bytesRead = stream.stream_ops.read(stream, buffer2, offset, length, position);
          if (!seeking)
            stream.position += bytesRead;
          return bytesRead;
        }, write: function(stream, buffer2, offset, length, position, canOwn) {
          offset >>>= 0;
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28);
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8);
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!stream.stream_ops.write) {
            throw new FS.ErrnoError(28);
          }
          if (stream.seekable && stream.flags & 1024) {
            FS.llseek(stream, 0, 2);
          }
          var seeking = typeof position !== "undefined";
          if (!seeking) {
            position = stream.position;
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(70);
          }
          var bytesWritten = stream.stream_ops.write(stream, buffer2, offset, length, position, canOwn);
          if (!seeking)
            stream.position += bytesWritten;
          try {
            if (stream.path && FS.trackingDelegate["onWriteToFile"])
              FS.trackingDelegate["onWriteToFile"](stream.path);
          } catch (e) {
            err("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message);
          }
          return bytesWritten;
        }, allocate: function(stream, offset, length) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (offset < 0 || length <= 0) {
            throw new FS.ErrnoError(28);
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8);
          }
          if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (!stream.stream_ops.allocate) {
            throw new FS.ErrnoError(138);
          }
          stream.stream_ops.allocate(stream, offset, length);
        }, mmap: function(stream, address, length, position, prot, flags) {
          address >>>= 0;
          if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
            throw new FS.ErrnoError(2);
          }
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(2);
          }
          if (!stream.stream_ops.mmap) {
            throw new FS.ErrnoError(43);
          }
          return stream.stream_ops.mmap(stream, address, length, position, prot, flags);
        }, msync: function(stream, buffer2, offset, length, mmapFlags) {
          offset >>>= 0;
          if (!stream || !stream.stream_ops.msync) {
            return 0;
          }
          return stream.stream_ops.msync(stream, buffer2, offset, length, mmapFlags);
        }, munmap: function(stream) {
          return 0;
        }, ioctl: function(stream, cmd, arg) {
          if (!stream.stream_ops.ioctl) {
            throw new FS.ErrnoError(59);
          }
          return stream.stream_ops.ioctl(stream, cmd, arg);
        }, readFile: function(path, opts) {
          opts = opts || {};
          opts.flags = opts.flags || 0;
          opts.encoding = opts.encoding || "binary";
          if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
            throw new Error('Invalid encoding type "' + opts.encoding + '"');
          }
          var ret;
          var stream = FS.open(path, opts.flags);
          var stat = FS.stat(path);
          var length = stat.size;
          var buf = new Uint8Array(length);
          FS.read(stream, buf, 0, length, 0);
          if (opts.encoding === "utf8") {
            ret = UTF8ArrayToString(buf, 0);
          } else if (opts.encoding === "binary") {
            ret = buf;
          }
          FS.close(stream);
          return ret;
        }, writeFile: function(path, data, opts) {
          opts = opts || {};
          opts.flags = opts.flags || 577;
          var stream = FS.open(path, opts.flags, opts.mode);
          if (typeof data === "string") {
            var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
            var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
            FS.write(stream, buf, 0, actualNumBytes, void 0, opts.canOwn);
          } else if (ArrayBuffer.isView(data)) {
            FS.write(stream, data, 0, data.byteLength, void 0, opts.canOwn);
          } else {
            throw new Error("Unsupported data type");
          }
          FS.close(stream);
        }, cwd: function() {
          return FS.currentPath;
        }, chdir: function(path) {
          var lookup = FS.lookupPath(path, { follow: true });
          if (lookup.node === null) {
            throw new FS.ErrnoError(44);
          }
          if (!FS.isDir(lookup.node.mode)) {
            throw new FS.ErrnoError(54);
          }
          var errCode = FS.nodePermissions(lookup.node, "x");
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          FS.currentPath = lookup.path;
        }, createDefaultDirectories: function() {
          FS.mkdir("/tmp");
          FS.mkdir("/home");
          FS.mkdir("/home/web_user");
        }, createDefaultDevices: function() {
          FS.mkdir("/dev");
          FS.registerDevice(FS.makedev(1, 3), { read: function() {
            return 0;
          }, write: function(stream, buffer2, offset, length, pos) {
            return length;
          } });
          FS.mkdev("/dev/null", FS.makedev(1, 3));
          TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
          TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
          FS.mkdev("/dev/tty", FS.makedev(5, 0));
          FS.mkdev("/dev/tty1", FS.makedev(6, 0));
          var random_device = getRandomDevice();
          FS.createDevice("/dev", "random", random_device);
          FS.createDevice("/dev", "urandom", random_device);
          FS.mkdir("/dev/shm");
          FS.mkdir("/dev/shm/tmp");
        }, createSpecialDirectories: function() {
          FS.mkdir("/proc");
          var proc_self = FS.mkdir("/proc/self");
          FS.mkdir("/proc/self/fd");
          FS.mount({ mount: function() {
            var node = FS.createNode(proc_self, "fd", 16384 | 511, 73);
            node.node_ops = { lookup: function(parent, name2) {
              var fd = +name2;
              var stream = FS.getStream(fd);
              if (!stream)
                throw new FS.ErrnoError(8);
              var ret = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: function() {
                return stream.path;
              } } };
              ret.parent = ret;
              return ret;
            } };
            return node;
          } }, {}, "/proc/self/fd");
        }, createStandardStreams: function() {
          if (Module["stdin"]) {
            FS.createDevice("/dev", "stdin", Module["stdin"]);
          } else {
            FS.symlink("/dev/tty", "/dev/stdin");
          }
          if (Module["stdout"]) {
            FS.createDevice("/dev", "stdout", null, Module["stdout"]);
          } else {
            FS.symlink("/dev/tty", "/dev/stdout");
          }
          if (Module["stderr"]) {
            FS.createDevice("/dev", "stderr", null, Module["stderr"]);
          } else {
            FS.symlink("/dev/tty1", "/dev/stderr");
          }
          FS.open("/dev/stdin", 0);
          FS.open("/dev/stdout", 1);
          FS.open("/dev/stderr", 1);
        }, ensureErrnoError: function() {
          if (FS.ErrnoError)
            return;
          FS.ErrnoError = function ErrnoError(errno, node) {
            this.node = node;
            this.setErrno = function(errno2) {
              this.errno = errno2;
            };
            this.setErrno(errno);
            this.message = "FS error";
          };
          FS.ErrnoError.prototype = new Error();
          FS.ErrnoError.prototype.constructor = FS.ErrnoError;
          [44].forEach(function(code) {
            FS.genericErrors[code] = new FS.ErrnoError(code);
            FS.genericErrors[code].stack = "<generic error, no stack>";
          });
        }, staticInit: function() {
          FS.ensureErrnoError();
          FS.nameTable = new Array(4096);
          FS.mount(MEMFS, {}, "/");
          FS.createDefaultDirectories();
          FS.createDefaultDevices();
          FS.createSpecialDirectories();
          FS.filesystems = { "MEMFS": MEMFS };
        }, init: function(input, output, error) {
          FS.init.initialized = true;
          FS.ensureErrnoError();
          Module["stdin"] = input || Module["stdin"];
          Module["stdout"] = output || Module["stdout"];
          Module["stderr"] = error || Module["stderr"];
          FS.createStandardStreams();
        }, quit: function() {
          FS.init.initialized = false;
          var fflush = Module["_fflush"];
          if (fflush)
            fflush(0);
          for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (!stream) {
              continue;
            }
            FS.close(stream);
          }
        }, getMode: function(canRead, canWrite) {
          var mode = 0;
          if (canRead)
            mode |= 292 | 73;
          if (canWrite)
            mode |= 146;
          return mode;
        }, findObject: function(path, dontResolveLastLink) {
          var ret = FS.analyzePath(path, dontResolveLastLink);
          if (ret.exists) {
            return ret.object;
          } else {
            return null;
          }
        }, analyzePath: function(path, dontResolveLastLink) {
          try {
            var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
            path = lookup.path;
          } catch (e) {
          }
          var ret = { isRoot: false, exists: false, error: 0, name: null, path: null, object: null, parentExists: false, parentPath: null, parentObject: null };
          try {
            var lookup = FS.lookupPath(path, { parent: true });
            ret.parentExists = true;
            ret.parentPath = lookup.path;
            ret.parentObject = lookup.node;
            ret.name = PATH.basename(path);
            lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
            ret.exists = true;
            ret.path = lookup.path;
            ret.object = lookup.node;
            ret.name = lookup.node.name;
            ret.isRoot = lookup.path === "/";
          } catch (e) {
            ret.error = e.errno;
          }
          return ret;
        }, createPath: function(parent, path, canRead, canWrite) {
          parent = typeof parent === "string" ? parent : FS.getPath(parent);
          var parts = path.split("/").reverse();
          while (parts.length) {
            var part = parts.pop();
            if (!part)
              continue;
            var current = PATH.join2(parent, part);
            try {
              FS.mkdir(current);
            } catch (e) {
            }
            parent = current;
          }
          return current;
        }, createFile: function(parent, name2, properties, canRead, canWrite) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name2);
          var mode = FS.getMode(canRead, canWrite);
          return FS.create(path, mode);
        }, createDataFile: function(parent, name2, data, canRead, canWrite, canOwn) {
          var path = name2 ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name2) : parent;
          var mode = FS.getMode(canRead, canWrite);
          var node = FS.create(path, mode);
          if (data) {
            if (typeof data === "string") {
              var arr = new Array(data.length);
              for (var i = 0, len = data.length; i < len; ++i)
                arr[i] = data.charCodeAt(i);
              data = arr;
            }
            FS.chmod(node, mode | 146);
            var stream = FS.open(node, 577);
            FS.write(stream, data, 0, data.length, 0, canOwn);
            FS.close(stream);
            FS.chmod(node, mode);
          }
          return node;
        }, createDevice: function(parent, name2, input, output) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name2);
          var mode = FS.getMode(!!input, !!output);
          if (!FS.createDevice.major)
            FS.createDevice.major = 64;
          var dev = FS.makedev(FS.createDevice.major++, 0);
          FS.registerDevice(dev, { open: function(stream) {
            stream.seekable = false;
          }, close: function(stream) {
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          }, read: function(stream, buffer2, offset, length, pos) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === void 0 && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === void 0)
                break;
              bytesRead++;
              buffer2[offset + i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          }, write: function(stream, buffer2, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer2[offset + i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          } });
          return FS.mkdev(path, mode, dev);
        }, forceLoadFile: function(obj) {
          if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
            return true;
          if (typeof XMLHttpRequest !== "undefined") {
            throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
          } else if (read_) {
            try {
              obj.contents = intArrayFromString(read_(obj.url), true);
              obj.usedBytes = obj.contents.length;
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
          } else {
            throw new Error("Cannot load without read() or XMLHttpRequest.");
          }
        }, createLazyFile: function(parent, name2, url, canRead, canWrite) {
          function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = [];
          }
          LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length - 1 || idx < 0) {
              return void 0;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = idx / this.chunkSize | 0;
            return this.getter(chunkNum)[chunkOffset];
          };
          LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter;
          };
          LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
            var xhr = new XMLHttpRequest();
            xhr.open("HEAD", url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
              throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
            var chunkSize = 1024 * 1024;
            if (!hasByteServing)
              chunkSize = datalength;
            var doXHR = function(from, to) {
              if (from > to)
                throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
              if (to > datalength - 1)
                throw new Error("only " + datalength + " bytes available! programmer error!");
              var xhr2 = new XMLHttpRequest();
              xhr2.open("GET", url, false);
              if (datalength !== chunkSize)
                xhr2.setRequestHeader("Range", "bytes=" + from + "-" + to);
              if (typeof Uint8Array != "undefined")
                xhr2.responseType = "arraybuffer";
              if (xhr2.overrideMimeType) {
                xhr2.overrideMimeType("text/plain; charset=x-user-defined");
              }
              xhr2.send(null);
              if (!(xhr2.status >= 200 && xhr2.status < 300 || xhr2.status === 304))
                throw new Error("Couldn't load " + url + ". Status: " + xhr2.status);
              if (xhr2.response !== void 0) {
                return new Uint8Array(xhr2.response || []);
              } else {
                return intArrayFromString(xhr2.responseText || "", true);
              }
            };
            var lazyArray2 = this;
            lazyArray2.setDataGetter(function(chunkNum) {
              var start = chunkNum * chunkSize;
              var end = (chunkNum + 1) * chunkSize - 1;
              end = Math.min(end, datalength - 1);
              if (typeof lazyArray2.chunks[chunkNum] === "undefined") {
                lazyArray2.chunks[chunkNum] = doXHR(start, end);
              }
              if (typeof lazyArray2.chunks[chunkNum] === "undefined")
                throw new Error("doXHR failed!");
              return lazyArray2.chunks[chunkNum];
            });
            if (usesGzip || !datalength) {
              chunkSize = datalength = 1;
              datalength = this.getter(0).length;
              chunkSize = datalength;
              out("LazyFiles on gzip forces download of the whole file when length is accessed");
            }
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true;
          };
          if (typeof XMLHttpRequest !== "undefined") {
            if (!ENVIRONMENT_IS_WORKER)
              throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
            var lazyArray = new LazyUint8Array();
            Object.defineProperties(lazyArray, { length: { get: function() {
              if (!this.lengthKnown) {
                this.cacheLength();
              }
              return this._length;
            } }, chunkSize: { get: function() {
              if (!this.lengthKnown) {
                this.cacheLength();
              }
              return this._chunkSize;
            } } });
            var properties = { isDevice: false, contents: lazyArray };
          } else {
            var properties = { isDevice: false, url };
          }
          var node = FS.createFile(parent, name2, properties, canRead, canWrite);
          if (properties.contents) {
            node.contents = properties.contents;
          } else if (properties.url) {
            node.contents = null;
            node.url = properties.url;
          }
          Object.defineProperties(node, { usedBytes: { get: function() {
            return this.contents.length;
          } } });
          var stream_ops = {};
          var keys = Object.keys(node.stream_ops);
          keys.forEach(function(key2) {
            var fn = node.stream_ops[key2];
            stream_ops[key2] = function forceLoadLazyFile() {
              FS.forceLoadFile(node);
              return fn.apply(null, arguments);
            };
          });
          stream_ops.read = function stream_ops_read(stream, buffer2, offset, length, position) {
            FS.forceLoadFile(node);
            var contents = stream.node.contents;
            if (position >= contents.length)
              return 0;
            var size = Math.min(contents.length - position, length);
            if (contents.slice) {
              for (var i = 0; i < size; i++) {
                buffer2[offset + i] = contents[position + i];
              }
            } else {
              for (var i = 0; i < size; i++) {
                buffer2[offset + i] = contents.get(position + i);
              }
            }
            return size;
          };
          node.stream_ops = stream_ops;
          return node;
        }, createPreloadedFile: function(parent, name2, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
          Browser.init();
          var fullname = name2 ? PATH_FS.resolve(PATH.join2(parent, name2)) : parent;
          function processData(byteArray) {
            function finish(byteArray2) {
              if (preFinish)
                preFinish();
              if (!dontCreateFile) {
                FS.createDataFile(parent, name2, byteArray2, canRead, canWrite, canOwn);
              }
              if (onload)
                onload();
              removeRunDependency();
            }
            var handled = false;
            Module["preloadPlugins"].forEach(function(plugin) {
              if (handled)
                return;
              if (plugin["canHandle"](fullname)) {
                plugin["handle"](byteArray, fullname, finish, function() {
                  if (onerror)
                    onerror();
                  removeRunDependency();
                });
                handled = true;
              }
            });
            if (!handled)
              finish(byteArray);
          }
          addRunDependency();
          if (typeof url == "string") {
            asyncLoad(url, function(byteArray) {
              processData(byteArray);
            }, onerror);
          } else {
            processData(url);
          }
        }, indexedDB: function() {
          return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        }, DB_NAME: function() {
          return "EM_FS_" + window.location.pathname;
        }, DB_VERSION: 20, DB_STORE_NAME: "FILE_DATA", saveFilesToDB: function(paths, onload, onerror) {
          onload = onload || function() {
          };
          onerror = onerror || function() {
          };
          var indexedDB = FS.indexedDB();
          try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
          } catch (e) {
            return onerror(e);
          }
          openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
            out("creating db");
            var db = openRequest.result;
            db.createObjectStore(FS.DB_STORE_NAME);
          };
          openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0, fail = 0, total = paths.length;
            function finish() {
              if (fail == 0)
                onload();
              else
                onerror();
            }
            paths.forEach(function(path) {
              var putRequest = files.put(FS.analyzePath(path).object.contents, path);
              putRequest.onsuccess = function putRequest_onsuccess() {
                ok++;
                if (ok + fail == total)
                  finish();
              };
              putRequest.onerror = function putRequest_onerror() {
                fail++;
                if (ok + fail == total)
                  finish();
              };
            });
            transaction.onerror = onerror;
          };
          openRequest.onerror = onerror;
        }, loadFilesFromDB: function(paths, onload, onerror) {
          onload = onload || function() {
          };
          onerror = onerror || function() {
          };
          var indexedDB = FS.indexedDB();
          try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
          } catch (e) {
            return onerror(e);
          }
          openRequest.onupgradeneeded = onerror;
          openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            try {
              var transaction = db.transaction([FS.DB_STORE_NAME], "readonly");
            } catch (e) {
              onerror(e);
              return;
            }
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0, fail = 0, total = paths.length;
            function finish() {
              if (fail == 0)
                onload();
              else
                onerror();
            }
            paths.forEach(function(path) {
              var getRequest = files.get(path);
              getRequest.onsuccess = function getRequest_onsuccess() {
                if (FS.analyzePath(path).exists) {
                  FS.unlink(path);
                }
                FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                ok++;
                if (ok + fail == total)
                  finish();
              };
              getRequest.onerror = function getRequest_onerror() {
                fail++;
                if (ok + fail == total)
                  finish();
              };
            });
            transaction.onerror = onerror;
          };
          openRequest.onerror = onerror;
        } };
        var SYSCALLS = { mappings: {}, DEFAULT_POLLMASK: 5, umask: 511, calculateAt: function(dirfd, path, allowEmpty) {
          if (path[0] === "/") {
            return path;
          }
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream)
              throw new FS.ErrnoError(8);
            dir = dirstream.path;
          }
          if (path.length == 0) {
            if (!allowEmpty) {
              throw new FS.ErrnoError(44);
            }
            return dir;
          }
          return PATH.join2(dir, path);
        }, doStat: function(func, path, buf) {
          try {
            var stat = func(path);
          } catch (e) {
            if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
              return -54;
            }
            throw e;
          }
          HEAP32[buf >>> 2] = stat.dev;
          HEAP32[buf + 4 >>> 2] = 0;
          HEAP32[buf + 8 >>> 2] = stat.ino;
          HEAP32[buf + 12 >>> 2] = stat.mode;
          HEAP32[buf + 16 >>> 2] = stat.nlink;
          HEAP32[buf + 20 >>> 2] = stat.uid;
          HEAP32[buf + 24 >>> 2] = stat.gid;
          HEAP32[buf + 28 >>> 2] = stat.rdev;
          HEAP32[buf + 32 >>> 2] = 0;
          tempI64 = [stat.size >>> 0, (tempDouble = stat.size, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 40 >>> 2] = tempI64[0], HEAP32[buf + 44 >>> 2] = tempI64[1];
          HEAP32[buf + 48 >>> 2] = 4096;
          HEAP32[buf + 52 >>> 2] = stat.blocks;
          HEAP32[buf + 56 >>> 2] = stat.atime.getTime() / 1e3 | 0;
          HEAP32[buf + 60 >>> 2] = 0;
          HEAP32[buf + 64 >>> 2] = stat.mtime.getTime() / 1e3 | 0;
          HEAP32[buf + 68 >>> 2] = 0;
          HEAP32[buf + 72 >>> 2] = stat.ctime.getTime() / 1e3 | 0;
          HEAP32[buf + 76 >>> 2] = 0;
          tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 80 >>> 2] = tempI64[0], HEAP32[buf + 84 >>> 2] = tempI64[1];
          return 0;
        }, doMsync: function(addr, stream, len, flags, offset) {
          var buffer2 = HEAPU8.slice(addr, addr + len);
          FS.msync(stream, buffer2, offset, len, flags);
        }, doMkdir: function(path, mode) {
          path = PATH.normalize(path);
          if (path[path.length - 1] === "/")
            path = path.substr(0, path.length - 1);
          FS.mkdir(path, mode, 0);
          return 0;
        }, doMknod: function(path, mode, dev) {
          switch (mode & 61440) {
            case 32768:
            case 8192:
            case 24576:
            case 4096:
            case 49152:
              break;
            default:
              return -28;
          }
          FS.mknod(path, mode, dev);
          return 0;
        }, doReadlink: function(path, buf, bufsize) {
          if (bufsize <= 0)
            return -28;
          var ret = FS.readlink(path);
          var len = Math.min(bufsize, lengthBytesUTF8(ret));
          var endChar = HEAP8[buf + len >>> 0];
          stringToUTF8(ret, buf, bufsize + 1);
          HEAP8[buf + len >>> 0] = endChar;
          return len;
        }, doAccess: function(path, amode) {
          if (amode & ~7) {
            return -28;
          }
          var node;
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
          if (!node) {
            return -44;
          }
          var perms = "";
          if (amode & 4)
            perms += "r";
          if (amode & 2)
            perms += "w";
          if (amode & 1)
            perms += "x";
          if (perms && FS.nodePermissions(node, perms)) {
            return -2;
          }
          return 0;
        }, doDup: function(path, flags, suggestFD) {
          var suggest = FS.getStream(suggestFD);
          if (suggest)
            FS.close(suggest);
          return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
        }, doReadv: function(stream, iov, iovcnt, offset) {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >>> 2];
            var len = HEAP32[iov + (i * 8 + 4) >>> 2];
            var curr = FS.read(stream, HEAP8, ptr, len, offset);
            if (curr < 0)
              return -1;
            ret += curr;
            if (curr < len)
              break;
          }
          return ret;
        }, doWritev: function(stream, iov, iovcnt, offset) {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >>> 2];
            var len = HEAP32[iov + (i * 8 + 4) >>> 2];
            var curr = FS.write(stream, HEAP8, ptr, len, offset);
            if (curr < 0)
              return -1;
            ret += curr;
          }
          return ret;
        }, varargs: void 0, get: function() {
          SYSCALLS.varargs += 4;
          var ret = HEAP32[SYSCALLS.varargs - 4 >>> 2];
          return ret;
        }, getStr: function(ptr) {
          var ret = UTF8ToString(ptr);
          return ret;
        }, getStreamFromFD: function(fd) {
          var stream = FS.getStream(fd);
          if (!stream)
            throw new FS.ErrnoError(8);
          return stream;
        }, get64: function(low, high) {
          return low;
        } };
        function ___sys_fcntl64(fd, cmd, varargs) {
          SYSCALLS.varargs = varargs;
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            switch (cmd) {
              case 0: {
                var arg = SYSCALLS.get();
                if (arg < 0) {
                  return -28;
                }
                var newStream;
                newStream = FS.open(stream.path, stream.flags, 0, arg);
                return newStream.fd;
              }
              case 1:
              case 2:
                return 0;
              case 3:
                return stream.flags;
              case 4: {
                var arg = SYSCALLS.get();
                stream.flags |= arg;
                return 0;
              }
              case 12: {
                var arg = SYSCALLS.get();
                var offset = 0;
                HEAP16[arg + offset >>> 1] = 2;
                return 0;
              }
              case 13:
              case 14:
                return 0;
              case 16:
              case 8:
                return -28;
              case 9:
                setErrNo(28);
                return -1;
              default: {
                return -28;
              }
            }
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return -e.errno;
          }
        }
        function ___sys_ioctl(fd, op, varargs) {
          SYSCALLS.varargs = varargs;
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            switch (op) {
              case 21509:
              case 21505: {
                if (!stream.tty)
                  return -59;
                return 0;
              }
              case 21510:
              case 21511:
              case 21512:
              case 21506:
              case 21507:
              case 21508: {
                if (!stream.tty)
                  return -59;
                return 0;
              }
              case 21519: {
                if (!stream.tty)
                  return -59;
                var argp = SYSCALLS.get();
                HEAP32[argp >>> 2] = 0;
                return 0;
              }
              case 21520: {
                if (!stream.tty)
                  return -59;
                return -28;
              }
              case 21531: {
                var argp = SYSCALLS.get();
                return FS.ioctl(stream, op, argp);
              }
              case 21523: {
                if (!stream.tty)
                  return -59;
                return 0;
              }
              case 21524: {
                if (!stream.tty)
                  return -59;
                return 0;
              }
              default:
                abort("bad ioctl syscall " + op);
            }
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return -e.errno;
          }
        }
        function ___sys_open(path, flags, varargs) {
          SYSCALLS.varargs = varargs;
          try {
            var pathname = SYSCALLS.getStr(path);
            var mode = varargs ? SYSCALLS.get() : 0;
            var stream = FS.open(pathname, flags, mode);
            return stream.fd;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return -e.errno;
          }
        }
        var tupleRegistrations = {};
        function runDestructors(destructors) {
          while (destructors.length) {
            var ptr = destructors.pop();
            var del = destructors.pop();
            del(ptr);
          }
        }
        function simpleReadValueFromPointer(pointer) {
          return this["fromWireType"](HEAPU32[pointer >>> 2]);
        }
        var awaitingDependencies = {};
        var registeredTypes = {};
        var typeDependencies = {};
        var char_0 = 48;
        var char_9 = 57;
        function makeLegalFunctionName(name2) {
          if (name2 === void 0) {
            return "_unknown";
          }
          name2 = name2.replace(/[^a-zA-Z0-9_]/g, "$");
          var f = name2.charCodeAt(0);
          if (f >= char_0 && f <= char_9) {
            return "_" + name2;
          } else {
            return name2;
          }
        }
        function createNamedFunction(name2, body) {
          name2 = makeLegalFunctionName(name2);
          return new Function("body", "return function " + name2 + '() {\n    "use strict";    return body.apply(this, arguments);\n};\n')(body);
        }
        function extendError(baseErrorType, errorName) {
          var errorClass = createNamedFunction(errorName, function(message) {
            this.name = errorName;
            this.message = message;
            var stack = new Error(message).stack;
            if (stack !== void 0) {
              this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "");
            }
          });
          errorClass.prototype = Object.create(baseErrorType.prototype);
          errorClass.prototype.constructor = errorClass;
          errorClass.prototype.toString = function() {
            if (this.message === void 0) {
              return this.name;
            } else {
              return this.name + ": " + this.message;
            }
          };
          return errorClass;
        }
        var InternalError = void 0;
        function throwInternalError(message) {
          throw new InternalError(message);
        }
        function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
          myTypes.forEach(function(type) {
            typeDependencies[type] = dependentTypes;
          });
          function onComplete(typeConverters2) {
            var myTypeConverters = getTypeConverters(typeConverters2);
            if (myTypeConverters.length !== myTypes.length) {
              throwInternalError("Mismatched type converter count");
            }
            for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
            }
          }
          var typeConverters = new Array(dependentTypes.length);
          var unregisteredTypes = [];
          var registered = 0;
          dependentTypes.forEach(function(dt, i) {
            if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
            } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                typeConverters[i] = registeredTypes[dt];
                ++registered;
                if (registered === unregisteredTypes.length) {
                  onComplete(typeConverters);
                }
              });
            }
          });
          if (unregisteredTypes.length === 0) {
            onComplete(typeConverters);
          }
        }
        function __embind_finalize_value_array(rawTupleType) {
          var reg = tupleRegistrations[rawTupleType];
          delete tupleRegistrations[rawTupleType];
          var elements = reg.elements;
          var elementsLength = elements.length;
          var elementTypes = elements.map(function(elt) {
            return elt.getterReturnType;
          }).concat(elements.map(function(elt) {
            return elt.setterArgumentType;
          }));
          var rawConstructor = reg.rawConstructor;
          var rawDestructor = reg.rawDestructor;
          whenDependentTypesAreResolved([rawTupleType], elementTypes, function(elementTypes2) {
            elements.forEach(function(elt, i) {
              var getterReturnType = elementTypes2[i];
              var getter = elt.getter;
              var getterContext = elt.getterContext;
              var setterArgumentType = elementTypes2[i + elementsLength];
              var setter = elt.setter;
              var setterContext = elt.setterContext;
              elt.read = function(ptr) {
                return getterReturnType["fromWireType"](getter(getterContext, ptr));
              };
              elt.write = function(ptr, o) {
                var destructors = [];
                setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, o));
                runDestructors(destructors);
              };
            });
            return [{ name: reg.name, "fromWireType": function(ptr) {
              var rv = new Array(elementsLength);
              for (var i = 0; i < elementsLength; ++i) {
                rv[i] = elements[i].read(ptr);
              }
              rawDestructor(ptr);
              return rv;
            }, "toWireType": function(destructors, o) {
              if (elementsLength !== o.length) {
                throw new TypeError("Incorrect number of tuple elements for " + reg.name + ": expected=" + elementsLength + ", actual=" + o.length);
              }
              var ptr = rawConstructor();
              for (var i = 0; i < elementsLength; ++i) {
                elements[i].write(ptr, o[i]);
              }
              if (destructors !== null) {
                destructors.push(rawDestructor, ptr);
              }
              return ptr;
            }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: rawDestructor }];
          });
        }
        var structRegistrations = {};
        function __embind_finalize_value_object(structType) {
          var reg = structRegistrations[structType];
          delete structRegistrations[structType];
          var rawConstructor = reg.rawConstructor;
          var rawDestructor = reg.rawDestructor;
          var fieldRecords = reg.fields;
          var fieldTypes = fieldRecords.map(function(field) {
            return field.getterReturnType;
          }).concat(fieldRecords.map(function(field) {
            return field.setterArgumentType;
          }));
          whenDependentTypesAreResolved([structType], fieldTypes, function(fieldTypes2) {
            var fields = {};
            fieldRecords.forEach(function(field, i) {
              var fieldName = field.fieldName;
              var getterReturnType = fieldTypes2[i];
              var getter = field.getter;
              var getterContext = field.getterContext;
              var setterArgumentType = fieldTypes2[i + fieldRecords.length];
              var setter = field.setter;
              var setterContext = field.setterContext;
              fields[fieldName] = { read: function(ptr) {
                return getterReturnType["fromWireType"](getter(getterContext, ptr));
              }, write: function(ptr, o) {
                var destructors = [];
                setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, o));
                runDestructors(destructors);
              } };
            });
            return [{ name: reg.name, "fromWireType": function(ptr) {
              var rv = {};
              for (var i in fields) {
                rv[i] = fields[i].read(ptr);
              }
              rawDestructor(ptr);
              return rv;
            }, "toWireType": function(destructors, o) {
              for (var fieldName in fields) {
                if (!(fieldName in o)) {
                  throw new TypeError('Missing field:  "' + fieldName + '"');
                }
              }
              var ptr = rawConstructor();
              for (fieldName in fields) {
                fields[fieldName].write(ptr, o[fieldName]);
              }
              if (destructors !== null) {
                destructors.push(rawDestructor, ptr);
              }
              return ptr;
            }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: rawDestructor }];
          });
        }
        function __embind_register_bigint(primitiveType, name2, size, minRange, maxRange) {
        }
        function getShiftFromSize(size) {
          switch (size) {
            case 1:
              return 0;
            case 2:
              return 1;
            case 4:
              return 2;
            case 8:
              return 3;
            default:
              throw new TypeError("Unknown type size: " + size);
          }
        }
        function embind_init_charCodes() {
          var codes = new Array(256);
          for (var i = 0; i < 256; ++i) {
            codes[i] = String.fromCharCode(i);
          }
          embind_charCodes = codes;
        }
        var embind_charCodes = void 0;
        function readLatin1String(ptr) {
          var ret = "";
          var c = ptr;
          while (HEAPU8[c >>> 0]) {
            ret += embind_charCodes[HEAPU8[c++ >>> 0]];
          }
          return ret;
        }
        var BindingError = void 0;
        function throwBindingError(message) {
          throw new BindingError(message);
        }
        function registerType(rawType, registeredInstance, options) {
          options = options || {};
          if (!("argPackAdvance" in registeredInstance)) {
            throw new TypeError("registerType registeredInstance requires argPackAdvance");
          }
          var name2 = registeredInstance.name;
          if (!rawType) {
            throwBindingError('type "' + name2 + '" must have a positive integer typeid pointer');
          }
          if (registeredTypes.hasOwnProperty(rawType)) {
            if (options.ignoreDuplicateRegistrations) {
              return;
            } else {
              throwBindingError("Cannot register type '" + name2 + "' twice");
            }
          }
          registeredTypes[rawType] = registeredInstance;
          delete typeDependencies[rawType];
          if (awaitingDependencies.hasOwnProperty(rawType)) {
            var callbacks = awaitingDependencies[rawType];
            delete awaitingDependencies[rawType];
            callbacks.forEach(function(cb) {
              cb();
            });
          }
        }
        function __embind_register_bool(rawType, name2, size, trueValue, falseValue) {
          var shift = getShiftFromSize(size);
          name2 = readLatin1String(name2);
          registerType(rawType, { name: name2, "fromWireType": function(wt) {
            return !!wt;
          }, "toWireType": function(destructors, o) {
            return o ? trueValue : falseValue;
          }, "argPackAdvance": 8, "readValueFromPointer": function(pointer) {
            var heap;
            if (size === 1) {
              heap = HEAP8;
            } else if (size === 2) {
              heap = HEAP16;
            } else if (size === 4) {
              heap = HEAP32;
            } else {
              throw new TypeError("Unknown boolean type size: " + name2);
            }
            return this["fromWireType"](heap[pointer >>> shift]);
          }, destructorFunction: null });
        }
        function ClassHandle_isAliasOf(other) {
          if (!(this instanceof ClassHandle)) {
            return false;
          }
          if (!(other instanceof ClassHandle)) {
            return false;
          }
          var leftClass = this.$$.ptrType.registeredClass;
          var left = this.$$.ptr;
          var rightClass = other.$$.ptrType.registeredClass;
          var right = other.$$.ptr;
          while (leftClass.baseClass) {
            left = leftClass.upcast(left);
            leftClass = leftClass.baseClass;
          }
          while (rightClass.baseClass) {
            right = rightClass.upcast(right);
            rightClass = rightClass.baseClass;
          }
          return leftClass === rightClass && left === right;
        }
        function shallowCopyInternalPointer(o) {
          return { count: o.count, deleteScheduled: o.deleteScheduled, preservePointerOnDelete: o.preservePointerOnDelete, ptr: o.ptr, ptrType: o.ptrType, smartPtr: o.smartPtr, smartPtrType: o.smartPtrType };
        }
        function throwInstanceAlreadyDeleted(obj) {
          function getInstanceTypeName(handle) {
            return handle.$$.ptrType.registeredClass.name;
          }
          throwBindingError(getInstanceTypeName(obj) + " instance already deleted");
        }
        var finalizationGroup = false;
        function detachFinalizer(handle) {
        }
        function runDestructor($$) {
          if ($$.smartPtr) {
            $$.smartPtrType.rawDestructor($$.smartPtr);
          } else {
            $$.ptrType.registeredClass.rawDestructor($$.ptr);
          }
        }
        function releaseClassHandle($$) {
          $$.count.value -= 1;
          var toDelete = $$.count.value === 0;
          if (toDelete) {
            runDestructor($$);
          }
        }
        function attachFinalizer(handle) {
          if (typeof FinalizationGroup === "undefined") {
            attachFinalizer = function(handle2) {
              return handle2;
            };
            return handle;
          }
          finalizationGroup = new FinalizationGroup(function(iter) {
            for (var result = iter.next(); !result.done; result = iter.next()) {
              var $$ = result.value;
              if (!$$.ptr) {
                console.warn("object already deleted: " + $$.ptr);
              } else {
                releaseClassHandle($$);
              }
            }
          });
          attachFinalizer = function(handle2) {
            finalizationGroup.register(handle2, handle2.$$, handle2.$$);
            return handle2;
          };
          detachFinalizer = function(handle2) {
            finalizationGroup.unregister(handle2.$$);
          };
          return attachFinalizer(handle);
        }
        function ClassHandle_clone() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
          if (this.$$.preservePointerOnDelete) {
            this.$$.count.value += 1;
            return this;
          } else {
            var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), { $$: { value: shallowCopyInternalPointer(this.$$) } }));
            clone.$$.count.value += 1;
            clone.$$.deleteScheduled = false;
            return clone;
          }
        }
        function ClassHandle_delete() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
          if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
            throwBindingError("Object already scheduled for deletion");
          }
          detachFinalizer(this);
          releaseClassHandle(this.$$);
          if (!this.$$.preservePointerOnDelete) {
            this.$$.smartPtr = void 0;
            this.$$.ptr = void 0;
          }
        }
        function ClassHandle_isDeleted() {
          return !this.$$.ptr;
        }
        var delayFunction = void 0;
        var deletionQueue = [];
        function flushPendingDeletes() {
          while (deletionQueue.length) {
            var obj = deletionQueue.pop();
            obj.$$.deleteScheduled = false;
            obj["delete"]();
          }
        }
        function ClassHandle_deleteLater() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
          if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
            throwBindingError("Object already scheduled for deletion");
          }
          deletionQueue.push(this);
          if (deletionQueue.length === 1 && delayFunction) {
            delayFunction(flushPendingDeletes);
          }
          this.$$.deleteScheduled = true;
          return this;
        }
        function init_ClassHandle() {
          ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
          ClassHandle.prototype["clone"] = ClassHandle_clone;
          ClassHandle.prototype["delete"] = ClassHandle_delete;
          ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
          ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater;
        }
        function ClassHandle() {
        }
        var registeredPointers = {};
        function ensureOverloadTable(proto, methodName, humanName) {
          if (proto[methodName].overloadTable === void 0) {
            var prevFunc = proto[methodName];
            proto[methodName] = function() {
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
            };
            proto[methodName].overloadTable = [];
            proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
          }
        }
        function exposePublicSymbol(name2, value, numArguments) {
          if (Module.hasOwnProperty(name2)) {
            if (numArguments === void 0 || Module[name2].overloadTable !== void 0 && Module[name2].overloadTable[numArguments] !== void 0) {
              throwBindingError("Cannot register public name '" + name2 + "' twice");
            }
            ensureOverloadTable(Module, name2, name2);
            if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
            }
            Module[name2].overloadTable[numArguments] = value;
          } else {
            Module[name2] = value;
            if (numArguments !== void 0) {
              Module[name2].numArguments = numArguments;
            }
          }
        }
        function RegisteredClass(name2, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
          this.name = name2;
          this.constructor = constructor;
          this.instancePrototype = instancePrototype;
          this.rawDestructor = rawDestructor;
          this.baseClass = baseClass;
          this.getActualType = getActualType;
          this.upcast = upcast;
          this.downcast = downcast;
          this.pureVirtualFunctions = [];
        }
        function upcastPointer(ptr, ptrClass, desiredClass) {
          while (ptrClass !== desiredClass) {
            if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
            }
            ptr = ptrClass.upcast(ptr);
            ptrClass = ptrClass.baseClass;
          }
          return ptr;
        }
        function constNoSmartPtrRawPointerToWireType(destructors, handle) {
          if (handle === null) {
            if (this.isReference) {
              throwBindingError("null is not a valid " + this.name);
            }
            return 0;
          }
          if (!handle.$$) {
            throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
          }
          if (!handle.$$.ptr) {
            throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
          }
          var handleClass = handle.$$.ptrType.registeredClass;
          var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
          return ptr;
        }
        function genericPointerToWireType(destructors, handle) {
          var ptr;
          if (handle === null) {
            if (this.isReference) {
              throwBindingError("null is not a valid " + this.name);
            }
            if (this.isSmartPointer) {
              ptr = this.rawConstructor();
              if (destructors !== null) {
                destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
            } else {
              return 0;
            }
          }
          if (!handle.$$) {
            throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
          }
          if (!handle.$$.ptr) {
            throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
          }
          if (!this.isConst && handle.$$.ptrType.isConst) {
            throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
          }
          var handleClass = handle.$$.ptrType.registeredClass;
          ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
          if (this.isSmartPointer) {
            if (handle.$$.smartPtr === void 0) {
              throwBindingError("Passing raw pointer to smart pointer is illegal");
            }
            switch (this.sharingPolicy) {
              case 0:
                if (handle.$$.smartPtrType === this) {
                  ptr = handle.$$.smartPtr;
                } else {
                  throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
                }
                break;
              case 1:
                ptr = handle.$$.smartPtr;
                break;
              case 2:
                if (handle.$$.smartPtrType === this) {
                  ptr = handle.$$.smartPtr;
                } else {
                  var clonedHandle = handle["clone"]();
                  ptr = this.rawShare(ptr, __emval_register(function() {
                    clonedHandle["delete"]();
                  }));
                  if (destructors !== null) {
                    destructors.push(this.rawDestructor, ptr);
                  }
                }
                break;
              default:
                throwBindingError("Unsupporting sharing policy");
            }
          }
          return ptr;
        }
        function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
          if (handle === null) {
            if (this.isReference) {
              throwBindingError("null is not a valid " + this.name);
            }
            return 0;
          }
          if (!handle.$$) {
            throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
          }
          if (!handle.$$.ptr) {
            throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
          }
          if (handle.$$.ptrType.isConst) {
            throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name);
          }
          var handleClass = handle.$$.ptrType.registeredClass;
          var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
          return ptr;
        }
        function RegisteredPointer_getPointee(ptr) {
          if (this.rawGetPointee) {
            ptr = this.rawGetPointee(ptr);
          }
          return ptr;
        }
        function RegisteredPointer_destructor(ptr) {
          if (this.rawDestructor) {
            this.rawDestructor(ptr);
          }
        }
        function RegisteredPointer_deleteObject(handle) {
          if (handle !== null) {
            handle["delete"]();
          }
        }
        function downcastPointer(ptr, ptrClass, desiredClass) {
          if (ptrClass === desiredClass) {
            return ptr;
          }
          if (desiredClass.baseClass === void 0) {
            return null;
          }
          var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
          if (rv === null) {
            return null;
          }
          return desiredClass.downcast(rv);
        }
        function getInheritedInstanceCount() {
          return Object.keys(registeredInstances).length;
        }
        function getLiveInheritedInstances() {
          var rv = [];
          for (var k in registeredInstances) {
            if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
            }
          }
          return rv;
        }
        function setDelayFunction(fn) {
          delayFunction = fn;
          if (deletionQueue.length && delayFunction) {
            delayFunction(flushPendingDeletes);
          }
        }
        function init_embind() {
          Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
          Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
          Module["flushPendingDeletes"] = flushPendingDeletes;
          Module["setDelayFunction"] = setDelayFunction;
        }
        var registeredInstances = {};
        function getBasestPointer(class_, ptr) {
          if (ptr === void 0) {
            throwBindingError("ptr should not be undefined");
          }
          while (class_.baseClass) {
            ptr = class_.upcast(ptr);
            class_ = class_.baseClass;
          }
          return ptr;
        }
        function getInheritedInstance(class_, ptr) {
          ptr = getBasestPointer(class_, ptr);
          return registeredInstances[ptr];
        }
        function makeClassHandle(prototype, record) {
          if (!record.ptrType || !record.ptr) {
            throwInternalError("makeClassHandle requires ptr and ptrType");
          }
          var hasSmartPtrType = !!record.smartPtrType;
          var hasSmartPtr = !!record.smartPtr;
          if (hasSmartPtrType !== hasSmartPtr) {
            throwInternalError("Both smartPtrType and smartPtr must be specified");
          }
          record.count = { value: 1 };
          return attachFinalizer(Object.create(prototype, { $$: { value: record } }));
        }
        function RegisteredPointer_fromWireType(ptr) {
          var rawPointer = this.getPointee(ptr);
          if (!rawPointer) {
            this.destructor(ptr);
            return null;
          }
          var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
          if (registeredInstance !== void 0) {
            if (registeredInstance.$$.count.value === 0) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance["clone"]();
            } else {
              var rv = registeredInstance["clone"]();
              this.destructor(ptr);
              return rv;
            }
          }
          function makeDefaultHandle() {
            if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, { ptrType: this.pointeeType, ptr: rawPointer, smartPtrType: this, smartPtr: ptr });
            } else {
              return makeClassHandle(this.registeredClass.instancePrototype, { ptrType: this, ptr });
            }
          }
          var actualType = this.registeredClass.getActualType(rawPointer);
          var registeredPointerRecord = registeredPointers[actualType];
          if (!registeredPointerRecord) {
            return makeDefaultHandle.call(this);
          }
          var toType;
          if (this.isConst) {
            toType = registeredPointerRecord.constPointerType;
          } else {
            toType = registeredPointerRecord.pointerType;
          }
          var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
          if (dp === null) {
            return makeDefaultHandle.call(this);
          }
          if (this.isSmartPointer) {
            return makeClassHandle(toType.registeredClass.instancePrototype, { ptrType: toType, ptr: dp, smartPtrType: this, smartPtr: ptr });
          } else {
            return makeClassHandle(toType.registeredClass.instancePrototype, { ptrType: toType, ptr: dp });
          }
        }
        function init_RegisteredPointer() {
          RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
          RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
          RegisteredPointer.prototype["argPackAdvance"] = 8;
          RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
          RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
          RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType;
        }
        function RegisteredPointer(name2, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
          this.name = name2;
          this.registeredClass = registeredClass;
          this.isReference = isReference;
          this.isConst = isConst;
          this.isSmartPointer = isSmartPointer;
          this.pointeeType = pointeeType;
          this.sharingPolicy = sharingPolicy;
          this.rawGetPointee = rawGetPointee;
          this.rawConstructor = rawConstructor;
          this.rawShare = rawShare;
          this.rawDestructor = rawDestructor;
          if (!isSmartPointer && registeredClass.baseClass === void 0) {
            if (isConst) {
              this["toWireType"] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
            } else {
              this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
            }
          } else {
            this["toWireType"] = genericPointerToWireType;
          }
        }
        function replacePublicSymbol(name2, value, numArguments) {
          if (!Module.hasOwnProperty(name2)) {
            throwInternalError("Replacing nonexistant public symbol");
          }
          if (Module[name2].overloadTable !== void 0 && numArguments !== void 0) {
            Module[name2].overloadTable[numArguments] = value;
          } else {
            Module[name2] = value;
            Module[name2].argCount = numArguments;
          }
        }
        function dynCallLegacy(sig, ptr, args) {
          var f = Module["dynCall_" + sig];
          return args && args.length ? f.apply(null, [ptr].concat(args)) : f.call(null, ptr);
        }
        function dynCall(sig, ptr, args) {
          if (sig.includes("j")) {
            return dynCallLegacy(sig, ptr, args);
          }
          return wasmTable.get(ptr).apply(null, args);
        }
        function getDynCaller(sig, ptr) {
          var argCache = [];
          return function() {
            argCache.length = arguments.length;
            for (var i = 0; i < arguments.length; i++) {
              argCache[i] = arguments[i];
            }
            return dynCall(sig, ptr, argCache);
          };
        }
        function embind__requireFunction(signature, rawFunction) {
          signature = readLatin1String(signature);
          function makeDynCaller() {
            if (signature.includes("j")) {
              return getDynCaller(signature, rawFunction);
            }
            return wasmTable.get(rawFunction);
          }
          var fp = makeDynCaller();
          if (typeof fp !== "function") {
            throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
          }
          return fp;
        }
        var UnboundTypeError = void 0;
        function getTypeName(type) {
          var ptr = ___getTypeName(type);
          var rv = readLatin1String(ptr);
          _free(ptr);
          return rv;
        }
        function throwUnboundTypeError(message, types) {
          var unboundTypes = [];
          var seen = {};
          function visit(type) {
            if (seen[type]) {
              return;
            }
            if (registeredTypes[type]) {
              return;
            }
            if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
            }
            unboundTypes.push(type);
            seen[type] = true;
          }
          types.forEach(visit);
          throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]));
        }
        function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name2, destructorSignature, rawDestructor) {
          name2 = readLatin1String(name2);
          getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
          if (upcast) {
            upcast = embind__requireFunction(upcastSignature, upcast);
          }
          if (downcast) {
            downcast = embind__requireFunction(downcastSignature, downcast);
          }
          rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
          var legalFunctionName = makeLegalFunctionName(name2);
          exposePublicSymbol(legalFunctionName, function() {
            throwUnboundTypeError("Cannot construct " + name2 + " due to unbound types", [baseClassRawType]);
          });
          whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function(base) {
            base = base[0];
            var baseClass;
            var basePrototype;
            if (baseClassRawType) {
              baseClass = base.registeredClass;
              basePrototype = baseClass.instancePrototype;
            } else {
              basePrototype = ClassHandle.prototype;
            }
            var constructor = createNamedFunction(legalFunctionName, function() {
              if (Object.getPrototypeOf(this) !== instancePrototype) {
                throw new BindingError("Use 'new' to construct " + name2);
              }
              if (registeredClass.constructor_body === void 0) {
                throw new BindingError(name2 + " has no accessible constructor");
              }
              var body = registeredClass.constructor_body[arguments.length];
              if (body === void 0) {
                throw new BindingError("Tried to invoke ctor of " + name2 + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
              }
              return body.apply(this, arguments);
            });
            var instancePrototype = Object.create(basePrototype, { constructor: { value: constructor } });
            constructor.prototype = instancePrototype;
            var registeredClass = new RegisteredClass(name2, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
            var referenceConverter = new RegisteredPointer(name2, registeredClass, true, false, false);
            var pointerConverter = new RegisteredPointer(name2 + "*", registeredClass, false, false, false);
            var constPointerConverter = new RegisteredPointer(name2 + " const*", registeredClass, false, true, false);
            registeredPointers[rawType] = { pointerType: pointerConverter, constPointerType: constPointerConverter };
            replacePublicSymbol(legalFunctionName, constructor);
            return [referenceConverter, pointerConverter, constPointerConverter];
          });
        }
        function heap32VectorToArray(count, firstElement) {
          var array = [];
          for (var i = 0; i < count; i++) {
            array.push(HEAP32[(firstElement >> 2) + i >>> 0]);
          }
          return array;
        }
        function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
          assert(argCount > 0);
          var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
          invoker = embind__requireFunction(invokerSignature, invoker);
          var args = [rawConstructor];
          var destructors = [];
          whenDependentTypesAreResolved([], [rawClassType], function(classType) {
            classType = classType[0];
            var humanName = "constructor " + classType.name;
            if (classType.registeredClass.constructor_body === void 0) {
              classType.registeredClass.constructor_body = [];
            }
            if (classType.registeredClass.constructor_body[argCount - 1] !== void 0) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
            }
            classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes);
            };
            whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                if (arguments.length !== argCount - 1) {
                  throwBindingError(humanName + " called with " + arguments.length + " arguments, expected " + (argCount - 1));
                }
                destructors.length = 0;
                args.length = argCount;
                for (var i = 1; i < argCount; ++i) {
                  args[i] = argTypes[i]["toWireType"](destructors, arguments[i - 1]);
                }
                var ptr = invoker.apply(null, args);
                runDestructors(destructors);
                return argTypes[0]["fromWireType"](ptr);
              };
              return [];
            });
            return [];
          });
        }
        function new_(constructor, argumentList) {
          if (!(constructor instanceof Function)) {
            throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function");
          }
          var dummy = createNamedFunction(constructor.name || "unknownFunctionName", function() {
          });
          dummy.prototype = constructor.prototype;
          var obj = new dummy();
          var r = constructor.apply(obj, argumentList);
          return r instanceof Object ? r : obj;
        }
        function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
          var argCount = argTypes.length;
          if (argCount < 2) {
            throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
          }
          var isClassMethodFunc = argTypes[1] !== null && classType !== null;
          var needsDestructorStack = false;
          for (var i = 1; i < argTypes.length; ++i) {
            if (argTypes[i] !== null && argTypes[i].destructorFunction === void 0) {
              needsDestructorStack = true;
              break;
            }
          }
          var returns = argTypes[0].name !== "void";
          var argsList = "";
          var argsListWired = "";
          for (var i = 0; i < argCount - 2; ++i) {
            argsList += (i !== 0 ? ", " : "") + "arg" + i;
            argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired";
          }
          var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\nif (arguments.length !== " + (argCount - 2) + ") {\nthrowBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n}\n";
          if (needsDestructorStack) {
            invokerFnBody += "var destructors = [];\n";
          }
          var dtorStack = needsDestructorStack ? "destructors" : "null";
          var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
          var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
          if (isClassMethodFunc) {
            invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n";
          }
          for (var i = 0; i < argCount - 2; ++i) {
            invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
            args1.push("argType" + i);
            args2.push(argTypes[i + 2]);
          }
          if (isClassMethodFunc) {
            argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
          }
          invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";
          if (needsDestructorStack) {
            invokerFnBody += "runDestructors(destructors);\n";
          } else {
            for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
              var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
              if (argTypes[i].destructorFunction !== null) {
                invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
                args1.push(paramName + "_dtor");
                args2.push(argTypes[i].destructorFunction);
              }
            }
          }
          if (returns) {
            invokerFnBody += "var ret = retType.fromWireType(rv);\nreturn ret;\n";
          }
          invokerFnBody += "}\n";
          args1.push(invokerFnBody);
          var invokerFunction = new_(Function, args1).apply(null, args2);
          return invokerFunction;
        }
        function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
          var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
          methodName = readLatin1String(methodName);
          rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
          whenDependentTypesAreResolved([], [rawClassType], function(classType) {
            classType = classType[0];
            var humanName = classType.name + "." + methodName;
            if (methodName.startsWith("@@")) {
              methodName = Symbol[methodName.substring(2)];
            }
            if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
            }
            function unboundTypesHandler() {
              throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes);
            }
            var proto = classType.registeredClass.instancePrototype;
            var method = proto[methodName];
            if (method === void 0 || method.overloadTable === void 0 && method.className !== classType.name && method.argCount === argCount - 2) {
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
            } else {
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
            }
            whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
              if (proto[methodName].overloadTable === void 0) {
                memberFunction.argCount = argCount - 2;
                proto[methodName] = memberFunction;
              } else {
                proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
              return [];
            });
            return [];
          });
        }
        var emval_free_list = [];
        var emval_handle_array = [{}, { value: void 0 }, { value: null }, { value: true }, { value: false }];
        function __emval_decref(handle) {
          if (handle > 4 && --emval_handle_array[handle].refcount === 0) {
            emval_handle_array[handle] = void 0;
            emval_free_list.push(handle);
          }
        }
        function count_emval_handles() {
          var count = 0;
          for (var i = 5; i < emval_handle_array.length; ++i) {
            if (emval_handle_array[i] !== void 0) {
              ++count;
            }
          }
          return count;
        }
        function get_first_emval() {
          for (var i = 5; i < emval_handle_array.length; ++i) {
            if (emval_handle_array[i] !== void 0) {
              return emval_handle_array[i];
            }
          }
          return null;
        }
        function init_emval() {
          Module["count_emval_handles"] = count_emval_handles;
          Module["get_first_emval"] = get_first_emval;
        }
        function __emval_register(value) {
          switch (value) {
            case void 0: {
              return 1;
            }
            case null: {
              return 2;
            }
            case true: {
              return 3;
            }
            case false: {
              return 4;
            }
            default: {
              var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
              emval_handle_array[handle] = { refcount: 1, value };
              return handle;
            }
          }
        }
        function __embind_register_emval(rawType, name2) {
          name2 = readLatin1String(name2);
          registerType(rawType, { name: name2, "fromWireType": function(handle) {
            var rv = emval_handle_array[handle].value;
            __emval_decref(handle);
            return rv;
          }, "toWireType": function(destructors, value) {
            return __emval_register(value);
          }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: null });
        }
        function enumReadValueFromPointer(name2, shift, signed) {
          switch (shift) {
            case 0:
              return function(pointer) {
                var heap = signed ? HEAP8 : HEAPU8;
                return this["fromWireType"](heap[pointer >>> 0]);
              };
            case 1:
              return function(pointer) {
                var heap = signed ? HEAP16 : HEAPU16;
                return this["fromWireType"](heap[pointer >>> 1]);
              };
            case 2:
              return function(pointer) {
                var heap = signed ? HEAP32 : HEAPU32;
                return this["fromWireType"](heap[pointer >>> 2]);
              };
            default:
              throw new TypeError("Unknown integer type: " + name2);
          }
        }
        function __embind_register_enum(rawType, name2, size, isSigned) {
          var shift = getShiftFromSize(size);
          name2 = readLatin1String(name2);
          function ctor() {
          }
          ctor.values = {};
          registerType(rawType, { name: name2, constructor: ctor, "fromWireType": function(c) {
            return this.constructor.values[c];
          }, "toWireType": function(destructors, c) {
            return c.value;
          }, "argPackAdvance": 8, "readValueFromPointer": enumReadValueFromPointer(name2, shift, isSigned), destructorFunction: null });
          exposePublicSymbol(name2, ctor);
        }
        function requireRegisteredType(rawType, humanName) {
          var impl = registeredTypes[rawType];
          if (impl === void 0) {
            throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
          }
          return impl;
        }
        function __embind_register_enum_value(rawEnumType, name2, enumValue) {
          var enumType = requireRegisteredType(rawEnumType, "enum");
          name2 = readLatin1String(name2);
          var Enum = enumType.constructor;
          var Value2 = Object.create(enumType.constructor.prototype, { value: { value: enumValue }, constructor: { value: createNamedFunction(enumType.name + "_" + name2, function() {
          }) } });
          Enum.values[enumValue] = Value2;
          Enum[name2] = Value2;
        }
        function _embind_repr(v) {
          if (v === null) {
            return "null";
          }
          var t = typeof v;
          if (t === "object" || t === "array" || t === "function") {
            return v.toString();
          } else {
            return "" + v;
          }
        }
        function floatReadValueFromPointer(name2, shift) {
          switch (shift) {
            case 2:
              return function(pointer) {
                return this["fromWireType"](HEAPF32[pointer >>> 2]);
              };
            case 3:
              return function(pointer) {
                return this["fromWireType"](HEAPF64[pointer >>> 3]);
              };
            default:
              throw new TypeError("Unknown float type: " + name2);
          }
        }
        function __embind_register_float(rawType, name2, size) {
          var shift = getShiftFromSize(size);
          name2 = readLatin1String(name2);
          registerType(rawType, { name: name2, "fromWireType": function(value) {
            return value;
          }, "toWireType": function(destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
              throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
            }
            return value;
          }, "argPackAdvance": 8, "readValueFromPointer": floatReadValueFromPointer(name2, shift), destructorFunction: null });
        }
        function __embind_register_function(name2, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
          var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
          name2 = readLatin1String(name2);
          rawInvoker = embind__requireFunction(signature, rawInvoker);
          exposePublicSymbol(name2, function() {
            throwUnboundTypeError("Cannot call " + name2 + " due to unbound types", argTypes);
          }, argCount - 1);
          whenDependentTypesAreResolved([], argTypes, function(argTypes2) {
            var invokerArgsArray = [argTypes2[0], null].concat(argTypes2.slice(1));
            replacePublicSymbol(name2, craftInvokerFunction(name2, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
            return [];
          });
        }
        function integerReadValueFromPointer(name2, shift, signed) {
          switch (shift) {
            case 0:
              return signed ? function readS8FromPointer(pointer) {
                return HEAP8[pointer >>> 0];
              } : function readU8FromPointer(pointer) {
                return HEAPU8[pointer >>> 0];
              };
            case 1:
              return signed ? function readS16FromPointer(pointer) {
                return HEAP16[pointer >>> 1];
              } : function readU16FromPointer(pointer) {
                return HEAPU16[pointer >>> 1];
              };
            case 2:
              return signed ? function readS32FromPointer(pointer) {
                return HEAP32[pointer >>> 2];
              } : function readU32FromPointer(pointer) {
                return HEAPU32[pointer >>> 2];
              };
            default:
              throw new TypeError("Unknown integer type: " + name2);
          }
        }
        function __embind_register_integer(primitiveType, name2, size, minRange, maxRange) {
          name2 = readLatin1String(name2);
          if (maxRange === -1) {
            maxRange = 4294967295;
          }
          var shift = getShiftFromSize(size);
          var fromWireType = function(value) {
            return value;
          };
          if (minRange === 0) {
            var bitshift = 32 - 8 * size;
            fromWireType = function(value) {
              return value << bitshift >>> bitshift;
            };
          }
          var isUnsignedType = name2.includes("unsigned");
          registerType(primitiveType, { name: name2, "fromWireType": fromWireType, "toWireType": function(destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
              throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
            }
            if (value < minRange || value > maxRange) {
              throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name2 + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!");
            }
            return isUnsignedType ? value >>> 0 : value | 0;
          }, "argPackAdvance": 8, "readValueFromPointer": integerReadValueFromPointer(name2, shift, minRange !== 0), destructorFunction: null });
        }
        function __embind_register_memory_view(rawType, dataTypeIndex, name2) {
          var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
          var TA = typeMapping[dataTypeIndex];
          function decodeMemoryView(handle) {
            handle = handle >> 2;
            var heap = HEAPU32;
            var size = heap[handle >>> 0];
            var data = heap[handle + 1 >>> 0];
            return new TA(buffer, data, size);
          }
          name2 = readLatin1String(name2);
          registerType(rawType, { name: name2, "fromWireType": decodeMemoryView, "argPackAdvance": 8, "readValueFromPointer": decodeMemoryView }, { ignoreDuplicateRegistrations: true });
        }
        function __embind_register_std_string(rawType, name2) {
          name2 = readLatin1String(name2);
          var stdStringIsUTF8 = name2 === "std::string";
          registerType(rawType, { name: name2, "fromWireType": function(value) {
            var length = HEAPU32[value >>> 2];
            var str;
            if (stdStringIsUTF8) {
              var decodeStartPtr = value + 4;
              for (var i = 0; i <= length; ++i) {
                var currentBytePtr = value + 4 + i;
                if (i == length || HEAPU8[currentBytePtr >>> 0] == 0) {
                  var maxRead = currentBytePtr - decodeStartPtr;
                  var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                  if (str === void 0) {
                    str = stringSegment;
                  } else {
                    str += String.fromCharCode(0);
                    str += stringSegment;
                  }
                  decodeStartPtr = currentBytePtr + 1;
                }
              }
            } else {
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {
                a[i] = String.fromCharCode(HEAPU8[value + 4 + i >>> 0]);
              }
              str = a.join("");
            }
            _free(value);
            return str;
          }, "toWireType": function(destructors, value) {
            if (value instanceof ArrayBuffer) {
              value = new Uint8Array(value);
            }
            var getLength;
            var valueIsOfTypeString = typeof value === "string";
            if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
              throwBindingError("Cannot pass non-string to std::string");
            }
            if (stdStringIsUTF8 && valueIsOfTypeString) {
              getLength = function() {
                return lengthBytesUTF8(value);
              };
            } else {
              getLength = function() {
                return value.length;
              };
            }
            var length = getLength();
            var ptr = _malloc(4 + length + 1);
            ptr >>>= 0;
            HEAPU32[ptr >>> 2] = length;
            if (stdStringIsUTF8 && valueIsOfTypeString) {
              stringToUTF8(value, ptr + 4, length + 1);
            } else {
              if (valueIsOfTypeString) {
                for (var i = 0; i < length; ++i) {
                  var charCode = value.charCodeAt(i);
                  if (charCode > 255) {
                    _free(ptr);
                    throwBindingError("String has UTF-16 code units that do not fit in 8 bits");
                  }
                  HEAPU8[ptr + 4 + i >>> 0] = charCode;
                }
              } else {
                for (var i = 0; i < length; ++i) {
                  HEAPU8[ptr + 4 + i >>> 0] = value[i];
                }
              }
            }
            if (destructors !== null) {
              destructors.push(_free, ptr);
            }
            return ptr;
          }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: function(ptr) {
            _free(ptr);
          } });
        }
        function __embind_register_std_wstring(rawType, charSize, name2) {
          name2 = readLatin1String(name2);
          var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
          if (charSize === 2) {
            decodeString = UTF16ToString;
            encodeString = stringToUTF16;
            lengthBytesUTF = lengthBytesUTF16;
            getHeap = function() {
              return HEAPU16;
            };
            shift = 1;
          } else if (charSize === 4) {
            decodeString = UTF32ToString;
            encodeString = stringToUTF32;
            lengthBytesUTF = lengthBytesUTF32;
            getHeap = function() {
              return HEAPU32;
            };
            shift = 2;
          }
          registerType(rawType, { name: name2, "fromWireType": function(value) {
            var length = HEAPU32[value >>> 2];
            var HEAP = getHeap();
            var str;
            var decodeStartPtr = value + 4;
            for (var i = 0; i <= length; ++i) {
              var currentBytePtr = value + 4 + i * charSize;
              if (i == length || HEAP[currentBytePtr >>> shift] == 0) {
                var maxReadBytes = currentBytePtr - decodeStartPtr;
                var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
                if (str === void 0) {
                  str = stringSegment;
                } else {
                  str += String.fromCharCode(0);
                  str += stringSegment;
                }
                decodeStartPtr = currentBytePtr + charSize;
              }
            }
            _free(value);
            return str;
          }, "toWireType": function(destructors, value) {
            if (!(typeof value === "string")) {
              throwBindingError("Cannot pass non-string to C++ string type " + name2);
            }
            var length = lengthBytesUTF(value);
            var ptr = _malloc(4 + length + charSize);
            ptr >>>= 0;
            HEAPU32[ptr >>> 2] = length >> shift;
            encodeString(value, ptr + 4, length + charSize);
            if (destructors !== null) {
              destructors.push(_free, ptr);
            }
            return ptr;
          }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: function(ptr) {
            _free(ptr);
          } });
        }
        function __embind_register_value_array(rawType, name2, constructorSignature, rawConstructor, destructorSignature, rawDestructor) {
          tupleRegistrations[rawType] = { name: readLatin1String(name2), rawConstructor: embind__requireFunction(constructorSignature, rawConstructor), rawDestructor: embind__requireFunction(destructorSignature, rawDestructor), elements: [] };
        }
        function __embind_register_value_array_element(rawTupleType, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
          tupleRegistrations[rawTupleType].elements.push({ getterReturnType, getter: embind__requireFunction(getterSignature, getter), getterContext, setterArgumentType, setter: embind__requireFunction(setterSignature, setter), setterContext });
        }
        function __embind_register_value_object(rawType, name2, constructorSignature, rawConstructor, destructorSignature, rawDestructor) {
          structRegistrations[rawType] = { name: readLatin1String(name2), rawConstructor: embind__requireFunction(constructorSignature, rawConstructor), rawDestructor: embind__requireFunction(destructorSignature, rawDestructor), fields: [] };
        }
        function __embind_register_value_object_field(structType, fieldName, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
          structRegistrations[structType].fields.push({ fieldName: readLatin1String(fieldName), getterReturnType, getter: embind__requireFunction(getterSignature, getter), getterContext, setterArgumentType, setter: embind__requireFunction(setterSignature, setter), setterContext });
        }
        function __embind_register_void(rawType, name2) {
          name2 = readLatin1String(name2);
          registerType(rawType, { isVoid: true, name: name2, "argPackAdvance": 0, "fromWireType": function() {
            return void 0;
          }, "toWireType": function(destructors, o) {
            return void 0;
          } });
        }
        function requireHandle(handle) {
          if (!handle) {
            throwBindingError("Cannot use deleted val. handle = " + handle);
          }
          return emval_handle_array[handle].value;
        }
        function __emval_as(handle, returnType, destructorsRef) {
          handle = requireHandle(handle);
          returnType = requireRegisteredType(returnType, "emval::as");
          var destructors = [];
          var rd = __emval_register(destructors);
          HEAP32[destructorsRef >>> 2] = rd;
          return returnType["toWireType"](destructors, handle);
        }
        function __emval_lookupTypes(argCount, argTypes) {
          var a = new Array(argCount);
          for (var i = 0; i < argCount; ++i) {
            a[i] = requireRegisteredType(HEAP32[(argTypes >> 2) + i >>> 0], "parameter " + i);
          }
          return a;
        }
        function __emval_call(handle, argCount, argTypes, argv) {
          handle = requireHandle(handle);
          var types = __emval_lookupTypes(argCount, argTypes);
          var args = new Array(argCount);
          for (var i = 0; i < argCount; ++i) {
            var type = types[i];
            args[i] = type["readValueFromPointer"](argv);
            argv += type["argPackAdvance"];
          }
          var rv = handle.apply(void 0, args);
          return __emval_register(rv);
        }
        var emval_symbols = {};
        function getStringOrSymbol(address) {
          var symbol = emval_symbols[address];
          if (symbol === void 0) {
            return readLatin1String(address);
          } else {
            return symbol;
          }
        }
        function emval_get_global() {
          if (typeof globalThis === "object") {
            return globalThis;
          }
          return function() {
            return Function;
          }()("return this")();
        }
        function __emval_get_global(name2) {
          if (name2 === 0) {
            return __emval_register(emval_get_global());
          } else {
            name2 = getStringOrSymbol(name2);
            return __emval_register(emval_get_global()[name2]);
          }
        }
        function __emval_get_property(handle, key2) {
          handle = requireHandle(handle);
          key2 = requireHandle(key2);
          return __emval_register(handle[key2]);
        }
        function __emval_incref(handle) {
          if (handle > 4) {
            emval_handle_array[handle].refcount += 1;
          }
        }
        function __emval_instanceof(object, constructor) {
          object = requireHandle(object);
          constructor = requireHandle(constructor);
          return object instanceof constructor;
        }
        function __emval_is_number(handle) {
          handle = requireHandle(handle);
          return typeof handle === "number";
        }
        function __emval_new_array() {
          return __emval_register([]);
        }
        function __emval_new_cstring(v) {
          return __emval_register(getStringOrSymbol(v));
        }
        function __emval_new_object() {
          return __emval_register({});
        }
        function __emval_run_destructors(handle) {
          var destructors = emval_handle_array[handle].value;
          runDestructors(destructors);
          __emval_decref(handle);
        }
        function __emval_set_property(handle, key2, value) {
          handle = requireHandle(handle);
          key2 = requireHandle(key2);
          value = requireHandle(value);
          handle[key2] = value;
        }
        function __emval_take_value(type, argv) {
          type = requireRegisteredType(type, "_emval_take_value");
          var v = type["readValueFromPointer"](argv);
          return __emval_register(v);
        }
        function _abort() {
          abort();
        }
        var _emscripten_get_now;
        if (ENVIRONMENT_IS_NODE) {
          _emscripten_get_now = function() {
            var t = process["hrtime"]();
            return t[0] * 1e3 + t[1] / 1e6;
          };
        } else
          _emscripten_get_now = function() {
            return performance.now();
          };
        var _emscripten_get_now_is_monotonic = true;
        function _clock_gettime(clk_id, tp) {
          var now;
          if (clk_id === 0) {
            now = Date.now();
          } else if ((clk_id === 1 || clk_id === 4) && _emscripten_get_now_is_monotonic) {
            now = _emscripten_get_now();
          } else {
            setErrNo(28);
            return -1;
          }
          HEAP32[tp >>> 2] = now / 1e3 | 0;
          HEAP32[tp + 4 >>> 2] = now % 1e3 * 1e3 * 1e3 | 0;
          return 0;
        }
        function _emscripten_memcpy_big(dest, src, num) {
          HEAPU8.copyWithin(dest >>> 0, src >>> 0, src + num >>> 0);
        }
        function emscripten_realloc_buffer(size) {
          try {
            wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
            updateGlobalBufferAndViews(wasmMemory.buffer);
            return 1;
          } catch (e) {
          }
        }
        function _emscripten_resize_heap(requestedSize) {
          var oldSize = HEAPU8.length;
          requestedSize = requestedSize >>> 0;
          var maxHeapSize = 4294901760;
          if (requestedSize > maxHeapSize) {
            return false;
          }
          for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
            var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
            overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
            var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
            var replacement = emscripten_realloc_buffer(newSize);
            if (replacement) {
              return true;
            }
          }
          return false;
        }
        var ENV = {};
        function getExecutableName() {
          return thisProgram || "./this.program";
        }
        function getEnvStrings() {
          if (!getEnvStrings.strings) {
            var lang = (typeof navigator === "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
            var env = { "USER": "web_user", "LOGNAME": "web_user", "PATH": "/", "PWD": "/", "HOME": "/home/web_user", "LANG": lang, "_": getExecutableName() };
            for (var x in ENV) {
              if (ENV[x] === void 0)
                delete env[x];
              else
                env[x] = ENV[x];
            }
            var strings = [];
            for (var x in env) {
              strings.push(x + "=" + env[x]);
            }
            getEnvStrings.strings = strings;
          }
          return getEnvStrings.strings;
        }
        function _environ_get(__environ, environ_buf) {
          try {
            var bufSize = 0;
            getEnvStrings().forEach(function(string, i) {
              var ptr = environ_buf + bufSize;
              HEAP32[__environ + i * 4 >>> 2] = ptr;
              writeAsciiToMemory(string, ptr);
              bufSize += string.length + 1;
            });
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _environ_sizes_get(penviron_count, penviron_buf_size) {
          try {
            var strings = getEnvStrings();
            HEAP32[penviron_count >>> 2] = strings.length;
            var bufSize = 0;
            strings.forEach(function(string) {
              bufSize += string.length + 1;
            });
            HEAP32[penviron_buf_size >>> 2] = bufSize;
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _fd_close(fd) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            FS.close(stream);
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _fd_read(fd, iov, iovcnt, pnum) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = SYSCALLS.doReadv(stream, iov, iovcnt);
            HEAP32[pnum >>> 2] = num;
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var HIGH_OFFSET = 4294967296;
            var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
            var DOUBLE_LIMIT = 9007199254740992;
            if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
              return -61;
            }
            FS.llseek(stream, offset, whence);
            tempI64 = [stream.position >>> 0, (tempDouble = stream.position, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[newOffset >>> 2] = tempI64[0], HEAP32[newOffset + 4 >>> 2] = tempI64[1];
            if (stream.getdents && offset === 0 && whence === 0)
              stream.getdents = null;
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _fd_write(fd, iov, iovcnt, pnum) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = SYSCALLS.doWritev(stream, iov, iovcnt);
            HEAP32[pnum >>> 2] = num;
            return 0;
          } catch (e) {
            if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
              abort(e);
            return e.errno;
          }
        }
        function _getTempRet0() {
          return getTempRet0();
        }
        function _llvm_eh_typeid_for(type) {
          return type;
        }
        function _setTempRet0(val) {
          setTempRet0(val);
        }
        function __isLeapYear(year) {
          return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        }
        function __arraySum(array, index) {
          var sum = 0;
          for (var i = 0; i <= index; sum += array[i++]) {
          }
          return sum;
        }
        var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        function __addDays(date, days) {
          var newDate = new Date(date.getTime());
          while (days > 0) {
            var leap = __isLeapYear(newDate.getFullYear());
            var currentMonth = newDate.getMonth();
            var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
            if (days > daysInCurrentMonth - newDate.getDate()) {
              days -= daysInCurrentMonth - newDate.getDate() + 1;
              newDate.setDate(1);
              if (currentMonth < 11) {
                newDate.setMonth(currentMonth + 1);
              } else {
                newDate.setMonth(0);
                newDate.setFullYear(newDate.getFullYear() + 1);
              }
            } else {
              newDate.setDate(newDate.getDate() + days);
              return newDate;
            }
          }
          return newDate;
        }
        function _strftime(s, maxsize, format, tm) {
          var tm_zone = HEAP32[tm + 40 >>> 2];
          var date = { tm_sec: HEAP32[tm >>> 2], tm_min: HEAP32[tm + 4 >>> 2], tm_hour: HEAP32[tm + 8 >>> 2], tm_mday: HEAP32[tm + 12 >>> 2], tm_mon: HEAP32[tm + 16 >>> 2], tm_year: HEAP32[tm + 20 >>> 2], tm_wday: HEAP32[tm + 24 >>> 2], tm_yday: HEAP32[tm + 28 >>> 2], tm_isdst: HEAP32[tm + 32 >>> 2], tm_gmtoff: HEAP32[tm + 36 >>> 2], tm_zone: tm_zone ? UTF8ToString(tm_zone) : "" };
          var pattern = UTF8ToString(format);
          var EXPANSION_RULES_1 = { "%c": "%a %b %d %H:%M:%S %Y", "%D": "%m/%d/%y", "%F": "%Y-%m-%d", "%h": "%b", "%r": "%I:%M:%S %p", "%R": "%H:%M", "%T": "%H:%M:%S", "%x": "%m/%d/%y", "%X": "%H:%M:%S", "%Ec": "%c", "%EC": "%C", "%Ex": "%m/%d/%y", "%EX": "%H:%M:%S", "%Ey": "%y", "%EY": "%Y", "%Od": "%d", "%Oe": "%e", "%OH": "%H", "%OI": "%I", "%Om": "%m", "%OM": "%M", "%OS": "%S", "%Ou": "%u", "%OU": "%U", "%OV": "%V", "%Ow": "%w", "%OW": "%W", "%Oy": "%y" };
          for (var rule in EXPANSION_RULES_1) {
            pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule]);
          }
          var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          function leadingSomething(value, digits, character) {
            var str = typeof value === "number" ? value.toString() : value || "";
            while (str.length < digits) {
              str = character[0] + str;
            }
            return str;
          }
          function leadingNulls(value, digits) {
            return leadingSomething(value, digits, "0");
          }
          function compareByDay(date1, date2) {
            function sgn(value) {
              return value < 0 ? -1 : value > 0 ? 1 : 0;
            }
            var compare;
            if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
              if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                compare = sgn(date1.getDate() - date2.getDate());
              }
            }
            return compare;
          }
          function getFirstWeekStartDate(janFourth) {
            switch (janFourth.getDay()) {
              case 0:
                return new Date(janFourth.getFullYear() - 1, 11, 29);
              case 1:
                return janFourth;
              case 2:
                return new Date(janFourth.getFullYear(), 0, 3);
              case 3:
                return new Date(janFourth.getFullYear(), 0, 2);
              case 4:
                return new Date(janFourth.getFullYear(), 0, 1);
              case 5:
                return new Date(janFourth.getFullYear() - 1, 11, 31);
              case 6:
                return new Date(janFourth.getFullYear() - 1, 11, 30);
            }
          }
          function getWeekBasedYear(date2) {
            var thisDate = __addDays(new Date(date2.tm_year + 1900, 0, 1), date2.tm_yday);
            var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
            var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
            var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
            var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
            if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
              if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                return thisDate.getFullYear() + 1;
              } else {
                return thisDate.getFullYear();
              }
            } else {
              return thisDate.getFullYear() - 1;
            }
          }
          var EXPANSION_RULES_2 = { "%a": function(date2) {
            return WEEKDAYS[date2.tm_wday].substring(0, 3);
          }, "%A": function(date2) {
            return WEEKDAYS[date2.tm_wday];
          }, "%b": function(date2) {
            return MONTHS[date2.tm_mon].substring(0, 3);
          }, "%B": function(date2) {
            return MONTHS[date2.tm_mon];
          }, "%C": function(date2) {
            var year = date2.tm_year + 1900;
            return leadingNulls(year / 100 | 0, 2);
          }, "%d": function(date2) {
            return leadingNulls(date2.tm_mday, 2);
          }, "%e": function(date2) {
            return leadingSomething(date2.tm_mday, 2, " ");
          }, "%g": function(date2) {
            return getWeekBasedYear(date2).toString().substring(2);
          }, "%G": function(date2) {
            return getWeekBasedYear(date2);
          }, "%H": function(date2) {
            return leadingNulls(date2.tm_hour, 2);
          }, "%I": function(date2) {
            var twelveHour = date2.tm_hour;
            if (twelveHour == 0)
              twelveHour = 12;
            else if (twelveHour > 12)
              twelveHour -= 12;
            return leadingNulls(twelveHour, 2);
          }, "%j": function(date2) {
            return leadingNulls(date2.tm_mday + __arraySum(__isLeapYear(date2.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date2.tm_mon - 1), 3);
          }, "%m": function(date2) {
            return leadingNulls(date2.tm_mon + 1, 2);
          }, "%M": function(date2) {
            return leadingNulls(date2.tm_min, 2);
          }, "%n": function() {
            return "\n";
          }, "%p": function(date2) {
            if (date2.tm_hour >= 0 && date2.tm_hour < 12) {
              return "AM";
            } else {
              return "PM";
            }
          }, "%S": function(date2) {
            return leadingNulls(date2.tm_sec, 2);
          }, "%t": function() {
            return "	";
          }, "%u": function(date2) {
            return date2.tm_wday || 7;
          }, "%U": function(date2) {
            var janFirst = new Date(date2.tm_year + 1900, 0, 1);
            var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
            var endDate = new Date(date2.tm_year + 1900, date2.tm_mon, date2.tm_mday);
            if (compareByDay(firstSunday, endDate) < 0) {
              var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
              var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
              var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
              return leadingNulls(Math.ceil(days / 7), 2);
            }
            return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00";
          }, "%V": function(date2) {
            var janFourthThisYear = new Date(date2.tm_year + 1900, 0, 4);
            var janFourthNextYear = new Date(date2.tm_year + 1901, 0, 4);
            var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
            var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
            var endDate = __addDays(new Date(date2.tm_year + 1900, 0, 1), date2.tm_yday);
            if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
              return "53";
            }
            if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
              return "01";
            }
            var daysDifference;
            if (firstWeekStartThisYear.getFullYear() < date2.tm_year + 1900) {
              daysDifference = date2.tm_yday + 32 - firstWeekStartThisYear.getDate();
            } else {
              daysDifference = date2.tm_yday + 1 - firstWeekStartThisYear.getDate();
            }
            return leadingNulls(Math.ceil(daysDifference / 7), 2);
          }, "%w": function(date2) {
            return date2.tm_wday;
          }, "%W": function(date2) {
            var janFirst = new Date(date2.tm_year, 0, 1);
            var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
            var endDate = new Date(date2.tm_year + 1900, date2.tm_mon, date2.tm_mday);
            if (compareByDay(firstMonday, endDate) < 0) {
              var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
              var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
              var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
              return leadingNulls(Math.ceil(days / 7), 2);
            }
            return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00";
          }, "%y": function(date2) {
            return (date2.tm_year + 1900).toString().substring(2);
          }, "%Y": function(date2) {
            return date2.tm_year + 1900;
          }, "%z": function(date2) {
            var off = date2.tm_gmtoff;
            var ahead = off >= 0;
            off = Math.abs(off) / 60;
            off = off / 60 * 100 + off % 60;
            return (ahead ? "+" : "-") + String("0000" + off).slice(-4);
          }, "%Z": function(date2) {
            return date2.tm_zone;
          }, "%%": function() {
            return "%";
          } };
          for (var rule in EXPANSION_RULES_2) {
            if (pattern.includes(rule)) {
              pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date));
            }
          }
          var bytes = intArrayFromString(pattern, false);
          if (bytes.length > maxsize) {
            return 0;
          }
          writeArrayToMemory(bytes, s);
          return bytes.length - 1;
        }
        function _strftime_l(s, maxsize, format, tm) {
          return _strftime(s, maxsize, format, tm);
        }
        var FSNode = function(parent, name2, mode, rdev) {
          if (!parent) {
            parent = this;
          }
          this.parent = parent;
          this.mount = parent.mount;
          this.mounted = null;
          this.id = FS.nextInode++;
          this.name = name2;
          this.mode = mode;
          this.node_ops = {};
          this.stream_ops = {};
          this.rdev = rdev;
        };
        var readMode = 292 | 73;
        var writeMode = 146;
        Object.defineProperties(FSNode.prototype, { read: { get: function() {
          return (this.mode & readMode) === readMode;
        }, set: function(val) {
          val ? this.mode |= readMode : this.mode &= ~readMode;
        } }, write: { get: function() {
          return (this.mode & writeMode) === writeMode;
        }, set: function(val) {
          val ? this.mode |= writeMode : this.mode &= ~writeMode;
        } }, isFolder: { get: function() {
          return FS.isDir(this.mode);
        } }, isDevice: { get: function() {
          return FS.isChrdev(this.mode);
        } } });
        FS.FSNode = FSNode;
        FS.staticInit();
        Module["FS_createPath"] = FS.createPath;
        Module["FS_createDataFile"] = FS.createDataFile;
        Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
        Module["FS_createLazyFile"] = FS.createLazyFile;
        Module["FS_createDevice"] = FS.createDevice;
        Module["FS_unlink"] = FS.unlink;
        InternalError = Module["InternalError"] = extendError(Error, "InternalError");
        embind_init_charCodes();
        BindingError = Module["BindingError"] = extendError(Error, "BindingError");
        init_ClassHandle();
        init_RegisteredPointer();
        init_embind();
        UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
        init_emval();
        function intArrayFromString(stringy, dontAddNull, length) {
          var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
          var u8array = new Array(len);
          var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
          if (dontAddNull)
            u8array.length = numBytesWritten;
          return u8array;
        }
        var asmLibraryArg = { "ga": ___assert_fail, "m": ___cxa_allocate_exception, "u": ___cxa_begin_catch, "x": ___cxa_end_catch, "b": ___cxa_find_matching_catch_2, "l": ___cxa_find_matching_catch_3, "A": ___cxa_free_exception, "$": ___cxa_rethrow, "n": ___cxa_throw, "pa": ___cxa_uncaught_exceptions, "h": ___resumeException, "ba": ___sys_fcntl64, "qa": ___sys_ioctl, "ra": ___sys_open, "Ca": __embind_finalize_value_array, "Fa": __embind_finalize_value_object, "ka": __embind_register_bigint, "ya": __embind_register_bool, "K": __embind_register_class, "J": __embind_register_class_constructor, "p": __embind_register_class_function, "xa": __embind_register_emval, "Aa": __embind_register_enum, "Q": __embind_register_enum_value, "ea": __embind_register_float, "s": __embind_register_function, "z": __embind_register_integer, "w": __embind_register_memory_view, "fa": __embind_register_std_string, "U": __embind_register_std_wstring, "Da": __embind_register_value_array, "Ba": __embind_register_value_array_element, "I": __embind_register_value_object, "Ea": __embind_register_value_object_field, "za": __embind_register_void, "R": __emval_as, "ha": __emval_call, "na": __emval_decref, "Ma": __emval_get_global, "Ia": __emval_get_property, "_": __emval_incref, "la": __emval_instanceof, "La": __emval_is_number, "Ka": __emval_new_array, "V": __emval_new_cstring, "Ja": __emval_new_object, "Ha": __emval_run_destructors, "Ga": __emval_set_property, "B": __emval_take_value, "da": _abort, "aa": _clock_gettime, "oa": _emscripten_memcpy_big, "T": _emscripten_resize_heap, "ta": _environ_get, "ua": _environ_sizes_get, "ca": _fd_close, "wa": _fd_read, "ja": _fd_seek, "va": _fd_write, "a": _getTempRet0, "G": invoke_diii, "C": invoke_i, "c": invoke_ii, "O": invoke_iid, "i": invoke_iii, "j": invoke_iiii, "P": invoke_iiiii, "X": invoke_iiiiid, "E": invoke_iiiiii, "y": invoke_iiiiiii, "Y": invoke_iiiiiiii, "N": invoke_iiiiiiiii, "M": invoke_iiiiiiiiiiii, "ia": invoke_j, "f": invoke_v, "e": invoke_vi, "H": invoke_viddi, "F": invoke_viffiid, "g": invoke_vii, "r": invoke_viidd, "d": invoke_viii, "k": invoke_viiii, "Z": invoke_viiiid, "S": invoke_viiiidii, "D": invoke_viiiii, "v": invoke_viiiiii, "q": invoke_viiiiiii, "t": invoke_viiiiiiiii, "o": invoke_viiiiiiiiii, "L": invoke_viiiiiiiiiiiiiii, "ma": _llvm_eh_typeid_for, "W": _setTempRet0, "sa": _strftime_l };
        createWasm();
        Module["___wasm_call_ctors"] = function() {
          return (Module["___wasm_call_ctors"] = Module["asm"]["Oa"]).apply(null, arguments);
        };
        Module["_main"] = function() {
          return (Module["_main"] = Module["asm"]["Pa"]).apply(null, arguments);
        };
        var _malloc = Module["_malloc"] = function() {
          return (_malloc = Module["_malloc"] = Module["asm"]["Qa"]).apply(null, arguments);
        };
        var _free = Module["_free"] = function() {
          return (_free = Module["_free"] = Module["asm"]["Sa"]).apply(null, arguments);
        };
        var ___getTypeName = Module["___getTypeName"] = function() {
          return (___getTypeName = Module["___getTypeName"] = Module["asm"]["Ta"]).apply(null, arguments);
        };
        Module["___embind_register_native_and_builtin_types"] = function() {
          return (Module["___embind_register_native_and_builtin_types"] = Module["asm"]["Ua"]).apply(null, arguments);
        };
        var ___errno_location = Module["___errno_location"] = function() {
          return (___errno_location = Module["___errno_location"] = Module["asm"]["Va"]).apply(null, arguments);
        };
        var stackSave = Module["stackSave"] = function() {
          return (stackSave = Module["stackSave"] = Module["asm"]["Wa"]).apply(null, arguments);
        };
        var stackRestore = Module["stackRestore"] = function() {
          return (stackRestore = Module["stackRestore"] = Module["asm"]["Xa"]).apply(null, arguments);
        };
        var _setThrew = Module["_setThrew"] = function() {
          return (_setThrew = Module["_setThrew"] = Module["asm"]["Ya"]).apply(null, arguments);
        };
        var ___cxa_can_catch = Module["___cxa_can_catch"] = function() {
          return (___cxa_can_catch = Module["___cxa_can_catch"] = Module["asm"]["Za"]).apply(null, arguments);
        };
        var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function() {
          return (___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = Module["asm"]["_a"]).apply(null, arguments);
        };
        Module["dynCall_jiji"] = function() {
          return (Module["dynCall_jiji"] = Module["asm"]["$a"]).apply(null, arguments);
        };
        var dynCall_j = Module["dynCall_j"] = function() {
          return (dynCall_j = Module["dynCall_j"] = Module["asm"]["ab"]).apply(null, arguments);
        };
        Module["dynCall_viijii"] = function() {
          return (Module["dynCall_viijii"] = Module["asm"]["bb"]).apply(null, arguments);
        };
        Module["dynCall_iiiiij"] = function() {
          return (Module["dynCall_iiiiij"] = Module["asm"]["cb"]).apply(null, arguments);
        };
        Module["dynCall_iiiiijj"] = function() {
          return (Module["dynCall_iiiiijj"] = Module["asm"]["db"]).apply(null, arguments);
        };
        Module["dynCall_iiiiiijj"] = function() {
          return (Module["dynCall_iiiiiijj"] = Module["asm"]["eb"]).apply(null, arguments);
        };
        function invoke_ii(index, a1) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_vi(index, a1) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_v(index) {
          var sp = stackSave();
          try {
            wasmTable.get(index)();
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viii(index, a1, a2, a3) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiii(index, a1, a2, a3, a4) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iii(index, a1, a2) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_vii(index, a1, a2) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiii(index, a1, a2, a3, a4) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_diii(index, a1, a2, a3) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_i(index) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)();
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiii(index, a1, a2, a3) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iid(index, a1, a2) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5, a6);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiidii(index, a1, a2, a3, a4, a5, a6, a7) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viffiid(index, a1, a2, a3, a4, a5, a6) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viddi(index, a1, a2, a3, a4) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiii(index, a1, a2, a3, a4, a5) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viidd(index, a1, a2, a3, a4) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiid(index, a1, a2, a3, a4, a5) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_viiiiiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15) {
          var sp = stackSave();
          try {
            wasmTable.get(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_iiiiid(index, a1, a2, a3, a4, a5) {
          var sp = stackSave();
          try {
            return wasmTable.get(index)(a1, a2, a3, a4, a5);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        function invoke_j(index) {
          var sp = stackSave();
          try {
            return dynCall_j(index);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0 && e !== "longjmp")
              throw e;
            _setThrew(1, 0);
          }
        }
        Module["addRunDependency"] = addRunDependency;
        Module["removeRunDependency"] = removeRunDependency;
        Module["FS_createPath"] = FS.createPath;
        Module["FS_createDataFile"] = FS.createDataFile;
        Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
        Module["FS_createLazyFile"] = FS.createLazyFile;
        Module["FS_createDevice"] = FS.createDevice;
        Module["FS_unlink"] = FS.unlink;
        Module["FS"] = FS;
        var calledRun;
        function ExitStatus(status) {
          this.name = "ExitStatus";
          this.message = "Program terminated with exit(" + status + ")";
          this.status = status;
        }
        dependenciesFulfilled = function runCaller() {
          if (!calledRun)
            run();
          if (!calledRun)
            dependenciesFulfilled = runCaller;
        };
        function callMain(args) {
          var entryFunction = Module["_main"];
          var argc = 0;
          var argv = 0;
          try {
            var ret = entryFunction(argc, argv);
            exit(ret, true);
          } catch (e) {
            if (e instanceof ExitStatus || e == "unwind") {
              return;
            }
            var toLog = e;
            if (e && typeof e === "object" && e.stack) {
              toLog = [e, e.stack];
            }
            err("exception thrown: " + toLog);
            quit_(1, e);
          } finally {
          }
        }
        function run(args) {
          if (runDependencies > 0) {
            return;
          }
          preRun();
          if (runDependencies > 0) {
            return;
          }
          function doRun() {
            if (calledRun)
              return;
            calledRun = true;
            Module["calledRun"] = true;
            if (ABORT)
              return;
            initRuntime();
            preMain();
            readyPromiseResolve(Module);
            if (Module["onRuntimeInitialized"])
              Module["onRuntimeInitialized"]();
            if (shouldRunNow)
              callMain();
            postRun();
          }
          if (Module["setStatus"]) {
            Module["setStatus"]("Running...");
            setTimeout(function() {
              setTimeout(function() {
                Module["setStatus"]("");
              }, 1);
              doRun();
            }, 1);
          } else {
            doRun();
          }
        }
        Module["run"] = run;
        function exit(status, implicit) {
          if (keepRuntimeAlive()) ; else {
            if (Module["onExit"])
              Module["onExit"](status);
            ABORT = true;
          }
          quit_(status, new ExitStatus(status));
        }
        if (Module["preInit"]) {
          if (typeof Module["preInit"] == "function")
            Module["preInit"] = [Module["preInit"]];
          while (Module["preInit"].length > 0) {
            Module["preInit"].pop()();
          }
        }
        var shouldRunNow = true;
        if (Module["noInitialRun"])
          shouldRunNow = false;
        run();
        return WebIFCWasm3.ready;
      };
    }();
    if (typeof exports === "object" && typeof module === "object")
      module.exports = WebIFCWasm2;
    else if (typeof define === "function" && define["amd"])
      define([], function() {
        return WebIFCWasm2;
      });
    else if (typeof exports === "object")
      exports["WebIFCWasm"] = WebIFCWasm2;
  }
});
if (typeof self !== "undefined" && self.crossOriginIsolated) {
  require_web_ifc_mt();
} else {
  require_web_ifc();
}

const _box$1 = new Box3();
const _vector = new Vector3();

class LineSegmentsGeometry extends InstancedBufferGeometry {

	constructor() {

		super();

		this.type = 'LineSegmentsGeometry';

		const positions = [ - 1, 2, 0, 1, 2, 0, - 1, 1, 0, 1, 1, 0, - 1, 0, 0, 1, 0, 0, - 1, - 1, 0, 1, - 1, 0 ];
		const uvs = [ - 1, 2, 1, 2, - 1, 1, 1, 1, - 1, - 1, 1, - 1, - 1, - 2, 1, - 2 ];
		const index = [ 0, 2, 1, 2, 3, 1, 2, 4, 3, 4, 5, 3, 4, 6, 5, 6, 7, 5 ];

		this.setIndex( index );
		this.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		this.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );

	}

	applyMatrix4( matrix ) {

		const start = this.attributes.instanceStart;
		const end = this.attributes.instanceEnd;

		if ( start !== undefined ) {

			start.applyMatrix4( matrix );

			end.applyMatrix4( matrix );

			start.needsUpdate = true;

		}

		if ( this.boundingBox !== null ) {

			this.computeBoundingBox();

		}

		if ( this.boundingSphere !== null ) {

			this.computeBoundingSphere();

		}

		return this;

	}

	setPositions( array ) {

		let lineSegments;

		if ( array instanceof Float32Array ) {

			lineSegments = array;

		} else if ( Array.isArray( array ) ) {

			lineSegments = new Float32Array( array );

		}

		const instanceBuffer = new InstancedInterleavedBuffer( lineSegments, 6, 1 ); // xyz, xyz

		this.setAttribute( 'instanceStart', new InterleavedBufferAttribute( instanceBuffer, 3, 0 ) ); // xyz
		this.setAttribute( 'instanceEnd', new InterleavedBufferAttribute( instanceBuffer, 3, 3 ) ); // xyz

		//

		this.computeBoundingBox();
		this.computeBoundingSphere();

		return this;

	}

	setColors( array ) {

		let colors;

		if ( array instanceof Float32Array ) {

			colors = array;

		} else if ( Array.isArray( array ) ) {

			colors = new Float32Array( array );

		}

		const instanceColorBuffer = new InstancedInterleavedBuffer( colors, 6, 1 ); // rgb, rgb

		this.setAttribute( 'instanceColorStart', new InterleavedBufferAttribute( instanceColorBuffer, 3, 0 ) ); // rgb
		this.setAttribute( 'instanceColorEnd', new InterleavedBufferAttribute( instanceColorBuffer, 3, 3 ) ); // rgb

		return this;

	}

	fromWireframeGeometry( geometry ) {

		this.setPositions( geometry.attributes.position.array );

		return this;

	}

	fromEdgesGeometry( geometry ) {

		this.setPositions( geometry.attributes.position.array );

		return this;

	}

	fromMesh( mesh ) {

		this.fromWireframeGeometry( new WireframeGeometry( mesh.geometry ) );

		// set colors, maybe

		return this;

	}

	fromLineSegments( lineSegments ) {

		const geometry = lineSegments.geometry;

		if ( geometry.isGeometry ) {

			console.error( 'THREE.LineSegmentsGeometry no longer supports Geometry. Use THREE.BufferGeometry instead.' );
			return;

		} else if ( geometry.isBufferGeometry ) {

			this.setPositions( geometry.attributes.position.array ); // assumes non-indexed

		}

		// set colors, maybe

		return this;

	}

	computeBoundingBox() {

		if ( this.boundingBox === null ) {

			this.boundingBox = new Box3();

		}

		const start = this.attributes.instanceStart;
		const end = this.attributes.instanceEnd;

		if ( start !== undefined && end !== undefined ) {

			this.boundingBox.setFromBufferAttribute( start );

			_box$1.setFromBufferAttribute( end );

			this.boundingBox.union( _box$1 );

		}

	}

	computeBoundingSphere() {

		if ( this.boundingSphere === null ) {

			this.boundingSphere = new Sphere();

		}

		if ( this.boundingBox === null ) {

			this.computeBoundingBox();

		}

		const start = this.attributes.instanceStart;
		const end = this.attributes.instanceEnd;

		if ( start !== undefined && end !== undefined ) {

			const center = this.boundingSphere.center;

			this.boundingBox.getCenter( center );

			let maxRadiusSq = 0;

			for ( let i = 0, il = start.count; i < il; i ++ ) {

				_vector.fromBufferAttribute( start, i );
				maxRadiusSq = Math.max( maxRadiusSq, center.distanceToSquared( _vector ) );

				_vector.fromBufferAttribute( end, i );
				maxRadiusSq = Math.max( maxRadiusSq, center.distanceToSquared( _vector ) );

			}

			this.boundingSphere.radius = Math.sqrt( maxRadiusSq );

			if ( isNaN( this.boundingSphere.radius ) ) {

				console.error( 'THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.', this );

			}

		}

	}

	toJSON() {

		// todo

	}

	applyMatrix( matrix ) {

		console.warn( 'THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().' );

		return this.applyMatrix4( matrix );

	}

}

LineSegmentsGeometry.prototype.isLineSegmentsGeometry = true;

/**
 * parameters = {
 *  color: <hex>,
 *  linewidth: <float>,
 *  dashed: <boolean>,
 *  dashScale: <float>,
 *  dashSize: <float>,
 *  dashOffset: <float>,
 *  gapSize: <float>,
 *  resolution: <Vector2>, // to be set by renderer
 * }
 */


UniformsLib.line = {

	worldUnits: { value: 1 },
	linewidth: { value: 1 },
	resolution: { value: new Vector2( 1, 1 ) },
	dashOffset: { value: 0 },
	dashScale: { value: 1 },
	dashSize: { value: 1 },
	gapSize: { value: 1 } // todo FIX - maybe change to totalSize

};

ShaderLib[ 'line' ] = {

	uniforms: UniformsUtils.merge( [
		UniformsLib.common,
		UniformsLib.fog,
		UniformsLib.line
	] ),

	vertexShader:
	/* glsl */`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				// get the offset direction as perpendicular to the view vector
				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 offset;
				if ( position.y < 0.5 ) {

					offset = normalize( cross( start.xyz, worldDir ) );

				} else {

					offset = normalize( cross( end.xyz, worldDir ) );

				}

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// extend the line bounds to encompass  endcaps
					start.xyz += - worldDir * linewidth * 0.5;
					end.xyz += worldDir * linewidth * 0.5;

					// shift the position of the quad so it hugs the forward edge of the line
					offset.xy -= dir * forwardOffset;
					offset.z += 0.5;

				#endif

				// endcaps
				if ( position.y > 1.0 || position.y < 0.0 ) {

					offset.xy += dir * 2.0 * forwardOffset;

				}

				// adjust for linewidth
				offset *= linewidth * 0.5;

				// set the world position
				worldPos = ( position.y < 0.5 ) ? start : end;
				worldPos.xyz += offset;

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segements overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,

	fragmentShader:
	/* glsl */`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			float alpha = opacity;

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <encodings_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`
};

class LineMaterial extends ShaderMaterial {

	constructor( parameters ) {

		super( {

			type: 'LineMaterial',

			uniforms: UniformsUtils.clone( ShaderLib[ 'line' ].uniforms ),

			vertexShader: ShaderLib[ 'line' ].vertexShader,
			fragmentShader: ShaderLib[ 'line' ].fragmentShader,

			clipping: true // required for clipping support

		} );

		Object.defineProperties( this, {

			color: {

				enumerable: true,

				get: function () {

					return this.uniforms.diffuse.value;

				},

				set: function ( value ) {

					this.uniforms.diffuse.value = value;

				}

			},

			worldUnits: {

				enumerable: true,

				get: function () {

					return 'WORLD_UNITS' in this.defines;

				},

				set: function ( value ) {

					if ( value === true ) {

						this.defines.WORLD_UNITS = '';

					} else {

						delete this.defines.WORLD_UNITS;

					}

				}

			},

			linewidth: {

				enumerable: true,

				get: function () {

					return this.uniforms.linewidth.value;

				},

				set: function ( value ) {

					this.uniforms.linewidth.value = value;

				}

			},

			dashed: {

				enumerable: true,

				get: function () {

					return Boolean( 'USE_DASH' in this.defines );

				},

				set( value ) {

					if ( Boolean( value ) !== Boolean( 'USE_DASH' in this.defines ) ) {

						this.needsUpdate = true;

					}

					if ( value === true ) {

						this.defines.USE_DASH = '';

					} else {

						delete this.defines.USE_DASH;

					}

				}

			},

			dashScale: {

				enumerable: true,

				get: function () {

					return this.uniforms.dashScale.value;

				},

				set: function ( value ) {

					this.uniforms.dashScale.value = value;

				}

			},

			dashSize: {

				enumerable: true,

				get: function () {

					return this.uniforms.dashSize.value;

				},

				set: function ( value ) {

					this.uniforms.dashSize.value = value;

				}

			},

			dashOffset: {

				enumerable: true,

				get: function () {

					return this.uniforms.dashOffset.value;

				},

				set: function ( value ) {

					this.uniforms.dashOffset.value = value;

				}

			},

			gapSize: {

				enumerable: true,

				get: function () {

					return this.uniforms.gapSize.value;

				},

				set: function ( value ) {

					this.uniforms.gapSize.value = value;

				}

			},

			opacity: {

				enumerable: true,

				get: function () {

					return this.uniforms.opacity.value;

				},

				set: function ( value ) {

					this.uniforms.opacity.value = value;

				}

			},

			resolution: {

				enumerable: true,

				get: function () {

					return this.uniforms.resolution.value;

				},

				set: function ( value ) {

					this.uniforms.resolution.value.copy( value );

				}

			},

			alphaToCoverage: {

				enumerable: true,

				get: function () {

					return Boolean( 'USE_ALPHA_TO_COVERAGE' in this.defines );

				},

				set: function ( value ) {

					if ( Boolean( value ) !== Boolean( 'USE_ALPHA_TO_COVERAGE' in this.defines ) ) {

						this.needsUpdate = true;

					}

					if ( value === true ) {

						this.defines.USE_ALPHA_TO_COVERAGE = '';
						this.extensions.derivatives = true;

					} else {

						delete this.defines.USE_ALPHA_TO_COVERAGE;
						this.extensions.derivatives = false;

					}

				}

			}

		} );

		this.setValues( parameters );

	}

}

LineMaterial.prototype.isLineMaterial = true;

const _start = new Vector3();
const _end = new Vector3();

const _start4 = new Vector4();
const _end4 = new Vector4();

const _ssOrigin = new Vector4();
const _ssOrigin3 = new Vector3();
const _mvMatrix = new Matrix4();
const _line = new Line3();
const _closestPoint = new Vector3();

const _box = new Box3();
const _sphere = new Sphere();
const _clipToWorldVector = new Vector4();

// Returns the margin required to expand by in world space given the distance from the camera,
// line width, resolution, and camera projection
function getWorldSpaceHalfWidth( camera, distance, lineWidth, resolution ) {

	// transform into clip space, adjust the x and y values by the pixel width offset, then
	// transform back into world space to get world offset. Note clip space is [-1, 1] so full
	// width does not need to be halved.
	_clipToWorldVector.set( 0, 0, - distance, 1.0 ).applyMatrix4( camera.projectionMatrix );
	_clipToWorldVector.multiplyScalar( 1.0 / _clipToWorldVector.w );
	_clipToWorldVector.x = lineWidth / resolution.width;
	_clipToWorldVector.y = lineWidth / resolution.height;
	_clipToWorldVector.applyMatrix4( camera.projectionMatrixInverse );
	_clipToWorldVector.multiplyScalar( 1.0 / _clipToWorldVector.w );

	return Math.abs( Math.max( _clipToWorldVector.x, _clipToWorldVector.y ) );

}

class LineSegments2 extends Mesh {

	constructor( geometry = new LineSegmentsGeometry(), material = new LineMaterial( { color: Math.random() * 0xffffff } ) ) {

		super( geometry, material );

		this.type = 'LineSegments2';

	}

	// for backwards-compatability, but could be a method of LineSegmentsGeometry...

	computeLineDistances() {

		const geometry = this.geometry;

		const instanceStart = geometry.attributes.instanceStart;
		const instanceEnd = geometry.attributes.instanceEnd;
		const lineDistances = new Float32Array( 2 * instanceStart.count );

		for ( let i = 0, j = 0, l = instanceStart.count; i < l; i ++, j += 2 ) {

			_start.fromBufferAttribute( instanceStart, i );
			_end.fromBufferAttribute( instanceEnd, i );

			lineDistances[ j ] = ( j === 0 ) ? 0 : lineDistances[ j - 1 ];
			lineDistances[ j + 1 ] = lineDistances[ j ] + _start.distanceTo( _end );

		}

		const instanceDistanceBuffer = new InstancedInterleavedBuffer( lineDistances, 2, 1 ); // d0, d1

		geometry.setAttribute( 'instanceDistanceStart', new InterleavedBufferAttribute( instanceDistanceBuffer, 1, 0 ) ); // d0
		geometry.setAttribute( 'instanceDistanceEnd', new InterleavedBufferAttribute( instanceDistanceBuffer, 1, 1 ) ); // d1

		return this;

	}

	raycast( raycaster, intersects ) {

		if ( raycaster.camera === null ) {

			console.error( 'LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2.' );

		}

		const threshold = ( raycaster.params.Line2 !== undefined ) ? raycaster.params.Line2.threshold || 0 : 0;

		const ray = raycaster.ray;
		const camera = raycaster.camera;
		const projectionMatrix = camera.projectionMatrix;

		const matrixWorld = this.matrixWorld;
		const geometry = this.geometry;
		const material = this.material;
		const resolution = material.resolution;
		const lineWidth = material.linewidth + threshold;

		const instanceStart = geometry.attributes.instanceStart;
		const instanceEnd = geometry.attributes.instanceEnd;

		// camera forward is negative
		const near = - camera.near;

		//

		// check if we intersect the sphere bounds
		if ( geometry.boundingSphere === null ) {

			geometry.computeBoundingSphere();

		}

		_sphere.copy( geometry.boundingSphere ).applyMatrix4( matrixWorld );
		const distanceToSphere = Math.max( camera.near, _sphere.distanceToPoint( ray.origin ) );

		// increase the sphere bounds by the worst case line screen space width
		const sphereMargin = getWorldSpaceHalfWidth( camera, distanceToSphere, lineWidth, resolution );
		_sphere.radius += sphereMargin;

		if ( raycaster.ray.intersectsSphere( _sphere ) === false ) {

			return;

		}

		//

		// check if we intersect the box bounds
		if ( geometry.boundingBox === null ) {

			geometry.computeBoundingBox();

		}

		_box.copy( geometry.boundingBox ).applyMatrix4( matrixWorld );
		const distanceToBox = Math.max( camera.near, _box.distanceToPoint( ray.origin ) );

		// increase the box bounds by the worst case line screen space width
		const boxMargin = getWorldSpaceHalfWidth( camera, distanceToBox, lineWidth, resolution );
		_box.max.x += boxMargin;
		_box.max.y += boxMargin;
		_box.max.z += boxMargin;
		_box.min.x -= boxMargin;
		_box.min.y -= boxMargin;
		_box.min.z -= boxMargin;

		if ( raycaster.ray.intersectsBox( _box ) === false ) {

			return;

		}

		//

		// pick a point 1 unit out along the ray to avoid the ray origin
		// sitting at the camera origin which will cause "w" to be 0 when
		// applying the projection matrix.
		ray.at( 1, _ssOrigin );

		// ndc space [ - 1.0, 1.0 ]
		_ssOrigin.w = 1;
		_ssOrigin.applyMatrix4( camera.matrixWorldInverse );
		_ssOrigin.applyMatrix4( projectionMatrix );
		_ssOrigin.multiplyScalar( 1 / _ssOrigin.w );

		// screen space
		_ssOrigin.x *= resolution.x / 2;
		_ssOrigin.y *= resolution.y / 2;
		_ssOrigin.z = 0;

		_ssOrigin3.copy( _ssOrigin );

		_mvMatrix.multiplyMatrices( camera.matrixWorldInverse, matrixWorld );

		for ( let i = 0, l = instanceStart.count; i < l; i ++ ) {

			_start4.fromBufferAttribute( instanceStart, i );
			_end4.fromBufferAttribute( instanceEnd, i );

			_start4.w = 1;
			_end4.w = 1;

			// camera space
			_start4.applyMatrix4( _mvMatrix );
			_end4.applyMatrix4( _mvMatrix );

			// skip the segment if it's entirely behind the camera
			var isBehindCameraNear = _start4.z > near && _end4.z > near;
			if ( isBehindCameraNear ) {

				continue;

			}

			// trim the segment if it extends behind camera near
			if ( _start4.z > near ) {

				const deltaDist = _start4.z - _end4.z;
				const t = ( _start4.z - near ) / deltaDist;
				_start4.lerp( _end4, t );

			} else if ( _end4.z > near ) {

				const deltaDist = _end4.z - _start4.z;
				const t = ( _end4.z - near ) / deltaDist;
				_end4.lerp( _start4, t );

			}

			// clip space
			_start4.applyMatrix4( projectionMatrix );
			_end4.applyMatrix4( projectionMatrix );

			// ndc space [ - 1.0, 1.0 ]
			_start4.multiplyScalar( 1 / _start4.w );
			_end4.multiplyScalar( 1 / _end4.w );

			// screen space
			_start4.x *= resolution.x / 2;
			_start4.y *= resolution.y / 2;

			_end4.x *= resolution.x / 2;
			_end4.y *= resolution.y / 2;

			// create 2d segment
			_line.start.copy( _start4 );
			_line.start.z = 0;

			_line.end.copy( _end4 );
			_line.end.z = 0;

			// get closest point on ray to segment
			const param = _line.closestPointToPointParameter( _ssOrigin3, true );
			_line.at( param, _closestPoint );

			// check if the intersection point is within clip space
			const zPos = MathUtils.lerp( _start4.z, _end4.z, param );
			const isInClipSpace = zPos >= - 1 && zPos <= 1;

			const isInside = _ssOrigin3.distanceTo( _closestPoint ) < lineWidth * 0.5;

			if ( isInClipSpace && isInside ) {

				_line.start.fromBufferAttribute( instanceStart, i );
				_line.end.fromBufferAttribute( instanceEnd, i );

				_line.start.applyMatrix4( matrixWorld );
				_line.end.applyMatrix4( matrixWorld );

				const pointOnLine = new Vector3();
				const point = new Vector3();

				ray.distanceSqToSegment( _line.start, _line.end, point, pointOnLine );

				intersects.push( {

					point: point,
					pointOnLine: pointOnLine,
					distance: ray.origin.distanceTo( point ),

					object: this,
					face: null,
					faceIndex: i,
					uv: null,
					uv2: null,

				} );

			}

		}

	}

}

LineSegments2.prototype.isLineSegments2 = true;

new THREE.LineSegments();

// Helper for passes that need to fill the viewport with a single quad.

new OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

// https://github.com/mrdoob/three.js/pull/21358

const _geometry$1 = new BufferGeometry();
_geometry$1.setAttribute( 'position', new Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
_geometry$1.setAttribute( 'uv', new Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );

// Helper for passes that need to fill the viewport with a single quad.

new OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

// https://github.com/mrdoob/three.js/pull/21358

const _geometry = new BufferGeometry();
_geometry.setAttribute( 'position', new Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
_geometry.setAttribute( 'uv', new Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );

/**
 * TODO
 */

({
	defines: {
		'NUM_SAMPLES': 7,
		'NUM_RINGS': 4,
		'NORMAL_TEXTURE': 0,
		'DIFFUSE_TEXTURE': 0,
		'DEPTH_PACKING': 1,
		'PERSPECTIVE_CAMERA': 1
	},
	uniforms: {

		'tDepth': { value: null },
		'tDiffuse': { value: null },
		'tNormal': { value: null },
		'size': { value: new Vector2( 512, 512 ) },

		'cameraNear': { value: 1 },
		'cameraFar': { value: 100 },
		'cameraProjectionMatrix': { value: new Matrix4() },
		'cameraInverseProjectionMatrix': { value: new Matrix4() },

		'scale': { value: 1.0 },
		'intensity': { value: 0.1 },
		'bias': { value: 0.5 },

		'minResolution': { value: 0.0 },
		'kernelRadius': { value: 100.0 },
		'randomSeed': { value: 0.0 }
	},
	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

	fragmentShader: /* glsl */`

		#include <common>

		varying vec2 vUv;

		#if DIFFUSE_TEXTURE == 1
		uniform sampler2D tDiffuse;
		#endif

		uniform sampler2D tDepth;

		#if NORMAL_TEXTURE == 1
		uniform sampler2D tNormal;
		#endif

		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraInverseProjectionMatrix;

		uniform float scale;
		uniform float intensity;
		uniform float bias;
		uniform float kernelRadius;
		uniform float minResolution;
		uniform vec2 size;
		uniform float randomSeed;

		// RGBA depth

		#include <packing>

		vec4 getDefaultColor( const in vec2 screenPosition ) {
			#if DIFFUSE_TEXTURE == 1
			return texture2D( tDiffuse, vUv );
			#else
			return vec4( 1.0 );
			#endif
		}

		float getDepth( const in vec2 screenPosition ) {
			#if DEPTH_PACKING == 1
			return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );
			#else
			return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		float getViewZ( const in float depth ) {
			#if PERSPECTIVE_CAMERA == 1
			return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );
			#else
			return orthographicDepthToViewZ( depth, cameraNear, cameraFar );
			#endif
		}

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {
			float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];
			vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );
			clipPosition *= clipW; // unprojection.

			return ( cameraInverseProjectionMatrix * clipPosition ).xyz;
		}

		vec3 getViewNormal( const in vec3 viewPosition, const in vec2 screenPosition ) {
			#if NORMAL_TEXTURE == 1
			return unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );
			#else
			return normalize( cross( dFdx( viewPosition ), dFdy( viewPosition ) ) );
			#endif
		}

		float scaleDividedByCameraFar;
		float minResolutionMultipliedByCameraFar;

		float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {
			vec3 viewDelta = sampleViewPosition - centerViewPosition;
			float viewDistance = length( viewDelta );
			float scaledScreenDistance = scaleDividedByCameraFar * viewDistance;

			return max(0.0, (dot(centerViewNormal, viewDelta) - minResolutionMultipliedByCameraFar) / scaledScreenDistance - bias) / (1.0 + pow2( scaledScreenDistance ) );
		}

		// moving costly divides into consts
		const float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );
		const float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );

		float getAmbientOcclusion( const in vec3 centerViewPosition ) {
			// precompute some variables require in getOcclusion.
			scaleDividedByCameraFar = scale / cameraFar;
			minResolutionMultipliedByCameraFar = minResolution * cameraFar;
			vec3 centerViewNormal = getViewNormal( centerViewPosition, vUv );

			// jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/
			float angle = rand( vUv + randomSeed ) * PI2;
			vec2 radius = vec2( kernelRadius * INV_NUM_SAMPLES ) / size;
			vec2 radiusStep = radius;

			float occlusionSum = 0.0;
			float weightSum = 0.0;

			for( int i = 0; i < NUM_SAMPLES; i ++ ) {
				vec2 sampleUv = vUv + vec2( cos( angle ), sin( angle ) ) * radius;
				radius += radiusStep;
				angle += ANGLE_STEP;

				float sampleDepth = getDepth( sampleUv );
				if( sampleDepth >= ( 1.0 - EPSILON ) ) {
					continue;
				}

				float sampleViewZ = getViewZ( sampleDepth );
				vec3 sampleViewPosition = getViewPosition( sampleUv, sampleDepth, sampleViewZ );
				occlusionSum += getOcclusion( centerViewPosition, centerViewNormal, sampleViewPosition );
				weightSum += 1.0;
			}

			if( weightSum == 0.0 ) discard;

			return occlusionSum * ( intensity / weightSum );
		}

		void main() {
			float centerDepth = getDepth( vUv );
			if( centerDepth >= ( 1.0 - EPSILON ) ) {
				discard;
			}

			float centerViewZ = getViewZ( centerDepth );
			vec3 viewPosition = getViewPosition( vUv, centerDepth, centerViewZ );

			float ambientOcclusion = getAmbientOcclusion( viewPosition );

			gl_FragColor = getDefaultColor( vUv );
			gl_FragColor.xyz *=  1.0 - ambientOcclusion;
		}`

});

/**
 * TODO
 */

({
	defines: {
		'KERNEL_RADIUS': 4,
		'DEPTH_PACKING': 1,
		'PERSPECTIVE_CAMERA': 1
	},
	uniforms: {
		'tDiffuse': { value: null },
		'size': { value: new Vector2( 512, 512 ) },
		'sampleUvOffsets': { value: [ new Vector2( 0, 0 ) ] },
		'sampleWeights': { value: [ 1.0 ] },
		'tDepth': { value: null },
		'cameraNear': { value: 10 },
		'cameraFar': { value: 1000 },
		'depthCutoff': { value: 10 },
	},
	vertexShader: /* glsl */`

		#include <common>

		uniform vec2 size;

		varying vec2 vUv;
		varying vec2 vInvSize;

		void main() {
			vUv = uv;
			vInvSize = 1.0 / size;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

	fragmentShader: /* glsl */`

		#include <common>
		#include <packing>

		uniform sampler2D tDiffuse;
		uniform sampler2D tDepth;

		uniform float cameraNear;
		uniform float cameraFar;
		uniform float depthCutoff;

		uniform vec2 sampleUvOffsets[ KERNEL_RADIUS + 1 ];
		uniform float sampleWeights[ KERNEL_RADIUS + 1 ];

		varying vec2 vUv;
		varying vec2 vInvSize;

		float getDepth( const in vec2 screenPosition ) {
			#if DEPTH_PACKING == 1
			return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );
			#else
			return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		float getViewZ( const in float depth ) {
			#if PERSPECTIVE_CAMERA == 1
			return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );
			#else
			return orthographicDepthToViewZ( depth, cameraNear, cameraFar );
			#endif
		}

		void main() {
			float depth = getDepth( vUv );
			if( depth >= ( 1.0 - EPSILON ) ) {
				discard;
			}

			float centerViewZ = -getViewZ( depth );
			bool rBreak = false, lBreak = false;

			float weightSum = sampleWeights[0];
			vec4 diffuseSum = texture2D( tDiffuse, vUv ) * weightSum;

			for( int i = 1; i <= KERNEL_RADIUS; i ++ ) {

				float sampleWeight = sampleWeights[i];
				vec2 sampleUvOffset = sampleUvOffsets[i] * vInvSize;

				vec2 sampleUv = vUv + sampleUvOffset;
				float viewZ = -getViewZ( getDepth( sampleUv ) );

				if( abs( viewZ - centerViewZ ) > depthCutoff ) rBreak = true;

				if( ! rBreak ) {
					diffuseSum += texture2D( tDiffuse, sampleUv ) * sampleWeight;
					weightSum += sampleWeight;
				}

				sampleUv = vUv - sampleUvOffset;
				viewZ = -getViewZ( getDepth( sampleUv ) );

				if( abs( viewZ - centerViewZ ) > depthCutoff ) lBreak = true;

				if( ! lBreak ) {
					diffuseSum += texture2D( tDiffuse, sampleUv ) * sampleWeight;
					weightSum += sampleWeight;
				}

			}

			gl_FragColor = diffuseSum / weightSum;
		}`

});

/**
 * NVIDIA FXAA by Timothy Lottes
 * http://timothylottes.blogspot.com/2011/06/fxaa3-source-released.html
 * - WebGL port by @supereggbert
 * http://www.glge.org/demos/fxaa/
 */

({

	uniforms: {

		'tDiffuse': { value: null },
		'resolution': { value: new Vector2( 1 / 1024, 1 / 512 ) }

	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader:

	// FXAA 3.11 implementation by NVIDIA, ported to WebGL by Agost Biro (biro@archilogic.com)

	//----------------------------------------------------------------------------------
	// File:				es3-kepler\FXAA\assets\shaders/FXAA_DefaultES.frag
	// SDK Version: v3.00
	// Email:			 gameworks@nvidia.com
	// Site:				http://developer.nvidia.com/
	//
	// Copyright (c) 2014-2015, NVIDIA CORPORATION. All rights reserved.
	//
	// Redistribution and use in source and binary forms, with or without
	// modification, are permitted provided that the following conditions
	// are met:
	//	* Redistributions of source code must retain the above copyright
	//		notice, this list of conditions and the following disclaimer.
	//	* Redistributions in binary form must reproduce the above copyright
	//		notice, this list of conditions and the following disclaimer in the
	//		documentation and/or other materials provided with the distribution.
	//	* Neither the name of NVIDIA CORPORATION nor the names of its
	//		contributors may be used to endorse or promote products derived
	//		from this software without specific prior written permission.
	//
	// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ``AS IS\'\' AND ANY
	// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
	// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
	// PURPOSE ARE DISCLAIMED.	IN NO EVENT SHALL THE COPYRIGHT OWNER OR
	// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
	// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
	// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
	// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
	// OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
	// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	//
	//----------------------------------------------------------------------------------

	/* glsl */`

		precision highp float;

		uniform sampler2D tDiffuse;

		uniform vec2 resolution;

		varying vec2 vUv;

		#define FXAA_PC 1
		#define FXAA_GLSL_100 1
		#define FXAA_QUALITY_PRESET 12

		#define FXAA_GREEN_AS_LUMA 1

		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_PC_CONSOLE
				//
				// The console algorithm for PC is included
				// for developers targeting really low spec machines.
				// Likely better to just run FXAA_PC, and use a really low preset.
				//
				#define FXAA_PC_CONSOLE 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_GLSL_120
				#define FXAA_GLSL_120 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_GLSL_130
				#define FXAA_GLSL_130 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_HLSL_3
				#define FXAA_HLSL_3 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_HLSL_4
				#define FXAA_HLSL_4 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_HLSL_5
				#define FXAA_HLSL_5 0
		#endif
		/*==========================================================================*/
		#ifndef FXAA_GREEN_AS_LUMA
				//
				// For those using non-linear color,
				// and either not able to get luma in alpha, or not wanting to,
				// this enables FXAA to run using green as a proxy for luma.
				// So with this enabled, no need to pack luma in alpha.
				//
				// This will turn off AA on anything which lacks some amount of green.
				// Pure red and blue or combination of only R and B, will get no AA.
				//
				// Might want to lower the settings for both,
				//		fxaaConsoleEdgeThresholdMin
				//		fxaaQualityEdgeThresholdMin
				// In order to insure AA does not get turned off on colors
				// which contain a minor amount of green.
				//
				// 1 = On.
				// 0 = Off.
				//
				#define FXAA_GREEN_AS_LUMA 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_EARLY_EXIT
				//
				// Controls algorithm\'s early exit path.
				// On PS3 turning this ON adds 2 cycles to the shader.
				// On 360 turning this OFF adds 10ths of a millisecond to the shader.
				// Turning this off on console will result in a more blurry image.
				// So this defaults to on.
				//
				// 1 = On.
				// 0 = Off.
				//
				#define FXAA_EARLY_EXIT 1
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_DISCARD
				//
				// Only valid for PC OpenGL currently.
				// Probably will not work when FXAA_GREEN_AS_LUMA = 1.
				//
				// 1 = Use discard on pixels which don\'t need AA.
				//		 For APIs which enable concurrent TEX+ROP from same surface.
				// 0 = Return unchanged color on pixels which don\'t need AA.
				//
				#define FXAA_DISCARD 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_FAST_PIXEL_OFFSET
				//
				// Used for GLSL 120 only.
				//
				// 1 = GL API supports fast pixel offsets
				// 0 = do not use fast pixel offsets
				//
				#ifdef GL_EXT_gpu_shader4
						#define FXAA_FAST_PIXEL_OFFSET 1
				#endif
				#ifdef GL_NV_gpu_shader5
						#define FXAA_FAST_PIXEL_OFFSET 1
				#endif
				#ifdef GL_ARB_gpu_shader5
						#define FXAA_FAST_PIXEL_OFFSET 1
				#endif
				#ifndef FXAA_FAST_PIXEL_OFFSET
						#define FXAA_FAST_PIXEL_OFFSET 0
				#endif
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_GATHER4_ALPHA
				//
				// 1 = API supports gather4 on alpha channel.
				// 0 = API does not support gather4 on alpha channel.
				//
				#if (FXAA_HLSL_5 == 1)
						#define FXAA_GATHER4_ALPHA 1
				#endif
				#ifdef GL_ARB_gpu_shader5
						#define FXAA_GATHER4_ALPHA 1
				#endif
				#ifdef GL_NV_gpu_shader5
						#define FXAA_GATHER4_ALPHA 1
				#endif
				#ifndef FXAA_GATHER4_ALPHA
						#define FXAA_GATHER4_ALPHA 0
				#endif
		#endif


		/*============================================================================
														FXAA QUALITY - TUNING KNOBS
		------------------------------------------------------------------------------
		NOTE the other tuning knobs are now in the shader function inputs!
		============================================================================*/
		#ifndef FXAA_QUALITY_PRESET
				//
				// Choose the quality preset.
				// This needs to be compiled into the shader as it effects code.
				// Best option to include multiple presets is to
				// in each shader define the preset, then include this file.
				//
				// OPTIONS
				// -----------------------------------------------------------------------
				// 10 to 15 - default medium dither (10=fastest, 15=highest quality)
				// 20 to 29 - less dither, more expensive (20=fastest, 29=highest quality)
				// 39			 - no dither, very expensive
				//
				// NOTES
				// -----------------------------------------------------------------------
				// 12 = slightly faster then FXAA 3.9 and higher edge quality (default)
				// 13 = about same speed as FXAA 3.9 and better than 12
				// 23 = closest to FXAA 3.9 visually and performance wise
				//	_ = the lowest digit is directly related to performance
				// _	= the highest digit is directly related to style
				//
				#define FXAA_QUALITY_PRESET 12
		#endif


		/*============================================================================

															 FXAA QUALITY - PRESETS

		============================================================================*/

		/*============================================================================
												 FXAA QUALITY - MEDIUM DITHER PRESETS
		============================================================================*/
		#if (FXAA_QUALITY_PRESET == 10)
				#define FXAA_QUALITY_PS 3
				#define FXAA_QUALITY_P0 1.5
				#define FXAA_QUALITY_P1 3.0
				#define FXAA_QUALITY_P2 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 11)
				#define FXAA_QUALITY_PS 4
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 3.0
				#define FXAA_QUALITY_P3 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 12)
				#define FXAA_QUALITY_PS 5
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 4.0
				#define FXAA_QUALITY_P4 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 13)
				#define FXAA_QUALITY_PS 6
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 4.0
				#define FXAA_QUALITY_P5 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 14)
				#define FXAA_QUALITY_PS 7
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 4.0
				#define FXAA_QUALITY_P6 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 15)
				#define FXAA_QUALITY_PS 8
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 4.0
				#define FXAA_QUALITY_P7 12.0
		#endif

		/*============================================================================
												 FXAA QUALITY - LOW DITHER PRESETS
		============================================================================*/
		#if (FXAA_QUALITY_PRESET == 20)
				#define FXAA_QUALITY_PS 3
				#define FXAA_QUALITY_P0 1.5
				#define FXAA_QUALITY_P1 2.0
				#define FXAA_QUALITY_P2 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 21)
				#define FXAA_QUALITY_PS 4
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 22)
				#define FXAA_QUALITY_PS 5
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 23)
				#define FXAA_QUALITY_PS 6
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 24)
				#define FXAA_QUALITY_PS 7
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 3.0
				#define FXAA_QUALITY_P6 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 25)
				#define FXAA_QUALITY_PS 8
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 4.0
				#define FXAA_QUALITY_P7 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 26)
				#define FXAA_QUALITY_PS 9
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 4.0
				#define FXAA_QUALITY_P8 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 27)
				#define FXAA_QUALITY_PS 10
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 2.0
				#define FXAA_QUALITY_P8 4.0
				#define FXAA_QUALITY_P9 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 28)
				#define FXAA_QUALITY_PS 11
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 2.0
				#define FXAA_QUALITY_P8 2.0
				#define FXAA_QUALITY_P9 4.0
				#define FXAA_QUALITY_P10 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 29)
				#define FXAA_QUALITY_PS 12
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 2.0
				#define FXAA_QUALITY_P8 2.0
				#define FXAA_QUALITY_P9 2.0
				#define FXAA_QUALITY_P10 4.0
				#define FXAA_QUALITY_P11 8.0
		#endif

		/*============================================================================
												 FXAA QUALITY - EXTREME QUALITY
		============================================================================*/
		#if (FXAA_QUALITY_PRESET == 39)
				#define FXAA_QUALITY_PS 12
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.0
				#define FXAA_QUALITY_P2 1.0
				#define FXAA_QUALITY_P3 1.0
				#define FXAA_QUALITY_P4 1.0
				#define FXAA_QUALITY_P5 1.5
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 2.0
				#define FXAA_QUALITY_P8 2.0
				#define FXAA_QUALITY_P9 2.0
				#define FXAA_QUALITY_P10 4.0
				#define FXAA_QUALITY_P11 8.0
		#endif



		/*============================================================================

																		API PORTING

		============================================================================*/
		#if (FXAA_GLSL_100 == 1) || (FXAA_GLSL_120 == 1) || (FXAA_GLSL_130 == 1)
				#define FxaaBool bool
				#define FxaaDiscard discard
				#define FxaaFloat float
				#define FxaaFloat2 vec2
				#define FxaaFloat3 vec3
				#define FxaaFloat4 vec4
				#define FxaaHalf float
				#define FxaaHalf2 vec2
				#define FxaaHalf3 vec3
				#define FxaaHalf4 vec4
				#define FxaaInt2 ivec2
				#define FxaaSat(x) clamp(x, 0.0, 1.0)
				#define FxaaTex sampler2D
		#else
				#define FxaaBool bool
				#define FxaaDiscard clip(-1)
				#define FxaaFloat float
				#define FxaaFloat2 float2
				#define FxaaFloat3 float3
				#define FxaaFloat4 float4
				#define FxaaHalf half
				#define FxaaHalf2 half2
				#define FxaaHalf3 half3
				#define FxaaHalf4 half4
				#define FxaaSat(x) saturate(x)
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_GLSL_100 == 1)
			#define FxaaTexTop(t, p) texture2D(t, p, 0.0)
			#define FxaaTexOff(t, p, o, r) texture2D(t, p + (o * r), 0.0)
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_GLSL_120 == 1)
				// Requires,
				//	#version 120
				// And at least,
				//	#extension GL_EXT_gpu_shader4 : enable
				//	(or set FXAA_FAST_PIXEL_OFFSET 1 to work like DX9)
				#define FxaaTexTop(t, p) texture2DLod(t, p, 0.0)
				#if (FXAA_FAST_PIXEL_OFFSET == 1)
						#define FxaaTexOff(t, p, o, r) texture2DLodOffset(t, p, 0.0, o)
				#else
						#define FxaaTexOff(t, p, o, r) texture2DLod(t, p + (o * r), 0.0)
				#endif
				#if (FXAA_GATHER4_ALPHA == 1)
						// use #extension GL_ARB_gpu_shader5 : enable
						#define FxaaTexAlpha4(t, p) textureGather(t, p, 3)
						#define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)
						#define FxaaTexGreen4(t, p) textureGather(t, p, 1)
						#define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)
				#endif
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_GLSL_130 == 1)
				// Requires "#version 130" or better
				#define FxaaTexTop(t, p) textureLod(t, p, 0.0)
				#define FxaaTexOff(t, p, o, r) textureLodOffset(t, p, 0.0, o)
				#if (FXAA_GATHER4_ALPHA == 1)
						// use #extension GL_ARB_gpu_shader5 : enable
						#define FxaaTexAlpha4(t, p) textureGather(t, p, 3)
						#define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)
						#define FxaaTexGreen4(t, p) textureGather(t, p, 1)
						#define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)
				#endif
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_HLSL_3 == 1)
				#define FxaaInt2 float2
				#define FxaaTex sampler2D
				#define FxaaTexTop(t, p) tex2Dlod(t, float4(p, 0.0, 0.0))
				#define FxaaTexOff(t, p, o, r) tex2Dlod(t, float4(p + (o * r), 0, 0))
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_HLSL_4 == 1)
				#define FxaaInt2 int2
				struct FxaaTex { SamplerState smpl; Texture2D tex; };
				#define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)
				#define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_HLSL_5 == 1)
				#define FxaaInt2 int2
				struct FxaaTex { SamplerState smpl; Texture2D tex; };
				#define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)
				#define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)
				#define FxaaTexAlpha4(t, p) t.tex.GatherAlpha(t.smpl, p)
				#define FxaaTexOffAlpha4(t, p, o) t.tex.GatherAlpha(t.smpl, p, o)
				#define FxaaTexGreen4(t, p) t.tex.GatherGreen(t.smpl, p)
				#define FxaaTexOffGreen4(t, p, o) t.tex.GatherGreen(t.smpl, p, o)
		#endif


		/*============================================================================
											 GREEN AS LUMA OPTION SUPPORT FUNCTION
		============================================================================*/
		#if (FXAA_GREEN_AS_LUMA == 0)
				FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.w; }
		#else
				FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.y; }
		#endif




		/*============================================================================

																 FXAA3 QUALITY - PC

		============================================================================*/
		#if (FXAA_PC == 1)
		/*--------------------------------------------------------------------------*/
		FxaaFloat4 FxaaPixelShader(
				//
				// Use noperspective interpolation here (turn off perspective interpolation).
				// {xy} = center of pixel
				FxaaFloat2 pos,
				//
				// Used only for FXAA Console, and not used on the 360 version.
				// Use noperspective interpolation here (turn off perspective interpolation).
				// {xy_} = upper left of pixel
				// {_zw} = lower right of pixel
				FxaaFloat4 fxaaConsolePosPos,
				//
				// Input color texture.
				// {rgb_} = color in linear or perceptual color space
				// if (FXAA_GREEN_AS_LUMA == 0)
				//		 {__a} = luma in perceptual color space (not linear)
				FxaaTex tex,
				//
				// Only used on the optimized 360 version of FXAA Console.
				// For everything but 360, just use the same input here as for "tex".
				// For 360, same texture, just alias with a 2nd sampler.
				// This sampler needs to have an exponent bias of -1.
				FxaaTex fxaaConsole360TexExpBiasNegOne,
				//
				// Only used on the optimized 360 version of FXAA Console.
				// For everything but 360, just use the same input here as for "tex".
				// For 360, same texture, just alias with a 3nd sampler.
				// This sampler needs to have an exponent bias of -2.
				FxaaTex fxaaConsole360TexExpBiasNegTwo,
				//
				// Only used on FXAA Quality.
				// This must be from a constant/uniform.
				// {x_} = 1.0/screenWidthInPixels
				// {_y} = 1.0/screenHeightInPixels
				FxaaFloat2 fxaaQualityRcpFrame,
				//
				// Only used on FXAA Console.
				// This must be from a constant/uniform.
				// This effects sub-pixel AA quality and inversely sharpness.
				//	 Where N ranges between,
				//		 N = 0.50 (default)
				//		 N = 0.33 (sharper)
				// {x__} = -N/screenWidthInPixels
				// {_y_} = -N/screenHeightInPixels
				// {_z_} =	N/screenWidthInPixels
				// {__w} =	N/screenHeightInPixels
				FxaaFloat4 fxaaConsoleRcpFrameOpt,
				//
				// Only used on FXAA Console.
				// Not used on 360, but used on PS3 and PC.
				// This must be from a constant/uniform.
				// {x__} = -2.0/screenWidthInPixels
				// {_y_} = -2.0/screenHeightInPixels
				// {_z_} =	2.0/screenWidthInPixels
				// {__w} =	2.0/screenHeightInPixels
				FxaaFloat4 fxaaConsoleRcpFrameOpt2,
				//
				// Only used on FXAA Console.
				// Only used on 360 in place of fxaaConsoleRcpFrameOpt2.
				// This must be from a constant/uniform.
				// {x__} =	8.0/screenWidthInPixels
				// {_y_} =	8.0/screenHeightInPixels
				// {_z_} = -4.0/screenWidthInPixels
				// {__w} = -4.0/screenHeightInPixels
				FxaaFloat4 fxaaConsole360RcpFrameOpt2,
				//
				// Only used on FXAA Quality.
				// This used to be the FXAA_QUALITY_SUBPIX define.
				// It is here now to allow easier tuning.
				// Choose the amount of sub-pixel aliasing removal.
				// This can effect sharpness.
				//	 1.00 - upper limit (softer)
				//	 0.75 - default amount of filtering
				//	 0.50 - lower limit (sharper, less sub-pixel aliasing removal)
				//	 0.25 - almost off
				//	 0.00 - completely off
				FxaaFloat fxaaQualitySubpix,
				//
				// Only used on FXAA Quality.
				// This used to be the FXAA_QUALITY_EDGE_THRESHOLD define.
				// It is here now to allow easier tuning.
				// The minimum amount of local contrast required to apply algorithm.
				//	 0.333 - too little (faster)
				//	 0.250 - low quality
				//	 0.166 - default
				//	 0.125 - high quality
				//	 0.063 - overkill (slower)
				FxaaFloat fxaaQualityEdgeThreshold,
				//
				// Only used on FXAA Quality.
				// This used to be the FXAA_QUALITY_EDGE_THRESHOLD_MIN define.
				// It is here now to allow easier tuning.
				// Trims the algorithm from processing darks.
				//	 0.0833 - upper limit (default, the start of visible unfiltered edges)
				//	 0.0625 - high quality (faster)
				//	 0.0312 - visible limit (slower)
				// Special notes when using FXAA_GREEN_AS_LUMA,
				//	 Likely want to set this to zero.
				//	 As colors that are mostly not-green
				//	 will appear very dark in the green channel!
				//	 Tune by looking at mostly non-green content,
				//	 then start at zero and increase until aliasing is a problem.
				FxaaFloat fxaaQualityEdgeThresholdMin,
				//
				// Only used on FXAA Console.
				// This used to be the FXAA_CONSOLE_EDGE_SHARPNESS define.
				// It is here now to allow easier tuning.
				// This does not effect PS3, as this needs to be compiled in.
				//	 Use FXAA_CONSOLE_PS3_EDGE_SHARPNESS for PS3.
				//	 Due to the PS3 being ALU bound,
				//	 there are only three safe values here: 2 and 4 and 8.
				//	 These options use the shaders ability to a free *|/ by 2|4|8.
				// For all other platforms can be a non-power of two.
				//	 8.0 is sharper (default!!!)
				//	 4.0 is softer
				//	 2.0 is really soft (good only for vector graphics inputs)
				FxaaFloat fxaaConsoleEdgeSharpness,
				//
				// Only used on FXAA Console.
				// This used to be the FXAA_CONSOLE_EDGE_THRESHOLD define.
				// It is here now to allow easier tuning.
				// This does not effect PS3, as this needs to be compiled in.
				//	 Use FXAA_CONSOLE_PS3_EDGE_THRESHOLD for PS3.
				//	 Due to the PS3 being ALU bound,
				//	 there are only two safe values here: 1/4 and 1/8.
				//	 These options use the shaders ability to a free *|/ by 2|4|8.
				// The console setting has a different mapping than the quality setting.
				// Other platforms can use other values.
				//	 0.125 leaves less aliasing, but is softer (default!!!)
				//	 0.25 leaves more aliasing, and is sharper
				FxaaFloat fxaaConsoleEdgeThreshold,
				//
				// Only used on FXAA Console.
				// This used to be the FXAA_CONSOLE_EDGE_THRESHOLD_MIN define.
				// It is here now to allow easier tuning.
				// Trims the algorithm from processing darks.
				// The console setting has a different mapping than the quality setting.
				// This only applies when FXAA_EARLY_EXIT is 1.
				// This does not apply to PS3,
				// PS3 was simplified to avoid more shader instructions.
				//	 0.06 - faster but more aliasing in darks
				//	 0.05 - default
				//	 0.04 - slower and less aliasing in darks
				// Special notes when using FXAA_GREEN_AS_LUMA,
				//	 Likely want to set this to zero.
				//	 As colors that are mostly not-green
				//	 will appear very dark in the green channel!
				//	 Tune by looking at mostly non-green content,
				//	 then start at zero and increase until aliasing is a problem.
				FxaaFloat fxaaConsoleEdgeThresholdMin,
				//
				// Extra constants for 360 FXAA Console only.
				// Use zeros or anything else for other platforms.
				// These must be in physical constant registers and NOT immediates.
				// Immediates will result in compiler un-optimizing.
				// {xyzw} = float4(1.0, -1.0, 0.25, -0.25)
				FxaaFloat4 fxaaConsole360ConstDir
		) {
		/*--------------------------------------------------------------------------*/
				FxaaFloat2 posM;
				posM.x = pos.x;
				posM.y = pos.y;
				#if (FXAA_GATHER4_ALPHA == 1)
						#if (FXAA_DISCARD == 0)
								FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);
								#if (FXAA_GREEN_AS_LUMA == 0)
										#define lumaM rgbyM.w
								#else
										#define lumaM rgbyM.y
								#endif
						#endif
						#if (FXAA_GREEN_AS_LUMA == 0)
								FxaaFloat4 luma4A = FxaaTexAlpha4(tex, posM);
								FxaaFloat4 luma4B = FxaaTexOffAlpha4(tex, posM, FxaaInt2(-1, -1));
						#else
								FxaaFloat4 luma4A = FxaaTexGreen4(tex, posM);
								FxaaFloat4 luma4B = FxaaTexOffGreen4(tex, posM, FxaaInt2(-1, -1));
						#endif
						#if (FXAA_DISCARD == 1)
								#define lumaM luma4A.w
						#endif
						#define lumaE luma4A.z
						#define lumaS luma4A.x
						#define lumaSE luma4A.y
						#define lumaNW luma4B.w
						#define lumaN luma4B.z
						#define lumaW luma4B.x
				#else
						FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);
						#if (FXAA_GREEN_AS_LUMA == 0)
								#define lumaM rgbyM.w
						#else
								#define lumaM rgbyM.y
						#endif
						#if (FXAA_GLSL_100 == 1)
							FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0, 1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 0.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0,-1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 0.0), fxaaQualityRcpFrame.xy));
						#else
							FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0, 1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0,-1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 0), fxaaQualityRcpFrame.xy));
						#endif
				#endif
		/*--------------------------------------------------------------------------*/
				FxaaFloat maxSM = max(lumaS, lumaM);
				FxaaFloat minSM = min(lumaS, lumaM);
				FxaaFloat maxESM = max(lumaE, maxSM);
				FxaaFloat minESM = min(lumaE, minSM);
				FxaaFloat maxWN = max(lumaN, lumaW);
				FxaaFloat minWN = min(lumaN, lumaW);
				FxaaFloat rangeMax = max(maxWN, maxESM);
				FxaaFloat rangeMin = min(minWN, minESM);
				FxaaFloat rangeMaxScaled = rangeMax * fxaaQualityEdgeThreshold;
				FxaaFloat range = rangeMax - rangeMin;
				FxaaFloat rangeMaxClamped = max(fxaaQualityEdgeThresholdMin, rangeMaxScaled);
				FxaaBool earlyExit = range < rangeMaxClamped;
		/*--------------------------------------------------------------------------*/
				if(earlyExit)
						#if (FXAA_DISCARD == 1)
								FxaaDiscard;
						#else
								return rgbyM;
						#endif
		/*--------------------------------------------------------------------------*/
				#if (FXAA_GATHER4_ALPHA == 0)
						#if (FXAA_GLSL_100 == 1)
							FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0,-1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0,-1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 1.0), fxaaQualityRcpFrame.xy));
						#else
							FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1,-1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1,-1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));
						#endif
				#else
						FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(1, -1), fxaaQualityRcpFrame.xy));
						FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));
				#endif
		/*--------------------------------------------------------------------------*/
				FxaaFloat lumaNS = lumaN + lumaS;
				FxaaFloat lumaWE = lumaW + lumaE;
				FxaaFloat subpixRcpRange = 1.0/range;
				FxaaFloat subpixNSWE = lumaNS + lumaWE;
				FxaaFloat edgeHorz1 = (-2.0 * lumaM) + lumaNS;
				FxaaFloat edgeVert1 = (-2.0 * lumaM) + lumaWE;
		/*--------------------------------------------------------------------------*/
				FxaaFloat lumaNESE = lumaNE + lumaSE;
				FxaaFloat lumaNWNE = lumaNW + lumaNE;
				FxaaFloat edgeHorz2 = (-2.0 * lumaE) + lumaNESE;
				FxaaFloat edgeVert2 = (-2.0 * lumaN) + lumaNWNE;
		/*--------------------------------------------------------------------------*/
				FxaaFloat lumaNWSW = lumaNW + lumaSW;
				FxaaFloat lumaSWSE = lumaSW + lumaSE;
				FxaaFloat edgeHorz4 = (abs(edgeHorz1) * 2.0) + abs(edgeHorz2);
				FxaaFloat edgeVert4 = (abs(edgeVert1) * 2.0) + abs(edgeVert2);
				FxaaFloat edgeHorz3 = (-2.0 * lumaW) + lumaNWSW;
				FxaaFloat edgeVert3 = (-2.0 * lumaS) + lumaSWSE;
				FxaaFloat edgeHorz = abs(edgeHorz3) + edgeHorz4;
				FxaaFloat edgeVert = abs(edgeVert3) + edgeVert4;
		/*--------------------------------------------------------------------------*/
				FxaaFloat subpixNWSWNESE = lumaNWSW + lumaNESE;
				FxaaFloat lengthSign = fxaaQualityRcpFrame.x;
				FxaaBool horzSpan = edgeHorz >= edgeVert;
				FxaaFloat subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;
		/*--------------------------------------------------------------------------*/
				if(!horzSpan) lumaN = lumaW;
				if(!horzSpan) lumaS = lumaE;
				if(horzSpan) lengthSign = fxaaQualityRcpFrame.y;
				FxaaFloat subpixB = (subpixA * (1.0/12.0)) - lumaM;
		/*--------------------------------------------------------------------------*/
				FxaaFloat gradientN = lumaN - lumaM;
				FxaaFloat gradientS = lumaS - lumaM;
				FxaaFloat lumaNN = lumaN + lumaM;
				FxaaFloat lumaSS = lumaS + lumaM;
				FxaaBool pairN = abs(gradientN) >= abs(gradientS);
				FxaaFloat gradient = max(abs(gradientN), abs(gradientS));
				if(pairN) lengthSign = -lengthSign;
				FxaaFloat subpixC = FxaaSat(abs(subpixB) * subpixRcpRange);
		/*--------------------------------------------------------------------------*/
				FxaaFloat2 posB;
				posB.x = posM.x;
				posB.y = posM.y;
				FxaaFloat2 offNP;
				offNP.x = (!horzSpan) ? 0.0 : fxaaQualityRcpFrame.x;
				offNP.y = ( horzSpan) ? 0.0 : fxaaQualityRcpFrame.y;
				if(!horzSpan) posB.x += lengthSign * 0.5;
				if( horzSpan) posB.y += lengthSign * 0.5;
		/*--------------------------------------------------------------------------*/
				FxaaFloat2 posN;
				posN.x = posB.x - offNP.x * FXAA_QUALITY_P0;
				posN.y = posB.y - offNP.y * FXAA_QUALITY_P0;
				FxaaFloat2 posP;
				posP.x = posB.x + offNP.x * FXAA_QUALITY_P0;
				posP.y = posB.y + offNP.y * FXAA_QUALITY_P0;
				FxaaFloat subpixD = ((-2.0)*subpixC) + 3.0;
				FxaaFloat lumaEndN = FxaaLuma(FxaaTexTop(tex, posN));
				FxaaFloat subpixE = subpixC * subpixC;
				FxaaFloat lumaEndP = FxaaLuma(FxaaTexTop(tex, posP));
		/*--------------------------------------------------------------------------*/
				if(!pairN) lumaNN = lumaSS;
				FxaaFloat gradientScaled = gradient * 1.0/4.0;
				FxaaFloat lumaMM = lumaM - lumaNN * 0.5;
				FxaaFloat subpixF = subpixD * subpixE;
				FxaaBool lumaMLTZero = lumaMM < 0.0;
		/*--------------------------------------------------------------------------*/
				lumaEndN -= lumaNN * 0.5;
				lumaEndP -= lumaNN * 0.5;
				FxaaBool doneN = abs(lumaEndN) >= gradientScaled;
				FxaaBool doneP = abs(lumaEndP) >= gradientScaled;
				if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P1;
				if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P1;
				FxaaBool doneNP = (!doneN) || (!doneP);
				if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P1;
				if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P1;
		/*--------------------------------------------------------------------------*/
				if(doneNP) {
						if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
						if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
						if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
						if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
						doneN = abs(lumaEndN) >= gradientScaled;
						doneP = abs(lumaEndP) >= gradientScaled;
						if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P2;
						if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P2;
						doneNP = (!doneN) || (!doneP);
						if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P2;
						if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P2;
		/*--------------------------------------------------------------------------*/
						#if (FXAA_QUALITY_PS > 3)
						if(doneNP) {
								if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
								if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
								if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
								if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
								doneN = abs(lumaEndN) >= gradientScaled;
								doneP = abs(lumaEndP) >= gradientScaled;
								if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P3;
								if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P3;
								doneNP = (!doneN) || (!doneP);
								if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P3;
								if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P3;
		/*--------------------------------------------------------------------------*/
								#if (FXAA_QUALITY_PS > 4)
								if(doneNP) {
										if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
										if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
										if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
										if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
										doneN = abs(lumaEndN) >= gradientScaled;
										doneP = abs(lumaEndP) >= gradientScaled;
										if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P4;
										if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P4;
										doneNP = (!doneN) || (!doneP);
										if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P4;
										if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P4;
		/*--------------------------------------------------------------------------*/
										#if (FXAA_QUALITY_PS > 5)
										if(doneNP) {
												if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
												if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
												if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
												if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
												doneN = abs(lumaEndN) >= gradientScaled;
												doneP = abs(lumaEndP) >= gradientScaled;
												if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P5;
												if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P5;
												doneNP = (!doneN) || (!doneP);
												if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P5;
												if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P5;
		/*--------------------------------------------------------------------------*/
												#if (FXAA_QUALITY_PS > 6)
												if(doneNP) {
														if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
														if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
														if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
														if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
														doneN = abs(lumaEndN) >= gradientScaled;
														doneP = abs(lumaEndP) >= gradientScaled;
														if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P6;
														if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P6;
														doneNP = (!doneN) || (!doneP);
														if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P6;
														if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P6;
		/*--------------------------------------------------------------------------*/
														#if (FXAA_QUALITY_PS > 7)
														if(doneNP) {
																if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
																if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
																if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
																if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
																doneN = abs(lumaEndN) >= gradientScaled;
																doneP = abs(lumaEndP) >= gradientScaled;
																if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P7;
																if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P7;
																doneNP = (!doneN) || (!doneP);
																if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P7;
																if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P7;
		/*--------------------------------------------------------------------------*/
				#if (FXAA_QUALITY_PS > 8)
				if(doneNP) {
						if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
						if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
						if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
						if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
						doneN = abs(lumaEndN) >= gradientScaled;
						doneP = abs(lumaEndP) >= gradientScaled;
						if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P8;
						if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P8;
						doneNP = (!doneN) || (!doneP);
						if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P8;
						if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P8;
		/*--------------------------------------------------------------------------*/
						#if (FXAA_QUALITY_PS > 9)
						if(doneNP) {
								if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
								if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
								if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
								if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
								doneN = abs(lumaEndN) >= gradientScaled;
								doneP = abs(lumaEndP) >= gradientScaled;
								if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P9;
								if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P9;
								doneNP = (!doneN) || (!doneP);
								if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P9;
								if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P9;
		/*--------------------------------------------------------------------------*/
								#if (FXAA_QUALITY_PS > 10)
								if(doneNP) {
										if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
										if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
										if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
										if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
										doneN = abs(lumaEndN) >= gradientScaled;
										doneP = abs(lumaEndP) >= gradientScaled;
										if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P10;
										if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P10;
										doneNP = (!doneN) || (!doneP);
										if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P10;
										if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P10;
		/*--------------------------------------------------------------------------*/
										#if (FXAA_QUALITY_PS > 11)
										if(doneNP) {
												if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
												if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
												if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
												if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
												doneN = abs(lumaEndN) >= gradientScaled;
												doneP = abs(lumaEndP) >= gradientScaled;
												if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P11;
												if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P11;
												doneNP = (!doneN) || (!doneP);
												if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P11;
												if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P11;
		/*--------------------------------------------------------------------------*/
												#if (FXAA_QUALITY_PS > 12)
												if(doneNP) {
														if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
														if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
														if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
														if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
														doneN = abs(lumaEndN) >= gradientScaled;
														doneP = abs(lumaEndP) >= gradientScaled;
														if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P12;
														if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P12;
														doneNP = (!doneN) || (!doneP);
														if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P12;
														if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P12;
		/*--------------------------------------------------------------------------*/
												}
												#endif
		/*--------------------------------------------------------------------------*/
										}
										#endif
		/*--------------------------------------------------------------------------*/
								}
								#endif
		/*--------------------------------------------------------------------------*/
						}
						#endif
		/*--------------------------------------------------------------------------*/
				}
				#endif
		/*--------------------------------------------------------------------------*/
														}
														#endif
		/*--------------------------------------------------------------------------*/
												}
												#endif
		/*--------------------------------------------------------------------------*/
										}
										#endif
		/*--------------------------------------------------------------------------*/
								}
								#endif
		/*--------------------------------------------------------------------------*/
						}
						#endif
		/*--------------------------------------------------------------------------*/
				}
		/*--------------------------------------------------------------------------*/
				FxaaFloat dstN = posM.x - posN.x;
				FxaaFloat dstP = posP.x - posM.x;
				if(!horzSpan) dstN = posM.y - posN.y;
				if(!horzSpan) dstP = posP.y - posM.y;
		/*--------------------------------------------------------------------------*/
				FxaaBool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;
				FxaaFloat spanLength = (dstP + dstN);
				FxaaBool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;
				FxaaFloat spanLengthRcp = 1.0/spanLength;
		/*--------------------------------------------------------------------------*/
				FxaaBool directionN = dstN < dstP;
				FxaaFloat dst = min(dstN, dstP);
				FxaaBool goodSpan = directionN ? goodSpanN : goodSpanP;
				FxaaFloat subpixG = subpixF * subpixF;
				FxaaFloat pixelOffset = (dst * (-spanLengthRcp)) + 0.5;
				FxaaFloat subpixH = subpixG * fxaaQualitySubpix;
		/*--------------------------------------------------------------------------*/
				FxaaFloat pixelOffsetGood = goodSpan ? pixelOffset : 0.0;
				FxaaFloat pixelOffsetSubpix = max(pixelOffsetGood, subpixH);
				if(!horzSpan) posM.x += pixelOffsetSubpix * lengthSign;
				if( horzSpan) posM.y += pixelOffsetSubpix * lengthSign;
				#if (FXAA_DISCARD == 1)
						return FxaaTexTop(tex, posM);
				#else
						return FxaaFloat4(FxaaTexTop(tex, posM).xyz, lumaM);
				#endif
		}
		/*==========================================================================*/
		#endif

		void main() {
			gl_FragColor = FxaaPixelShader(
				vUv,
				vec4(0.0),
				tDiffuse,
				tDiffuse,
				tDiffuse,
				resolution,
				vec4(0.0),
				vec4(0.0),
				vec4(0.0),
				0.75,
				0.166,
				0.0833,
				0.0,
				0.0,
				0.0,
				vec4(0.0)
			);

			// TODO avoid querying texture twice for same texel
			gl_FragColor.a = texture2D(tDiffuse, vUv).a;
		}`

});

class Control {
    constructor(camera, element) {
        this.transformed = new Event();
        this.controlsActivated = new Event();
        this.core = new TransformControls(camera, element);
        this.helper = new THREE.Object3D();
        let transform = new THREE.Matrix4();
        this.core.attach(this.helper);
        this.core.addEventListener("dragging-changed", () => {
            this.controlsActivated.trigger();
        });
        this.core.addEventListener("change", () => {
            this.helper.updateMatrix();
            const temp = this.helper.matrix.clone();
            temp.multiply(transform.invert());
            this.transformed.trigger(temp);
            transform = this.helper.matrix.clone();
        });
    }
    get items() {
        return [this.helper, this.core];
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
     * The list of ids of the {@link list} of items.
     */
    get ids() {
        const ids = [];
        for (const id in this.list) {
            ids.push(this.list[id].id);
        }
        return ids;
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
}

class Vertices extends Primitive {
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
     * @param ids the vertices to edit.
     * @param coordinates the new coordinates for the vertex.
     */
    set(ids, coordinates) {
        const [x, y, z] = coordinates;
        for (const id of ids) {
            const index = this.idMap.getIndex(id);
            if (index === null)
                return;
            this._positionBuffer.setXYZ(index, x, y, z);
        }
        this._positionBuffer.needsUpdate = true;
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
     * @param matrix Transformation matrix to apply.
     * @param ids IDs of the vertices to transform.
     */
    transform(matrix, ids = this.selected.data) {
        const vector = new THREE.Vector3();
        for (const id of ids) {
            const index = this.idMap.getIndex(id);
            if (index === null)
                continue;
            const x = this._positionBuffer.getX(index);
            const y = this._positionBuffer.getY(index);
            const z = this._positionBuffer.getZ(index);
            vector.set(x, y, z);
            vector.applyMatrix4(matrix);
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
        this.setupAttributes();
    }
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
    /**
     * Quickly removes all the lines and releases all the memory used.
     */
    clear() {
        this.selected.data.clear();
        this.mesh.geometry.dispose();
        this.mesh.geometry = new THREE.BufferGeometry();
        this.setupAttributes();
        this.vertices.clear();
        this.idMap.reset();
        this.list = {};
        this.points = {};
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
        const line = this.list[id];
        const start = this.vertices.get(line.start);
        const end = this.vertices.get(line.end);
        if (!start || !end)
            return null;
        return [start, end];
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
        return ids;
    }
    /**
     * Select or unselects the given lines.
     * @param active Whether to select or unselect.
     * @param ids List of lines IDs to select or unselect. If not
     * defined, all lines will be selected or deselected.
     */
    select(active, ids = this.ids) {
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
    /**
     * Sets a point of the line to a specific position.
     * @param id The point whose position to set.
     * @param coordinates The new coordinates of the point.
     */
    setPoint(id, coordinates) {
        const indices = new Set();
        this.getPointIndices(id, indices);
        this.setLines(coordinates, indices);
        this.vertices.set([id], coordinates);
    }
    transform(matrix) {
        const indices = new Set();
        const points = new Set();
        for (const id of this.vertices.selected.data) {
            points.add(id);
            this.getPointIndices(id, indices);
        }
        this.transformLines(matrix, indices);
        this.vertices.transform(matrix, points);
    }
    getPointIndices(id, indices) {
        const point = this.points[id];
        for (const id of point.start) {
            const index = this.idMap.getIndex(id);
            if (index === null) {
                continue;
            }
            indices.add(index * 2);
        }
        for (const id of point.end) {
            const index = this.idMap.getIndex(id);
            if (index === null) {
                continue;
            }
            indices.add(index * 2 + 1);
        }
    }
    setupAttributes() {
        this._buffers.createAttribute("position");
        this._buffers.createAttribute("color");
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
    setLines(coords, indices) {
        const [x, y, z] = coords;
        for (const index of indices) {
            this._positionBuffer.setXYZ(index, x, y, z);
        }
        this._positionBuffer.needsUpdate = true;
    }
    updateColor(ids = this.ids) {
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
    constructor() {
        super();
        /** {@link Primitive.mesh } */
        this.mesh = new THREE.Mesh();
        /**
         * The list of points that define the faces. Each point corresponds to a set of {@link Vertices}. This way,
         * we can provide an API of faces that share vertices, but under the hood the vertices are duplicated per face
         * (and thus being able to contain the normals as a vertex attribute).
         */
        this.points = {};
        /**
         * The list of faces. Each face is defined by a list of outer points.
         */
        this.list = {};
        /**
         * The geometric representation of the vertices that define this instance of faces.
         */
        this.vertices = new Vertices();
        /**
         * The list of selected {@link points}.
         */
        this.selectedPoints = new Selector();
        this._vertexFaceMap = new Map();
        this._faceIdGenerator = 0;
        this._pointIdGenerator = 0;
        this._holeIdGenerator = 0;
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
        this.updateBuffers();
    }
    /**
     * The color of all the points.
     */
    set baseColor(color) {
        super.baseColor = color;
        const unselected = this.selected.getUnselected(this.ids);
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
    /**
     * Quickly removes all the faces and releases all the memory used.
     */
    clear() {
        this.selected.data.clear();
        this.selectedPoints.data.clear();
        this.mesh.geometry.setIndex([]);
        this.vertices.clear();
        this.updateBuffers();
        this.list = {};
        this.points = {};
        this._faceIdGenerator = 0;
        this._pointIdGenerator = 0;
        this._holeIdGenerator = 0;
    }
    /**
     * Adds a face.
     * @param ids - the IDs of the {@link points} that define that face. It's assumed that they are coplanar.
     * @param holesPointsIDs - the IDs of the {@link points} that define the holes.
     */
    add(ids, holesPointsIDs = []) {
        const id = this._faceIdGenerator++;
        // Add face references to points
        for (const pointID of ids) {
            const point = this.points[pointID];
            point.faces.add(id);
        }
        const holes = {};
        for (const pointIDs of holesPointsIDs) {
            const id = this._holeIdGenerator++;
            const points = new Set(pointIDs);
            holes[id] = { id, points };
            for (const pointID of pointIDs) {
                const point = this.points[pointID];
                point.faces.add(id);
            }
        }
        const face = {
            id,
            holes,
            vertices: new Set(),
            points: new Set(ids),
        };
        // Create face vertices
        const coordinates = [];
        for (const pointID of face.points) {
            this.saveCoordinates(pointID, coordinates, face);
        }
        let holesCounter = coordinates.length / 3;
        const holeIndices = [];
        for (const holeID in face.holes) {
            holeIndices.push(holesCounter);
            const hole = face.holes[holeID];
            holesCounter += hole.points.size;
            for (const pointID of hole.points) {
                this.saveCoordinates(pointID, coordinates, face);
            }
        }
        // Generate face indices
        const allIndices = Array.from(this._index.array);
        const faceIndices = this.triangulate(coordinates, holeIndices);
        let offset = 0;
        for (const index of allIndices) {
            if (index >= offset)
                offset = index + 1;
        }
        for (const faceIndex of faceIndices) {
            const absoluteIndex = faceIndex + offset;
            allIndices.push(absoluteIndex);
        }
        this.mesh.geometry.setIndex(allIndices);
        this.list[id] = face;
        this.updateBuffers();
        this.updateColor([id]);
        // this.computeNormal([id]);
        this.mesh.geometry.computeVertexNormals();
        this.mesh.geometry.computeBoundingSphere();
        this.mesh.geometry.computeBoundingBox();
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
            if (face === undefined)
                continue;
            for (const vertex of face.vertices) {
                verticesToRemove.add(vertex);
                this._vertexFaceMap.delete(vertex);
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
    select(active, ids = this.ids) {
        const idsToUpdate = this.selected.select(active, ids, this.ids);
        this.updateColor(idsToUpdate);
        const points = [];
        for (const id of ids) {
            const face = this.list[id];
            if (face) {
                points.push(...face.points);
                for (const holeID in face.holes) {
                    const hole = face.holes[holeID];
                    points.push(...hole.points);
                }
            }
        }
        this.selectPoints(active, points);
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
    /**
     * Sets a point of the face to a specific position.
     * @param id The point whose position to set.
     * @param coordinates The new coordinates of the point.
     */
    setPoint(id, coordinates) {
        const point = this.points[id];
        if (point === undefined)
            return;
        point.coordinates = coordinates;
        this.vertices.set(point.vertices, coordinates);
    }
    /**
     * Applies a transformation to the selected vertices.
     * @param matrix Transformation matrix to apply.
     */
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
    /**
     * Given a face index, returns the face ID.
     * @param faceIndex The index of the face whose ID to get.
     */
    getFromIndex(faceIndex) {
        const vertexIndex = this._index.array[faceIndex * 3];
        const vertexID = this.vertices.idMap.getId(vertexIndex);
        return this._vertexFaceMap.get(vertexID);
    }
    /**
     * Gets the center point of a face.
     * @param id The face whose center to get.
     */
    getCenter(id) {
        const face = this.list[id];
        if (!face)
            return null;
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        for (const pointID of face.points) {
            const point = this.points[pointID];
            const [x, y, z] = point.coordinates;
            sumX += x;
            sumY += y;
            sumZ += z;
        }
        const size = face.points.size;
        return [sumX / size, sumY / size, sumZ / size];
    }
    /**
     * Gets the normalVector of a face.
     * @param id The face whose normal vector to get.
     */
    getNormal(id) {
        const face = this.list[id];
        const firstVertex = Array.from(face.vertices)[0];
        const index = this.vertices.idMap.getIndex(firstVertex);
        if (index === null)
            return null;
        const normal = this.vertices.mesh.geometry.attributes.normal;
        const x = normal.getX(index);
        const y = normal.getY(index);
        const z = normal.getZ(index);
        return [x, y, z];
    }
    saveCoordinates(pointID, coordinates, face) {
        const point = this.points[pointID];
        coordinates.push(...point.coordinates);
        const [id] = this.vertices.add([point.coordinates]);
        this._vertexFaceMap.set(id, face.id);
        point.vertices.add(id);
        face.vertices.add(id);
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
    updateColor(ids = this.ids) {
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
    triangulate(coordinates, holesIndices) {
        // Earcut only supports 2d triangulations, so let's project the face
        // into the cartesian plane that is more parallel to the face
        const dim = this.getProjectionDimension(coordinates);
        const projectedCoords = [];
        for (let i = 0; i < coordinates.length; i++) {
            if (i % 3 !== dim) {
                projectedCoords.push(coordinates[i]);
            }
        }
        return earcut$1.exports(projectedCoords, holesIndices, 2);
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
        // An axis that goes from A to B will define an OffsetFace like this. The
        // positive offset direction goes up.
        //       p2  +-------------------------------------------+ p3
        //          |                                           |
        //       A +-------------------------------------------+ B
        //        |                                           |
        //    p1 +-------------------------------------------+ p4
        /**
         * The list of axis. Points are p1, p2, p3, p4
         */
        this.list = {};
        /**
         * A knot is the encounter of multiple OffsetFaces at a point. It's made of
         * a point and, optionally, an extra face to fill the gap (if there are more
         * than 3 OffsetFaces).
         */
        this.knots = {};
        this.mesh = this.faces.mesh;
    }
    get knotsIDs() {
        const ids = [];
        for (const id in this.knots) {
            const idNumber = parseInt(id, 10);
            ids.push(idNumber);
        }
        return ids;
    }
    /**
     * Adds a new set of axes to this instance of OffsetFaces.
     * @param ids the ids of the points that define the axes ({@link Lines}).
     * @param width the width of the faces.
     * @param offset the offset of the faces to their respective axis.
     *
     */
    add(ids, width, offset = 0) {
        const linesIDs = this.lines.add(ids);
        const knotsToUpdate = new Set();
        for (const id of linesIDs) {
            this.list[id] = { id, width, offset, face: 0, points: [] };
            const result = this.getFacePoints(id, knotsToUpdate);
            if (result === null)
                continue;
            const points = this.faces.addPoints(result);
            this.list[id].points = points;
            this.list[id].face = this.faces.add(points);
        }
        this.updateKnots(knotsToUpdate);
        return linesIDs;
    }
    /**
     * Select or unselects the given OffsetFaces.
     * @param active Whether to select or unselect.
     * @param ids List of OffsetFaces IDs to select or unselect. If not
     * defined, all lines will be selected or deselected.
     */
    select(active, ids = this.ids) {
        const faces = [];
        for (const id of ids) {
            const item = this.list[id];
            if (item) {
                faces.push(item.face);
            }
        }
        this.faces.select(active, faces);
        this.lines.select(active, ids);
    }
    /**
     * Select or unselects the given knots.
     * @param active Whether to select or unselect.
     * @param ids List of knot IDs to select or unselect. If not
     * defined, all knots will be selected or deselected.
     */
    selectKnots(active, ids = this.knotsIDs) {
        const points = [];
        const faces = [];
        for (const id of ids) {
            const face = this.knots[id];
            if (face === undefined)
                continue;
            points.push(id);
            if (face !== null) {
                faces.push(face);
            }
        }
        this.lines.selectPoints(active, points);
        this.faces.select(active, faces);
    }
    /**
     * Removes OffsetFaces.
     * @param ids List of OffsetFaces to remove. If no face is specified,
     * removes all the selected OffsetFaces.
     */
    remove(ids = this.lines.selected.data) {
        const relatedKnots = this.getRelatedKnots(ids);
        const facePoints = [];
        for (const id of ids) {
            facePoints.push(...this.list[id].points);
            delete this.list[id];
        }
        this.faces.removePoints(facePoints);
        const linesToUpdate = this.getRelatedLines(relatedKnots);
        this.lines.remove(ids);
        this.updateOffsetFaces(linesToUpdate);
    }
    /**
     * Removes Knots and all the related OffsetFaces.
     * @param ids List of knots to remove. If no knot is specified,
     * removes all the selected knots.
     */
    removePoints(ids = this.lines.vertices.selected.data) {
        const pointsToRemove = new Set();
        const knotFacesToRemove = new Set();
        for (const id of ids) {
            pointsToRemove.add(id);
            const face = this.knots[id];
            if (face !== null && face !== undefined) {
                knotFacesToRemove.add(face);
            }
            delete this.knots[id];
        }
        this.faces.remove(knotFacesToRemove);
        const offsetFacesToRemove = this.getRelatedLines(ids);
        this.remove(offsetFacesToRemove);
        this.lines.removePoints(pointsToRemove);
    }
    /**
     * Sets the offset of the specified OffsetFaces.
     * @param offset The offset to set.
     * @param ids List of knot IDs whose offset to change. If not specified,
     * it will change the offset of the selected OffsetFaces.
     */
    setOffset(offset, ids = this.lines.selected.data) {
        for (const id of ids) {
            const offsetFace = this.list[id];
            offsetFace.offset = offset;
        }
        this.updateOffsetFaces(ids);
    }
    /**
     * Sets the width of the specified OffsetFaces.
     * @param width The width to set.
     * @param ids List of knot IDs whose width to change. If not specified,
     * it will change the width of the selected OffsetFaces.
     */
    setWidth(width, ids = this.lines.selected.data) {
        for (const id of ids) {
            const offsetFace = this.list[id];
            offsetFace.width = width;
        }
        this.updateOffsetFaces(ids);
    }
    /**
     * Applies a transformation to the selected vertices.
     * @param matrix Transformation matrix to apply.
     */
    transform(matrix) {
        this.lines.transform(matrix);
        const selectedPoints = this.lines.vertices.selected.data;
        const linesToUpdate = this.getRelatedLines(selectedPoints);
        this.updateOffsetFaces(linesToUpdate);
    }
    getRelatedKnots(lineIDs) {
        const relatedKnots = new Set();
        for (const id of lineIDs) {
            const line = this.lines.list[id];
            relatedKnots.add(line.start);
            relatedKnots.add(line.end);
        }
        return relatedKnots;
    }
    getRelatedLines(pointIDs, neighbors = false) {
        const linesToUpdate = new Set();
        this.getLinesOfPoints(pointIDs, linesToUpdate);
        if (neighbors) {
            const neighborPoints = new Set();
            for (const lineID of linesToUpdate) {
                const line = this.lines.list[lineID];
                neighborPoints.add(line.start);
                neighborPoints.add(line.end);
            }
            this.getLinesOfPoints(neighborPoints, linesToUpdate);
        }
        return linesToUpdate;
    }
    getLinesOfPoints(pointIDs, lines) {
        for (const id of pointIDs) {
            const point = this.lines.points[id];
            for (const lineID of point.start) {
                lines.add(lineID);
            }
            for (const lineID of point.end) {
                lines.add(lineID);
            }
        }
    }
    getFacePoints(id, knots) {
        const offsetFace = this.list[id];
        if (!offsetFace)
            return null;
        const line = this.lines.list[id];
        const start = this.lines.vertices.get(line.start);
        const end = this.lines.vertices.get(line.end);
        if (!start || !end)
            return null;
        knots.add(line.start);
        knots.add(line.end);
        const rawDirection = Vector.subtract(end, start);
        const direction = Vector.normalize(rawDirection);
        const { width, offset } = offsetFace;
        const normal = Vector.multiply(Vector.up, direction);
        const scaledNormal = Vector.multiplyScalar(normal, width / 2);
        const invScaledNormal = Vector.multiplyScalar(scaledNormal, -1);
        const offsetDirection = Vector.multiplyScalar(normal, offset);
        const p1 = Vector.add(start, scaledNormal, offsetDirection);
        const p2 = Vector.add(start, invScaledNormal, offsetDirection);
        const p3 = Vector.add(end, invScaledNormal, offsetDirection);
        const p4 = Vector.add(end, scaledNormal, offsetDirection);
        return [p1, p2, p3, p4];
    }
    updateOffsetFaces(ids) {
        const knotsToUpdate = new Set();
        for (const id of ids) {
            const offsetFace = this.list[id];
            if (offsetFace === undefined)
                continue;
            const result = this.getFacePoints(id, knotsToUpdate);
            if (result === null)
                continue;
            for (let i = 0; i < 4; i++) {
                const pointID = offsetFace.points[i];
                const coordinates = result[i];
                this.faces.setPoint(pointID, coordinates);
            }
        }
        this.updateKnots(knotsToUpdate);
    }
    updateKnots(ids) {
        for (const id of ids) {
            const point = this.lines.points[id];
            const coords = this.lines.vertices.get(id);
            if (coords === null)
                continue;
            const knotFace = this.knots[id];
            if (knotFace !== undefined && knotFace !== null) {
                const points = this.faces.list[knotFace].points;
                this.faces.removePoints(points);
                this.knots[id] = null;
            }
            if (point.start.size + point.end.size === 1) {
                continue;
            }
            // Strategy: traverse all points, sort lines by angle and find the intersection
            // of each outer line with the next one
            const vectors = this.getNormalVectorsSortedClockwise(id);
            if (vectors.length === 1) {
                continue;
            }
            const intersectionPoints = [];
            for (let i = 0; i < vectors.length; i++) {
                const currentLine = vectors[i];
                const currentVector = currentLine.vector;
                const currentOffsetFace = this.list[currentLine.lineID];
                const isCurrentStart = point.start.has(currentLine.lineID);
                const { width, offset } = currentOffsetFace;
                // If it's the last vector, the next one is the first one
                const isLastVector = i === vectors.length - 1;
                const j = isLastVector ? 0 : i + 1;
                const nextLine = vectors[j];
                const nextVector = nextLine.vector;
                const nextOffsetFace = this.list[nextLine.lineID];
                const isNextStart = point.start.has(nextLine.lineID);
                const nextWidth = nextOffsetFace.width;
                const nextOffset = nextOffsetFace.offset;
                // Express the outlines as a point and a direction
                // Beware the right-handed system for the direction
                const n1 = Vector.multiply(Vector.up, currentVector);
                const o1 = isCurrentStart ? -offset : offset;
                const v1 = Vector.multiplyScalar(n1, width / 2 + o1);
                const p1 = Vector.add(coords, v1);
                const n2 = Vector.multiply(nextVector, Vector.up);
                const o2 = isNextStart ? nextOffset : -nextOffset;
                const v2 = Vector.multiplyScalar(n2, nextWidth / 2 + o2);
                const p2 = Vector.add(coords, v2);
                const r1 = Vector.round(n1);
                const r2 = Vector.round(n2);
                const areLinesParallel = r1[0] === r2[0] && r1[2] === r2[2];
                const currentIndex = isCurrentStart ? 1 : 3;
                const currentPoint = currentOffsetFace.points[currentIndex];
                const nextIndex = isNextStart ? 0 : 2;
                const nextPoint = nextOffsetFace.points[nextIndex];
                if (areLinesParallel) {
                    this.faces.setPoint(currentPoint, p1);
                    this.faces.setPoint(nextPoint, p2);
                    const pr1 = Vector.round(p1);
                    const pr2 = Vector.round(p2);
                    const areSamePoint = pr1[0] === pr2[0] && pr1[2] === pr2[2];
                    intersectionPoints.push(p1);
                    if (!areSamePoint) {
                        intersectionPoints.push(p2);
                    }
                }
                else {
                    // Convert point-direction to implicit 2D line ax + by = d
                    // Although in our case we use z instead of y
                    // p . n = d
                    const a1 = n1[0];
                    const b1 = n1[2];
                    const d1 = p1[0] * n1[0] + p1[2] * n1[2];
                    const a2 = n2[0];
                    const b2 = n2[2];
                    const d2 = p2[0] * n2[0] + p2[2] * n2[2];
                    const x = (b2 * d1 - b1 * d2) / (a1 * b2 - a2 * b1);
                    const z = (a1 * d2 - a2 * d1) / (a1 * b2 - a2 * b1);
                    // Update the vertices of both OffsetFaces
                    this.faces.setPoint(currentPoint, [x, 0, z]);
                    this.faces.setPoint(nextPoint, [x, 0, z]);
                    intersectionPoints.push([x, 0, z]);
                }
            }
            if (intersectionPoints.length > 2) {
                // if (Polygon.isConvex(intersectionPoints)) {
                intersectionPoints.reverse();
                // }
                const pointsIDs = this.faces.addPoints(intersectionPoints);
                this.knots[id] = this.faces.add(pointsIDs);
            }
        }
    }
    getNormalVectorsSortedClockwise(id) {
        const vectors = [];
        const point = this.lines.points[id];
        this.getAllNormalizedVectors(vectors, point.start, false);
        this.getAllNormalizedVectors(vectors, point.end, true);
        return this.order2DVectorsClockwise(vectors);
    }
    order2DVectorsClockwise(vectors) {
        const vectorsWithAngles = [];
        for (const line of vectors) {
            const { vector } = line;
            let angle = Math.atan2(vector[0], vector[2]);
            if (angle < 0)
                angle += 2 * Math.PI;
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
            let vector = Vector.subtract(start, end);
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
         * The geometric representation of the faces of all the extrusions.
         */
        this.faces = new Faces();
        /**
         * The geometric representation of the lines that represent the axis.
         */
        this.lines = new Lines();
        this._faceExtrusionMap = new Map();
        this._idGenerator = 0;
        this._holeIdGenerator = 0;
        const material = new THREE.MeshLambertMaterial({
            side: THREE.DoubleSide,
            vertexColors: true,
        });
        const geometry = new THREE.BufferGeometry();
        this.mesh = new THREE.Mesh(geometry, material);
        geometry.setIndex([]);
    }
    clear() {
        this.selected.data.clear();
        this.faces.clear();
        this.lines.clear();
        this._idGenerator = 0;
        this._holeIdGenerator = 0;
        this.faces = new Faces();
        this.lines = new Lines();
        this.list = {};
    }
    add(faceID, pathID) {
        const id = this._idGenerator++;
        const newFaces = this.createExtrusion(faceID, pathID);
        if (newFaces) {
            const { topFaceID, sideFacesIDs, holes } = newFaces;
            this._faceExtrusionMap.set(topFaceID, id);
            this._faceExtrusionMap.set(faceID, id);
            for (const sideFaceID of sideFacesIDs) {
                this._faceExtrusionMap.set(sideFaceID, id);
            }
            this.list[id] = {
                id,
                holes,
                baseFace: faceID,
                path: pathID,
                topFace: topFaceID,
                sideFaces: sideFacesIDs,
            };
        }
        return id;
    }
    /**
     * Removes Extrusions.
     * @param ids List of extrusions to remove. If no face is specified,
     * removes all the selected extrusions.
     */
    remove(ids = this.selected.data) {
        const faces = [];
        for (const id of ids) {
            const { topFace, baseFace, sideFaces, holes } = this.list[id];
            faces.push(topFace);
            faces.push(baseFace);
            faces.push(...sideFaces);
            for (const holeID in holes) {
                const hole = holes[holeID];
                faces.push(...hole.faces);
            }
            this._faceExtrusionMap.delete(topFace);
            this._faceExtrusionMap.delete(baseFace);
            for (const sideFace of sideFaces) {
                this._faceExtrusionMap.delete(sideFace);
            }
            delete this.list[id];
        }
        const points = new Set();
        for (const faceID of faces) {
            const face = this.faces.list[faceID];
            for (const point of face.points) {
                points.add(point);
            }
        }
        this.faces.removePoints(points);
    }
    /**
     * Given a face, returns the extrusion that contains it.
     * @param faceID The ID of the face whose extrusion to get.
     */
    getFromFace(faceID) {
        return this._faceExtrusionMap.get(faceID);
    }
    /**
     * Select or unselects the given Extrusions.
     * @param active Whether to select or unselect.
     * @param ids List of extrusion IDs to select or unselect. If not
     * defined, all extrusions will be selected or deselected.
     */
    select(active, ids) {
        const idsUndefined = ids === undefined;
        const items = idsUndefined ? this.ids : ids;
        this.selected.select(active, items, this.ids);
        const faces = [];
        for (const id of this.selected.data) {
            const extrusion = this.list[id];
            if (extrusion) {
                faces.push(extrusion.topFace);
                faces.push(extrusion.baseFace);
                faces.push(...extrusion.sideFaces);
                for (const holeID in extrusion.holes) {
                    const hole = extrusion.holes[holeID];
                    faces.push(...hole.faces);
                }
            }
        }
        const selected = idsUndefined ? undefined : faces;
        this.faces.select(active, selected);
    }
    createExtrusion(faceID, pathID) {
        const linePoints = this.lines.get(pathID);
        if (!linePoints)
            return null;
        const [start, end] = linePoints;
        const vector = Vector.subtract(start, end);
        const baseFace = this.faces.list[faceID];
        // Create top face
        const topFacePoints = [];
        const holesCoordinates = [];
        for (const pointID of baseFace.points) {
            const coords = this.faces.points[pointID].coordinates;
            const transformed = Vector.add(coords, vector);
            topFacePoints.push(transformed);
        }
        for (const holeID in baseFace.holes) {
            const hole = baseFace.holes[holeID];
            const holeCoords = [];
            holesCoordinates.push(holeCoords);
            for (const pointID of hole.points) {
                const coords = this.faces.points[pointID].coordinates;
                const transformed = Vector.add(coords, vector);
                holeCoords.push(transformed);
            }
        }
        const topFacePointsIDs = this.faces.addPoints(topFacePoints);
        const topHolesPoints = [];
        for (const hole of holesCoordinates) {
            const ids = this.faces.addPoints(hole);
            topHolesPoints.push(ids);
        }
        const topFaceID = this.faces.add(topFacePointsIDs, topHolesPoints);
        // Create side faces
        const sideFacesIDs = new Set();
        const baseFaceArray = Array.from(baseFace.points);
        this.createSideFaces(baseFaceArray, topFacePointsIDs, sideFacesIDs);
        // Define holes
        const holes = {};
        const topFace = this.faces.list[topFaceID];
        const baseHolesIDs = Object.keys(baseFace.holes);
        const topHolesIDs = Object.keys(topFace.holes);
        for (let i = 0; i < baseHolesIDs.length; i++) {
            const faces = new Set();
            const baseHole = baseFace.holes[baseHolesIDs[i]];
            const topHole = topFace.holes[topHolesIDs[i]];
            const holeID = this._holeIdGenerator++;
            holes[holeID] = { base: baseHole.id, top: topHole.id, faces };
            const holePointsIdsArray = Array.from(baseHole.points);
            const topHoleCoordsArray = Array.from(topHolesPoints[i]);
            this.createSideFaces(holePointsIdsArray, topHoleCoordsArray, faces);
        }
        return { topFaceID, sideFacesIDs, holes };
    }
    createSideFaces(base, top, faces) {
        for (let i = 0; i < base.length; i++) {
            const isLastFace = i === base.length - 1;
            const nextIndex = isLastFace ? 0 : i + 1;
            const p1 = base[i];
            const p2 = base[nextIndex];
            const p3 = top[nextIndex];
            const p4 = top[i];
            const id = this.faces.add([p1, p2, p3, p4]);
            faces.add(id);
        }
    }
}

// import { Vector3 } from "three";
// TODO: Clean up all, especially holes management
class Walls extends Primitive {
    constructor() {
        super();
        this.offsetFaces = new OffsetFaces();
        this.extrusions = new Extrusions();
        this.list = {};
        this.knots = {};
        this.holes = {};
        this._holeIdGenerator = 0;
        // TODO: Probably better to keep offsetfaces and extrusion faces separated
        this.extrusions.faces = this.offsetFaces.faces;
        this.mesh = this.extrusions.mesh;
        const heightPointsID = this.extrusions.lines.addPoints([
            [0, 0, 0],
            [0, 3, 0],
        ]);
        const [axisID] = this.extrusions.lines.add(heightPointsID);
        this.defaultAxis = axisID;
    }
    regenerate(ids = this.offsetFaces.ids) {
        this.deletePreviousExtrusions(ids);
        for (const id of ids) {
            const extrusion = this.createGeometry(id);
            if (extrusion === null)
                continue;
            const previous = this.list[id];
            const holes = previous ? previous.holes : new Set();
            this.list[id] = {
                id,
                extrusion,
                holes,
            };
        }
        const relatedKnots = this.offsetFaces.getRelatedKnots(ids);
        this.regenerateKnots(relatedKnots);
    }
    /**
     * Select or unselects the given Walls.
     * @param active Whether to select or unselect.
     * @param ids List of walls IDs to select or unselect. If not
     * defined, all lines walls be selected or deselected.
     */
    select(active, ids) {
        const idsUndefined = ids === undefined;
        const items = idsUndefined ? this.ids : ids;
        this.selected.select(active, items, this.ids);
        const extrusions = [];
        for (const id of this.selected.data) {
            const wall = this.list[id];
            if (!wall)
                continue;
            extrusions.push(wall.extrusion);
        }
        const selected = idsUndefined ? undefined : extrusions;
        this.extrusions.select(active, selected);
        this.offsetFaces.select(active, items);
    }
    /**
     * Applies a transformation to the selected geometries.
     * @param matrix Transformation matrix to apply.
     */
    transform(matrix) {
        this.offsetFaces.transform(matrix);
        this.update();
    }
    setWidth(width, ids = this.selected.data) {
        this.offsetFaces.setWidth(width, ids);
        this.update();
    }
    setOffset(offset, ids = this.selected.data) {
        this.offsetFaces.setOffset(offset, ids);
        this.update();
    }
    update() {
        const relatedPoints = new Set();
        for (const id of this.offsetFaces.lines.vertices.selected.data) {
            relatedPoints.add(id);
        }
        const updatedLines = this.offsetFaces.getRelatedLines(relatedPoints, true);
        const updatedKnots = this.offsetFaces.getRelatedKnots(updatedLines);
        for (const id of updatedKnots) {
            this.updateKnotGeometry(id);
        }
        this.updateWalls(updatedLines);
    }
    updateWalls(walls) {
        for (const id of walls) {
            const offsetFace = this.offsetFaces.list[id];
            const extrusionID = this.list[id].extrusion;
            const { baseFace, topFace } = this.extrusions.list[extrusionID];
            const faces = this.extrusions.faces;
            const offsetFaces = this.offsetFaces.faces;
            // Get new point coordinates
            const [p1, p1Top, p4Top, p4] = faces.list[baseFace].points;
            const [p2, p2Top, p3Top, p3] = faces.list[topFace].points;
            const [bp1, bp2, bp3, bp4] = offsetFace.points;
            const p1Coords = offsetFaces.points[bp1].coordinates;
            const p2Coords = offsetFaces.points[bp2].coordinates;
            const p3Coords = offsetFaces.points[bp3].coordinates;
            const p4Coords = offsetFaces.points[bp4].coordinates;
            const axis = this.getVerticalAxis();
            const p1TopCoords = Vector.add(p1Coords, axis);
            const p2TopCoords = Vector.add(p2Coords, axis);
            const p3TopCoords = Vector.add(p3Coords, axis);
            const p4TopCoords = Vector.add(p4Coords, axis);
            // Save distance from holes to p1 to keep it after transform
            const prevP1Coordinates = faces.points[p1].coordinates;
            const holes = this.holes[id];
            const distances = {};
            if (holes) {
                for (const holeID in holes) {
                    distances[holeID] = [];
                    for (const pointID of holes[holeID].basePoints) {
                        const point = faces.points[pointID].coordinates;
                        const [x, y, z] = Vector.subtract(prevP1Coordinates, point);
                        const horizontalDist = Vector.magnitude([x, 0, z]);
                        distances[holeID].push([pointID, horizontalDist, y]);
                    }
                }
            }
            // Set coordinates of base
            faces.setPoint(p1, p1Coords);
            faces.setPoint(p2, p2Coords);
            faces.setPoint(p3, p3Coords);
            faces.setPoint(p4, p4Coords);
            // Set coordinates of top
            faces.setPoint(p1Top, p1TopCoords);
            faces.setPoint(p2Top, p2TopCoords);
            faces.setPoint(p3Top, p3TopCoords);
            faces.setPoint(p4Top, p4TopCoords);
            // Set coordinates of holes in wall, maintaining distance to p1
            const direction = Vector.subtract(p1Coords, p4Coords);
            const normalDir = Vector.normalize(direction);
            const normalPerp = Vector.multiply(Vector.up, normalDir);
            const perpendicular = Vector.multiplyScalar(normalPerp, offsetFace.width);
            if (holes) {
                for (const holeID in distances) {
                    const hole = distances[holeID];
                    const topPoints = Array.from(holes[holeID].topPoints);
                    let counter = 0;
                    for (const point of hole) {
                        const [pointID, x, y] = point;
                        const horizontalVector = Vector.multiplyScalar(normalDir, x);
                        const vector = Vector.add(horizontalVector, [0, y, 0]);
                        const newPosition = Vector.add(p1Coords, vector);
                        faces.setPoint(pointID, newPosition);
                        const topPoint = topPoints[counter++];
                        const newTopPosition = Vector.add(newPosition, perpendicular);
                        faces.setPoint(topPoint, newTopPosition);
                    }
                }
            }
        }
    }
    addHole(id, holePointsIDs) {
        if (!this.holes[id]) {
            this.holes[id] = {};
        }
        for (const points of holePointsIDs) {
            const holeID = this._holeIdGenerator++;
            this.holes[id][holeID] = {
                basePoints: new Set(points),
                topPoints: new Set(),
            };
        }
    }
    deletePreviousExtrusions(ids) {
        const previousExtrusions = [];
        for (const id of ids) {
            const previous = this.list[id];
            if (previous) {
                previousExtrusions.push(previous.extrusion);
            }
        }
        this.extrusions.remove(previousExtrusions);
    }
    regenerateKnots(ids = this.offsetFaces.knotsIDs) {
        for (const knotID of ids) {
            const knot = this.offsetFaces.knots[knotID];
            if (knot === null || knot === undefined)
                continue;
            this.createKnotGeometry(knotID);
        }
    }
    createGeometry(id) {
        const offsetFace = this.offsetFaces.list[id];
        const [p1ID, p2ID, p3ID, p4ID] = offsetFace.points;
        const points = this.offsetFaces.faces.points;
        const p1 = points[p1ID].coordinates;
        const p4 = points[p4ID].coordinates;
        const vector = this.getVerticalAxis();
        const p1Top = Vector.add(p1, vector);
        const p4Top = Vector.add(p4, vector);
        const direction = Vector.subtract(p1, p4);
        const normalDirection = Vector.normalize(direction);
        const normal = Vector.multiply(Vector.up, normalDirection);
        const scaledNormal = Vector.multiplyScalar(normal, offsetFace.width);
        const p1Normal = Vector.add(p1, scaledNormal);
        const normalAxisPointsIDs = this.extrusions.lines.addPoints([p1, p1Normal]);
        const [normalAxis] = this.extrusions.lines.add(normalAxisPointsIDs);
        const pointsIDs = this.extrusions.faces.addPoints([p1, p1Top, p4Top, p4]);
        const faceHoles = this.holes[id];
        const holes = [];
        if (faceHoles) {
            for (const holeID in faceHoles) {
                const hole = faceHoles[holeID];
                const holePoints = Array.from(hole.basePoints);
                holes.push(holePoints);
            }
        }
        const faceID = this.extrusions.faces.add(pointsIDs, holes);
        const extrusionID = this.extrusions.add(faceID, normalAxis);
        const extrusion = this.extrusions.list[extrusionID];
        // Save top holes
        if (faceHoles) {
            let counter = 0;
            const topHoles = Object.values(this.extrusions.faces.list[extrusion.topFace].holes);
            for (const holeID in faceHoles) {
                const hole = topHoles[counter++];
                faceHoles[holeID].topPoints = hole.points;
            }
        }
        // Correct extrusion top to fit the OffsetFace knots
        const otherSide = this.extrusions.faces.list[extrusion.topFace];
        const otherSidePoints = Array.from(otherSide.points);
        const [extrP2, extrP2Top, extrP3Top, extrP3] = otherSidePoints;
        const p2 = points[p2ID].coordinates;
        const p3 = points[p3ID].coordinates;
        const p2Top = Vector.add(p2, vector);
        const p3Top = Vector.add(p3, vector);
        this.extrusions.faces.setPoint(extrP2, p2);
        this.extrusions.faces.setPoint(extrP3, p3);
        this.extrusions.faces.setPoint(extrP2Top, p2Top);
        this.extrusions.faces.setPoint(extrP3Top, p3Top);
        return extrusionID;
    }
    // TODO: Allow each wall to have a different vertical axis
    //  (e.g. for different heights or tilted walls)
    getVerticalAxis() {
        const line = this.extrusions.lines.get(this.defaultAxis);
        if (!line) {
            throw new Error("Wall axis not found!");
        }
        const [start, end] = line;
        return Vector.subtract(start, end);
    }
    updateKnotGeometry(knotID) {
        const baseKnot = this.offsetFaces.knots[knotID];
        if (baseKnot === null || baseKnot === undefined) {
            return;
        }
        const baseFace = this.offsetFaces.faces.list[baseKnot];
        const knot = this.knots[knotID];
        if (!knot || !knot.extrusion) {
            this.createKnotGeometry(knotID);
            console.log("knot didnt exist");
            return;
        }
        const extrudedKnot = this.extrusions.list[knot.extrusion];
        const extrudedBaseFace = this.extrusions.faces.list[extrudedKnot.baseFace];
        const extrudedTopFace = this.extrusions.faces.list[extrudedKnot.topFace];
        if (baseFace.points.size !== extrudedBaseFace.points.size) {
            this.createKnotGeometry(knotID);
            console.log("knot changed size");
            return;
        }
        const verticalAxis = this.getVerticalAxis();
        const basePointsArray = Array.from(extrudedBaseFace.points);
        const topPointsArray = Array.from(extrudedTopFace.points);
        let counter = 0;
        for (const pointID of baseFace.points) {
            const coords = this.offsetFaces.faces.points[pointID].coordinates;
            const basePointID = basePointsArray[counter];
            this.extrusions.faces.setPoint(basePointID, coords);
            const topCoords = Vector.add(coords, verticalAxis);
            const topPointID = topPointsArray[counter];
            this.extrusions.faces.setPoint(topPointID, topCoords);
            counter++;
        }
    }
    createKnotGeometry(knotID) {
        if (this.knots[knotID]) {
            const knot = this.knots[knotID];
            this.extrusions.remove([knot.extrusion]);
        }
        const knotFaceID = this.offsetFaces.knots[knotID];
        if (knotFaceID === null || knotFaceID === undefined)
            return;
        const face = this.offsetFaces.faces.list[knotFaceID];
        const points = [];
        for (const pointID of face.points) {
            const point = this.offsetFaces.faces.points[pointID];
            points.push(point.coordinates);
        }
        const pointsIDs = this.extrusions.faces.addPoints(points);
        const faceID = this.extrusions.faces.add(pointsIDs);
        const extrusion = this.extrusions.add(faceID, this.defaultAxis);
        this.knots[knotID] = {
            id: knotID,
            extrusion,
        };
    }
}

// import { Vector3 } from "three";
class Slabs extends Primitive {
    constructor() {
        super();
        this.extrusions = new Extrusions();
        this.lines = new Lines();
        this._nextIndex = 0;
        this._nextPolylineIndex = 0;
        this._extrusionSlabMap = new Map();
        this.list = {};
        this.polylines = {};
        this.mesh = this.extrusions.mesh;
    }
    /**
     * Given a face index, returns the slab ID that contains it.
     * @param faceIndex The index of the face whose slab ID to get.
     */
    getFromIndex(faceIndex) {
        const faceID = this.extrusions.faces.getFromIndex(faceIndex);
        if (faceID === undefined)
            return undefined;
        const extrusionID = this.extrusions.getFromFace(faceID);
        if (extrusionID === undefined)
            return undefined;
        return this._extrusionSlabMap.get(extrusionID);
    }
    addPolyline(lines) {
        const id = this._nextPolylineIndex++;
        this.polylines[id] = {
            id,
            lines: new Set(lines),
        };
        return id;
    }
    setPolylines(id, lines) {
        this.list[id].polylines = new Set(lines);
    }
    add(polylines, height) {
        const id = this._nextIndex++;
        const directionID = this.getDirection(height);
        this.list[id] = {
            id,
            direction: directionID,
            polylines: new Set(polylines),
            extrusion: null,
        };
        this.regenerate([id]);
    }
    remove(ids) {
        const pointsToDelete = new Set();
        for (const id of ids) {
            const slab = this.list[id];
            this.removeExtrusion(id);
            for (const line of slab.polylines) {
                const { start, end } = this.lines.list[line];
                pointsToDelete.add(start);
                pointsToDelete.add(end);
            }
        }
        this.lines.removePoints(pointsToDelete);
    }
    regenerate(ids) {
        for (const id of ids) {
            this.removeExtrusion(id);
            const slab = this.list[id];
            let outline = [];
            const holes = [];
            const outlineID = this.getOutline(id);
            for (const polyID of slab.polylines) {
                const pointIDs = this.createPoints(polyID);
                if (polyID === outlineID) {
                    outline = pointIDs;
                }
                else {
                    holes.push(pointIDs);
                }
            }
            const face = this.extrusions.faces.add(outline, holes);
            const extrusion = this.extrusions.add(face, slab.direction);
            slab.extrusion = extrusion;
            this._extrusionSlabMap.set(extrusion, id);
        }
    }
    removeExtrusion(id) {
        const slab = this.list[id];
        const extrusion = slab.extrusion;
        if (extrusion === null)
            return;
        this.extrusions.remove([extrusion]);
        this.list[id].extrusion = null;
    }
    getOutline(id) {
        const slab = this.list[id];
        let biggestSize = 0;
        let biggestPolyline = 0;
        for (const polyID of slab.polylines) {
            const size = this.getPolylineSize(polyID);
            if (size > biggestSize) {
                biggestSize = size;
                biggestPolyline = polyID;
            }
        }
        return biggestPolyline;
    }
    getPolylineSize(id) {
        const polyline = this.polylines[id];
        const max = Number.MAX_VALUE;
        const biggest = [-max, -max, -max];
        const smallest = [max, max, max];
        for (const lineID of polyline.lines) {
            const line = this.lines.list[lineID];
            const end = this.lines.vertices.get(line.end);
            if (!end)
                continue;
            if (end[0] > biggest[0])
                biggest[0] = end[0];
            if (end[1] > biggest[1])
                biggest[1] = end[1];
            if (end[2] > biggest[2])
                biggest[2] = end[2];
            if (end[0] < smallest[0])
                smallest[0] = end[0];
            if (end[1] < smallest[1])
                smallest[1] = end[1];
            if (end[2] < smallest[2])
                smallest[2] = end[2];
        }
        const x = Math.abs(biggest[0] - smallest[0]);
        const y = Math.abs(biggest[1] - smallest[1]);
        const z = Math.abs(biggest[2] - smallest[2]);
        return x + y + z;
    }
    createPoints(id) {
        const polyline = this.polylines[id];
        const points = [];
        for (const lineID of polyline.lines) {
            const line = this.lines.list[lineID];
            const end = this.lines.vertices.get(line.end);
            if (!end)
                continue;
            points.push(end);
        }
        return this.extrusions.faces.addPoints(points);
    }
    getDirection(height) {
        // TODO: Make direction normal to face
        const directionPointsIDs = this.extrusions.lines.addPoints([
            [0, 0, 0],
            [0, height, 0],
        ]);
        const [directionID] = this.extrusions.lines.add(directionPointsIDs);
        return directionID;
    }
}

class Polygons {
    constructor() {
        this.lines = new Lines();
        this.list = {};
        this._editMode = false;
        this._caster = new Raycaster();
        this._foundItems = [];
        this._isClosingPolygon = false;
        this._newPoints = [];
        this._newLines = [];
        this._firstPointID = null;
        this._nextIndex = 0;
        this.update = () => {
            this._foundItems = this._caster.cast([
                this.workPlane,
                this.lines.vertices.mesh,
            ]);
            if (this.editMode) {
                this.updateCurrentPoint();
            }
        };
        this.workPlane = this.newWorkPlane();
    }
    get items() {
        return [this.lines.mesh, this.lines.vertices.mesh, this.workPlane];
    }
    get editMode() {
        return this._editMode;
    }
    set editMode(active) {
        this.workPlane.visible = active;
        this._caster.trackMouse = active;
        this._editMode = active;
        if (active) {
            window.addEventListener("mousemove", this.update);
        }
        else {
            window.removeEventListener("mousemove", this.update);
        }
        const wasPolygonInProcess = Boolean(this._newPoints.length);
        const wasDrawingCancelled = wasPolygonInProcess && !active;
        if (wasDrawingCancelled) {
            this.cancel();
        }
    }
    set camera(camera) {
        this._caster.camera = camera;
    }
    set domElement(element) {
        this._caster.domElement = element;
    }
    add() {
        if (!this._editMode)
            return;
        if (!this._foundItems.length)
            return;
        if (this._isClosingPolygon) {
            this.finishPolygon();
            return;
        }
        const { x, y, z } = this._foundItems[0].point;
        if (!this._newPoints.length) {
            const [firstPoint] = this.lines.addPoints([[x, y, z]]);
            this._firstPointID = firstPoint;
            this._newPoints.push(firstPoint);
        }
        const previousPoint = this._newPoints[this._newPoints.length - 1];
        const [newPoint] = this.lines.addPoints([[x, y, z]]);
        this._newPoints.push(newPoint);
        const [newLine] = this.lines.add([previousPoint, newPoint]);
        this._newLines.push(newLine);
        this.lines.vertices.mesh.geometry.computeBoundingSphere();
    }
    cancel() {
        this.lines.removePoints(this._newPoints);
        this._newPoints.length = 0;
        this._newLines.length = 0;
        this._firstPointID = null;
    }
    addPolygon(lines) {
        const id = this._nextIndex++;
        this.list[id] = {
            id,
            lines: new Set(lines),
        };
        return id;
    }
    finishPolygon() {
        const last = this._newPoints.pop();
        if (last !== undefined) {
            this.lines.removePoints([last]);
        }
        this._newLines.pop();
        const lastPoint = this._newPoints[this._newPoints.length - 1];
        const firstPoint = this._newPoints[0];
        const [newLine] = this.lines.add([lastPoint, firstPoint]);
        this._newLines.push(newLine);
        this.addPolygon(this._newLines);
        this._newLines.length = 0;
        this._newPoints.length = 0;
        this._isClosingPolygon = false;
        this._firstPointID = null;
    }
    updateCurrentPoint() {
        if (!this._foundItems.length || this._firstPointID === null) {
            this._isClosingPolygon = false;
            return;
        }
        const lastIndex = this._newPoints.length - 1;
        const lastPoint = this._newPoints[lastIndex];
        let foundFirstPoint = false;
        let basePlane = null;
        const index = this.lines.vertices.idMap.getIndex(this._firstPointID);
        for (const item of this._foundItems) {
            if (item.object === this.workPlane) {
                basePlane = item;
            }
            if (item.object === this.lines.vertices.mesh && item.index === index) {
                foundFirstPoint = true;
            }
        }
        if (foundFirstPoint) {
            const coords = this.lines.vertices.get(this._firstPointID);
            if (coords) {
                const [x, y, z] = coords;
                this.lines.setPoint(lastPoint, [x, y, z]);
                this._isClosingPolygon = true;
                return;
            }
        }
        else if (basePlane) {
            const { x, y, z } = basePlane.point;
            this.lines.setPoint(lastPoint, [x, y, z]);
        }
        this._isClosingPolygon = false;
    }
    newWorkPlane() {
        const floorPlaneGeom = new THREE.PlaneGeometry(10, 10);
        const floorPlaneMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.7,
            color: 0xc4adef,
        });
        const plane = new THREE.Mesh(floorPlaneGeom, floorPlaneMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.visible = false;
        return plane;
    }
}

class Planes {
    constructor(components) {
        this.faces = new Faces();
        this._enabled = false;
        this.transformMode = "TRANSLATE";
        this._lines = new Lines();
        this._selected = null;
        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();
        this._v3 = new THREE.Vector3();
        this._v4 = new THREE.Vector3();
        this._q = new THREE.Quaternion();
        this._transformActive = false;
        this._previousTransform = new THREE.Matrix4();
        this._newTransform = new THREE.Matrix4();
        this._tempTransform = new THREE.Matrix4();
        this._state = "IDLE";
        this.updateTransform = () => {
            const result = this._components.raycaster.castRay([this._helperPlane]);
            if (result === null)
                return;
            this.updateAxis(result);
            this.getTransformData();
            this.applyTransform();
        };
        this.startDrawing = () => {
            this._state = "START_DRAWING_AXIS_2";
            window.removeEventListener("click", this.startDrawing);
            window.addEventListener("click", this.finishDrawing);
        };
        this.finishDrawing = () => {
            this._state = "IDLE";
            window.removeEventListener("click", this.finishDrawing);
            this.transform(false);
        };
        this.pick = () => {
            if (this._transformActive)
                return;
            this.faces.select(false);
            this._selected = null;
            const result = this._components.raycaster.castRay([this.faces.mesh]);
            if (result === null || result.faceIndex === undefined)
                return;
            const faceID = this.faces.getFromIndex(result.faceIndex);
            if (faceID !== undefined) {
                this._selected = faceID;
                this.faces.select(true, [faceID]);
            }
        };
        this._components = components;
        const material = this.faces.mesh.material;
        material.transparent = true;
        material.opacity = 0.2;
        const helperMaterial = new THREE.MeshBasicMaterial({
            color: 0xeeeeee,
            transparent: true,
            opacity: 0.3,
            side: 2,
        });
        const helperGeometry = new THREE.PlaneGeometry(10, 10, 10);
        this._helperPlane = new THREE.Mesh(helperGeometry, helperMaterial);
        // this._helperPlane.visible = false;
        const [a, b, c, d] = this._lines.addPoints([
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ]);
        const [helperLineID] = this._lines.add([a, b]);
        this._helperLine1 = this._lines.list[helperLineID];
        const [helperAngleLineID] = this._lines.add([c, d]);
        this._helperLine2 = this._lines.list[helperAngleLineID];
        const scene = components.scene.get();
        scene.add(this.faces.mesh);
        scene.add(this._helperPlane);
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(active) {
        this._enabled = active;
        if (active) {
            window.addEventListener("click", this.pick);
        }
        else {
            window.removeEventListener("click", this.pick);
        }
    }
    add() {
        const pointIDs = this.faces.addPoints([
            [1, 0, 1],
            [-1, 0, 1],
            [-1, 0, -1],
            [1, 0, -1],
        ]);
        return this.faces.add(pointIDs);
    }
    transform(active = !this._transformActive) {
        if (active === this._transformActive)
            return;
        if (active && this._selected === null)
            return;
        this._transformActive = active;
        if (!active) {
            this.setHelperLineVisible(false);
            this.faces.mesh.geometry.computeBoundingSphere();
            this.faces.mesh.geometry.computeBoundingBox();
            window.removeEventListener("mousemove", this.updateTransform);
            return;
        }
        if (this._selected === null)
            return;
        this.setHelperLineVisible(true);
        const center = this.faces.getCenter(this._selected);
        if (center === null) {
            this.transform(false);
            return;
        }
        const [cx, cy, cz] = center;
        this._helperPlane.position.set(cx, cy, cz);
        const camera = this._components.camera.get();
        this._helperPlane.rotation.copy(camera.rotation);
        this._helperPlane.updateMatrix();
        this._helperPlane.updateMatrixWorld();
        const result = this._components.raycaster.castRay([this._helperPlane]);
        if (result === null) {
            this.transform(false);
            return;
        }
        this._previousTransform.setPosition(result.point);
        this._newTransform.setPosition(result.point);
        const { x, y, z } = result.point;
        this._lines.setPoint(this._helperLine1.start, [x, y, z]);
        this._lines.setPoint(this._helperLine1.end, [x, y, z]);
        this._lines.setPoint(this._helperLine2.start, [x, y, z]);
        this._lines.setPoint(this._helperLine2.end, [x, y, z]);
        this._state = "DRAWING_AXIS_1";
        if (this.transformMode === "TRANSLATE") {
            window.addEventListener("click", this.finishDrawing);
        }
        else {
            window.addEventListener("click", this.startDrawing);
        }
        window.addEventListener("mousemove", this.updateTransform);
    }
    updateAxis(result) {
        const { x, y, z } = result.point;
        const isFirstAxis = this._state === "DRAWING_AXIS_1";
        const axis = isFirstAxis ? this._helperLine1 : this._helperLine2;
        this._lines.setPoint(axis.end, [x, y, z]);
    }
    getTransformData() {
        if (this.transformMode === "TRANSLATE") {
            this.getTranslation();
        }
        else if (this.transformMode === "ROTATE") {
            this.getRotation();
        }
        else if (this.transformMode === "SCALE") {
            this.getScale();
        }
    }
    getTranslation() {
        const endPoint = this._lines.vertices.get(this._helperLine1.end);
        if (endPoint === null)
            return;
        const [x, y, z] = endPoint;
        this._v1.set(x, y, z);
        this._newTransform.setPosition(this._v1);
    }
    getScale() {
        if (this._state === "DRAWING_AXIS_1")
            return;
        this.getSegmentVectors();
        const firstLength = this._v2.length();
        const secondLength = this._v4.length();
        const factor = secondLength / firstLength;
        this._newTransform.identity();
        const { x, y, z } = this._v1;
        const move = new THREE.Matrix4().makeTranslation(x, y, z);
        const scale = new THREE.Matrix4().makeScale(factor, factor, factor);
        const invMove = move.clone().invert();
        this._newTransform.multiply(move);
        this._newTransform.multiply(scale);
        this._newTransform.multiply(invMove);
        this._newTransform.multiply(this._helperPlane.matrix);
    }
    getRotation() {
        if (this._state === "DRAWING_AXIS_1")
            return;
        this.getSegmentVectors();
        let angle = this._v4.angleTo(this._v2);
        // Correct angle sign (otherwise it's always the shorter unsigned angle)
        this._v3.set(0, 0, 1);
        this._v3.applyEuler(this._helperPlane.rotation);
        this._v4.cross(this._v2);
        const dot = this._v4.dot(this._v3);
        if (dot > 0) {
            angle *= -1;
        }
        // Get axis from camera
        const axis = new THREE.Vector3();
        axis.set(0, 0, 1);
        const camera = this._components.camera.get();
        axis.applyEuler(camera.rotation);
        this._q.setFromAxisAngle(axis, angle);
        this._newTransform.identity();
        const { x, y, z } = this._v1;
        const move = new THREE.Matrix4().makeTranslation(x, y, z);
        const rotation = new THREE.Matrix4().makeRotationFromQuaternion(this._q);
        const invMove = move.clone().invert();
        this._newTransform.multiply(move);
        this._newTransform.multiply(rotation);
        this._newTransform.multiply(invMove);
        this._newTransform.multiply(this._helperPlane.matrix);
    }
    getSegmentVectors() {
        const first = this._lines.get(this._helperLine1.id);
        const second = this._lines.get(this._helperLine2.id);
        if (first === null || second === null)
            return;
        const [[ax, ay, az], [bx, by, bz]] = first;
        const [[cx, cy, cz], [dx, dy, dz]] = second;
        this._v1.set(ax, ay, az);
        this._v2.set(bx, by, bz);
        this._v3.set(cx, cy, cz);
        this._v4.set(dx, dy, dz);
        this._v2.sub(this._v1);
        this._v4.sub(this._v3);
    }
    applyTransform() {
        // Rotation and scale only update when updating the second axis
        const isNotMove = this.transformMode !== "TRANSLATE";
        const isFirstAxis = this._state === "DRAWING_AXIS_1";
        if (isFirstAxis && isNotMove)
            return;
        this._tempTransform.copy(this._newTransform);
        if (this._state === "START_DRAWING_AXIS_2") {
            this._state = "FINISH_DRAWING_AXIS_2";
            this._previousTransform = this._newTransform.clone();
        }
        this._tempTransform.multiply(this._previousTransform.invert());
        this.faces.transform(this._tempTransform);
        this._previousTransform.copy(this._newTransform);
    }
    setHelperLineVisible(active) {
        const scene = this._components.scene.get();
        if (active) {
            scene.add(this._lines.mesh, this._lines.vertices.mesh);
        }
        else {
            scene.remove(this._lines.mesh, this._lines.vertices.mesh);
        }
    }
}

export { BufferManager, Control, Extrusions, Faces, IdIndexMap, Lines, OffsetFaces, Planes, Polygons, Primitive, Raycaster, Selector, Slabs, Vector, Vertices, Walls };
