import * as THREE from 'https://unpkg.com/three@0.135.0/build/three.module.js';

class Vertices {
    constructor(size = 0.1) {
        /** Buffer increment when geometry size is exceeded, multiple of 3. */
        this.bufferIncrease = 300;
        this.geometry = new THREE.BufferGeometry();
        this.vertices = [];
        this.colors = [];
        this.capacity = 0;
        this.bufferPosition = new Float32Array(0);
        this.position = new THREE.BufferAttribute(this.bufferPosition, 3);
        this.bufferColor = new Float32Array(0);
        this.color = new THREE.BufferAttribute(this.bufferColor, 3);
        this.resetBuffer();
        const material = new THREE.PointsMaterial({
            size,
            vertexColors: true,
        });
        this.points = new THREE.Points(this.geometry, material);
    }
    /**
     * Add new points
     * @param coordinates Points to add
     */
    add(coordinates, colors) {
        this.vertices.push(...coordinates);
        this.colors.push(...colors);
        this.regenerate();
    }
    regenerate() {
        const size = this.vertices.length * 3;
        if (size >= this.capacity) {
            this.resetBuffer();
            return;
        }
        const indexToAdd = this.vertices.length - 1;
        const { x, y, z } = this.vertices[indexToAdd];
        this.bufferPosition.set([x, y, z], indexToAdd * 3);
        const { r, g, b } = this.colors[indexToAdd];
        this.bufferColor.set([r, g, b], indexToAdd * 3);
        this.position.count = this.vertices.length;
        this.color.count = this.vertices.length;
    }
    resetBuffer() {
        this.capacity += this.bufferIncrease;
        this.resetAttributePosition();
        this.resetAttributeColor();
        for (let i = 0; i < this.vertices.length; i++) {
            const { x, y, z } = this.vertices[i];
            this.bufferPosition.set([x, y, z], i * 3);
            const { r, g, b } = this.colors[i];
            this.bufferColor.set([r, g, b], i * 3);
        }
    }
    resetAttributePosition() {
        this.geometry.deleteAttribute("position");
        this.bufferPosition = new Float32Array(this.capacity);
        this.position = new THREE.BufferAttribute(this.bufferPosition, 3);
        this.position.count = this.vertices.length;
        this.geometry.setAttribute("position", this.position);
    }
    resetAttributeColor() {
        this.geometry.deleteAttribute("color");
        this.bufferColor = new Float32Array(this.capacity);
        this.color = new THREE.BufferAttribute(this.bufferColor, 3);
        this.color.count = this.vertices.length;
        this.geometry.setAttribute("color", this.color);
    }
}

export { Vertices };
