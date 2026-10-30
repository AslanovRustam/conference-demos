# Бренд Clickable для конференционных демо

Общие логотип, цвета и шрифты для всех игр в `demos/`. Демо берут бренд только отсюда, без своих копий.

Папка только для чтения: демо её не меняют. Изменения вносятся отдельно и осознанно, потому что они затрагивают все игры.

## Что внутри

| Файл | Что это |
|---|---|
| `logo/clickable-logo-red.svg` | основной логотип, красный `#FF1923`, 262×36 |
| `logo/clickable-logo-white.svg` | белый вариант для тёмного фона и цветных плашек |
| `logo/clickable-logo-black.svg` | тёмный вариант (`#0D0D0D`) для светлого фона |
| `logo/favicon-32x32.png` | круглый знак с сайта, только 32×32 |
| `fonts/CLICKABLE-Black.woff2`, `.woff` | фирменный шрифт Clickable Black (900): латиница, кириллица, цифры |
| `fonts/Montserrat-*.woff2` | Montserrat 400, 500, 600, 700 |
| `fonts.css` | `@font-face` для всех шрифтов |
| `tokens.css` | CSS-переменные `--ck-*`: цвета, шрифты, форма кнопки |
| `tokens.ts` | те же цвета и шрифты для кода, плюс URL логотипов |

## Цвета

| Токен | Значение | Где на сайте |
|---|---|---|
| `--ck-red` | `#ff1923` | логотип, основной акцент |
| `--ck-red-button` | `#f01c25` | заливка кнопок |
| `--ck-red-pressed` | `#e5000a` | hover и active кнопок |
| `--ck-dark` | `#0d0d0d` | тёмные плашки и фон секций |
| `--ck-black` | `#000000` | фон |
| `--ck-white` | `#ffffff` | текст на тёмном |
| `--ck-gray` | `#909090` | основной текст |
| `--ck-accent-green` | `#59ea00` | редкий акцент в промо-блоках |

Палитра игрового мира у каждой игры своя (например, фиолетовые кристаллы в Plinko). Бренд в игре проявляется через логотип, красные акценты и шрифты.

**Фирменная форма кнопки:** срезанный правый нижний угол. Класс `.ck-chamfer` в `tokens.css`, размер среза задаёт `--ck-chamfer`.

## Шрифты

- **Clickable Black** для крупных надписей, цифр и заголовков. Знака `×` в нём нет: если он нужен, браузер возьмёт его из Montserrat по цепочке `--ck-font-display`.
- **Montserrat** для остального текста.
- `font-display: block`. Перед отрисовкой текста в canvas или WebGL дождитесь `document.fonts.ready`.

## Подключение в демо (Vite)

`vite.config.ts`:

```ts
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { fileURLToPath } from 'node:url';

const brandDir = fileURLToPath(new URL('../../shared/brand', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@brand': brandDir } },
  // dev-сервер по умолчанию не отдаёт файлы вне папки проекта
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), brandDir] } },
});
```

`tsconfig.json`, в `compilerOptions`:

```json
"paths": { "@brand/*": ["../../shared/brand/*"] }
```

В коде:

```ts
import '@brand/fonts.css';
import '@brand/tokens.css';
import { brandColors, brandFonts, brandLogo } from '@brand/tokens';
```

При сборке Vite копирует шрифты и логотипы в `dist/` демо, поэтому игра работает офлайн и не зависит от `shared/` после сборки.

## Источник

Всё взято с https://clickable.agency/ 30.10.2026:
- логотип: `/wp-content/themes/clickable/assets/public/img/clickable_logo.svg` (белый и тёмный варианты получены заменой цвета заливки);
- иконка: `/wp-content/themes/clickable/assets/public/img/favicon-32x32.png`;
- шрифты: `/wp-content/themes/clickable/assets/public/fonts/`;
- цвета: CSS-переменные и стили `style.min.css` сайта.

## Чего не хватает

- **Знак в высоком разрешении.** На сайте круглый знак есть только в PNG 32×32. Для иконок PWA (192 и 512 px) и крупного показа нужен вектор. Его стоит запросить у дизайнеров Clickable, а пока демо могут собирать иконку из логотипа.
- **Брендбук.** Правила охранного поля, минимального размера и сочетаний цветов неизвестны. Сейчас используются только значения с сайта.

## Лицензии

- Montserrat: SIL Open Font License 1.1.
- Clickable Black и логотип принадлежат Clickable и используются в демо самого агентства.
