# C3 Plinko 3D: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** офлайн-игра Plinko на WebGL для ноутбука и телефона: хромированный шарик падает сквозь пирамиду из фиолетовых кристаллов, впечатляют полёт шарика и момент выигрыша.

**Architecture:** чистая логика (таблицы выплат, выбор исхода, траектория по баллистическим дугам) отделена от рендера и покрыта vitest. Императивная симуляция (`BallSystem`, `SlowMoDirector`, `GameController`) крутится в кадровом цикле R3F и общается со сценой, звуком и интерфейсом через типизированную шину событий. Сцена на R3F (instancing, физические материалы двух уровней качества, постобработка), интерфейс на DOM поверх canvas (React + Motion), звук синтезируется Web Audio.

**Tech Stack:** Vite, TypeScript (strict), React 19, three.js, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3, GSAP 3, Motion 12 (`motion/react`), zustand 5, vite-plugin-pwa, @vite-pwa/assets-generator, vitest, @playwright/test. Ставить последние стабильные версии. Если мажорная версия R3F на момент установки выше 9, проверить совместимость с React 19 по peer-зависимостям и брать её экосистему drei/postprocessing.

**Spec:** `demos/plinko-3d/docs/2026-10-30-c3-plinko-3d-design.md`. Исполнитель читает её целиком перед первой задачей.

## Global Constraints

- Меняются только файлы в `demos/plinko-3d/`. `shared/brand/` только читается, через алиас `@brand` (как в `shared/brand/README.md`). Своих копий логотипа и шрифтов в проекте нет.
- Только виртуальные кредиты: никаких оплат, регистрации, сетевых запросов к серверам.
- Офлайн: ни одного запроса в сеть во время работы. Запрещены drei `<Environment preset=…>`, `useGLTF`/`useTexture` с внешних URL, Google Fonts, CDN. Шрифт для troika-текста только локальный `@brand/fonts/CLICKABLE-Black.woff` (troika не читает woff2).
- Браузеры: Chrome последней версии на ноутбуке, Safari на iOS 17+, Chrome на Android.
- Цель 60 FPS на ноутбуке со встроенной графикой и телефонах уровня iPhone 12+/Android с 2022 года.
- Язык интерфейса английский, все строки лежат в `src/strings.ts`.
- Числа из спеки: баланс 10 000; риск low/medium/high; ряды 8–16; по умолчанию high и 12 рядов; уровни выигрыша: `<1×` sub, `1×–<5×` normal, `5×–<25×` large, `25×–<100×` big, `≥100×` mega; attract после 45 с без ввода; «100 шариков».
- Палитра: фон `#1b0f3d` → `#06030f`; кристаллы `#c9b8ff` → `#6a4fd6`; камни: mega `#e0115f`, big `#9b30ff`, large `#2d6bff`, 2×–5× `#00c2a8`, 1×–2× `#7a5cff`, `<1×` `#c7c3ff`; фирменный красный `#FF1923` только для логотипа и главной кнопки.
- Режим ведущего содержит ровно две функции: «следующий шарик в Big/Mega» и «бесплатные 100 шариков». Сброса баланса и FPS в нём нет.
- Подписи множителей пишутся латинской `x` (`29x`, `0.3x`): в Clickable Black нет знака `×`.
- Отладочный FPS-счётчик показывается только с `?debug=1`. Детерминированный запуск через `?seed=<число>`. Ручной выбор качества через `?quality=high|light`.
- Оригинальный контент: никаких названий, символов и оформления чужих Plinko.

## Review Focus

1. **Шквал нажатий DROP** (20+ тапов в секунду, двойной тап на iPhone). Ожидается: баланс никогда не уходит в минус, активных шариков не больше `MAX_ACTIVE_BALLS`, страница не масштабируется. Тесты: задача 7 (spam-тест контроллера), задача 22 (тач-спам в e2e и проверка `visualViewport.scale === 1`).
2. **Смена риска или рядов, пока шарики летят.** Ожидается: смена игнорируется, переключатели неактивны, пирамида не перестраивается под шариками. Тесты: задача 6 (стор), задача 22 (e2e).
3. **Вкладка скрыта или телефон заблокирован посреди полёта.** Ожидается: после возвращения шарики продолжают с того же места, а не приземляются все разом; звук возобновляется, если не выключен. Тесты: задача 7 (огромный `dt` ограничивается), задача 15 (`bindVisibility`).
4. **Поворот телефона и изменение размера окна.** Ожидается: кадр пересчитывается, вся пирамида видна в свободной от интерфейса области. Тесты: задача 8 (кадрирование для обеих ориентаций), задача 22 (e2e с resize).
5. **localStorage недоступен** (приватный режим, заблокированные данные сайта). Ожидается: игра работает, звук по умолчанию включён. Тест: задача 6.

## Структура файлов

```
demos/plinko-3d/
  package.json  vite.config.ts  tsconfig.json  index.html  playwright.config.ts
  pwa-assets.config.ts  README.md  .gitignore
  public/icon.svg                      иконка приложения (источник для PWA-иконок)
  e2e/*.spec.ts                        Playwright
  src/
    main.tsx  App.tsx  config.ts  strings.ts  styles/global.css
    core/      types.ts  rng.ts  events.ts  format.ts
    math/      tiers.ts  paytable.ts  outcome.ts  layout.ts  decisions.ts  trajectory.ts  framing.ts
    state/     store.ts
    sim/       BallSystem.ts  slowmo.ts  controller.ts  attract.ts  SimProvider.tsx
    fx/        glowField.ts  wave.ts
    scene/     Stage.tsx  Background.tsx  Lighting.tsx  CameraRig.tsx  Effects.tsx
               Pegs.tsx  Slots.tsx  Balls.tsx  Trails.tsx  Shards.tsx  FloatingWins.tsx
               WinFx.tsx  CelebrationFx.tsx  materials.ts  palette.ts  fxStore.ts
    audio/     engine.ts  scale.ts  sfx.ts  music.ts  bindings.ts
    platform/  quality.ts  presenter.ts  idle.ts  embed.ts  fullscreen.ts
    ui/        Hud.tsx  TopBar.tsx  ControlPanel.tsx  History.tsx  BalanceCounter.tsx
               BigWinOverlay.tsx  Splash.tsx  AttractOverlay.tsx  PresenterPanel.tsx
               layoutMetrics.ts  useLongPress.ts  ui.css
```

Юнит-тесты лежат рядом с модулями (`*.test.ts`), окружение vitest `node`.

---

### Task 1: Каркас проекта и подключение бренда

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/config.ts`, `src/strings.ts`, `src/styles/global.css`, `src/config.test.ts`, `README.md` (заготовка)

**Interfaces:**
- Produces: `src/config.ts`:
  `START_BALANCE = 10_000`, `BETS = [10, 20, 50, 100, 200, 500, 1000] as const`, `DEFAULT_BET = 100`, `DEFAULT_RISK: Risk = 'high'`, `DEFAULT_ROWS: Rows = 12`, `RAIN_COUNT = 100`, `RAIN_SPAWN_INTERVAL = 0.06`, `MAX_ACTIVE_BALLS = 130`, `MAX_DT = 0.05`, `IDLE_MS = 45_000`, `HISTORY_MAX = 12`, `SLOWMO_SCALE = 0.3`, `SLOWMO_ROWS_BEFORE_END = 3`, `DECOY_CHANCE = 0.5`, `PRESENTER_LONGPRESS_MS = 2000`, `ATTRACT_DROP_INTERVAL = 2.2`, `ATTRACT_SHOWCASE_INTERVAL = 20`, `ATTRACT_RAIN_COUNT = 60`, `MAX_QUEUED_DROPS = 5`.
- Produces: `src/strings.ts`, объект `S` со строками: `drop: 'DROP'`, `bet: 'BET'`, `risk: 'RISK'`, `rows: 'ROWS'`, `balance: 'BALANCE'`, `rain: '100 BALLS'`, `low: 'LOW'`, `medium: 'MEDIUM'`, `high: 'HIGH'`, `bigWin: 'BIG WIN'`, `megaWin: 'MEGA WIN'`, `totalWin: 'TOTAL WIN'`, `tapToPlay: 'TAP TO PLAY'`, `refill: 'BALANCE REFILLED'`, `presenterBig: 'NEXT: BIG WIN'`, `presenterRain: 'FREE 100 BALLS'`, `exit: 'EXIT'`.
- Consumes: `shared/brand/fonts.css`, `shared/brand/tokens.css`, `shared/brand/tokens.ts`.

- [ ] **Step 1: Репозиторий** (решение заказчика: один репозиторий на весь `conference-demos/`). Если в `conference-demos/` ещё нет git, выполнить там `git init`, создать корневой `.gitignore` (`node_modules/`, `dist/`, `.superpowers/`, `test-results/`, `playwright-report/`) и сделать первый коммит из `.gitignore`, `docs/concepts.md` и `shared/brand/`. Папки других демо не добавлять: их ведут другие сессии. Дальше коммитить только пути внутри `demos/plinko-3d/`.

- [ ] **Step 2: Создать Vite-проект React + TS** в `demos/plinko-3d/` (без шаблонного мусора), поставить зависимости из Tech Stack и dev-зависимости `vitest`, `@playwright/test`, `vite-plugin-pwa`, `@vite-pwa/assets-generator`. Скрипты в `package.json`: `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`), `e2e` (`playwright test`), `icons` (`pwa-assets-generator`).

- [ ] **Step 3: Подключить `@brand`** в `vite.config.ts` (алиас и `server.fs.allow` по `shared/brand/README.md`), `paths` в `tsconfig.json`, `base: './'`. В `global.css` импортировать `@brand/fonts.css` и `@brand/tokens.css`. Фон `body` градиент `#1b0f3d` → `#06030f`, `margin: 0`, `overflow: hidden`, `overscroll-behavior: none`, `touch-action: none` на корне, `user-select: none`.

