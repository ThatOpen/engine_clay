import * as THREE from 'https://unpkg.com/three@0.135.0/build/three.module.js';

class Vertices {
    constructor(size = 0.1) {
        /** Buffer increment when geometry size is exceeded, multiple of 3. */
        this.bufferIncrease = 300;
        this.defaultColor = new THREE.Color(0.5, 0.5, 0.5);
        this.selectColor = new THREE.Color(1, 0, 0);
        this._capacity = 0;
        this._geometry = new THREE.BufferGeometry();
        this._positionBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
        this._colorBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
        this._selected = new Set();
        this._geometry.setAttribute("position", this._positionBuffer);
        this._geometry.setAttribute("color", this._colorBuffer);
        this.resetBuffer();
        const material = new THREE.PointsMaterial({
            size,
            vertexColors: true,
        });
        this.points = new THREE.Points(this._geometry, material);
    }
    /**
     * Add new points
     * @param coordinates Points to add
     */
    add(coordinates) {
        this.checkBufferSize(coordinates.length);
        for (let i = 0; i < coordinates.length; i++) {
            const indexToAdd = this._positionBuffer.count + i;
            const { x, y, z } = coordinates[i];
            this._positionBuffer.setXYZ(indexToAdd, x, y, z);
            const { r, g, b } = this.defaultColor;
            this._colorBuffer.setXYZ(indexToAdd, r, g, b);
        }
        this._positionBuffer.count += coordinates.length;
        this._colorBuffer.count += coordinates.length;
    }
    /**
     * Creates a set of selected points
     * @param active When true we will select, when false we will unselect
     * @param selection List of point indices to add to the selected set
     */
    select(active, selection = []) {
        if (active) {
            this.selectIndex(selection);
            return;
        }
        this.unselect(selection);
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
     * Removes points from the list
     */
    remove() {
        for (const index of this._selected.values()) {
            const lastIndex = this._positionBuffer.count - 1;
            this._positionBuffer.setXYZ(index, this._positionBuffer.getX(lastIndex), this._positionBuffer.getY(lastIndex), this._positionBuffer.getZ(lastIndex));
            this._colorBuffer.setXYZ(index, this._colorBuffer.getX(lastIndex), this._colorBuffer.getY(lastIndex), this._colorBuffer.getZ(lastIndex));
            this._positionBuffer.count--;
        }
    }
    checkBufferSize(increase) {
        const tempPositionArray = this._geometry.getAttribute("position");
        const size = tempPositionArray.count * 3 + increase * 3;
        while (size >= this._capacity) {
            if (this.bufferIncrease < 1) {
                this.bufferIncrease = 1;
            }
            this.resetBuffer();
            return;
        }
    }
    selectIndex(selection = []) {
        if (selection.length === 0) {
            this.resetAllSelectedColors();
            this._selected.clear();
            for (let i = 0; i < this._positionBuffer.count; i++) {
                this.addSelection(i);
            }
            return;
        }
        for (let i = 0; i < selection.length; i++) {
            this.addSelection(selection[i]);
        }
    }
    addSelection(index) {
        this._selected.add(index);
        this._colorBuffer.setX(index, this.selectColor.r);
        this._colorBuffer.setY(index, this.selectColor.g);
        this._colorBuffer.setZ(index, this.selectColor.b);
    }
    unselect(selection = []) {
        this.restoreColor(selection);
        if (selection.length === 0) {
            this._selected.clear();
            return;
        }
        for (let i = 0; i < selection.length; i++) {
            this._selected.delete(selection[i]);
        }
    }
    restoreColor(selection = []) {
        if (selection.length === 0) {
            this.resetAllSelectedColors();
            return;
        }
        this.resetSelectedColors(selection);
    }
    resetAllSelectedColors() {
        for (const index of this._selected.values()) {
            this._colorBuffer.setXYZ(index, this.defaultColor.r, this.defaultColor.g, this.defaultColor.b);
        }
    }
    resetSelectedColors(selection) {
        for (let i = 0; i < selection.length; i++) {
            this._colorBuffer.setXYZ(selection[i], this.defaultColor.r, this.defaultColor.g, this.defaultColor.b);
        }
    }
    transform(transformation) {
        const vector = new THREE.Vector3();
        for (const index of this._selected) {
            const x = this._positionBuffer.getX(index);
            const y = this._positionBuffer.getY(index);
            const z = this._positionBuffer.getZ(index);
            vector.set(x, y, z);
            vector.applyMatrix4(transformation);
            this._positionBuffer.setXYZ(index, vector.x, vector.y, vector.z);
        }
    }
    resetBuffer() {
        this._capacity += this.bufferIncrease;
        const tempPositionArray = this._geometry.getAttribute("position").array;
        const tempColorArray = this._geometry.getAttribute("color").array;
        this.resetAttributePosition();
        this.resetAttributeColor();
        for (let i = 0; i < this._positionBuffer.count; i++) {
            const x = tempPositionArray[i * 3];
            const y = tempPositionArray[i * 3 + 1];
            const z = tempPositionArray[i * 3 + 2];
            this._positionBuffer.setXYZ(i, x, y, z);
            const r = tempColorArray[i * 3];
            const g = tempColorArray[i * 3 + 1];
            const b = tempColorArray[i * 3 + 2];
            this._colorBuffer.setXYZ(i, r, g, b);
        }
    }
    resetAttributePosition() {
        const count = this._positionBuffer.count;
        this._geometry.deleteAttribute("position");
        this._positionBuffer = new THREE.BufferAttribute(new Float32Array(this._capacity), 3);
        this._positionBuffer.count = count;
        this._geometry.setAttribute("position", this._positionBuffer);
    }
    resetAttributeColor() {
        const count = this._colorBuffer.count;
        this._geometry.deleteAttribute("color");
        this._colorBuffer = new THREE.BufferAttribute(new Float32Array(this._capacity), 3);
        this._colorBuffer.count = count;
        this._geometry.setAttribute("color", this._colorBuffer);
    }
}

export { Vertices };
