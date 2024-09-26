export class Vector {
  static get up() {
    return [0, 1, 0];
  }

  static round(vector: number[], precission = 1000) {
    return [
      Math.round(vector[0] * precission) / precission,
      Math.round(vector[1] * precission) / precission,
      Math.round(vector[2] * precission) / precission,
    ];
  }

  static getNormal(points: number[][]) {
    const a = Vector.subtract(points[0], points[1]);
    const b = Vector.subtract(points[1], points[2]);

    const [x, y, z] = this.multiply(a, b);

    const magnitude = Math.sqrt(x * x + y * y + z * z);

    return [x / magnitude, y / magnitude, z / magnitude];
  }

  static dot(v1: number[], v2: number[]) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  }

  static multiply(v1: number[], v2: number[]) {
    const x = v1[1] * v2[2] - v1[2] * v2[1];
    const y = v1[2] * v2[0] - v1[0] * v2[2];
    const z = v1[0] * v2[1] - v1[1] * v2[0];
    return [x, y, z];
  }

  static normalize(vector: number[]) {
    const [x, y, z] = vector;
    const magnitude = Vector.magnitude(vector);
    return [x / magnitude, y / magnitude, z / magnitude];
  }

  static magnitude(vector: number[]) {
    const [x, y, z] = vector;
    return Math.sqrt(x * x + y * y + z * z);
  }

  static squaredMagnitude(vector: number[]) {
    const [x, y, z] = vector;
    return x * x + y * y + z * z;
  }

  static add(...vectors: number[][]) {
    const result = [0, 0, 0];
    for (const vector of vectors) {
      result[0] += vector[0];
      result[1] += vector[1];
      result[2] += vector[2];
    }
    return result as [number, number, number];
  }

  static subtract(v1: number[], v2: number[]) {
    const [x1, y1, z1] = v1;
    const [x2, y2, z2] = v2;
    return [x2 - x1, y2 - y1, z2 - z1];
  }

  static multiplyScalar(vector: number[], scalar: number) {
    return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
  }
}