- [ ] **Step 4: `index.html`:** `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`, `theme-color` `#06030f`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` `black-translucent`, `<title>Clickable Plinko</title>`, favicon `@brand/logo/favicon-32x32.png` (через импорт в `main.tsx` или `<link>` с путём, который Vite перепишет).

- [ ] **Step 5: Написать тест** `src/config.test.ts`:

```ts
import { BETS, DEFAULT_BET, START_BALANCE, DEFAULT_ROWS, DEFAULT_RISK } from './config';
test('defaults match spec', () => {
  expect(START_BALANCE).toBe(10000);
  expect(BETS).toContain(DEFAULT_BET);
  expect(DEFAULT_ROWS).toBe(12);
  expect(DEFAULT_RISK).toBe('high');
});
```

- [ ] **Step 6: `App.tsx`** временно рисует по центру `brandLogo.red` из `@brand/tokens` и надпись `S.drop` шрифтом `var(--ck-font-display)`.

- [ ] **Step 7: Проверить.** `npm test` → PASS. `npm run build` → без ошибок, в `dist/assets/` есть `CLICKABLE-Black*.woff2` и `clickable-logo-red*.svg`. `npm run dev`, открыть страницу: логотип и надпись DROP шрифтом Clickable на фиолетовом фоне, в консоли нет ошибок 403 от `/@fs/`.

- [ ] **Step 8: Commit** `chore: scaffold plinko-3d with shared brand`.

---

### Task 2: Базовые утилиты: типы, rng, шина событий, уровни, форматирование

**Files:**
- Create: `src/core/types.ts`, `src/core/rng.ts`, `src/core/events.ts`, `src/core/format.ts`, `src/math/tiers.ts`
- Test: `src/core/rng.test.ts`, `src/core/events.test.ts`, `src/core/format.test.ts`, `src/math/tiers.test.ts`

**Interfaces:**
- Produces `core/types.ts`: `type Risk = 'low' | 'medium' | 'high'`; `type Rows = 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16`; `ROWS_MIN = 8`, `ROWS_MAX = 16`, `ROWS_LIST: readonly Rows[]` (8…16), `RISKS: readonly Risk[]`; `type BallKind = 'player' | 'rain' | 'demo'`; `type RainMode = 'paid' | 'free' | 'demo'`; `type CelebrateKind = 'big' | 'mega' | 'total'`; `type Quality = 'high' | 'light'`.
- Produces `core/rng.ts`: `interface Rng { next(): number; int(maxExclusive: number): number; range(min: number, max: number): number; chance(p: number): boolean }`, `createRng(seed: number): Rng` (mulberry32), `seedFromSearch(search: string): number | null` (`?seed=123` → 123).
- Produces `core/events.ts`: `interface EventBus<E> { on<K extends keyof E>(type: K, fn: (p: E[K]) => void): () => void; emit<K extends keyof E>(type: K, p: E[K]): void }`, `createBus<E>(): EventBus<E>`, и тип событий:

```ts
export type GameEvents = {
  'ball:spawn': { ballId: number; kind: BallKind };
  'peg:hit': { ballId: number; row: number; index: number; speed: number; kind: BallKind };
  'ball:land': { ballId: number; slot: number; multiplier: number; tier: Tier; win: number; kind: BallKind };
  'ball:gone': { ballId: number };
  'board:clear': Record<string, never>;
  'slowmo:start': { ballId: number; reason: 'win' | 'decoy' };
  'slowmo:end': { ballId: number };
  'rain:start': { count: number; mode: RainMode };
  'rain:end': { totalWin: number; totalBet: number; mode: RainMode };
  'balance:refill': { from: number; to: number };
  'celebrate:start': { kind: CelebrateKind; amount: number; slot: number | null };
  'celebrate:tick': Record<string, never>;
  'celebrate:end': { kind: CelebrateKind };
  'ui:click': Record<string, never>;
};
```

- Produces `math/tiers.ts`: `type Tier = 'sub' | 'normal' | 'large' | 'big' | 'mega'`, `TIER_RANK: Record<Tier, number>` (0…4), `tierOf(multiplier: number): Tier`.
- Produces `core/format.ts`: `formatCredits(n: number): string`, `formatMultiplier(m: number): string`.

- [ ] **Step 1: Написать тесты:**

```ts
// rng.test.ts
test('same seed, same sequence', () => {
  const a = createRng(42), b = createRng(42);
  expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
});
test('next in [0,1), int in range', () => {
  const r = createRng(1);
  for (let i = 0; i < 10000; i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); expect(r.int(7)).toBeLessThan(7); }
});
test('seedFromSearch', () => { expect(seedFromSearch('?seed=123')).toBe(123); expect(seedFromSearch('?x=1')).toBeNull(); });
// events.test.ts
test('on/emit/unsubscribe', () => {
  const bus = createBus<{ a: number }>(); const got: number[] = [];
  const off = bus.on('a', v => got.push(v)); bus.emit('a', 1); off(); bus.emit('a', 2);
  expect(got).toEqual([1]);
});
// tiers.test.ts
test('tier thresholds', () => {
  expect(tierOf(0.99)).toBe('sub'); expect(tierOf(1)).toBe('normal'); expect(tierOf(4.9)).toBe('normal');
  expect(tierOf(5)).toBe('large'); expect(tierOf(24.9)).toBe('large'); expect(tierOf(25)).toBe('big');
  expect(tierOf(99)).toBe('big'); expect(tierOf(100)).toBe('mega');
});
// format.test.ts
test('credits and multipliers', () => {
  expect(formatCredits(10000)).toBe('10,000'); expect(formatCredits(1234567)).toBe('1,234,567'); expect(formatCredits(0)).toBe('0');
  expect(formatMultiplier(0.3)).toBe('0.3x'); expect(formatMultiplier(29)).toBe('29x'); expect(formatMultiplier(1.5)).toBe('1.5x'); expect(formatMultiplier(1000)).toBe('1000x');
});
```

- [ ] **Step 2: Запустить** `npm test` → FAIL (модулей нет).
- [ ] **Step 3: Реализовать модули.** `formatCredits` через `Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })`; `formatMultiplier` без группировки разрядов и без хвостовых нулей.
- [ ] **Step 4: Запустить** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: core types, rng, event bus, tiers, formatting`.

---

### Task 3: Таблицы выплат и выбор исхода

**Files:**
- Create: `src/math/paytable.ts`, `src/math/outcome.ts`
- Test: `src/math/paytable.test.ts`, `src/math/outcome.test.ts`

**Interfaces:**
- Consumes: `Risk`, `Rows`, `Tier`, `tierOf`, `TIER_RANK`, `Rng`.
- Produces `paytable.ts`:
  - `interface Paytable { risk: Risk; rows: Rows; multipliers: readonly number[]; weights: readonly number[] }` (длина `rows + 1`, сумма весов 1);
  - `MULTIPLIERS: Record<Risk, Record<Rows, readonly number[]>>`, данные пишутся вручную;
  - `tierTargets(risk: Risk, rows: Rows): Partial<Record<Tier, number>>`;
  - `weightsFor(multipliers: readonly number[], rows: Rows, targets: Partial<Record<Tier, number>>): number[]`;
  - `getPaytable(risk: Risk, rows: Rows): Paytable` (мемоизирован);
  - `rtp(t: Paytable): number`, `probability(t: Paytable, pred: (tier: Tier) => boolean): number`.
- Produces `outcome.ts`: `pickSlot(t: Paytable, rng: Rng): number`, `bigCells(t: Paytable): number[]` (индексы ячеек с множителем ≥ 25), `pickForcedBig(t: Paytable, rng: Rng): number | null` (равновероятно среди `bigCells`, `null`, если их нет).

**Целевые частоты** (из спеки, раздел 6; `sub` получает остаток до 1):

| risk | mega | big | large | normal |
|---|---|---|---|---|
| high | 0.005 | 0.0167 | 0.058 | 0.25 |
| medium, rows ≥ 14 | 0.0017 | 0.0067 | 0.043 | 0.32 |
| medium, rows < 14 | — | 0.0067 | 0.043 | 0.32 |
| low | — | — | 0.025 | 0.50 |

**Алгоритм `weightsFor`:** база биномиальная, `b_k = C(rows, k) / 2^rows`. Ячейки группируются по `tierOf(m_k)`. Для уровня `T` с целью `p_T` вес ячейки `w_k = p_T · b_k / Σ_{j∈T} b_j`. Цель `sub` равна `1 − Σ` остальных. Функция бросает ошибку, если у уровня есть ячейки, а цели нет (или она 0), или есть цель, а ячеек нет. Так биномиальная форма сохраняется внутри уровня, а частоты уровней задаются точно.

**Множители** автор задаёт сам в пределах тестов. Ориентир стиля для high/12: `[100, 30, 8, 3, 1.2, 0.3, 0.2, 0.3, 1.2, 3, 8, 30, 100]`, RTP ≈ 2.08.

- [ ] **Step 1: Написать тесты** `paytable.test.ts`, перебор всех 27 комбинаций `RISKS × 8..16`:

```ts
const all = RISKS.flatMap(risk => ROWS_LIST.map(rows => getPaytable(risk, rows)));
test.each(all)('$risk/$rows shape', t => {
  const m = t.multipliers; expect(m).toHaveLength(t.rows + 1);
  m.forEach((v, i) => expect(v).toBe(m[m.length - 1 - i]));                     // симметрия
  const c = Math.floor(t.rows / 2); for (let i = c; i > 0; i--) expect(m[i - 1]).toBeGreaterThanOrEqual(m[i]); // растёт к краям
  expect(t.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  t.weights.forEach(w => expect(w).toBeGreaterThan(0));                          // каждая ячейка достижима
  expect(m.some(v => v < 1)).toBe(true);
});
test.each(all)('$risk/$rows rates and rtp', t => {
  const p = (tiers: Tier[]) => probability(t, x => tiers.includes(x));
  expect(rtp(t)).toBeGreaterThanOrEqual(1.05); expect(rtp(t)).toBeLessThanOrEqual(2.2);
  expect(p(['normal', 'large', 'big', 'mega'])).toBeGreaterThanOrEqual(0.30);
  if (t.risk === 'high') {
    expect(p(['large', 'big', 'mega'])).toBeGreaterThanOrEqual(1 / 15); expect(p(['large', 'big', 'mega'])).toBeLessThanOrEqual(1 / 10);
    expect(p(['big'])).toBeCloseTo(1 / 60, 3); expect(p(['mega'])).toBeCloseTo(1 / 200, 3);
  }
  if (t.risk === 'medium') { expect(p(['big'])).toBeGreaterThan(0); expect(p(['mega']) > 0).toBe(t.rows >= 14); }
  if (t.risk === 'low') { expect(p(['big', 'mega'])).toBe(0); expect(p(['large'])).toBeCloseTo(0.025, 3); }
});
test.each(RISKS)('%s edge multiplier grows with rows', risk => {
  for (let r = 9; r <= 16; r++) expect(MULTIPLIERS[risk][r as Rows][0]).toBeGreaterThanOrEqual(MULTIPLIERS[risk][(r - 1) as Rows][0]);
});
test('weightsFor rejects a tier with cells but no target', () => {
  expect(() => weightsFor([30, 1, 0.5, 1, 30], 4 as Rows, { normal: 0.5 })).toThrow();
});
```

`outcome.test.ts`:

```ts
test('pickSlot follows weights (100k draws)', () => {
  const t = getPaytable('high', 12), rng = createRng(7), n = 100_000, counts = new Array(13).fill(0);
  for (let i = 0; i < n; i++) counts[pickSlot(t, rng)]++;
  counts.forEach((c, k) => expect(Math.abs(c / n - t.weights[k])).toBeLessThan(Math.max(0.003, t.weights[k] * 0.25)));
});
test('forced big picks only >=25x cells, null when none', () => {
  const rng = createRng(3), hi = getPaytable('high', 8);
  for (let i = 0; i < 200; i++) expect(hi.multipliers[pickForcedBig(hi, rng)!]).toBeGreaterThanOrEqual(25);
  expect(pickForcedBig(getPaytable('low', 8), rng)).toBeNull();
});
```

- [ ] **Step 2: Запустить** → FAIL.
- [ ] **Step 3: Реализовать** `weightsFor`, `tierTargets`, `getPaytable`, `rtp`, `probability`, `pickSlot` (кумулятивные веса), `bigCells`, `pickForcedBig`. Заполнить `MULTIPLIERS` для всех 27 комбинаций и подбирать значения, пока тесты не станут зелёными.
- [ ] **Step 4: Запустить** → PASS. Добавить в README таблицу RTP и частот по всем комбинациям (вывести одноразовым скриптом или из теста через `console.table`).
- [ ] **Step 5: Commit** `feat: generous demo paytables and outcome selection`.

---

### Task 4: Геометрия пирамиды и решения пути

**Files:**
- Create: `src/math/layout.ts`, `src/math/decisions.ts`
- Test: `src/math/layout.test.ts`, `src/math/decisions.test.ts`

