import * as THREE from 'three';
import { BRILLIANT, brilliantCut, brilliantRadiusAt } from './brilliant';

test('round brilliant has the classic facet layout', () => {
  const g = brilliantCut();
  const triangles = g.attributes.position.count / 3;
  // площадка (8) + звёзды (8) + клинья (8·2) + верхний поясок (16) + поясок (16·2) + нижний поясок (16) + павильон (8·2)
  expect(triangles).toBe(8 + 8 + 16 + 16 + 32 + 16 + 16);
});

test('every facet faces outwards', () => {
  const g = brilliantCut();
  const pos = g.attributes.position;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const center = new THREE.Vector3(0, BRILLIANT.center, 0);
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a));
    centroid.copy(a).add(b).add(c).divideScalar(3).sub(center);
    expect(n.dot(centroid)).toBeGreaterThan(0);
  }
});

test('proportions: girdle diameter 2, crown above, pavilion below', () => {
  const g = brilliantCut();
  g.computeBoundingBox();
  const box = g.boundingBox!;
  expect(box.max.x - box.min.x).toBeCloseTo(2, 2);
  expect(box.max.y).toBeCloseTo(BRILLIANT.table, 5);
  expect(box.min.y).toBeCloseTo(BRILLIANT.culet, 5);
});

test('profile radius: girdle widest, narrows to table above and culet below', () => {
  expect(brilliantRadiusAt(0)).toBeCloseTo(1, 5);
  expect(brilliantRadiusAt(BRILLIANT.table)).toBeCloseTo(BRILLIANT.tableRadius, 5);
  expect(brilliantRadiusAt(BRILLIANT.culet)).toBeCloseTo(0, 5);
  expect(brilliantRadiusAt(BRILLIANT.table + 0.01)).toBe(0);
  expect(brilliantRadiusAt(BRILLIANT.culet - 0.01)).toBe(0);
});
