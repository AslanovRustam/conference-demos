// Фирменные токены Clickable для кода (three.js, canvas, анимации).
// Те же значения, что в tokens.css. Меняются вместе.

export const brandColors = {
  red: '#ff1923',
  redButton: '#f01c25',
  redPressed: '#e5000a',
  black: '#000000',
  dark: '#0d0d0d',
  white: '#ffffff',
  gray: '#909090',
  accentGreen: '#59ea00',
} as const;

export const brandFonts = {
  display: "'Clickable', 'Montserrat', system-ui, sans-serif",
  body: "'Montserrat', system-ui, sans-serif",
} as const;

// URL ассетов. Vite копирует файлы в сборку и подставляет итоговые пути.
export const brandLogo = {
  red: new URL('./logo/clickable-logo-red.svg', import.meta.url).href,
  white: new URL('./logo/clickable-logo-white.svg', import.meta.url).href,
  black: new URL('./logo/clickable-logo-black.svg', import.meta.url).href,
  favicon: new URL('./logo/favicon-32x32.png', import.meta.url).href,
} as const;