**Interfaces:**
- Produces `layout.ts`: `SPACING = 1`, `ROW_HEIGHT = 0.92`, `PEG_RADIUS = 0.12`, `BALL_RADIUS = 0.2`, `SLOT_DROP = 0.95`, `GEM_TOP = 0.18`, `SPAWN_HEIGHT = 1.6`;
  `interface Peg { row: number; index: number; flat: number; x: number; y: number }`, `interface SlotPos { index: number; x: number; y: number }`,
  `interface BoardLayout { rows: Rows; pegs: Peg[]; slots: SlotPos[]; spawn: { x: number; y: number }; bounds: { minX: number; maxX: number; minY: number; maxY: number } }`,
  `boardLayout(rows: Rows): BoardLayout` (мемоизирован), `pegFlatIndex(row: number, index: number): number` (= `row*(row+5)/2 + index`), `pegCount(rows: Rows): number` (= `rows*(rows+5)/2`).
  Ряд `r` содержит `r + 3` кристалла: `x = (index − (r+2)/2) · SPACING`, `y = −r · ROW_HEIGHT`. Ячейка `k`: `x = (k − rows/2) · SPACING`, `y = −(rows−1) · ROW_HEIGHT − SLOT_DROP`. Точка появления `(0, SPAWN_HEIGHT)`. `bounds` охватывает кристаллы, камни (полуширина 0.45, высота 0.32) и точку появления.
- Produces `decisions.ts`: `type Step = -1 | 1`;
  `buildDecisions(rows: Rows, slot: number, rng: Rng, lastStep?: Step): Step[]` (ровно `slot` шагов `+1`, перемешано; если задан `lastStep` и это возможно, последний шаг равен ему);
  `columnsOf(steps: Step[]): number[]` (смещение кристалла, которого шарик касается в каждом ряду: `c0 = 0`, `c[r+1] = c[r] + steps[r]/2`, длина `rows`);
  `pegIndexAt(row: number, column: number): number` (= `column + (row+2)/2`);
  `alternativeSlot(slot: number, steps: Step[]): number` (= `slot − steps[last]`: ячейка, куда шарик попал бы при обратном последнем шаге).

- [ ] **Step 1: Написать тесты:**

