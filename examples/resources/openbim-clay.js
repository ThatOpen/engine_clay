import * as THREE from 'https://unpkg.com/three@0.135.0/build/three.module.js';

class Vertices {
    constructor(size = 0.1) {
        /** Buffer increment when geometry size is exceeded, multiple of 3. */
        this.bufferIncrease = 300;
        this._geometry = new THREE.BufferGeometry();
        this._vertices = [];
        this._colors = [];
        this._capacity = 0;
        this._positionBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
        this._colorBuffer = new THREE.BufferAttribute(new Float32Array(0), 3);
        this._selected = new Set();
        this._selectedColor = new Set();
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
    add(coordinates, colors) {
        this._vertices.push(...coordinates);
        this._colors.push(...colors);
        this.regenerate();
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
    selectIndex(selection = []) {
        if (selection.length === 0) {
            this.resetAllSelectedColors();
            this._selected.clear();
            this._selectedColor.clear();
            for (let i = 0; i < this._vertices.length; i++) {
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
        this._selectedColor.add(new THREE.Color(this._colorBuffer.getX(index), this._colorBuffer.getY(index), this._colorBuffer.getZ(index)));
        this._colorBuffer.setX(index, 1);
        this._colorBuffer.setY(index, 0);
        this._colorBuffer.setZ(index, 0);
    }
    unselect(selection = []) {
        this.restoreColor(selection);
        if (selection.length === 0) {
            this._selected.clear();
            this._selectedColor.clear();
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
        const colorArray = Array.from(this._selectedColor);
        let i = 0;
        for (const index of this._selected.values()) {
            this._colorBuffer.setXYZ(index, colorArray[i].r, colorArray[i].g, colorArray[i].b);
            i++;
        }
    }
    resetSelectedColors(selection) {
        const selectionArray = Array.from(this._selected);
        const colorArray = Array.from(this._selectedColor);
        for (let i = 0; i < selection.length; i++) {
            const index = selectionArray.indexOf(selection[i]);
            this._colorBuffer.setXYZ(selection[i], colorArray[index].r, colorArray[index].g, colorArray[index].b);
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
    regenerate() {
        const size = this._vertices.length * 3;
        if (size >= this._capacity) {
            this.resetBuffer();
            return;
        }
        const indexToAdd = this._vertices.length - 1;
        const { x, y, z } = this._vertices[indexToAdd];
        this._positionBuffer.setXYZ(indexToAdd, x, y, z);
        const { r, g, b } = this._colors[indexToAdd];
        this._colorBuffer.setXYZ(indexToAdd, r, g, b);
        this._positionBuffer.count = this._vertices.length;
        this._colorBuffer.count = this._vertices.length;
    }
    resetBuffer() {
        this._capacity += this.bufferIncrease;
        this.resetAttributePosition();
        this.resetAttributeColor();
        for (let i = 0; i < this._vertices.length; i++) {
            const { x, y, z } = this._vertices[i];
            this._positionBuffer.setXYZ(i, x, y, z);
            const { r, g, b } = this._colors[i];
            this._colorBuffer.setXYZ(i, r, g, b);
        }
    }
    resetAttributePosition() {
        this._geometry.deleteAttribute("position");
        this._positionBuffer = new THREE.BufferAttribute(new Float32Array(this._capacity), 3);
        this._positionBuffer.count = this._vertices.length;
        this._geometry.setAttribute("position", this._positionBuffer);
    }
    resetAttributeColor() {
        this._geometry.deleteAttribute("color");
        this._colorBuffer = new THREE.BufferAttribute(new Float32Array(this._capacity), 3);
        this._colorBuffer.count = this._vertices.length;
        this._geometry.setAttribute("color", this._colorBuffer);
    }
}

export { Vertices };
