import * as THREE from 'three';
import { createRng } from '../../core/rng';

/**
 * Студия для бриллианта: тёмный фиолетовый фон, жёсткие белые софтбоксы и лавандовые панели.
 * Камень преломляет только эту карту, поэтому блеск даёт контраст: яркие узкие источники на тёмном.
 * Верх холста — небо (+Y), по горизонтали — азимут: u = 0.25 смотрит от зрителя (−Z), u = 0.75 — на зрителя.
 */
export function gemEnvironment(): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const rng = createRng(11);

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0c0720');
  bg.addColorStop(0.45, '#241552');
  bg.addColorStop(0.55, '#1a0f3d');
  bg.addColorStop(1, '#040209');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Софтбокс: яркая середина, мягко гаснущие края
  const box = (x: number, y: number, w: number, h: number, color: string, alpha = 1) => {
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.15, color);
    grad.addColorStop(0.85, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha;
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  };
  const spot = (x: number, y: number, r: number, color: string) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // Верхний свет по кругу: корона камня ловит его при любом повороте
  for (let i = 0; i < 6; i++) box(i * (W / 6) + 20, 34, W / 6 - 60, 46, '#ffffff', 0.95);
  // Высокие узкие стойки у горизонта: на гранях павильона они дают резкие вспышки
  [70, 210, 330, 470, 600, 700, 820, 940].forEach((x, i) => box(x, 150 + (i % 3) * 14, 22 + (i % 2) * 16, 190 - (i % 3) * 20, '#ffffff', 0.9));
  // Цветные панели палитры: лаванда, фиолет, маджента, капля фирменного красного
  box(380, 190, 150, 120, '#b9a7ff', 0.75);
  box(860, 200, 110, 140, '#8f74ff', 0.7);
  box(120, 220, 70, 90, '#6a4fd6', 0.8);
  box(640, 300, 90, 40, '#ff7ae6', 0.55);
  spot(760, 250, 18, '#ff1923');
  // Мелкие точечные источники: искры на гранях
  for (let i = 0; i < 40; i++) spot(rng.range(0, W), rng.range(20, H * 0.62), rng.range(2, 6), '#ffffff');
  // Отражённый пол: слабая лавандовая полоса снизу
  box(0, H - 120, W, 40, '#3a2780', 0.6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let shared: THREE.CanvasTexture | null = null;

/** Одна студия на всю игру: её преломляют и камень интро, и камни-ячейки. Живёт всё время работы игры. */
export function sharedGemEnvironment(): THREE.CanvasTexture {
  return (shared ??= gemEnvironment());
}