```ts
test('peg counts and flat index', () => {
  expect(pegCount(16)).toBe(168); expect(pegCount(8)).toBe(52);
  expect(pegFlatIndex(1, 0)).toBe(3); expect(pegFlatIndex(2, 0)).toBe(7);
  const L = boardLayout(12); expect(L.pegs).toHaveLength(pegCount(12)); expect(L.slots).toHaveLength(13);
  L.pegs.forEach(p => expect(p.flat).toBe(pegFlatIndex(p.row, p.index)));
});
test('ball fits between pegs', () => { expect(SPACING - 2 * PEG_RADIUS).toBeGreaterThan(2 * BALL_RADIUS * 1.5); });
test('slots sit between last-row pegs', () => {
  const L = boardLayout(10), last = L.pegs.filter(p => p.row === 9);
  L.slots.forEach((s, k) => expect(s.x).toBeCloseTo((last[k].x + last[k + 1].x) / 2, 9));
});
test.each([0, 3, 6, 12])('decisions reach slot %i', slot => {
  const steps = buildDecisions(12, slot, createRng(slot));
  expect(steps).toHaveLength(12); expect(steps.filter(s => s === 1)).toHaveLength(slot);
  const cols = columnsOf(steps); expect(cols[0]).toBe(0);
  cols.forEach((c, r) => { const i = pegIndexAt(r, c); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(r + 3); });
});
test('lastStep honoured when feasible, alternative slot', () => {
  const s = buildDecisions(12, 5, createRng(1), -1); expect(s[11]).toBe(-1); expect(alternativeSlot(5, s)).toBe(6);
  expect(buildDecisions(12, 0, createRng(1), 1)[11]).toBe(-1); // нет ни одного +1: lastStep игнорируется
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать.** **Step 4: Запустить** → PASS.
- [ ] **Step 5: Commit** `feat: board layout and path decisions`.

---

### Task 5: Траектория шарика

**Files:**
- Create: `src/math/trajectory.ts`
- Test: `src/math/trajectory.test.ts`

**Interfaces:**
- Consumes: `BoardLayout`, `Step`, `columnsOf`, `pegIndexAt`, константы `layout.ts`, `Rng`.
- Produces: `GRAVITY = 32`;
  `interface Contact { row: number; index: number; t: number; x: number; y: number; speedIn: number; speedOut: number; micro: boolean }` (`micro: true` у второго касания двойного отскока: шарик скатывается с кристалла и может уходить быстрее, чем пришёл);
  `interface Segment { t0: number; t1: number; x0: number; y0: number; vx: number; vy: number; spin: number; angle0: number }`;
  `interface Trajectory { segments: Segment[]; contacts: Contact[]; landT: number; endT: number; slot: number }`;
  `buildTrajectory(layout: BoardLayout, steps: Step[], rng: Rng, opts?: { jitterX?: number }): Trajectory`;
  `interface BallSample { x: number; y: number; angle: number; segment: number }`;
  `sampleTrajectory(tr: Trajectory, t: number, out?: BallSample): BallSample` (за пределами `[0, endT]` возвращает крайние значения).

**Алгоритм** (выбран вместо записанной физики: точные параболы под постоянной гравитацией, исход гарантирован построением, дёшево для 100 шариков):
1. Точка касания кристалла в ряду `r`: угол `θ ∈ [0.18, 0.6]` рад от вертикали в сторону `steps[r]`; `x = pegX + steps[r]·sinθ·(PEG_RADIUS+BALL_RADIUS)`, `y = pegY + cosθ·(PEG_RADIUS+BALL_RADIUS)`.
2. Первый отрезок: из `(jitterX, SPAWN_HEIGHT)` с `vy = 0` до касания в ряду 0: `T = √(2Δy/g)`, `vx = Δx/T`.
3. Между касаниями: высота подскока `h ∈ [0.03, 0.22]`, `vy = √(2gh)`, `T = (vy + √(vy² + 2g(y0−y1)))/g`, `vx = Δx/T`. Если `speedOut > 0.85·speedIn`, `h` уменьшается вдвое (не ниже 0.01).
4. Двойной отскок: с вероятностью 0.12 (кроме последнего ряда) вставить микро-подскок по тому же кристаллу: от `θ1` к `θ1 + 0.35` в ту же сторону, `h ∈ [0.02, 0.05]`. Это второй `Contact` с тем же `row`/`index`.
5. Последний полёт до точки `(slot.x ± 0.08, slot.y + GEM_TOP + BALL_RADIUS)` по тому же правилу, это `landT`. Затем два затухающих подскока на месте (`h = 0.12`, `0.04`), конец последнего даёт `endT`.
6. Вращение: на отрезке `spin = −vx / BALL_RADIUS`, `angle0` непрерывно накапливается.

- [ ] **Step 1: Написать тесты:**

```ts
const make = (rows: Rows, slot: number, seed: number) => {
  const rng = createRng(seed); const L = boardLayout(rows);
  return { L, tr: buildTrajectory(L, buildDecisions(rows, slot, rng), rng) };
};
test('contacts follow decisions and land in slot', () => {
  const { L, tr } = make(12, 9, 5);
  expect(tr.contacts[0]).toMatchObject({ row: 0, index: 1 });
  const rows = [...new Set(tr.contacts.map(c => c.row))]; expect(rows).toEqual([...Array(12).keys()]);
  const s = sampleTrajectory(tr, tr.landT); expect(Math.abs(s.x - L.slots[9].x)).toBeLessThanOrEqual(0.1);
});
test('continuous at segment boundaries', () => {
  const { tr } = make(14, 3, 9);
  tr.segments.slice(1).forEach(sg => {
    const a = sampleTrajectory(tr, sg.t0 - 1e-7), b = sampleTrajectory(tr, sg.t0 + 1e-7);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-4);
  });
});
test('no energy gain at bounces', () => {
  for (let seed = 0; seed < 200; seed++) make(16, seed % 17, seed).tr.contacts.slice(1).filter(c => !c.micro).forEach(c => expect(c.speedOut).toBeLessThanOrEqual(c.speedIn * 0.85 + 1e-9));
});
test('never penetrates pegs', () => {
  for (let seed = 0; seed < 100; seed++) {
    const { L, tr } = make(16, seed % 17, seed);
    for (let t = 0; t <= tr.landT; t += 0.005) {
      const s = sampleTrajectory(tr, t);
      L.pegs.forEach(p => expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeGreaterThanOrEqual(PEG_RADIUS + BALL_RADIUS - 0.02));
    }
  }
});
test('durations', () => {
  expect(make(8, 4, 1).tr.landT).toBeGreaterThan(1.2);
  const t12 = make(12, 6, 1).tr.landT; expect(t12).toBeGreaterThan(2.0); expect(t12).toBeLessThan(4.5);
  expect(make(16, 8, 1).tr.landT).toBeLessThan(5.5);
});
test('deterministic per seed', () => { expect(make(12, 2, 77).tr).toEqual(make(12, 2, 77).tr); });
test('double bounce rate ~12%', () => {
  let extra = 0, rows = 0;
  for (let seed = 0; seed < 2000; seed++) { const { tr } = make(12, seed % 13, seed); extra += tr.contacts.length - 12; rows += 11; }
  expect(extra / rows).toBeGreaterThan(0.09); expect(extra / rows).toBeLessThan(0.15);
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать** по алгоритму. Если тест на проникновение падает, сузить диапазоны `h` и `θ`, а не ослаблять тест. **Step 4: Запустить** → PASS.
- [ ] **Step 5: Commit** `feat: ballistic ball trajectories to predetermined slot`.

---

### Task 6: Состояние игры (zustand)

**Files:**
- Create: `src/state/store.ts`
- Test: `src/state/store.test.ts`

**Interfaces:**
- Produces:

```ts
export interface HistoryItem { id: number; multiplier: number; tier: Tier }
export interface GameState {
  balance: number; bet: number; risk: Risk; rows: Rows; muted: boolean; quality: Quality;
  mode: 'splash' | 'play' | 'attract'; inFlight: number; history: HistoryItem[]; // новые первыми, не больше HISTORY_MAX
  setBet(b: number): void; stepBet(dir: 1 | -1): void;
  setRisk(r: Risk): boolean; setRows(n: Rows): boolean;  // false и без изменений, если inFlight > 0
  debit(amount: number): boolean;                         // false, если не хватает
  credit(amount: number): void; refill(): void;           // refill: balance = START_BALANCE
  pushHistory(multiplier: number): void;
  setMuted(m: boolean): void; setQuality(q: Quality): void; setMode(m: GameState['mode']): void; setInFlight(n: number): void;
}
export function createGameStore(deps?: { storage?: Pick<Storage, 'getItem' | 'setItem'> | null }): StoreApi<GameState>; // zustand/vanilla
export const gameStore: StoreApi<GameState>;
export function useGame<T>(selector: (s: GameState) => T): T;
```

Сохраняется только `muted`, ключ `plinko3d.muted`, каждое обращение к хранилищу в try/catch. Стартовые значения: `START_BALANCE`, `DEFAULT_BET`, `DEFAULT_RISK`, `DEFAULT_ROWS`, `muted` из хранилища или `false`, `quality: 'high'`, `mode: 'splash'`.

- [ ] **Step 1: Написать тесты:**

```ts
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
test('debit never goes negative', () => {
  const s = createGameStore({ storage: mem() }).getState();
  expect(s.debit(10_001)).toBe(false); expect(s.debit(10_000)).toBe(true);
});
test('risk/rows locked while balls in flight', () => {
  const st = createGameStore({ storage: mem() }); st.getState().setInFlight(2);
  expect(st.getState().setRows(16)).toBe(false); expect(st.getState().rows).toBe(12);
  expect(st.getState().setRisk('low')).toBe(false); expect(st.getState().risk).toBe('high');
  st.getState().setInFlight(0); expect(st.getState().setRows(16)).toBe(true);
});
test('bet stepping clamps to BETS', () => {
  const st = createGameStore({ storage: mem() }); for (let i = 0; i < 20; i++) st.getState().stepBet(1);
  expect(st.getState().bet).toBe(1000); for (let i = 0; i < 20; i++) st.getState().stepBet(-1); expect(st.getState().bet).toBe(10);
});
test('history newest first, capped', () => {
  const st = createGameStore({ storage: mem() }); for (let i = 0; i < 20; i++) st.getState().pushHistory(i);
  expect(st.getState().history).toHaveLength(12); expect(st.getState().history[0].multiplier).toBe(19);
});
test('muted persists', () => {
  const storage = mem(); createGameStore({ storage }).getState().setMuted(true);
  expect(createGameStore({ storage }).getState().muted).toBe(true);
});
test('works when storage throws', () => {
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const st = createGameStore({ storage: bad }); expect(st.getState().muted).toBe(false);
  expect(() => st.getState().setMuted(true)).not.toThrow(); expect(st.getState().muted).toBe(true);
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать** (`gameStore` использует `window.localStorage`, обёрнутый в try/catch при получении). **Step 4: Запустить** → PASS.
- [ ] **Step 5: Commit** `feat: game store with locked settings and safe persistence`.

---

### Task 7: Симуляция: шарики, замедление, контроллер

**Files:**
- Create: `src/sim/BallSystem.ts`, `src/sim/slowmo.ts`, `src/sim/controller.ts`, `src/sim/SimProvider.tsx`, `src/sim/testkit.ts`
- Test: `src/sim/BallSystem.test.ts`, `src/sim/slowmo.test.ts`, `src/sim/controller.test.ts`

**Interfaces:**
- Consumes: всё из задач 2–6.
- Produces `BallSystem.ts`:

```ts
export interface Ball {
  id: number; kind: BallKind; bet: number; slot: number; multiplier: number; tier: Tier;
  traj: Trajectory; t: number; nextContact: number; landed: boolean; sample: BallSample;
  slowMo: 'win' | 'decoy' | null;
}
export class BallSystem {
  constructor(bus: EventBus<GameEvents>);
  timeScale: number;                 // 1 по умолчанию, меняет SlowMoDirector
  readonly balls: Ball[];
  add(spec: Omit<Ball, 'id' | 't' | 'nextContact' | 'landed' | 'sample'>): Ball;
  update(realDt: number): void;      // dt = min(realDt, MAX_DT) * timeScale
}
```

`update` по порядку испускает `peg:hit` на каждое пройденное касание (`speed = contact.speedIn`), `ball:land` при переходе `landT` (`win = Math.round(bet * multiplier)`), `ball:gone` с удалением шарика при `endT`, `board:clear`, когда ушёл последний.

- Produces `slowmo.ts`:
  `slowMoReason(a: { tier: Tier; altTier: Tier; alone: boolean; decoyRoll: number }): 'win' | 'decoy' | null`. Без `alone` всегда `null`; `TIER_RANK[tier] >= TIER_RANK.large` → `'win'`; `TIER_RANK[altTier] >= TIER_RANK.large && decoyRoll < DECOY_CHANCE` → `'decoy'`.
  `class SlowMoDirector { constructor(system: BallSystem, bus: EventBus<GameEvents>); readonly activeBallId: number | null; update(realDt: number): void }`. Старт: у шарика `slowMo !== null`, он единственный в `system.balls`, и его `t` дошёл до `contacts` первого касания ряда `rows − SLOWMO_ROWS_BEFORE_END`. Тогда `timeScale` плавно (smoothstep по реальному времени) идёт к `SLOWMO_SCALE` за 0.25 с и испускается `slowmo:start`. Если к этому моменту шарик не один, замедление для него отменяется. После `ball:land` этого шарика `timeScale` возвращается к 1 за 0.4 с, затем `slowmo:end`.
- Produces `controller.ts`:

```ts
export class GameController {
  constructor(deps: { store: StoreApi<GameState>; bus: EventBus<GameEvents>; rng: Rng; system: BallSystem; slowmo: SlowMoDirector });
  drop(opts?: { kind?: 'player' | 'demo'; forceBig?: boolean }): void;
  rain(opts: { mode: RainMode; count?: number }): void;
  forceBigNext(): void;
  readonly rainActive: boolean;
  readonly celebrating: boolean;
  update(realDt: number): void;      // расписание дождя, очередь, system.update, slowmo.update, store.setInFlight
}
```

Правила:
- `drop` игрока: при активном замедлении бросок встаёт в очередь (не больше `MAX_QUEUED_DROPS`) и выполняется после `slowmo:end`. Игнорируется при `celebrating` и при `balls.length >= MAX_ACTIVE_BALLS`. Если `balance < bet`: `refill()`, затем `balance:refill`. Дальше `debit(bet)`, выбор ячейки (`pickSlot`, или `pickForcedBig` для `forceBig` и для флага `forceBigNext`), `lastStep` для обманки (если ячейка не large+ и соседняя по последнему шагу large+, с вероятностью 0.5 ставится шаг, делающий её альтернативой), траектория с `jitterX ∈ [−0.15, 0.15]`, `slowMo = slowMoReason({ alone: balls.length === 0, … })`.
- `forceBigNext`: если в текущей таблице нет `bigCells`, риск переключается на `'high'` сразу при пустом поле, иначе по `board:clear` (через `setRisk`). Флаг срабатывает на следующем броске игрока.
- `rain`: `paid`: `count = min(RAIN_COUNT, floor(balance / bet))`, при 0 сначала refill; ставка списывается за каждый шарик при его появлении. `free` и `demo` ничего не списывают. Шарики появляются каждые `RAIN_SPAWN_INTERVAL` с `kind: 'rain'` (для `demo` `kind: 'demo'`) и `slowMo: null`. `rain:start`, затем, когда приземлился последний шарик дождя, `rain:end` с суммой выигрышей и ставок.
- `ball:land`: при `kind !== 'demo'` выполнить `credit(win)` и `pushHistory(multiplier)`. Если шарик не из дождя и `tier` big/mega, `celebrate:start { kind: tier, amount: win, slot }`. После `rain:end` идёт `celebrate:start { kind: 'total', amount: totalWin, slot: null }`. Флаг `celebrating` держится до `celebrate:end` (его испускает оверлей, задача 14).
- Produces `SimProvider.tsx`: `interface Sim { bus; store; rng; system; slowmo; controller }`, `createSim(opts: { seed: number; store?: StoreApi<GameState> }): Sim`, `SimContext`, `useSim(): Sim`, `<SimDriver />` (внутри `<Canvas>`: `useFrame((_, dt) => sim.controller.update(dt), -1)`). Seed берётся из `seedFromSearch(location.search) ?? Date.now()`.

- Produces `testkit.ts` (только для тестов): `setup(seed: number): { st: StoreApi<GameState>; bus: EventBus<GameEvents>; sys: BallSystem; slowmo: SlowMoDirector; ctl: GameController; run(sec: number): void }`. Стор с хранилищем в памяти, `run` вызывает `ctl.update(1/60)` нужное число раз.

- [ ] **Step 1: Написать тесты:**

```ts
test('drop debits, lands, credits, history', () => {
  const { st, bus, ctl, run } = setup(1); const lands: any[] = []; bus.on('ball:land', e => lands.push(e));
  ctl.drop(); expect(st.getState().balance).toBe(10000 - 100); run(8);
  expect(lands).toHaveLength(1); expect(st.getState().balance).toBe(9900 + lands[0].win); expect(st.getState().history).toHaveLength(1);
});
test('peg hits arrive in row order before land', () => {
  const { bus, ctl, run } = setup(2); const seq: string[] = [];
  bus.on('peg:hit', e => seq.push('p' + e.row)); bus.on('ball:land', () => seq.push('land'));
  ctl.drop(); run(8); expect(seq.at(-1)).toBe('land'); expect(seq.filter(s => s === 'p0').length).toBeGreaterThanOrEqual(1);
});
test('spam drop: never negative, capped balls', () => {
  const { st, sys, ctl, run } = setup(3);
  for (let i = 0; i < 1000; i++) { ctl.drop(); if (i % 10 === 0) run(0.05); expect(st.getState().balance).toBeGreaterThanOrEqual(0); expect(sys.balls.length).toBeLessThanOrEqual(MAX_ACTIVE_BALLS); }
});
test('huge dt is clamped (hidden tab)', () => {
  const { sys, ctl } = setup(4); ctl.drop(); const t0 = sys.balls[0].t; ctl.update(5); expect(sys.balls[0].t - t0).toBeLessThanOrEqual(MAX_DT + 1e-9);
});
test('refill when broke', () => {
  const { st, bus, ctl } = setup(5); st.setState({ balance: 50 }); const ev: any[] = []; bus.on('balance:refill', e => ev.push(e));
  ctl.drop(); expect(ev).toHaveLength(1); expect(st.getState().balance).toBe(10000 - 100);
});
test('paid rain spends at most 100 bets and emits total', () => {
  const { st, bus, ctl, run } = setup(6); let end: any; bus.on('rain:end', e => (end = e));
  ctl.rain({ mode: 'paid' }); run(20); expect(end.totalBet).toBe(100 * 100); expect(st.getState().balance).toBe(10000 - 10000 + end.totalWin);
});
test('demo balls never touch balance', () => {
  const { st, ctl, run } = setup(7); ctl.rain({ mode: 'demo', count: 30 }); ctl.drop({ kind: 'demo' }); run(20); expect(st.getState().balance).toBe(10000);
});
test('forceBigNext lands >=25x and switches risk if needed', () => {
  const { st, bus, ctl, run } = setup(8); st.getState().setRisk('low'); let land: any; bus.on('ball:land', e => (land = e));
  ctl.forceBigNext(); expect(st.getState().risk).toBe('high'); ctl.drop(); run(8); expect(land.multiplier).toBeGreaterThanOrEqual(25);
});
test('drops during slow-mo are queued, then flushed', () => {
  const { bus, ctl, sys, run } = setup(9); const log: string[] = [];
  bus.on('slowmo:start', () => log.push('start')); bus.on('slowmo:end', () => log.push('end')); bus.on('ball:spawn', () => log.push('spawn'));
  ctl.drop({ forceBig: true }); while (!log.includes('start')) run(0.05);
  ctl.drop(); ctl.drop(); expect(sys.balls).toHaveLength(1);
  run(8); expect(log.slice(log.indexOf('end'))).toEqual(['end', 'spawn', 'spawn']);
});
// slowmo.test.ts
test('slowMoReason rules', () => {
  expect(slowMoReason({ tier: 'large', altTier: 'sub', alone: false, decoyRoll: 0 })).toBeNull();
  expect(slowMoReason({ tier: 'big', altTier: 'sub', alone: true, decoyRoll: 0.9 })).toBe('win');
  expect(slowMoReason({ tier: 'normal', altTier: 'large', alone: true, decoyRoll: 0.4 })).toBe('decoy');
  expect(slowMoReason({ tier: 'normal', altTier: 'large', alone: true, decoyRoll: 0.6 })).toBeNull();
});
test('director slows down and restores', () => {
  const { bus, ctl, sys, run } = setup(10); const ev: string[] = []; let min = 1;
  bus.on('slowmo:start', () => ev.push('start')); bus.on('slowmo:end', () => ev.push('end'));
  ctl.drop({ forceBig: true }); for (let i = 0; i < 60 * 12; i++) { run(1 / 60); min = Math.min(min, sys.timeScale); }
  expect(min).toBeCloseTo(SLOWMO_SCALE, 2); expect(sys.timeScale).toBe(1); expect(ev).toEqual(['start', 'end']);
});
test('no slow-mo when another ball is in flight', () => {
  const { bus, ctl, run } = setup(11); let started = false; bus.on('slowmo:start', () => (started = true));
  ctl.drop({ forceBig: true }); run(0.2); ctl.drop(); run(10); expect(started).toBe(false);
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать** три класса и `SimProvider.tsx`. **Step 4: Запустить** → PASS.
- [ ] **Step 5: Commit** `feat: ball simulation, slow-mo director, game controller`.

---

### Task 8: Сцена: Stage, кадрирование камеры, фон, окружение

**Files:**
- Create: `src/math/framing.ts`, `src/ui/layoutMetrics.ts`, `src/scene/Stage.tsx`, `src/scene/Background.tsx`, `src/scene/Lighting.tsx`, `src/scene/CameraRig.tsx` (базовый)
- Modify: `src/App.tsx`
- Test: `src/math/framing.test.ts`, `src/ui/layoutMetrics.test.ts`

**Interfaces:**
- Produces `framing.ts`: `interface Insets { top: number; right: number; bottom: number; left: number }`, `interface Framing { x: number; y: number; z: number; targetX: number; targetY: number }`, `computeFraming(bounds: BoardLayout['bounds'], viewport: { width: number; height: number }, insets: Insets, fovDeg: number, margin?: number): Framing`. Камера смотрит прямо на плоскость `z = 0`. Пирамида вписывается в свободный прямоугольник (viewport минус insets) с запасом `margin` (по умолчанию 0.6 мировых единиц) и центрируется в нём смещением камеры.
- Produces `layoutMetrics.ts`: `orientationOf(v: { width: number; height: number }): 'portrait' | 'landscape'`, `hudInsets(v: { width: number; height: number }): Insets`. Портрет: `top 72`, `bottom 232`, бока 8. Ландшафт: `left = clamp(0.2·w, 300, 420)`, `right = clamp(0.13·w, 200, 280)`, `top 24`, `bottom 24`. Те же числа HUD берёт в CSS-переменные (задача 13).
- Produces `Stage.tsx`: `<Stage>{children}</Stage>`: `<Canvas>` с `camera={{ fov: 35 }}`, `dpr` из уровня качества (задача 16, пока `[1, 2]`), `gl={{ antialias: false, powerPreference: 'high-performance' }}`, ACES-тонмаппинг, sRGB, внутри `<SimDriver />`, `<Lighting />`, `<Background />`, `<CameraRig />`.
- Produces `CameraRig.tsx`: ставит камеру по `computeFraming(boardLayout(rows).bounds, size, hudInsets(size), 35)` при изменении `rows` и размера окна, плюс лёгкий idle-дрейф ±0.05. Расширяется в задаче 12.
- `Background.tsx`: большая сфера с шейдерным вертикальным градиентом `#1b0f3d` → `#06030f`, мягкое радиальное свечение `#3a1d7a` за пирамидой, ~300 частиц пыли (`Points`, аддитивно, медленный дрейф; на `light` 120).
- `Lighting.tsx`: `<Environment resolution={256}>` только с дочерними `<Lightformer>`: белый ключевой сверху, лавандовые боковые, розово-фиолетовый снизу. Без `preset`. Плюс слабый `ambientLight`.

- [ ] **Step 1: Написать тесты** `framing.test.ts`. Вспомогательная функция проецирует мировую точку перспективной камерой (fov, aspect) в пиксели.

```ts
const L = boardLayout(16);
test.each([
  { v: { width: 390, height: 844 } },   // телефон, портрет
  { v: { width: 844, height: 390 } },   // телефон, ландшафт
  { v: { width: 1920, height: 1080 } }, // ноутбук
])('board fits free area $v.width x $v.height', ({ v }) => {
  const ins = hudInsets(v), f = computeFraming(L.bounds, v, ins, 35);
  const corners = [[L.bounds.minX, L.bounds.minY], [L.bounds.maxX, L.bounds.maxY], [L.bounds.minX, L.bounds.maxY], [L.bounds.maxX, L.bounds.minY]];
  const px = corners.map(([x, y]) => project(x, y, f, v, 35));
  px.forEach(p => { expect(p.x).toBeGreaterThanOrEqual(ins.left - 1); expect(p.x).toBeLessThanOrEqual(v.width - ins.right + 1); expect(p.y).toBeGreaterThanOrEqual(ins.top - 1); expect(p.y).toBeLessThanOrEqual(v.height - ins.bottom + 1); });
  const freeW = v.width - ins.left - ins.right, freeH = v.height - ins.top - ins.bottom;
  const w = Math.max(...px.map(p => p.x)) - Math.min(...px.map(p => p.x)), h = Math.max(...px.map(p => p.y)) - Math.min(...px.map(p => p.y));
  expect(Math.max(w / freeW, h / freeH)).toBeGreaterThan(0.8);                 // пирамида не мелкая
});
test('orientation', () => { expect(orientationOf({ width: 390, height: 844 })).toBe('portrait'); expect(orientationOf({ width: 1920, height: 1080 })).toBe('landscape'); });
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать** `framing.ts`, `layoutMetrics.ts`, затем компоненты сцены. `App.tsx` создаёт `Sim` через `createSim` и рендерит `<SimContext.Provider><Stage /></SimContext.Provider>`. **Step 4: Запустить** `npm test` → PASS.
- [ ] **Step 5: Визуальная проверка.** `npm run dev`, Playwright-скриншоты 390×844 и 1920×1080: фиолетовый градиент, свечение, пыль, ошибок в консоли нет, во вкладке Network нет запросов кроме localhost.
- [ ] **Step 6: Commit** `feat: stage, camera framing, background and environment`.

---

### Task 9: Кристаллы и камни-ячейки

**Files:**
- Create: `src/scene/materials.ts`, `src/scene/palette.ts`, `src/scene/Pegs.tsx`, `src/scene/Slots.tsx`, `src/scene/fxStore.ts`, `src/fx/glowField.ts`
- Modify: `src/scene/Stage.tsx`
- Test: `src/scene/palette.test.ts`, `src/fx/glowField.test.ts`

**Interfaces:**
- Produces `palette.ts`: `gemColor(multiplier: number): string` (mega `#e0115f`, big `#9b30ff`, large `#2d6bff`, 2–<5 `#00c2a8`, 1–<2 `#7a5cff`, <1 `#c7c3ff`), `CRYSTAL = { light: '#c9b8ff', deep: '#6a4fd6', idleGlow: '#b9a7ff' }`, `BG = { top: '#1b0f3d', bottom: '#06030f', halo: '#3a1d7a' }`, `pegHue(flat: number, timeSec: number): number` (0…1, радужный сдвиг по позиции и времени).
- Produces `materials.ts`: `createCrystalMaterial(q: Quality): THREE.MeshPhysicalMaterial`. `high`: `transmission 1, thickness 0.6, ior 1.7, dispersion 4, roughness 0.03, iridescence 0.6, color CRYSTAL.light, attenuationColor CRYSTAL.deep, attenuationDistance 1.2`. `light`: `transmission 0, metalness 0.1, roughness 0.05, iridescence 0.8, envMapIntensity 2, color CRYSTAL.light, emissive #3a2a7a, emissiveIntensity 0.3`. Также `createGemMaterial(color: string, q: Quality)` (та же логика, цвет камня, у `high` меньше transmission 0.6) и `createChromeMaterial(): MeshStandardMaterial` (`metalness 1, roughness 0.06, color #e9ecf8`).
- Produces `glowField.ts`: `class GlowField { constructor(capacity: number); readonly values: Float32Array; hit(flat: number, amount?: number): void; decay(dt: number, rate?: number): void; clear(): void }` (`hit` берёт максимум, а не сумму; `decay` по умолчанию 2.2/с, не ниже 0).
- Produces `fxStore.ts`: `pegGlow = new GlowField(pegCount(16))` и `fxHooks: { burst?(x: number, y: number, count: number, power: number): void; flashSlot?(slot: number, amount: number): void; floatText?(slot: number, text: string, dim: boolean): void; shake?(amp: number, sec: number): void; pulse?(bloom: number, ca: number, sec: number): void; wave?(x: number, y: number, intensity: number): void }`. Компоненты регистрируют хуки при монтировании и снимают при размонтировании.
- `Pegs.tsx`: `InstancedMesh` на `pegCount(16)` с `count = pegCount(rows)`. Геометрия `OctahedronGeometry(PEG_RADIUS * 1.35, 0)` со scale y 1.25 и фиксированным (seed 1) поворотом каждого экземпляра. Свечение отдельным `InstancedMesh` из billboard-квадов с аддитивным радиальным шейдером: цвет экземпляра = `hsl(pegHue) · glow`, `toneMapped: false`. Пульс масштаба `1 + 0.35·glow`. Подписка на `peg:hit` → `pegGlow.hit(pegFlatIndex(row, index), kind === 'rain' ? 0.6 : 1)`. `decay` каждый кадр.
- `Slots.tsx`: камень на каждую ячейку, `CylinderGeometry(0.4, 0.28, 0.32, 8)` с `flatShading`, материал `createGemMaterial(gemColor(m), quality)`. Подпись drei `<Text font={clickableWoffUrl}>` с `formatMultiplier(m)` (`import clickableWoffUrl from '@brand/fonts/CLICKABLE-Black.woff?url'`). Хук `fxHooks.flashSlot`: всплеск emissive, подъём на 0.15 и масштаб 1.15 с затуханием 0.6 с.

- [ ] **Step 1: Написать тесты:**

```ts
test('gem colors by multiplier', () => {
  expect(gemColor(100)).toBe('#e0115f'); expect(gemColor(30)).toBe('#9b30ff'); expect(gemColor(8)).toBe('#2d6bff');
  expect(gemColor(3)).toBe('#00c2a8'); expect(gemColor(1.2)).toBe('#7a5cff'); expect(gemColor(0.3)).toBe('#c7c3ff');
});
test('glow field hit keeps max and decays to zero', () => {
  const g = new GlowField(4); g.hit(1, 0.6); g.hit(1, 0.4); expect(g.values[1]).toBeCloseTo(0.6);
  g.decay(10); expect(g.values[1]).toBe(0);
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать.** **Step 4: Запустить** → PASS.
- [ ] **Step 5: Визуальная проверка** при `?quality=high` и `?quality=light`, ряды 8, 12, 16 (временно менять `DEFAULT_ROWS` через стор в консоли): граненые кристаллы с радужными отблесками, камни нужных цветов, подписи `100x`…`0.2x` читаются, пирамида целиком в кадре.
- [ ] **Step 6: Commit** `feat: crystal pegs and gem slots with two quality tiers`.

---

### Task 10: Шарики, шлейф, вспышки кристаллов

**Files:**
- Create: `src/scene/Balls.tsx`, `src/scene/Trails.tsx`
- Modify: `src/scene/Stage.tsx`, `src/App.tsx` (временный ввод: пробел и клик по canvas вызывают `controller.drop()`)

**Interfaces:**
- Consumes: `useSim()`, `Ball.sample`, `createChromeMaterial`, `pegGlow`.
- `Balls.tsx`: `InstancedMesh(SphereGeometry(BALL_RADIUS, 32, 16), chrome, MAX_ACTIVE_BALLS)`. Каждый кадр берёт позиции и `angle` (вращение вокруг z) из `system.balls`. Между `landT` и `endT` шарик уменьшается до 0 и уходит в камень.
- `Trails.tsx`: пул `MAX_TRAILS = 10` лент (24 точки, 2 вершины на точку, лента в плоскости XY перпендикулярно скорости, ширина спадает к хвосту). `ShaderMaterial` аддитивный, радужный оттенок сдвигается со временем, альфа гаснет к хвосту. Ленты отдаются первым 10 шарикам в `system.balls` с `kind !== 'rain'`, а при дожде первым 10 вообще. Свободная лента гаснет за 0.3 с.

- [ ] **Step 1: Реализовать** компоненты и временный ввод.
- [ ] **Step 2: Визуальная проверка** (Playwright, 1920×1080 и 390×844, `?seed=1`): после пробела шарик падает с правдоподобными отскоками и вращением, кристаллы вспыхивают радугой в момент касания, шлейф переливается, шарик уходит в камень. Десять быстрых нажатий: шарики летят одновременно без рывков.
- [ ] **Step 3: Проверить** `npm test` → PASS (ничего не сломано), `npm run build` → OK.
- [ ] **Step 4: Commit** `feat: chrome balls with rainbow trails and peg flashes`.

---

### Task 11: Эффекты выигрыша: осколки, волна, всплывающие суммы

**Files:**
- Create: `src/fx/wave.ts`, `src/scene/Shards.tsx`, `src/scene/FloatingWins.tsx`, `src/scene/WinFx.tsx`
- Modify: `src/scene/Stage.tsx`
- Test: `src/fx/wave.test.ts`

**Interfaces:**
- Produces `wave.ts`: `waveIntensity(distance: number, t: number, speed?: number, width?: number): number` (по умолчанию `speed 14`, `width 0.7`; 1 на радиусе `speed·t`, линейно до 0 на ±`width`; 0 при `t > maxRadius/speed`, где `maxRadius = 20`); `class WaveField { add(x: number, y: number, intensity: number): void; update(dt: number): void; apply(pegs: Peg[], glow: GlowField): void; readonly active: number }`.
- `Shards.tsx`: пул 900 `InstancedMesh(TetrahedronGeometry(0.06))`, `MeshBasicMaterial({ toneMapped: false })` с `instanceColor` (радужные HSL), простая физика (гравитация 9, вращение), жизнь 1.2 с. Регистрирует `fxHooks.burst(x, y, count, power)`: веер вверх ±70°.
- `FloatingWins.tsx`: пул 10 drei `<Text>` со шрифтом Clickable woff. `fxHooks.floatText(slot, text, dim)`: текст поднимается на 1.2 единицы за 1.1 с и гаснет. Белый, при `dim` приглушённый `#9a93c9`.
- `WinFx.tsx`: подписка на `ball:land`. Реакции по уровню:

| tier | обычный шарик | шарик дождя |
|---|---|---|
| sub | `flashSlot 0.3`, `floatText` dim | `flashSlot 0.2` |
| normal | `flashSlot 1`, `floatText`, `burst 12` | `flashSlot 0.6`, `burst 3` |
| large | `flashSlot 1`, `floatText`, `burst 60, power 1.2`, `wave 1` | `flashSlot 1`, `burst 10`, `wave 0.6` |
| big / mega | как large (остальное добавляет задача 14) | как large у дождя |

`floatText` получает `'+' + formatCredits(win)`, у `demo` без плюса. `WinFx` держит `WaveField`, регистрирует `fxHooks.wave` (им пользуется и задача 14) и каждый кадр применяет волны к `pegGlow`.

- [ ] **Step 1: Написать тест:**

```ts
test('wave ring travels outward', () => {
  expect(waveIntensity(1.4, 0.1)).toBeCloseTo(1);           // радиус 1.4
  expect(waveIntensity(1.4 + 0.35, 0.1)).toBeCloseTo(0.5);
  expect(waveIntensity(3, 0.1)).toBe(0); expect(waveIntensity(1, 5)).toBe(0);
});
test('wave field lights pegs on the ring and expires', () => {
  const L = boardLayout(8), g = new GlowField(pegCount(16)), w = new WaveField();
  w.add(L.slots[0].x, L.slots[0].y, 1); w.update(0.2); w.apply(L.pegs, g);
  expect(Math.max(...g.values)).toBeGreaterThan(0.5); w.update(5); expect(w.active).toBe(0);
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать.** **Step 4: Запустить** → PASS.
- [ ] **Step 5: Визуальная проверка** с `?seed=` (подобрать seed, при котором первые броски дают large): ячейка вспыхивает, осколки разлетаются, волна идёт вверх по пирамиде, сумма всплывает.
- [ ] **Step 6: Commit** `feat: win reactions with shards, light wave, floating amounts`.

---

### Task 12: Камера: замедление с наездом и тряска

**Files:**
- Modify: `src/scene/CameraRig.tsx`, `src/App.tsx` (`window.__sim = sim` только при `import.meta.env.DEV`)

**Interfaces:**
- Consumes: `slowmo:start { ballId }`, `slowmo:end`, `system.balls`, `fxHooks`.
- Produces: регистрирует `fxHooks.shake(amp, sec)` (шумовое смещение позиции и крена, затухание по времени).
- Поведение: на `slowmo:start` камера за 0.35 с (GSAP, `power2.out`) переходит в режим слежения: цель = позиция шарика, дистанция = 0.45 от базовой, сглаживание к цели каждый кадр. На `slowmo:end` через 0.3 с возвращается к базовому кадру за 0.8 с (`power2.inOut`). Тряска складывается с любым режимом.

- [ ] **Step 1: Реализовать.**
- [ ] **Step 2: Визуальная проверка** `?seed=` + принудительный бросок из консоли `window.__sim.controller.drop({ forceBig: true })`: на последних трёх рядах время замедляется, камера подлетает к шарику, после приземления плавно возвращается. Обычные броски без наезда.
- [ ] **Step 3: Commit** `feat: slow-mo camera follow and shake`.

---

### Task 13: Интерфейс и раскладки

**Files:**
- Create: `src/ui/Hud.tsx`, `src/ui/TopBar.tsx`, `src/ui/ControlPanel.tsx`, `src/ui/History.tsx`, `src/ui/BalanceCounter.tsx`, `src/ui/ui.css`, `src/platform/fullscreen.ts`
- Modify: `src/App.tsx` (убрать временный ввод из задачи 10, ввод теперь здесь)

**Interfaces:**
- Consumes: `useGame`, `useSim`, `S`, `hudInsets`, `orientationOf`, `formatCredits`, `formatMultiplier`, `gemColor`, `brandLogo`.
- Produces `fullscreen.ts`: `canFullscreen(): boolean`, `toggleFullscreen(): Promise<void>`.
- Раскладка: корень `Hud` ставит CSS-переменные `--inset-top/right/bottom/left` из `hudInsets` и класс `portrait | landscape`, учитывает `env(safe-area-inset-*)`.
  - Портрет: `TopBar` (логотип `brandLogo.red` высотой 18 px, `BalanceCounter`, mute, fullscreen если доступен) вверху. Снизу `ControlPanel`: строка `BET − 100 +`, сегменты `LOW | MEDIUM | HIGH`, `ROWS − 12 +`, большая кнопка `DROP` и кнопка `100 BALLS`. `History` горизонтальной полосой над панелью.
  - Ландшафт: `ControlPanel` колонкой слева, `History` колонкой справа, `TopBar` слева сверху над панелью.
- Стиль: стекло `rgba(255,255,255,0.06)` + `backdrop-filter: blur(10px)`, обводка `rgba(201,184,255,0.25)`, текст Montserrat. Цифры и `DROP` шрифтом `var(--ck-font-display)`. `DROP` красная `var(--ck-red-button)` с классом `.ck-chamfer`, свечение `0 0 28px rgba(255,25,35,.55)`, при нажатии Motion scale 0.94 и `var(--ck-red-pressed)`. Переключатели риска и рядов `disabled` при `inFlight > 0`.
- `BalanceCounter`: Motion `animate` от старого значения к новому за 0.6 с. На `balance:refill` всплывает подпись `S.refill` с блеском.
- `History`: последние `HISTORY_MAX` множителей, фишки цвета `gemColor`, новая въезжает через Motion `layout`.
- Ввод: пробел → `drop()`, `pointerdown` по canvas (не по HUD) → `drop()`, кнопка `100 BALLS` → `rain({ mode: 'paid' })` (неактивна при `rainActive`). Каждое нажатие кнопок испускает `ui:click`.
- `data-testid` для e2e (задача 22): `balance`, `drop`, `rain`, `risk-low`, `risk-medium`, `risk-high`, `rows-minus`, `rows-plus`, `bet-minus`, `bet-plus`, `history`, `mute`.

- [ ] **Step 1: Реализовать.**
- [ ] **Step 2: Визуальная проверка** Playwright: 390×844, 844×390, 1366×768, 1920×1080, 3840×2160. Элементы не перекрывают пирамиду, текст читается, на 4K интерфейс масштабирован (`clamp` в размерах). Во время полёта шарика переключатели риска и рядов серые.
- [ ] **Step 3: Проверить** `npm test` → PASS, `npm run build` → OK.
- [ ] **Step 4: Commit** `feat: HUD with portrait and landscape layouts`.

---

### Task 14: Big Win, Mega Win и финал дождя

**Files:**
- Create: `src/ui/BigWinOverlay.tsx`, `src/scene/CelebrationFx.tsx`, `src/scene/Effects.tsx`
- Modify: `src/scene/Stage.tsx`, `src/ui/Hud.tsx`

**Interfaces:**
- Consumes: `celebrate:start`, `fxHooks.burst/shake/pulse`, `pegGlow`, `WaveField`.
- Produces: `BigWinOverlay` (`data-testid="celebrate-overlay"`) испускает `celebrate:tick` (не чаще 20/с, пока идёт счётчик) и `celebrate:end`.
- `Effects.tsx`: `EffectComposer` (`multisampling` 4 на high, 0 на light), `Bloom` (`mipmapBlur`, `luminanceThreshold 0.75`, `intensity 1.2` / `0.9` на light), `ChromaticAberration` (только high, offset 0 в покое), `Vignette` (`darkness 0.6`). Регистрирует `fxHooks.pulse(bloom, ca, sec)`: добавка к intensity и offset с затуханием.
- `BigWinOverlay`: затемнение и размытие фона (`backdrop-filter`). Надпись `S.bigWin` / `S.megaWin` / `S.totalWin` шрифтом Clickable с градиентом `#ffffff → #c9b8ff → #ff4fd8` и свечением, въезжает через Motion spring. Счётчик от 0 до `amount` за 3.0 с (big), 5.0 с (mega), 3.0 с (total), easeOut. Тап по оверлею сразу показывает итог, через 1.2 с исчезновение и `celebrate:end`. Без тапа конец через длительность + 1.5 с.
- `CelebrationFx` на `celebrate:start`:

| kind | shake | pulse (bloom, ca, sec) | осколки | пирамида |
|---|---|---|---|---|
| big | 0.15, 1.2 с | 0.8, 0.004, 1.5 | фонтан из камня 300 за 1.5 с | волны из камня каждые 0.4 с, пока идёт сцена |
| mega | 0.3, 2.0 с | 1.4, 0.008, 2.5 | 600 за 2.5 с | вся пирамида горит (`glow ≥ 0.7`) + волны |
| total | 0.1, 0.8 с | 0.6, 0.003, 1.2 | по 20 из каждого камня | волна снизу вверх по всей ширине |

- [ ] **Step 1: Реализовать.**
- [ ] **Step 2: Визуальная проверка:** `window.__sim.controller.drop({ forceBig: true })` несколько раз (попадутся и big, и mega), `rain({ mode: 'free' })`. Сцены отрабатывают, тап пропускает, после `celebrate:end` броски снова работают. На `?quality=light` хроматической аберрации нет.
- [ ] **Step 3: Commit** `feat: big/mega win and rain total celebrations`.

---

### Task 15: Звук: движок, эффекты, mute

**Files:**
- Create: `src/audio/engine.ts`, `src/audio/scale.ts`, `src/audio/sfx.ts`, `src/audio/bindings.ts`, `src/audio/music.ts` (пока только `interface Music`, см. задачу 20)
- Modify: `src/App.tsx`, `src/ui/TopBar.tsx` (mute)
- Test: `src/audio/scale.test.ts`, `src/audio/engine.test.ts`

**Interfaces:**
- Produces `engine.ts`: `interface AudioEngine { readonly ctx: AudioContext | null; readonly sfx: GainNode | null; readonly music: GainNode | null; unlock(): Promise<void>; setMuted(m: boolean): void }`, `createAudioEngine(): AudioEngine` (контекст создаётся в `unlock` по жесту пользователя; цепочка `sfx/music → master → DynamicsCompressor → destination`), `bindVisibility(ctx: { state: string; suspend(): Promise<void>; resume(): Promise<void> }, doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>, isMuted: () => boolean): () => void`.
- Produces `scale.ts`: `PENTATONIC_ROOT_HZ = 220`, `rowFrequency(row: number): number` (мажорная пентатоника от A3, полутона `[0, 2, 4, 7, 9]`, ряд 0 самый низкий: `root · 2^((semi[row % 5] + 12·⌊row/5⌋)/12)`), `class VoicePool { constructor(capacity: number); acquire(now: number): { index: number; stolen: boolean }; release(index: number): void }` (при заполнении отнимает самый старый голос).
- Produces `sfx.ts`: `interface Sfx { chime(row: number, velocity: number): void; land(tier: Tier): void; tick(): void; fanfare(kind: CelebrateKind): void; riser(): void; refill(): void; uiClick(): void }`, `createSfx(engine: AudioEngine): Sfx`. `chime`: стеклянный колокольчик из синусоид с негармоничными партиалами `1, 2.76, 5.4`, экспоненциальное затухание 0.6–1.2 с, расстройка ±5 центов, громкость от `velocity`, голоса через `VoicePool(24)`. Остальное: `land` по уровню (sub тихий низкий, normal два тона, large восходящее арпеджио с переливом), `fanfare` аккордовые удары и арпеджио (mega длиннее), `riser` шумовой свип для замедления.
- Produces `bindings.ts`: `bindAudio(bus: EventBus<GameEvents>, sfx: Sfx, music: Music | null): () => void`. `peg:hit` → `chime(row, kind === 'rain' ? 0.35 : min(1, speed / 9))`, `ball:land` (кроме rain) → `land(tier)`, `slowmo:start` → `riser()`, `celebrate:start` → `fanfare(kind)`, `celebrate:tick` → `tick()`, `balance:refill` → `refill()`, `ui:click` → `uiClick()`. До задачи 20 вместо музыки передаётся `null`.
- Mute: кнопка в `TopBar` вызывает `store.setMuted` и `engine.setMuted` (плавный спад master за 0.15 с). Начальное состояние берётся из стора.

- [ ] **Step 1: Написать тесты:**

```ts
test('row notes ascend within pentatonic', () => {
  const f = Array.from({ length: 16 }, (_, r) => rowFrequency(r));
  f.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(f[i]));
  expect(f[0]).toBeCloseTo(220); expect(f[5]).toBeCloseTo(440); expect(f[15]).toBeCloseTo(1760);
});
test('voice pool steals oldest when full', () => {
  const p = new VoicePool(2); p.acquire(0); p.acquire(1); const r = p.acquire(2);
  expect(r.stolen).toBe(true); expect(r.index).toBe(0);
});
test('visibility suspends and resumes unless muted', async () => {
  let muted = false; const calls: string[] = [];
  const ctx = { state: 'running', suspend: async () => { calls.push('s'); }, resume: async () => { calls.push('r'); } };
  const listeners: Record<string, () => void> = {};
  const doc = { visibilityState: 'visible', addEventListener: (t: string, fn: () => void) => (listeners[t] = fn), removeEventListener: () => {} } as any;
  bindVisibility(ctx, doc, () => muted);
  doc.visibilityState = 'hidden'; listeners.visibilitychange(); doc.visibilityState = 'visible'; listeners.visibilitychange();
  muted = true; doc.visibilityState = 'hidden'; listeners.visibilitychange(); doc.visibilityState = 'visible'; listeners.visibilitychange();
  expect(calls).toEqual(['s', 'r', 's']);
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать.** До задачи 19 `unlock()` вызывается на первом `pointerdown`/`keydown` в `App`. **Step 4: Запустить** → PASS.
- [ ] **Step 5: Проверка на слух** в Chrome: звон по рядам звучит музыкально, дождь из 100 шариков даёт «каскад», а не шум, mute работает и переживает перезагрузку.
- [ ] **Step 6: Commit** `feat: synthesized crystal sound effects and mute`.

---

### Task 16: Уровни качества и производительность

**Files:**
- Create: `src/platform/quality.ts`
- Modify: `src/scene/Stage.tsx`, `src/scene/Pegs.tsx`, `src/scene/Slots.tsx`, `src/scene/Effects.tsx`, `src/scene/Background.tsx`
- Test: `src/platform/quality.test.ts`

**Interfaces:**
- Produces: `initialQuality(env: { coarsePointer: boolean; maxTouchPoints: number; renderer?: string; override?: string | null }): Quality`. `override` `'high'`/`'light'` из `?quality=` важнее всего. Иначе `'light'` при `coarsePointer` или `maxTouchPoints > 0` или `renderer` по `/SwiftShader|llvmpipe|Mali-[4T]|Adreno \(TM\) [3-5]\d\d/i`, в остальных случаях `'high'`. Также `dprRange(q: Quality): [number, number]` (high `[1, 2]`, light `[1, 1.5]`).
- `Stage`: стартовое качество в стор, `dpr` из `dprRange`. drei `<PerformanceMonitor flipflops={3} onDecline={…}>`: при high перейти на light, при light опустить DPR до 1. После трёх переключений уровень фиксируется. `?debug=1` показывает drei `<Stats />`.
- Материалы пересоздаются при смене `quality` (через `useMemo` по `quality`, старые `dispose()`).

- [ ] **Step 1: Написать тест:**

```ts
test('initial quality', () => {
  expect(initialQuality({ coarsePointer: true, maxTouchPoints: 5 })).toBe('light');
  expect(initialQuality({ coarsePointer: false, maxTouchPoints: 0, renderer: 'ANGLE (Intel Iris Xe)' })).toBe('high');
  expect(initialQuality({ coarsePointer: false, maxTouchPoints: 0, renderer: 'Google SwiftShader' })).toBe('light');
  expect(initialQuality({ coarsePointer: true, maxTouchPoints: 5, override: 'high' })).toBe('high');
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать.** **Step 4: Запустить** → PASS.
- [ ] **Step 5: Замер FPS** в Chrome на этой машине с `?debug=1`: обычные броски и бесплатный дождь на high и light. Записать цифры в README. Если на high во время дождя меньше 55 FPS, уменьшить пул осколков или частиц, не трогая логику.
- [ ] **Step 6: Commit** `feat: quality tiers with automatic downgrade`.

---

### Task 17: Режим ведущего

**Files:**
- Create: `src/platform/presenter.ts`, `src/ui/useLongPress.ts`, `src/ui/PresenterPanel.tsx`
- Modify: `src/ui/TopBar.tsx` (длинное нажатие на логотип), `src/App.tsx` (горячие клавиши)
- Test: `src/platform/presenter.test.ts`

**Interfaces:**
- Produces: `presenterAction(e: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey' | 'repeat'>): 'forceBig' | 'freeRain' | null`. `Shift+KeyB` → `forceBig`, `Shift+KeyR` → `freeRain`. По `code`, поэтому работает в любой раскладке. Без Ctrl/Alt/Meta, повторы игнорируются.
- Produces: `useLongPress(onLongPress: () => void, ms?: number): { onPointerDown; onPointerUp; onPointerLeave; onPointerCancel }` (по умолчанию `PRESENTER_LONGPRESS_MS`).
- `PresenterPanel`: маленькая панель у логотипа с двумя кнопками `S.presenterBig` → `controller.forceBigNext()`, `S.presenterRain` → `controller.rain({ mode: 'free' })`. Закрывается после нажатия или через 6 с. Длинное нажатие на логотип работает и мышью, и тачем, обычный тап по логотипу ничего не делает.

- [ ] **Step 1: Написать тест:**

```ts
const k = (code: string, o: Partial<KeyboardEvent> = {}) => ({ code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...o });
test('presenter keys', () => {
  expect(presenterAction(k('KeyB', { shiftKey: true }))).toBe('forceBig');
  expect(presenterAction(k('KeyR', { shiftKey: true }))).toBe('freeRain');
  expect(presenterAction(k('KeyB'))).toBeNull();
  expect(presenterAction(k('KeyR', { shiftKey: true, ctrlKey: true }))).toBeNull();
  expect(presenterAction(k('KeyB', { shiftKey: true, repeat: true }))).toBeNull();
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать.** **Step 4: Запустить** → PASS.
- [ ] **Step 5: Проверка:** Shift+B, затем DROP → Big или Mega; Shift+R → дождь без списания. На 390×844 с `hasTouch` удержание логотипа 2 с открывает панель.
- [ ] **Step 6: Commit** `feat: presenter mode via hotkeys and logo long-press`.

---

### Task 18: PWA и офлайн

**Files:**
- Create: `public/icon.svg`, `pwa-assets.config.ts`, `playwright.config.ts`, `e2e/offline.spec.ts`
- Modify: `vite.config.ts`, `index.html`, `package.json`

**Interfaces:**
- `public/icon.svg` 512×512: скруглённый квадрат с градиентом `#1b0f3d` → `#06030f`, лавандовое радиальное свечение, по центру буква C из логотипа Clickable (путь `M20.9473…` из `shared/brand/logo/clickable-logo-red.svg`) заливкой `#FF1923` на 60% высоты. Это составная иконка приложения, а не копия бренд-ассета.
- `pwa-assets.config.ts`: пресет `minimal2023Preset`, источник `public/icon.svg`. `npm run icons` генерирует PNG в `public/`.
- `vite-plugin-pwa`: `registerType: 'autoUpdate'`, `workbox.globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,webmanifest}']`, `maximumFileSizeToCacheInBytes: 6 * 1024 * 1024`. Манифест: `name 'Clickable Plinko'`, `short_name 'Plinko'`, `display 'fullscreen'`, `orientation 'any'`, `background_color` и `theme_color` `#06030f`, `start_url './'`, `scope './'`, иконки из генератора. `apple-touch-icon` в `index.html`.
- `playwright.config.ts`: `webServer: { command: 'npm run build && npm run preview -- --port 4173', port: 4173 }`, проекты `desktop` (1920×1080) и `phone` (390×844, `hasTouch`, `isMobile`), chromium.

- [ ] **Step 1: Написать тест** `e2e/offline.spec.ts`:

```ts
test('loads offline after first visit', async ({ page, context }) => {
  await page.goto('/?seed=1');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // SW контролирует страницу
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('900 20px Clickable'))).toBe(true);
});
```

- [ ] **Step 2: Запустить** `npm run e2e -- offline` → FAIL (SW нет).
- [ ] **Step 3: Реализовать:** иконка, `npm run icons`, конфиг PWA, мета-теги.
- [ ] **Step 4: Запустить** → PASS. Дополнительно проверить, что в `dist/sw.js` есть оба шрифта Clickable и все Montserrat.
- [ ] **Step 5: Commit** `feat: installable offline PWA`.

---

### Task 19: Заставка и attract-режим

**Files:**
- Create: `src/ui/Splash.tsx`, `src/ui/AttractOverlay.tsx`, `src/platform/idle.ts`, `src/platform/embed.ts`, `src/sim/attract.ts`
- Modify: `src/sim/SimProvider.tsx` (в `Sim` добавить `attract: AttractDirector`; `SimDriver` в кадре вызывает `sim.attract.update(dt)`, затем `sim.controller.update(dt)`), `src/sim/testkit.ts` (добавить `setupWithAttract(seed)`: то же, что `setup`, плюс `attract`), `src/App.tsx`
- Test: `src/platform/idle.test.ts`, `src/sim/attract.test.ts`, `src/platform/embed.test.ts`

**Interfaces:**
- Produces `idle.ts`: `class IdleTimer { constructor(timeoutMs: number, now: () => number); poke(): void; isIdle(): boolean }`.
- Produces `embed.ts`: `isEmbed(search: string): boolean` (`?embed=1`), `postExit(target?: Pick<Window, 'postMessage'>): void` (отправляет `{ type: 'clickable:exit' }` с `'*'`).
- Produces `attract.ts`: `class AttractDirector { constructor(deps: { store: StoreApi<GameState>; controller: GameController }); update(realDt: number): void }`. В режиме `attract`: `drop({ kind: 'demo' })` каждые `ATTRACT_DROP_INTERVAL`. Каждые `ATTRACT_SHOWCASE_INTERVAL` по очереди: демо-бросок с `forceBig: true`, затем `rain({ mode: 'demo', count: ATTRACT_RAIN_COUNT })`. Пока идёт `celebrating` или `rainActive`, новые демо-броски не запускаются.
- `App`: `IdleTimer(IDLE_MS)`, `poke()` на любой `pointerdown`/`keydown`. Переход `play → attract`, когда таймер истёк, поле пустое (`inFlight === 0`), нет празднования и закрыта панель ведущего. Выход: первый `pointerdown`/`keydown` в `attract` переводит в `play` и поглощается (`preventDefault` + `stopPropagation` в capture-фазе), то есть сам не бросает шарик.
- `Splash` (`data-testid="splash"`): логотип `brandLogo.red`, полоса загрузки (drei `useProgress` + `document.fonts.ready`), после готовности пульсирующая надпись `S.tapToPlay`. Тап → `audio.unlock()`, `setMode('play')`. В `embed` заставки нет (`mode = 'play'` сразу, `unlock` на первом жесте), в `TopBar` появляется кнопка `S.exit` → `postExit()`.
- `AttractOverlay`: пульсирующая надпись `S.tapToPlay` и логотип поверх игры.

- [ ] **Step 1: Написать тесты:**

```ts
test('idle timer', () => {
  let t = 0; const it = new IdleTimer(45000, () => t);
  t = 44999; expect(it.isIdle()).toBe(false); t = 45000; expect(it.isIdle()).toBe(true); it.poke(); expect(it.isIdle()).toBe(false);
});
test('attract drops demo balls only in attract mode', () => {
  const { st, ctl, attract, sys, run } = setupWithAttract(1);
  attract.update(5); expect(sys.balls).toHaveLength(0);
  st.getState().setMode('attract'); for (let i = 0; i < 300; i++) { attract.update(1 / 60); run(1 / 60); }
  expect(st.getState().balance).toBe(10000);
});
test('embed flag and exit message', () => {
  expect(isEmbed('?embed=1')).toBe(true); expect(isEmbed('')).toBe(false);
  const sent: any[] = []; postExit({ postMessage: (m: any, o: any) => sent.push([m, o]) } as any);
  expect(sent).toEqual([[{ type: 'clickable:exit' }, '*']]);
});
```

- [ ] **Step 2: Запустить** → FAIL. **Step 3: Реализовать.** **Step 4: Запустить** → PASS.
- [ ] **Step 5: Проверка:** заставка → тап → игра со звуком. 45 с без ввода → attract с демо-шариками, Big Win и дождём, баланс не меняется. Тап возвращает в игру и не бросает шарик. `?embed=1` открывает игру сразу с кнопкой EXIT.
- [ ] **Step 6: Commit** `feat: splash, attract mode, lobby embed contract`.

---

### Task 20: Музыка

**Files:**
- Modify: `src/audio/music.ts` (добавить `createMusic`), `src/audio/bindings.ts`, `src/App.tsx`

**Interfaces:**
- Produces: `interface Music { start(): void; setIntensity(level: number, seconds: number): void; stop(): void }`, `createMusic(engine: AudioEngine): Music`. Генеративный эмбиент в тональности A-мажорной пентатоники: 3–4 расстроенных triangle/saw-голоса через lowpass, цикл аккордов `Amaj9 – F#m9 – Dmaj7 – E6` по 8 с, медленный LFO на фильтр. `intensity` (0…1) открывает фильтр и подмешивает искрящееся арпеджио на высоких нотах.
- `bindAudio`: `slowmo:start` → 0.8 за 0.3 с, `slowmo:end` → 0.3 за 1 с, `celebrate:start` → 1 за 0.2 с, `celebrate:end` → 0.3 за 1.5 с. Старт музыки после `unlock`, уровень по умолчанию 0.3.

- [ ] **Step 1: Реализовать.** **Step 2: Проверка на слух:** фон спокойный, не мешает звону, нарастает в замедлении и Big Win, mute глушит и музыку. **Step 3:** `npm test` → PASS.
- [ ] **Step 4: Commit** `feat: adaptive ambient music`.

---

### Task 21: Анимация перестройки пирамиды и смены риска

**Files:**
- Modify: `src/scene/Pegs.tsx`, `src/scene/Slots.tsx`, `src/scene/CameraRig.tsx`

**Interfaces:**
- Смена `rows` (возможна только при пустом поле): старые кристаллы сжимаются до 0 снизу вверх с шагом 0.012 с за 0.25 с каждый, затем новые вырастают сверху вниз с шагом 0.015 с за 0.35 с (`back.out`). Камни перестраиваются так же. Камера переезжает к новому кадру за 0.6 с вместо прыжка.
- Смена `risk`: цвет каждого камня плавно меняется к новому `gemColor` за 0.4 с. Подпись переворачивается (scale y 1 → 0 → 1, текст меняется в нуле) с шагом 0.02 с от центра к краям.

- [ ] **Step 1: Реализовать.**
- [ ] **Step 2: Проверка:** переключение 8 ↔ 16 и LOW ↔ HIGH выглядит плавно, без вспышек «пустого» кадра. Нажатие DROP сразу после смены работает (геометрия уже итоговая, анимация только визуальная).
- [ ] **Step 3: Commit** `feat: animated board rebuild and risk recolor`.

---

### Task 22: Сквозная проверка, документация

**Files:**
- Create: `e2e/game.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: всё, в том числе `data-testid` из задач 13, 14 и 19.

- [ ] **Step 1: Написать тесты** `e2e/game.spec.ts` (оба проекта Playwright, `?seed=1`):

```ts
test('boots without errors and drops', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?seed=1'); await page.getByTestId('splash').click();
  const before = await page.getByTestId('balance').innerText();
  await page.getByTestId('drop').click();
  await expect(page.getByTestId('history').locator('> *')).toHaveCount(1, { timeout: 10000 });
  expect(await page.getByTestId('balance').innerText()).not.toBe(before); expect(errors).toEqual([]);
});
test('settings locked while ball in flight', async ({ page }) => {
  await page.goto('/?seed=1'); await page.getByTestId('splash').click();
  await page.getByTestId('drop').click(); await expect(page.getByTestId('risk-low')).toBeDisabled(); await expect(page.getByTestId('rows-plus')).toBeDisabled();
});
test('touch spam does not zoom and never goes negative', async ({ page, isMobile }) => {
  test.skip(!isMobile); await page.goto('/?seed=1'); await page.getByTestId('splash').tap();
  for (let i = 0; i < 25; i++) await page.getByTestId('drop').tap();
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
  expect(Number((await page.getByTestId('balance').innerText()).replace(/,/g, ''))).toBeGreaterThanOrEqual(0);
});
test('presenter big win shows overlay', async ({ page, isMobile }) => {
  test.skip(isMobile); await page.goto('/?seed=1'); await page.getByTestId('splash').click();
  await page.keyboard.press('Shift+KeyB'); await page.getByTestId('drop').click();
  await expect(page.getByTestId('celebrate-overlay')).toBeVisible({ timeout: 15000 });
});
test('resize keeps game alive', async ({ page }) => {
  await page.goto('/?seed=1'); await page.getByTestId('splash').click();
  await page.setViewportSize({ width: 844, height: 390 }); await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('drop').click(); await expect(page.getByTestId('history').locator('> *')).toHaveCount(1, { timeout: 10000 });
});
```

- [ ] **Step 2: Запустить** `npm run e2e` → PASS (если что-то падает, чинить код, а не ослаблять тест).
- [ ] **Step 3: README** (по-русски): запуск (`npm install`, `npm run dev`, `npm run build`, `npm run preview`), как открыть на телефоне и установить офлайн (Chrome Android: «Установить приложение»; iOS Safari: «Поделиться → На экран Домой»), режим ведущего (Shift+B, Shift+R, удержание логотипа 2 с), параметры `?seed`, `?quality`, `?debug`, `?embed`, таблица RTP и частот из задачи 3, замеры FPS из задачи 16, чек-лист проверки на реальном телефоне (плавность дождя, звук после блокировки экрана, поворот, установка на экран «Домой», работа в авиарежиме).
- [ ] **Step 4: Финальная проверка:** `npm test` → PASS, `npm run build` → OK, `npm run e2e` → PASS. Ручной прогон: заставка, броски, замедление, Big/Mega, дождь, attract, ведущий, mute, офлайн.
- [ ] **Step 5: Commit** `test: end-to-end coverage and README`.
