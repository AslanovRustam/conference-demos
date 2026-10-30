import * as THREE from 'three';

/** Пропорции круглого бриллианта (радиус пояска 1): высота короны ~16% диаметра, глубина павильона ~43%. */
export const BRILLIANT = {
  table: 0.32,
  tableRadius: 0.55,
  star: 0.2,
  starRadius: 0.8,
  girdleTop: 0.03,
  girdleBottom: -0.03,
  lowerRadius: 0.5,
  lower: -0.48,
  culet: -0.86,
  /** точка внутри камня: от неё считаются внешние нормали */
  center: -0.2,
} as const;

/** Радиус профиля камня на высоте y (упрощённо: корона и павильон — усечённые конусы). */
export function brilliantRadiusAt(y: number): number {
  const B = BRILLIANT;
  if (y > B.table || y < B.culet) return 0;
  if (y >= 0) return 1 - (1 - B.tableRadius) * (y / B.table);
  return 1 - y / B.culet;
}

/**
 * Классическая огранка «круглый бриллиант»: площадка, 8 звёзд, 8 клиньев, 16 граней верхнего пояска,
 * поясок, 16 граней нижнего пояска и 8 главных граней павильона. Плоские нормали — каждая грань бликует отдельно.
 */
export function brilliantCut(): THREE.BufferGeometry {
  const B = BRILLIANT;
  const at = (angle: number, r: number, y: number) => new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
  const step = Math.PI / 4;
  const T = Array.from({ length: 8 }, (_, i) => at(i * step, B.tableRadius, B.table));
  const S = Array.from({ length: 8 }, (_, i) => at(i * step + step / 2, B.starRadius, B.star));
  const G = Array.from({ length: 16 }, (_, j) => at((j * step) / 2, 1, B.girdleTop));
  const Gb = Array.from({ length: 16 }, (_, j) => at((j * step) / 2, 1, B.girdleBottom));
  const L = Array.from({ length: 8 }, (_, i) => at(i * step + step / 2, B.lowerRadius, B.lower));
  const top = new THREE.Vector3(0, B.table, 0);
  const culet = new THREE.Vector3(0, B.culet, 0);
  const center = new THREE.Vector3(0, B.center, 0);

  const out: number[] = [];
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    // Разворачиваем треугольник наружу: камень выпуклый, внешняя нормаль смотрит от центра
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    mid.copy(a).add(b).add(c).divideScalar(3).sub(center);
    const flip = ab.cross(ac).dot(mid) < 0;
    for (const v of flip ? [a, c, b] : [a, b, c]) out.push(v.x, v.y, v.z);
  };
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    tri(a, b, c);
    tri(a, c, d);
  };

  for (let i = 0; i < 8; i++) {
    const n = (i + 1) % 8;
    const p = (i + 7) % 8;
    tri(top, T[i], T[n]); // площадка
    tri(T[i], T[n], S[i]); // звезда
    quad(T[i], S[i], G[2 * i], S[p]); // клин
    tri(S[i], G[2 * i], G[2 * i + 1]); // верхний поясок
    tri(S[i], G[2 * i + 1], G[(2 * i + 2) % 16]);
    tri(Gb[2 * i], Gb[2 * i + 1], L[i]); // нижний поясок
    tri(Gb[2 * i + 1], Gb[(2 * i + 2) % 16], L[i]);
    quad(Gb[2 * i], L[i], culet, L[p]); // главная грань павильона
  }
  for (let j = 0; j < 16; j++) quad(G[j], G[(j + 1) % 16], Gb[(j + 1) % 16], Gb[j]); // поясок

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}
