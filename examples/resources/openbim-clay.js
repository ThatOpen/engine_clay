import * as THREE from 'https://unpkg.com/three@0.135.0/build/three.module.js';

class Vertices {
    constructor(color = 0x888888, size = 0.1) {
        this.geometry = new THREE.BufferGeometry();
        this.vertices = [];
        this.capacity = 0;
        this.buffer = new Float32Array(0);
        this.position = new THREE.BufferAttribute(this.buffer, 3);
        this.bufferIncrease = 300;
        this.resetBuffer();
        const material = new THREE.PointsMaterial({ color, size });
        this.points = new THREE.Points(this.geometry, material);
    }
    add(coordinates) {
        this.vertices.push(...coordinates);
        this.regenerate();
    }
    setIncreaseBufferValue(value) {
        this.bufferIncrease = value * 3;
    }
    regenerate() {
        const size = this.vertices.length * 3;
        if (size >= this.capacity) {
            this.resetBuffer();
            for (let i = 0; i < this.vertices.length; i++) {
                const { x, y, z } = this.vertices[i];
                this.buffer.set([x, y, z], i * 3);
            }
        }
        else {
            const indexToAdd = this.vertices.length - 1;
            const { x, y, z } = this.vertices[indexToAdd];
            this.buffer.set([x, y, z], indexToAdd * 3);
        }
        this.position.count = this.vertices.length;
    }
    resetBuffer() {
        this.capacity += this.bufferIncrease;
        this.geometry.deleteAttribute("position");
        this.buffer = new Float32Array(this.capacity);
        this.position = new THREE.BufferAttribute(this.buffer, 3);
        this.geometry.setAttribute("position", this.position);
    }
}

export { Vertices };
