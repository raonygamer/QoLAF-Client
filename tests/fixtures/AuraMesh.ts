import { Display } from './NativeGame';

export class Vertices {
  count = 0;
  points: number[][] = [];
  set_numVertices(count: number) {
    this.count = count;
  }
  get_numVertices() {
    return this.count;
  }
  setPoint(index: number, _key: string, x: number, y: number) {
    this.points[index] = [x, y];
  }
  colorize(_key: string, _color: number, _alpha: number, _start: number, _count: number) {}
}
export class Indices {
  count = 0;
  set_numIndices(count: number) {
    this.count = count;
  }
  addQuad(..._indices: number[]) {
    this.count += 6;
  }
}
export class Mesh extends Display {
  rotation = 0;
  set_rotation(value: number) {
    this.rotation = value;
  }
  get_rotation() {
    return this.rotation;
  }
  constructor(
    readonly vertices: Vertices,
    readonly indices: Indices,
  ) {
    super();
  }
  get_vertexData() {
    return this.vertices;
  }
  get_indexData() {
    return this.indices;
  }
  setVertexDataChanged() {}
  setIndexDataChanged() {}
}
