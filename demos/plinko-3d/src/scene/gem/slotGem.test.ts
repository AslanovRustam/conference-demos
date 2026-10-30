import * as THREE from 'three';
import { SLOT_GEM_BOTTOM, SLOT_LABEL_HALF, SLOT_LABEL_Y } from '../../math/layout';
import { SLOT_GEM_TILT, slotGemGeometry } from './slotGem';

// Ячейки выглядели нарисованными: 8 граней и собственное свечение. Теперь это та же огранка, что у камня интро.
test('slot gem is the round brilliant cut', () => {
  expect(slotGemGeometry().attributes.position.count / 3).toBe(112);
});

test('slot gem is as wide as a slot cell allows', () => {
  const g = slotGemGeometry();
  g.computeBoundingBox();
  expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeCloseTo(0.94, 2);
});

// Камень наклонён к зрителю и вращается: при любом повороте его низ выше подписи множителя
test('the tilted, spinning slot gem never dips into its multiplier label', () => {
  const box = new THREE.Box3();
  for (let spin = 0; spin < Math.PI * 2; spin += Math.PI / 16) {
    const g = slotGemGeometry().applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(SLOT_GEM_TILT, spin, 0)));
    box.setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
    expect(box.min.y).toBeGreaterThanOrEqual(SLOT_GEM_BOTTOM);
  }
  expect(SLOT_LABEL_Y + SLOT_LABEL_HALF).toBeLessThanOrEqual(SLOT_GEM_BOTTOM);
});
