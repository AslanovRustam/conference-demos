# C2 Crash «Ракета»: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** офлайн crash-игра на WebGL для ноутбука и телефона, оформленная как кинематографичная трансляция космического запуска. Ракета взлетает, множитель растёт, игрок забирает выигрыш до взрыва.

**Architecture:**
- **Логика раунда.** Кривая множителя, распределение точки взрыва, этапы, конечный автомат и баланс написаны на чистом TypeScript без рендера и покрыты vitest. Логику крутит собственный rAF-цикл: снимок состояния публикуется в zustand, события уходят в типизированную шину.
- **Сцена на R3F.** Сцена читает мутируемый объект `rig` с производными полёта на текущий кадр. Ближнее поле (стартовый стол, ракета, облака) живёт в метрах с плавающим началом координат. Дальнее поле (небо, Земля, Луна, звёзды, туманности, варп) центрировано на камере и всегда рисуется позади.
- **Постобработка.** Используется pmndrs/postprocessing вместе с собственными эффектами: объёмные облака, искажения, zoom blur, lens flare.
- **HUD и звук.** HUD на DOM (React + Motion) с горизонтальной и вертикальной раскладкой. Звук на Web Audio, файлы проигрываются через Howler.

**Tech Stack:** версии как в `demos/slot-3d/package.json`:
- three 0.186.1, @types/three 0.186.0;
- @react-three/fiber 9.8.2, @react-three/drei 10.7.9;
- @react-three/postprocessing 3.2.2, postprocessing 6.39.5;
- react и react-dom 19.3.1, motion 14.8.0, gsap 3.15.0, zustand 5.0.16;
- vite 8.3.4, @vitejs/plugin-react 6.1.2, typescript 6.0.3, vitest 5.0.5.
Плюс последние стабильные версии, совместимые с vite 8: howler с @types/howler, vite-plugin-pwa, @vite-pwa/assets-generator, @playwright/test, sharp (dev, для подготовки текстур).

**Spec:** `demos/crash-3d/docs/2026-10-30-c2-crash-design.md`. Исполнитель читает спеку целиком перед первой задачей. Утверждённые наброски лежат в `demos/crash-3d/.superpowers/brainstorm/839-1793349392/content/`: `visual-style.html` (карточка C) и `brand-hud.html` (вариант A).

## Global Constraints

- **Где работать.** Меняются только файлы внутри `demos/crash-3d/`. `shared/brand/` только читается, через алиас `@brand`. Подключение как в `shared/brand/README.md` и в `demos/slot-3d/vite.config.ts`, с `normalizePath` для Windows. Своих копий логотипа и шрифтов нет.
- **Без сети.** Только виртуальные кредиты. Во время работы ни одного сетевого запроса: без CDN, без внешних URL в загрузчиках, без drei `<Environment preset>` (он качает HDR из сети). Пути к файлам из `public/` строятся через `import.meta.env.BASE_URL`.
- **Браузеры:** Chrome последней версии на ноутбуке, Safari iOS 17+, Chrome Android.
- **Качество одно,** `ultra`, на всех устройствах. Все тяжёлые параметры живут только в `src/scene/quality.ts`.
- **Тексты.** Интерфейс на английском, все строки в `src/strings.ts`.
- **Числа из спеки:**
  - стартовый баланс 10 000, ставка по умолчанию 100;
  - отсчёт 3 с;
  - ×2 ≈ 5 с, ×10 ≈ 14 с, ×100 ≈ 28 с (±10%), максимум ×1000;
  - опорные точки S(x): ×1 → 0.97, ×2 → 0.5, ×5 → 0.25, ×15 → 0.10, ×50 → 0.025;
  - пороги этапов ×1.2 / ×1.8 / ×3 / ×8 / ×30;
  - хвост полёта после Cash Out не больше 6 с;
  - экран результата 2.5 с;
  - история из 15 раундов;
  - attract через 45 с;
  - варп ведущего ×40–150.
- **Брендинг.** Красный `--ck-red` #FF1923 используется только для главной кнопки, логотипа, знака ×, проигранных раундов в истории и маркера высоты. Остальной HUD белый и серый. Главная кнопка: заливка `--ck-red-button`, нажатие `--ck-red-pressed`, форма `.ck-chamfer`. Шрифты: Montserrat для интерфейса, `--ck-font-display` (Clickable Black) для крупных надписей. Знак × всегда набирается Montserrat.
- **Режим ведущего.** Ровно два действия: «следующий раунд до варпа» и «следующий раунд взрывается на старте». Нет FPS, сброса баланса и выбора множителя.
- **Отладка.** Все отладочные параметры работают только вместе с `?debug=1`: `seed`, `freeze`, счётчик FPS, `window.__crash`. Без `debug=1` их нет.
- **Стиль кода** как в `demos/slot-3d`: без точек с запятой, одинарные кавычки, 2 пробела, короткие комментарии на английском строчными буквами.
- **Коммиты.** Коммит в конце каждой задачи, репозиторий создаётся в `demos/crash-3d/` в задаче 1.

## Review Focus

1. **Шквал нажатий** пробела или тапа на границах фаз: автоповтор клавиши, двойной тап, нажатие в кадр взрыва. Ожидается:
   - нет двойного старта;
   - Cash Out после взрыва не проходит;
   - баланс не уходит в минус;
   - страница не масштабируется.
   Тесты: задача 3 (движок), задача 4 (ввод игнорирует `repeat`), задача 21 (e2e тач-спам и `visualViewport.scale === 1`).
2. **Вкладка скрыта или телефон заблокирован посреди полёта.** Ожидается: после возврата раунд продолжается с того же места, а не взрывается сразу; звук возобновляется, если не был выключен. Тесты: задача 3 (`tick` ограничивает dt), задача 15 (suspend/resume).
3. **Поворот телефона или изменение окна посреди раунда.** Ожидается: HUD переключает раскладку, кадр камеры пересчитывается, ракета в кадре, кнопка доступна. Тесты: задача 12 (кадрирование для 16:9 и 9:19.5), задача 21 (e2e resize).
4. **Автокэшаут на значении, которое больше или равно точке взрыва.** Ожидается: выигрыш только при значении строго меньше точки взрыва; выплата ровно по значению автокэшаута, а не по множителю кадра. Тест: задача 3.
5. **localStorage недоступен, звук до первого жеста.** Ожидается: игра работает, в консоли нет исключений, mute по умолчанию выключен. Тесты: задача 15 (storage бросает исключение), задача 21 (нет ошибок в консоли).

## Структура файлов

```
demos/crash-3d/
  package.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json index.html
  playwright.config.ts pwa-assets.config.ts README.md CREDITS.md .gitignore
  scripts/   shot.mjs  prepare-textures.mjs
  public/    icon.svg  textures/earth/  textures/moon/  audio/
  e2e/       round.spec.ts  layout.spec.ts  embed.spec.ts  offline.spec.ts
  src/
    main.tsx  App.tsx  strings.ts  styles/global.css
    core/      config.ts types.ts rng.ts curve.ts crashPoint.ts stages.ts telemetry.ts
               events.ts round.ts rare.ts attract.ts        (+ *.test.ts рядом)
    game/      runtime.ts loop.ts store.ts debug.ts
    platform/  params.ts input.ts presenter.ts idle.ts embed.ts haptics.ts storage.ts
    scene/     Stage.tsx quality.ts rig.ts RigUpdater.tsx fx.ts
               camera/  shots.ts director.ts CameraRig.tsx
               post/    Effects.tsx DistortionEffect.ts ZoomBlurEffect.ts LensFlareEffect.ts CloudsEffect.ts
               env/     environment.ts Lights.tsx lightState.ts
               rocket/  geometry.ts materials.ts textures.ts Rocket.tsx Plume.tsx plumeShader.ts refs.ts
               pad/     LaunchPad.tsx Tower.tsx Floodlights.tsx Smoke.tsx
               clouds/  noise.worker.ts noise.ts cloudsShader.ts
               far/     FarField.tsx SkyDome.tsx Stars.tsx Sun.tsx Moon.tsx Earth.tsx Nebula.tsx Warp.tsx
               eject/   Capsule.tsx Parachute.tsx Fairing.tsx
               crash/   Explosion.tsx Fireball.tsx Shockwave.tsx Debris.tsx
               rare/    RareEvents.tsx Meteors.tsx Aurora.tsx Station.tsx
    audio/     core.ts rocket.ts sfx.ts music.ts bindings.ts
    ui/        Hud.tsx hud.css format.ts MainButton.tsx Multiplier.tsx Telemetry.tsx AltitudeScale.tsx
               BetControls.tsx History.tsx Balance.tsx Countdown.tsx ResultOverlay.tsx Banner.tsx
               WinBurst.tsx Confetti.tsx MuteButton.tsx AttractOverlay.tsx PresenterPanel.tsx
               PresenterDot.tsx useLongPress.ts Splash.tsx ExitButton.tsx
```

---

## Часть 1. Логика и интерфейс (игра работает без 3D)

### Task 1: Каркас проекта, бренд, параметры URL, скрипт скриншотов

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `.gitignore`, `README.md` (заготовка), `src/main.tsx`, `src/App.tsx`, `src/styles/global.css`, `src/platform/params.ts`, `scripts/shot.mjs`
- Test: `src/platform/params.test.ts`

**Interfaces:**
- Produces: `parseParams(search: string): Params` и `params: Params`, где `interface Params { embed: boolean; debug: boolean; seed: number | null; freeze: number | null }`.
- Produces: `npm run shot -- "<query>" <out.png> [--portrait]`. Скрипт снимает кадр запущенного dev-сервера (`http://localhost:5173/` по умолчанию, `--base <url>` меняет адрес). Кадр делается, когда `window.__crashReady === true`. Этот флаг выставляет задача 6.

- [ ] **Step 1: Репозиторий.** Если `git rev-parse --is-inside-work-tree` в `demos/crash-3d/` падает, выполнить `git init` именно в `demos/crash-3d/`. `.gitignore`: `node_modules`, `dist`, `dev-dist`, `shots`, `test-results`, `playwright-report`, `.superpowers/**/state/`.
- [ ] **Step 2: Vite-проект React + TS** в `demos/crash-3d/`, без шаблонных файлов. Поставить пакеты из Tech Stack. Скрипты `package.json`:
  - `dev`: `vite --host`;
  - `build`: `tsc -b && vite build`;
  - `preview`: `vite preview --host`;
  - `test`: `vitest run`;
  - `e2e`: `playwright test`;
  - `shot`: `node scripts/shot.mjs`;
  - `textures`: `node scripts/prepare-textures.mjs`;
  - `icons`: `pwa-assets-generator`.
  Выполнить `npx playwright install chromium`.
- [ ] **Step 3: Конфиги.** `vite.config.ts` по образцу `demos/slot-3d/vite.config.ts`: `base: './'`, алиас `@brand` с `normalizePath`, `server.fs.allow`, `chunkSizeWarningLimit: 4000`, `worker: { format: 'es' }`, `test: { environment: 'node', include: ['src/**/*.test.ts'] }`. Добавить `paths` для `@brand/*` в `tsconfig.app.json`.
- [ ] **Step 4: index.html.**
  - viewport: `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`;
  - `theme-color` `#000000`;
  - title `Clickable Rocket · crash demo`.
- [ ] **Step 5: global.css и main.tsx.**
  - `main.tsx` импортирует `@brand/fonts.css`, `@brand/tokens.css` и `./styles/global.css`.
  - В `global.css`: `html, body, #root` на весь экран, фон `#000`, `overflow: hidden`, `overscroll-behavior: none`, `touch-action: manipulation`, `user-select: none`, `-webkit-tap-highlight-color: transparent`, шрифт `var(--ck-font-body)`.
- [ ] **Step 6: Падающий тест** `src/platform/params.test.ts`:

```ts
import { expect, test } from 'vitest'
import { parseParams } from './params'

test('debug-only params are ignored without debug=1', () => {
  expect(parseParams('?seed=7&freeze=3')).toEqual({ embed: false, debug: false, seed: null, freeze: null })
})

test('parses embed and debug params', () => {
  expect(parseParams('?embed=1&debug=1&seed=7&freeze=2.5')).toEqual({ embed: true, debug: true, seed: 7, freeze: 2.5 })
})

test('rejects garbage and out-of-range values', () => {
  expect(parseParams('?debug=1&seed=abc').seed).toBeNull()
  expect(parseParams('?debug=1&freeze=0.5').freeze).toBeNull()
  expect(parseParams('?debug=1&freeze=1001').freeze).toBeNull()
})
```

- [ ] **Step 7:** `npm test`. Ожидается FAIL: `parseParams` не найден.
- [ ] **Step 8: Реализовать `parseParams`.**
  - `seed`: целое число.
  - `freeze`: число от 1 до 1000.
  - `params` вычисляется из `location.search`, а если `location` нет, из пустой строки.
- [ ] **Step 9:** `npm test`. Ожидается PASS.
- [ ] **Step 10: shot.mjs.**
  - Использовать Playwright с установленным Google Chrome (`channel: 'chrome'`, `args: ['--use-angle=d3d11', '--ignore-gpu-blocklist']`, headless), чтобы рендер шёл на GPU.
  - Viewport 1920×1080 DPR 1. С флагом `--portrait`: 390×844, DPR 3, `isMobile`, `hasTouch`.
  - Ждать `window.__crashReady === true` (таймаут 60 с), затем ещё 1 с, затем снять кадр в указанный путь (папка `shots/` создаётся сама).
- [ ] **Step 11: App.tsx.** Пока App рисует чёрный экран и логотип `brandLogo.red` в левом верхнем углу: это проверка алиаса. `npm run build` проходит без ошибок, `dist/` содержит шрифты и логотип.
- [ ] **Step 12: Commit** `chore: scaffold crash-3d with shared brand and debug params`.

### Task 2: Математика игры

**Files:**
- Create: `src/core/config.ts`, `src/core/rng.ts`, `src/core/curve.ts`, `src/core/crashPoint.ts`, `src/core/stages.ts`, `src/core/telemetry.ts`
- Test: `src/core/curve.test.ts`, `src/core/crashPoint.test.ts`, `src/core/stages.test.ts`, `src/core/telemetry.test.ts`

**Interfaces:**
- Produces, `config.ts`:
  - `START_BALANCE = 10_000`, `DEFAULT_BET = 100`;
  - `BET_LADDER = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]`;
  - `AUTO_LADDER = [1.5, 2, 3, 5, 10, 25, 50, 100]`, `DEFAULT_AUTO = 2`;
  - `COUNTDOWN_S = 3`;
  - `MULT_RATE = 0.1516`, `MAX_MULT = 1000`;
  - `CRASH_ANCHORS = [[1, 0.97], [2, 0.5], [5, 0.25], [15, 0.1], [50, 0.025], [1000, 0.0005]] as const`;
  - `STAGE_THRESHOLDS = [1, 1.2, 1.8, 3, 8, 30] as const`;
  - `ALT_ANCHORS_KM = [0, 0.4, 3.5, 40, 400, 20000, 400000]`;
  - `VEL_ANCHORS_KMS = [0, 0.08, 0.45, 1.6, 7.8, 11.2, 99.9]`;
  - `EJECT_TAIL_MAX_S = 6`;
  - `CRASH_SCENE_S = 1.6`, `CRASH_SCENE_SHORT_S = 1.0`, `RESULT_S = 2.5`;
  - `HISTORY_LEN = 15`;
  - `IDLE_TO_ATTRACT_S = 45`;
  - `WARP_FORCE_RANGE = [40, 150] as const`;
  - `MAX_DT = 0.1`.
- Produces:
  - `type Rng = () => number`, `createRng(seed: number): Rng` (mulberry32), `randomSeed(): number`;
  - `floor2(x: number): number`: вниз до сотых, с допуском `1e-9`, чтобы `1.9999999` давало `2`;
  - `multiplierAt(t: number): number`: `exp(MULT_RATE·t)`, ограничено `MAX_MULT`, без округления;
  - `timeAt(m: number): number`: обратная функция;
  - `survival(x: number): number`, `sampleCrashPoint(u: number): number` (результат через `floor2`);
  - `type StageId = 0 | 1 | 2 | 3 | 4 | 5`, `stageAt(m: number): StageId`, `stageFloat(m: number): number` (от 0 до 6);
  - `telemetry(m: number): { altKm: number; velKmS: number }`.

- [ ] **Step 1: Падающие тесты.**

```ts
// curve.test.ts
test('hits the agreed checkpoints within 10%', () => {
  expect(timeAt(2)).toBeGreaterThan(4.5); expect(timeAt(2)).toBeLessThan(5.5)
  expect(timeAt(10)).toBeGreaterThan(12.6); expect(timeAt(10)).toBeLessThan(15.4)
  expect(timeAt(100)).toBeGreaterThan(25.2); expect(timeAt(100)).toBeLessThan(30.8)
})
test('starts at 1 and caps at 1000', () => {
  expect(multiplierAt(0)).toBe(1)
  expect(multiplierAt(1e6)).toBe(1000)
})
test('timeAt inverts multiplierAt', () => {
  for (const m of [1.01, 2, 7.5, 333]) expect(multiplierAt(timeAt(m))).toBeCloseTo(m, 6)
})

// crashPoint.test.ts
test.each([[0.97, 1], [0.5, 2], [0.25, 5], [0.1, 15], [0.025, 50]])('u=%f lands on anchor %f', (u, x) => {
  expect(sampleCrashPoint(u)).toBe(x)
})
test('top 3% explode at 1.00', () => {
  expect(sampleCrashPoint(0.975)).toBe(1)
  expect(sampleCrashPoint(0.99999)).toBe(1)
})
test('caps at 1000', () => expect(sampleCrashPoint(0)).toBe(1000))
test('is non-increasing in u and floored to cents', () => {
  let prev = Infinity
  for (let u = 0; u < 1; u += 0.001) {
    const x = sampleCrashPoint(u)
    expect(x).toBeLessThanOrEqual(prev)
    expect(Math.round(x * 100)).toBe(x * 100)
    prev = x
  }
})
test('matches the survival table on 200k seeded samples', () => {
  const rng = createRng(42)
  const xs = Array.from({ length: 200_000 }, () => sampleCrashPoint(rng()))
  const share = (f: (x: number) => boolean) => xs.filter(f).length / xs.length
  expect(share((x) => x === 1)).toBeCloseTo(0.03, 2)
  expect(Math.abs(share((x) => x >= 2) - 0.5)).toBeLessThan(0.01)
  expect(Math.abs(share((x) => x >= 5) - 0.25)).toBeLessThan(0.01)
  expect(Math.abs(share((x) => x >= 15) - 0.1)).toBeLessThan(0.005)
  expect(Math.abs(share((x) => x >= 50) - 0.025)).toBeLessThan(0.002)
})
test('survival agrees with the anchors', () => {
  expect(survival(2)).toBeCloseTo(0.5, 6)
  expect(survival(15)).toBeCloseTo(0.1, 6)
  expect(survival(1000)).toBe(0)
})

// stages.test.ts
test.each([[1, 0], [1.19, 0], [1.2, 1], [1.8, 2], [3, 3], [8, 4], [30, 5], [1000, 5]])('stageAt(%f) = %i', (m, s) => {
  expect(stageAt(m)).toBe(s)
})
test.each([[1, 0], [1.2, 1], [1.8, 2], [3, 3], [8, 4], [30, 5], [1000, 6]])('stageFloat(%f) = %f', (m, f) => {
  expect(stageFloat(m)).toBeCloseTo(f, 6)
})
test('stageFloat is continuous and increasing', () => {
  let prev = -1
  for (let m = 1; m < 1000; m *= 1.001) {
    const f = stageFloat(m)
    expect(f).toBeGreaterThan(prev)
    expect(f - prev).toBeLessThan(0.01)
    prev = f
  }
})

// telemetry.test.ts
test('hits anchors at stage borders and grows monotonically', () => {
  expect(telemetry(1)).toEqual({ altKm: 0, velKmS: 0 })
  expect(telemetry(3).altKm).toBeCloseTo(40, 6)
  let prev = telemetry(1)
  for (let m = 1.01; m < 1000; m *= 1.01) {
    const cur = telemetry(m)
    expect(cur.altKm).toBeGreaterThanOrEqual(prev.altKm)
    expect(cur.velKmS).toBeGreaterThanOrEqual(prev.velKmS)
    prev = cur
  }
})
```

- [ ] **Step 2:** `npm test`. Ожидается FAIL: модули не найдены.
- [ ] **Step 3: Реализовать модули.** Формулы, которые сигнатуры не определяют:
  - `sampleCrashPoint(u)`:
    - при `u >= 0.97` вернуть `1`;
    - при `u < 0.0005` вернуть `1000`;
    - иначе найти отрезок опорных точек `[xᵢ, Sᵢ]..[xᵢ₊₁, Sᵢ₊₁]` с `Sᵢ₊₁ ≤ u ≤ Sᵢ` и вычислить `x = xᵢ · (xᵢ₊₁/xᵢ)^(ln(u/Sᵢ) / ln(Sᵢ₊₁/Sᵢ))`;
    - результат пропустить через `floor2`.
  - `survival(x)`: та же лог-лог интерполяция в обратную сторону. При `x < 1` вернуть `1`, при `x >= 1000` вернуть `0`.
  - `stageFloat(m)`:
    - на отрезке `[Tᵢ, Tᵢ₊₁)` возвращает `i + ln(m/Tᵢ)/ln(Tᵢ₊₁/Tᵢ)`;
    - выше ×30 возвращает `5 + ln(m/30)/ln(1000/30)`.
  - `telemetry`: линейная интерполяция `ALT_ANCHORS_KM` и `VEL_ANCHORS_KMS` по `stageFloat`.
- [ ] **Step 4:** `npm test`. Ожидается PASS.
- [ ] **Step 5: Commit** `feat: multiplier curve, crash distribution, stages, telemetry`.

### Task 3: Движок раунда и шина событий

**Files:**
- Create: `src/core/types.ts`, `src/core/events.ts`, `src/core/round.ts`
- Test: `src/core/round.test.ts`

**Interfaces:**
- Consumes: всё из задачи 2.
- Produces, `types.ts`:

```ts
export type Phase = 'betting' | 'countdown' | 'flight' | 'ejected' | 'crashed' | 'result'
export type PresenterForce = 'warp' | 'instant'
export type RareKind = 'meteors' | 'aurora' | 'station' | 'sunrise'
export interface RarePlan { kind: RareKind; atStage: number } // stageFloat at which it starts
export interface HistoryEntry { crash: number; won: boolean }
export interface RoundSnapshot {
  phase: Phase
  balance: number
  bet: number
  auto: { enabled: boolean; value: number }
  countdown: number          // seconds left, 0 outside countdown
  t: number                  // rocket clock since liftoff
  multiplier: number         // rocket multiplier, floor2; keeps growing after cash out
  cashedAt: number | null    // player's multiplier after cash out
  payout: number             // credits won this round
  crashPoint: number | null  // revealed only once crashed
  stage: StageId
  phaseAge: number           // real seconds since the phase began
  history: HistoryEntry[]    // newest first
  armed: PresenterForce | null
  attract: boolean
  rare: RarePlan | null
  frozen: boolean
}
```

- Produces, `events.ts`:

```ts
export type GameEvent =
  | { type: 'launch'; bet: number }
  | { type: 'countdown'; n: 3 | 2 | 1 }
  | { type: 'liftoff' }
  | { type: 'stage'; stage: StageId }
  | { type: 'cashout'; multiplier: number; payout: number; stage: StageId; auto: boolean }
  | { type: 'crash'; multiplier: number; cashedOut: boolean; stage: StageId }
  | { type: 'result'; won: boolean; payout: number }
  | { type: 'betting' }
  | { type: 'refuel'; balance: number }
export class Emitter { on(fn: (e: GameEvent) => void): () => void; emit(e: GameEvent): void }
```

- Produces, `round.ts`: `class RoundEngine`:
  - `constructor(opts: { rng: Rng; emitter: Emitter; balance?: number })`
  - `snapshot(): RoundSnapshot`
  - `launch(): boolean`
  - `launchScripted(crash: number, autoAt: number | null): boolean`: для attract, без списания и начисления
  - `cashOut(auto?: boolean): boolean`
  - `tick(dt: number): void`
  - `stepBet(dir: 1 | -1): void`
  - `toggleAuto(): void`
  - `stepAuto(dir: 1 | -1): void`
  - `arm(kind: PresenterForce): void`
  - `setNextCrash(x: number): void`: только для отладки и тестов
  - `setAttract(on: boolean): void`
  - `abortToBetting(): void`
  - `freezeAt(m: number): void`

- [ ] **Step 1: Падающие тесты** `round.test.ts`. Вспомогательные функции: `setup(us: number[])` создаёт движок с rng, который по кругу отдаёт `us`, и собирает события в массив; `run(engine, seconds)` тикает шагом 1/60.

```ts
test('starts in betting with default balance, bet and auto', () => {
  const s = setup([0.5]).engine.snapshot()
  expect(s).toMatchObject({ phase: 'betting', balance: 10_000, bet: 100, auto: { enabled: false, value: 2 } })
})
test('launch deducts the bet, counts 3-2-1 and lifts off after 3 s', () => {
  const { engine, events } = setup([0.5])
  expect(engine.launch()).toBe(true)
  expect(engine.snapshot()).toMatchObject({ phase: 'countdown', balance: 9_900 })
  run(engine, 3.05)
  expect(engine.snapshot().phase).toBe('flight')
  expect(events.map((e) => e.type === 'countdown' ? `c${e.n}` : e.type))
    .toEqual(['launch', 'c3', 'c2', 'c1', 'liftoff'])
})
test('a second launch or launch outside betting is ignored', () => {
  const { engine } = setup([0.5])
  engine.launch()
  expect(engine.launch()).toBe(false)
  expect(engine.snapshot().balance).toBe(9_900)
})
test('manual cash out pays floor(bet × multiplier) once', () => {
  const { engine } = setup([0.25]) // crash ×5
  engine.launch(); run(engine, 3 + timeAt(1.5))
  expect(engine.cashOut()).toBe(true)
  const s = engine.snapshot()
  expect(s.phase).toBe('ejected')
  expect(s.payout).toBe(Math.floor(100 * s.cashedAt!))
  expect(s.balance).toBe(9_900 + s.payout)
  expect(engine.cashOut()).toBe(false)
})
test('without cash out the rocket crashes exactly at the crash point and the bet is lost', () => {
  const { engine, events } = setup([0.5]) // crash ×2
  engine.launch(); run(engine, 3 + timeAt(2) + 0.1)
  const s = engine.snapshot()
  expect(s).toMatchObject({ phase: 'crashed', multiplier: 2, crashPoint: 2, balance: 9_900 })
  expect(events).toContainEqual(expect.objectContaining({ type: 'crash', multiplier: 2, cashedOut: false }))
  expect(engine.cashOut()).toBe(false)
})
test('auto cash out pays exactly the auto value', () => {
  const { engine, events } = setup([0.25]) // crash ×5
  engine.toggleAuto(); engine.launch(); run(engine, 3 + timeAt(2.5))
  expect(engine.snapshot()).toMatchObject({ phase: 'ejected', cashedAt: 2, payout: 200 })
  expect(events).toContainEqual(expect.objectContaining({ type: 'cashout', auto: true, multiplier: 2 }))
})
test('auto value equal to the crash point loses', () => {
  const { engine } = setup([0.5]) // crash ×2, auto ×2
  engine.toggleAuto(); engine.launch(); run(engine, 3 + timeAt(2) + 0.1)
  expect(engine.snapshot()).toMatchObject({ phase: 'crashed', payout: 0, cashedAt: null })
})
test('after cash out the rest of the flight takes at most 6 s', () => {
  const { engine } = setup([0.0001]) // crash ×1000
  engine.launch(); run(engine, 3 + timeAt(1.2)); engine.cashOut()
  let real = 0
  while (engine.snapshot().phase === 'ejected') { engine.tick(1 / 60); real += 1 / 60 }
  expect(real).toBeLessThanOrEqual(6.05)
})
test('crash at 1.00 explodes right at liftoff', () => {
  const { engine } = setup([0.99])
  engine.launch(); run(engine, 3.05)
  expect(engine.snapshot().phase).toBe('crashed')
})
test('crashed → result → betting with the configured durations', () => {
  const { engine, events } = setup([0.99])
  engine.launch(); run(engine, 3.05 + 1.6 + 2.5 + 0.1)
  expect(engine.snapshot().phase).toBe('betting')
  expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['result', 'betting']))
})
test('refuels to 10 000 when the balance cannot cover the minimum bet', () => {
  const { engine, events } = setupWithBalance(15, [0.99])
  expect(engine.snapshot().bet).toBe(10)
  engine.launch(); run(engine, 3.05 + 1.6 + 2.5 + 0.1)
  expect(engine.snapshot().balance).toBe(10_000)
  expect(events).toContainEqual({ type: 'refuel', balance: 10_000 })
})
test('bet and auto controls are locked outside betting', () => {
  const { engine } = setup([0.5])
  engine.launch(); engine.stepBet(1); engine.toggleAuto()
  expect(engine.snapshot()).toMatchObject({ bet: 100, auto: { enabled: false } })
})
test('stepBet walks the ladder and never exceeds the balance', () => {
  const { engine } = setupWithBalance(300, [0.5])
  engine.stepBet(1); expect(engine.snapshot().bet).toBe(200)
  engine.stepBet(1); expect(engine.snapshot().bet).toBe(200)
  engine.stepBet(-1); engine.stepBet(-1); engine.stepBet(-1); engine.stepBet(-1); engine.stepBet(-1)
  expect(engine.snapshot().bet).toBe(10)
})
test('history keeps the last 15 rounds, newest first', () => { /* 16 losing rounds at ×1.00 → length 15, all { crash: 1, won: false } */ })
test('arm forces the next round once', () => {
  const { engine } = setup([0.5, 0.5, 0.5])
  engine.arm('instant'); expect(engine.snapshot().armed).toBe('instant')
  engine.launch(); run(engine, 3.05)
  expect(engine.snapshot()).toMatchObject({ phase: 'crashed', armed: null })
  run(engine, 4.2); engine.arm('warp'); engine.launch(); run(engine, 3 + timeAt(39.9))
  expect(engine.snapshot().phase).toBe('flight') // warp crash point is ≥ 40
})
test('stage events fire once per stage reached, in order', () => { /* crash ×50 → stage events 1,2,3,4,5 */ })
test('a huge dt is clamped to MAX_DT so a hidden tab does not skip the round', () => {
  const { engine } = setup([0.25])
  engine.launch(); run(engine, 3.05)
  const t0 = engine.snapshot().t
  engine.tick(30)
  expect(engine.snapshot().t - t0).toBeLessThanOrEqual(0.1 + 1e-9)
})
test('attract rounds do not touch balance or history', () => { /* setAttract(true); launchScripted(3, 2); run to betting → balance 10 000, history [] */ })
test('abortToBetting ends any phase immediately without paying', () => { /* mid-flight → betting, balance unchanged since launch */ })
test('freezeAt holds the rocket at a multiplier', () => {
  const { engine } = setup([0.5])
  engine.freezeAt(4.2); run(engine, 5)
  expect(engine.snapshot()).toMatchObject({ phase: 'flight', multiplier: 4.2, frozen: true })
})
```

`setupWithBalance(balance, us)` то же, что `setup`, но передаёт `balance` в конструктор.

- [ ] **Step 2:** `npm test`. Ожидается FAIL.
- [ ] **Step 3: Реализовать `Emitter` и `RoundEngine`.** Правила, которые тесты не определяют полностью:
  - `tick` начинается с `dt = Math.min(dt, MAX_DT)`.
  - **Взрыв.** Ракета взрывается, когда `multiplierAt(t) >= crashPoint`. В этот момент `t = timeAt(crashPoint)` и `multiplier = crashPoint`.
  - **Автокэшаут.** Срабатывает, если `auto.enabled && auto.value < crashPoint && multiplierAt(t) >= auto.value`. Выплачивается по `auto.value`.
  - **Хвост после Cash Out.** Часы ракеты идут со скоростью `max(1, (timeAt(crashPoint) − t) / EJECT_TAIL_MAX_S)`.
  - **Длительность взрыва.** Фаза `crashed` длится `CRASH_SCENE_SHORT_S`, если игрок уже забрал выигрыш, иначе `CRASH_SCENE_S`. Затем `result` длится `RESULT_S`.
  - **Новая ставка.** При входе в `betting`:
    - если `balance < BET_LADDER[0]`, баланс пополняется до `START_BALANCE` с событием `refuel`;
    - если ставка больше баланса, она опускается до наибольшей ступени, которая не больше баланса.
  - **Ведущий.** `arm('warp')` задаёт точку взрыва `40 + rng()·110`, `arm('instant')` задаёт `1`. Флаг снимается при запуске.
  - **Attract.** `launchScripted` не трогает баланс, не пишет историю и работает только при `attract === true`.
  - **Заморозка.** `freezeAt` ставит фазу `flight`, `t = timeAt(m)`, `frozen = true`, точку взрыва `MAX_MULT`. Пока `frozen`, `t` не растёт.
  - Поле `rare` пока всегда `null`, его заполнит задача 19.
- [ ] **Step 4:** `npm test`. Ожидается PASS.
- [ ] **Step 5: Commit** `feat: round engine with cash out, auto cash out, presenter forcing`.

### Task 4: Runtime, игровой цикл, стор, ввод

**Files:**
- Create: `src/game/runtime.ts`, `src/game/loop.ts`, `src/game/store.ts`, `src/game/debug.ts`, `src/platform/input.ts`, `src/platform/presenter.ts`, `src/platform/storage.ts`
- Test: `src/platform/input.test.ts`, `src/platform/presenter.test.ts`, `src/platform/storage.test.ts`

**Interfaces:**
- Consumes: `RoundEngine`, `Emitter`, `params`.
- Produces:
  - `runtime: { engine: RoundEngine; emitter: Emitter; rng: Rng }`. Seed берётся из `params.seed`, иначе случайный.
  - `startLoop(onFrame: (dtReal: number) => void): () => void`: rAF-цикл. На каждом кадре он вызывает `engine.tick(dt)`, затем `useGame.setState({ snap })`, затем `onFrame(dt)`.
  - `useGame` (zustand): `{ snap: RoundSnapshot; muted: boolean; camLabel: string; presenterOpen: boolean; setMuted(v: boolean): void; setCamLabel(v: string): void; setPresenterOpen(v: boolean): void }`.
  - `primaryAction(): void`: в `betting` вызывает `launch()`, в `flight` вызывает `cashOut()`, в остальных фазах ничего не делает.
  - `interface KeyHandlers { primary(): void; bet(dir: 1 | -1): void; auto(dir: 1 | -1): void; toggleAuto(): void; mute(): void; exit(): void; anyInput(): void; code(key: string): void }`.
  - `bindKeyboard(target: Pick<Window, 'addEventListener' | 'removeEventListener'>, h: KeyHandlers): () => void`.
  - `createCodeDetector(codes: Record<string, () => void>, windowMs?: number): (key: string, now: number) => void`. По умолчанию `windowMs = 2000`.
  - `createSafeStorage(get: () => Storage): SafeStorage` и `safeStorage = createSafeStorage(() => localStorage)`, где `interface SafeStorage { get(key: string): string | null; set(key: string, v: string): void }`. Никогда не бросает исключений.
  - `installDebug(): void`: при `params.debug` выставляет `window.__crash = { snap: () => RoundSnapshot, setNextCrash(x: number): void }`.

- [ ] **Step 1: Падающие тесты.**

```ts
// input.test.ts: fake target collects listeners, tests dispatch fake KeyboardEvent-like objects
test('space and enter trigger primary, auto-repeat is ignored', () => {
  const { fire, calls } = setupKeys()
  fire({ code: 'Space' }); fire({ code: 'Space', repeat: true }); fire({ code: 'Enter' })
  expect(calls.primary).toBe(2)
})
test('arrows step bet and auto, A toggles auto, M mutes, Escape exits', () => {
  const { fire, calls } = setupKeys()
  fire({ code: 'ArrowUp' }); fire({ code: 'ArrowDown' }); fire({ code: 'ArrowRight' }); fire({ code: 'KeyA' })
  fire({ code: 'KeyM' }); fire({ code: 'Escape' })
  expect(calls).toMatchObject({ bet: [1, -1], auto: [1], toggleAuto: 1, mute: 1, exit: 1 })
})
test('every keydown counts as input and feeds the code detector', () => {
  const { fire, calls } = setupKeys()
  fire({ code: 'KeyW', key: 'w' })
  expect(calls.anyInput).toBe(1); expect(calls.code).toEqual(['W'])
})
test('primary keys prevent default page scrolling', () => { /* preventDefault called for Space */ })

// presenter.test.ts
test('typing WARP within 2 s fires once', () => {
  const hits: string[] = []
  const feed = createCodeDetector({ WARP: () => hits.push('warp'), BOOM: () => hits.push('boom') })
  ;['W', 'A', 'R', 'P'].forEach((k, i) => feed(k, i * 300))
  expect(hits).toEqual(['warp'])
})
test('slow typing or other keys do not fire', () => {
  const hits: string[] = []
  const feed = createCodeDetector({ WARP: () => hits.push('warp') })
  ;['W', 'A', 'R'].forEach((k, i) => feed(k, i * 300)); feed('P', 5000)
  ;['W', 'X', 'R', 'P'].forEach((k, i) => feed(k, 6000 + i * 100))
  expect(hits).toEqual([])
})

// storage.test.ts
test('safeStorage survives a throwing localStorage', () => {
  const thrower = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
  const s = createSafeStorage(() => thrower as unknown as Storage)
  expect(s.get('muted')).toBeNull()
  expect(() => s.set('muted', '1')).not.toThrow()
})
```

`setupKeys()` создаёт фейковый target и обработчики, которые считают вызовы в `calls`.

- [ ] **Step 2:** `npm test`. Ожидается FAIL.
- [ ] **Step 3: Реализовать модули.**
  - `storage.ts` экспортирует `createSafeStorage(get: () => Storage)` и `safeStorage = createSafeStorage(() => localStorage)`.
  - Обработчик клавиатуры:
    - пропускает события с `repeat`;
    - вызывает `preventDefault()` для Space, Enter и стрелок;
    - передаёт в `code` `event.key.toUpperCase()`, только если это одна буква.
  - `muted` в сторе при старте читается из `safeStorage.get('muted') === '1'`.
- [ ] **Step 4:** `npm test`. Ожидается PASS.
- [ ] **Step 5: Подключить в `App.tsx`.**
  - `startLoop` запускается в эффекте и останавливается при размонтировании.
  - `bindKeyboard` привязан к window.
  - Код `WARP` вызывает `engine.arm('warp')`, `BOOM` вызывает `engine.arm('instant')`.
  - `installDebug()`.
- [ ] **Step 6: Commit** `feat: game loop, store, keyboard and presenter codes`.

### Task 5: HUD в двух раскладках

**Files:**
- Create: `src/strings.ts`, `src/ui/format.ts`, `src/ui/Hud.tsx`, `src/ui/hud.css`, `src/ui/MainButton.tsx`, `src/ui/Multiplier.tsx`, `src/ui/Telemetry.tsx`, `src/ui/AltitudeScale.tsx`, `src/ui/BetControls.tsx`, `src/ui/History.tsx`, `src/ui/Balance.tsx`, `src/ui/Countdown.tsx`, `src/ui/ResultOverlay.tsx`, `src/ui/Banner.tsx`, `src/ui/MuteButton.tsx`
- Test: `src/ui/format.test.ts`

**Interfaces:**
- Consumes: `useGame`, `runtime`, `primaryAction`, `telemetry`, `brandLogo`.
- Produces:
  - `formatCredits(n: number): string`: `Intl.NumberFormat('en-US')`, например `9,563`.
  - `formatMult(m: number): string`: всегда 2 знака без группировки и без ×, например `4.37`. Знак × рисует компонент.
  - `formatClock(t: number): string`: `T+00:12.4`.
  - `formatAlt(km: number): string`: меньше 1 км даёт `ALT 420 M`, иначе `ALT 84.2 KM`, а от 1000 км с группировкой: `ALT 12,400 KM`.
  - `formatVel(kms: number): string`: `VEL 2.41 KM/S`.
  - `<Hud />`. Строки в `strings.ts`: `LAUNCH`, `CASH OUT`, `CASHED OUT`, `BET`, `AUTO`, `MULTIPLIER`, `BALANCE`, `CRASHED @`, `YOU WON`, `ROCKET REACHED`, `REFUELING`, `PRESS SPACE TO LAUNCH`, `TAP TO LAUNCH`, `EXIT`, `LOADING`, `NEXT ROUND: WARP`, `NEXT ROUND: BOOM`.

- [ ] **Step 1: Падающий тест** `format.test.ts`:

```ts
test('formats credits, multipliers, clock and telemetry', () => {
  expect(formatCredits(9563)).toBe('9,563')
  expect(formatMult(4.3)).toBe('4.30')
  expect(formatMult(1000)).toBe('1000.00')
  expect(formatClock(12.43)).toBe('T+00:12.4')
  expect(formatClock(75)).toBe('T+01:15.0')
  expect(formatAlt(0.42)).toBe('ALT 420 M')
  expect(formatAlt(84.25)).toBe('ALT 84.3 KM')
  expect(formatAlt(12400)).toBe('ALT 12,400 KM')
  expect(formatVel(2.414)).toBe('VEL 2.41 KM/S')
})
```

- [ ] **Step 2:** `npm test`. Ожидается FAIL. **Step 3:** реализовать `format.ts`. **Step 4:** PASS.
- [ ] **Step 5: Компоненты HUD.** Раскладки описаны в разделе 4 спеки.
  - **Горизонтальная** (`@media (min-aspect-ratio: 1/1)`): по наброску `brand-hud.html`, вариант A. Размеры в `rem`, корневой `font-size: min(calc(100vw / 120), calc(100vh / 67.5))`, что даёт 16px на 1920×1080. Чёрные полосы сверху и снизу по 6vh.
  - **Вертикальная:** сверху логотип, баланс и история (сколько помещается); множитель по центру верхней трети; кнопка внизу во всю ширину с учётом `env(safe-area-inset-bottom)`, над ней ставка и автокэшаут. Корневой `font-size: calc(100vw / 24.4)`. Телеметрия в одну строку. Полос нет.
  - **Telemetry:** `formatClock(t)`, `formatAlt`, `formatVel` из `telemetry(multiplier)` и метка камеры `useGame.camLabel` (пока пустая, её заполнит режиссёр камеры).
  - `Multiplier`, `MainButton` и `Telemetry` подписываются на стор через `useGame.subscribe` и пишут текст прямо в DOM через ref, без React-рендера каждый кадр.
  - **MainButton** реагирует на `pointerdown`, не на `click`. Высота не меньше 56px на таче. Состояния:
    - `betting`: `LAUNCH`;
    - `countdown`: `T-3`, `T-2`, `T-1`, неактивна;
    - `flight`: `CASH OUT · <formatCredits(bet × multiplier)>`;
    - `ejected`: `CASHED OUT · <payout>`, неактивна;
    - `crashed` и `result`: неактивна.
  - **Ставка и автокэшаут:** `BET 100 [−][+]`, `AUTO [on/off] 2.00× [−][+]`. Видны и активны только в `betting`, появляются и исчезают через Motion.
  - **History:** чипы `12.40×`. Белые, если `won`, красные, если нет. Новый чип въезжает слева.
  - **AltitudeScale:** вертикальная линия на правом крае, красный маркер стоит на `stageFloat/6`.
  - **Countdown:** крупные `3`, `2`, `1` шрифтом Clickable Black по событиям `countdown`.
  - **ResultOverlay** в фазе `result`:
    - при выигрыше: `YOU WON +437` и строка `ROCKET REACHED 12.40×`;
    - при проигрыше: `CRASHED @ 4.37×` красным.
  - **Banner** показывает `REFUELING` на 1.5 с по событию `refuel`.
  - **MuteButton** стоит в углу рядом с логотипом.
- [ ] **Step 6: Проверка вручную.** `npm run dev`, сыграть несколько раундов клавиатурой и мышью. Проверить:
  - множитель растёт;
  - Cash Out начисляет выигрыш;
  - проигрыш попадает в историю красным;
  - автокэшаут срабатывает;
  - после проигрыша всего баланса приходит `REFUELING`.
  Снять оба кадра: `npm run shot -- "?debug=1&freeze=4.37" shots/hud-landscape.png` и тот же с `--portrait`. Сравнить с наброском A: раскладка та же, красный только на разрешённых местах.
- [ ] **Step 7: Commit** `feat: HUD with landscape and portrait layouts`.

---

## Часть 2. Сцена и звук: играбельная основа

Порядок частей 2–4 повторяет слои из раздела 13 спеки. Если время кончится, урезается в порядке спеки: сначала редкие события (задача 19), потом голос отсчёта (шаг 6 задачи 15), потом часть дальнего космоса (задача 17).

Общие правила для задач сцены (6–14, 16, 17, 19):
- **Ближнее поле** в метрах. Ракета стоит в `y = rig.rocketY`. Стартовый стол и облака смещаются вниз на `rig.nearOffset`.
- **Дальнее поле.** Все объекты дальнего поля лежат внутри `<FarField>`. Материалы с `depthWrite: false` и `depthTest: false`, порядок отрисовки задаётся `renderOrder`:
  - небо −100;
  - звёзды −90;
  - туманности −80;
  - солнце −75;
  - Луна −70;
  - Земля −60;
  - атмосфера −50;
  - варп −40.
- **Камера:** near 0.5, far 30 000.
- **Проверка кадра** в каждой графической задаче: `npm run shot -- "?debug=1&freeze=<m>" shots/<name>.png` при запущенном `npm run dev`. Посмотреть снимок (Read по пути PNG) и сверить с критериями задачи. Снимки в git не попадают.

### Task 6: Основа рендера: Stage, rig, дальнее поле, постобработка

**Files:**
- Create: `src/scene/Stage.tsx`, `src/scene/quality.ts`, `src/scene/rig.ts`, `src/scene/RigUpdater.tsx`, `src/scene/fx.ts`, `src/scene/far/FarField.tsx`, `src/scene/camera/CameraRig.tsx` (простая слежка, заменяется в задаче 12), `src/scene/post/Effects.tsx`, `src/scene/post/ZoomBlurEffect.ts`
- Test: `src/scene/rig.test.ts`
- Modify: `src/App.tsx` (Canvas под HUD)

**Interfaces:**
- Consumes: `RoundSnapshot`, `stageFloat`, `telemetry`, `params.freeze`.
- Produces, `quality.ts`:

```ts
export const QUALITY = {
  dpr: [1, 2] as [number, number],
  cloudScale: 0.5, cloudSteps: 72, cloudLightSteps: 6, cloudNoiseSize: 128,
  smokeParticles: 6000, debrisPieces: 320, starCount: 30000, meteorCount: 60,
  earthTextures: 'textures/earth/8k/', moonTexture: 'textures/moon/moon-4k.jpg',
  bloomLevels: 8, zoomBlur: true, godRays: true, dof: true, grain: true, lensFlare: true,
} as const
```

- Produces, `rig.ts`:

```ts
export const NEAR_CAP_M = 6000
export const CLOUD_BASE_M = 1200
export const CLOUD_TOP_M = 2600
export interface FlightRig {
  phase: Phase; m: number; stageF: number; altM: number
  rocketY: number      // min(altM, NEAR_CAP_M)
  nearOffset: number   // max(0, altM - NEAR_CAP_M)
  speed: number        // 0..1 = clamp(stageF / 5) while flying, eases to 0 after the crash
  thrust: number       // 0 in betting, ramps 0→1 over the last 1.5 s of countdown, 1 in flight, 0 after crash
  ejected: boolean; ejectStage: StageId | null
  crashAge: number | null // real seconds since the crash
  slowmo: number       // 0.3 at the crash, eases back to 1 by crashAge 1.5
  vtime: number        // visual clock, += dt * slowmo
}
export const rig: FlightRig
export function computeRig(prev: FlightRig, snap: RoundSnapshot, dt: number): FlightRig
```

- Produces, `fx.ts`: `interface DistortionSource { pos: Vector2 /* uv */; radius: number; strength: number; ring: boolean }` и мутируемый `fx = { chroma: 0, flash: 0, flashColor: new Color(), dofPulse: 0, shake: 0, zoomBlur: 0, distortion: [] as DistortionSource[], sunScreen: new Vector2(), sunVisible: 0 }`. В него пишут факел, взрыв, режиссёр, варп и солнце, читает постобработка.
- Produces: `class ZoomBlurEffect extends Effect`: радиальное размытие от центра экрана, сила берётся из `fx.zoomBlur` каждый кадр.
- Produces: `<FarField>{children}</FarField>`: группа, которая каждый кадр копирует `camera.position`. Константы `FAR_SKY_R = 20000`, `FAR_EARTH_D = 15000`.
- Produces: `window.__crashReady = true` в режиме debug, когда загрузка завершена и прошло 30 кадров.

- [ ] **Step 1: Падающий тест** `rig.test.ts`:

```ts
test('rocket stays in the near field and the world shifts past 6 km', () => {
  const r = computeRig(initialRig(), snapAt({ phase: 'flight', multiplier: 3 }), 1 / 60)
  expect(r.altM).toBeCloseTo(40_000, 0)
  expect(r.rocketY).toBe(6000)
  expect(r.nearOffset).toBeCloseTo(34_000, 0)
})
test('thrust is 0 while betting and ramps during the last 1.5 s of countdown', () => {
  expect(computeRig(initialRig(), snapAt({ phase: 'betting' }), 0.016).thrust).toBe(0)
  expect(computeRig(initialRig(), snapAt({ phase: 'countdown', countdown: 2 }), 0.016).thrust).toBe(0)
  expect(computeRig(initialRig(), snapAt({ phase: 'countdown', countdown: 0.75 }), 0.016).thrust).toBeCloseTo(0.5, 2)
})
test('slow motion starts at 0.3 on crash and recovers by 1.5 s', () => {
  let r = computeRig(initialRig(), snapAt({ phase: 'crashed', phaseAge: 0 }), 0.016)
  expect(r.slowmo).toBeCloseTo(0.3, 2)
  r = computeRig(r, snapAt({ phase: 'crashed', phaseAge: 1.5 }), 0.016)
  expect(r.slowmo).toBe(1)
})
test('ejected keeps the rocket flying and remembers the stage', () => {
  const r = computeRig(initialRig(), snapAt({ phase: 'ejected', multiplier: 4, cashedAt: 2 }), 0.016)
  expect(r).toMatchObject({ ejected: true, ejectStage: 2 })
})
```

`snapAt(partial)` дополняет снимок значениями по умолчанию. Этап выхода из капсулы считается как `stageAt(cashedAt)`.

- [ ] **Step 2:** FAIL. **Step 3:** реализовать `computeRig`. `RigUpdater` вызывает его в `useFrame` с priority −10 и копирует результат в `rig`. **Step 4:** PASS.
- [ ] **Step 5: Stage и постобработка.**
  - **Canvas:** `gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}`, `dpr={QUALITY.dpr}`, `camera={{ near: 0.5, far: 30000, fov: 40 }}`, рендерер с `NoToneMapping`. Тонмаппинг делает постобработка.
  - **Effects:** `EffectComposer` с `multisampling={0}`. В этой задаче цепочка `ZoomBlurEffect` → `Bloom` (mipmapBlur, `levels = QUALITY.bloomLevels`, `luminanceThreshold` 1.0) → `ChromaticAberration` (смещение из `fx.chroma`) → `Vignette` → `Noise` (зерно, premultiply, opacity 0.06) → `ToneMapping` (AgX) → `SMAA`. Остальные эффекты добавляют задачи 8, 10 и 11. Вставлять их в цепочку **до** `ToneMapping`.
  - **Отладка:** при `params.debug` показывается drei `<Stats />`.
  - **Заморозка:** при `params.freeze` вызывается `engine.freezeAt(params.freeze)`.
  - **Временная сцена:** пока ракеты нет, рисуется заглушка (белый цилиндр высотой 48 м) и тёмная плоскость земли.
- [ ] **Step 6: Проверка.** `npm run shot -- "?debug=1&freeze=1.1" shots/t6.png`. На кадре виден цилиндр, HUD поверх, ошибок в консоли нет.
- [ ] **Step 7: Commit** `feat: render foundation with rig, far field and post chain`.

### Task 7: Ракета

**Files:**
- Create: `src/scene/rocket/geometry.ts`, `src/scene/rocket/materials.ts`, `src/scene/rocket/textures.ts`, `src/scene/rocket/Rocket.tsx`, `src/scene/rocket/refs.ts`, `src/scene/env/environment.ts`
- Modify: `src/scene/Stage.tsx` (заглушку заменить на `<Rocket />`)

**Interfaces:**
- Consumes: `rig`, `brandFonts`, `brandColors`, `@brand/logo/clickable-logo-red.svg`.
- Produces, `refs.ts`:
  - `ROCKET_HEIGHT_M = 48`;
  - `rocketRefs = { root: null as Group | null, capsule: null as Group | null, nozzles: [] as Object3D[], fairing: null as Group | null }`. Узлы сопел нужны факелу и свету, капсула и обтекатель нужны задаче 13.
- Produces, `environment.ts`: `createEnvMaps(renderer: WebGLRenderer): { pad: Texture; space: Texture }`. Две PMREM-карты строятся из процедурных сцен, без сети. Ракета переключает `scene.environment` с `pad` на `space` при `stageF ≥ 1.6`, пока она внутри облаков, поэтому смена незаметна.

- [ ] **Step 1: Геометрия, оригинальный дизайн.**
  - Корпус: LatheGeometry со швами-канавками.
  - Тёмный межступенчатый отсек.
  - Пять сопел: центральное и четыре вокруг, раструбы из LatheGeometry.
  - Четыре стреловидных стабилизатора.
  - Наверху отделяемая капсула экипажа: коническая, с тёмным теплозащитным экраном, с башней системы спасения. Капсула в отдельной `Group` под `rocketRefs.capsule`, обтекатель-переходник в `rocketRefs.fairing`.
  - Высота 48 м, начало координат в основании.
  - Без сходства с реальными ракетами и без маскотов.
- [ ] **Step 2: Материалы.** `MeshPhysicalMaterial`:
  - корпус: белая краска с `clearcoat` 0.6;
  - межступенчатый отсек: матовый чёрный углепластик;
  - сопла: металл, `metalness` 1, тёмно-бронзовый с цветами побежалости;
  - красная полоса `brandColors.red` с надписью `CLICKABLE` шрифтом Clickable Black.
  Процедурные `CanvasTexture` (через `document.fonts.ready`):
  - roughness с пятнами;
  - normal-карта панельных швов;
  - копоть: градиент к основанию плюс шум;
  - полоса с надписью.
- [ ] **Step 3: Окружение** через `createEnvMaps`:
  - `pad`: ночное небо, тёплые прожекторы-панели, тёмная земля;
  - `space`: чёрное небо, яркое солнце-панель, голубой отражённый свет снизу.
- [ ] **Step 4: Проверка.** `freeze=1.05` (ракета на столе) и крупный план. Критерии:
  - на корпусе видны отражения;
  - читается надпись CLICKABLE;
  - заметны швы и копоть;
  - ракета не выглядит пластиковой.
- [ ] **Step 5: Commit** `feat: procedural branded rocket with PBR materials`.

### Task 8: Факел двигателя, марево, свет от пламени

**Files:**
- Create: `src/scene/rocket/Plume.tsx`, `src/scene/rocket/plumeShader.ts`, `src/scene/post/DistortionEffect.ts`
- Modify: `src/scene/post/Effects.tsx`, `src/scene/rocket/Rocket.tsx`

**Interfaces:**
- Consumes: `rig.thrust`, `rig.stageF`, `rocketRefs.nozzles`, `fx`.
- Produces:
  - `class DistortionEffect extends Effect`: читает `fx.distortion` (тип `DistortionSource` из `fx.ts`) каждый кадр, до 8 источников;
  - `plumeMaterial(opts: { scale: number }): ShaderMaterial`: тот же материал для маленьких двигателей капсулы в задаче 13;
  - `plumeLight`: `PointLight`, оранжевый, интенсивность `∝ thrust`. Его позицию задача 11 передаёт в облака.

- [ ] **Step 1: Шейдер факела.**
  - Аддитивный, вытянутый конус на каждое сопло.
  - Слои: горячее белое ядро, оранжевый, сине-фиолетовый край.
  - Ударные ромбы (shock diamonds): синус по длине с затуханием.
  - Анимированный шум.
  - Длина и ширина зависят от `thrust`.
  - С ростом `stageF` факел расширяется: у земли плотный, в вакууме широкий и прозрачный.
  - HDR-яркость больше 1, чтобы светился bloom.
- [ ] **Step 2: DistortionEffect.** Экранное искажение UV шумом в кругах источников. Если у источника `ring: true`, искажается кольцо: это ударная волна в задаче 14. Plume каждый кадр проецирует сопло на экран и кладёт источник марева в `fx.distortion`.
- [ ] **Step 3: Свет.** `plumeLight` у сопел мерцает с шумом и освещает ракету, землю и дым.
- [ ] **Step 4: Проверка.**
  - На `freeze=1.05` факел яркий, видны ромбы, вокруг сопла заметно марево.
  - На `freeze=4` факел широкий и полупрозрачный.
- [ ] **Step 5: Commit** `feat: layered engine plume, heat haze and flame light`.

### Task 9: Стартовый стол, прожекторы, дым и пар

**Files:**
- Create: `src/scene/pad/LaunchPad.tsx`, `src/scene/pad/Tower.tsx`, `src/scene/pad/Floodlights.tsx`, `src/scene/pad/Smoke.tsx`
- Modify: `src/scene/Stage.tsx`, `src/core/round.ts` и `src/core/round.test.ts` (`freezeAt(1)` держит отсчёт)

**Interfaces:**
- Consumes: `rig` (`nearOffset`, `thrust`, `phase`, `vtime`), `plumeLight`, `QUALITY.smokeParticles`.
- Produces: `<LaunchPad />`. Всё лежит в группе с `position.y = -rig.nearOffset` и скрывается при `altM > 30 000`.

- [ ] **Step 1: Стол и окружение.**
  - Бетонная площадка с газоотводным лотком и мокрыми бликами.
  - Ферменная башня обслуживания: instanced-балки, огни-маячки, отводящиеся при отсчёте фермы.
  - Земля до горизонта с огнями далёкого комплекса.
- [ ] **Step 2: Прожекторы.** 4–6 `SpotLight` с тенями от ракеты и башни. Видимые объёмные лучи: конусы с fresnel и шумом, аддитивные. Ночная атмосфера.
- [ ] **Step 3: Дым и пар.** `QUALITY.smokeParticles` instanced-квадов, поворот к камере делает шейдер.
  - Мягкий круглый край с шумом.
  - Освещение: оранжевый снизу от факела, холодный от прожекторов.
  - Затухание у земли.
  - В `betting`: лёгкий пар из клапанов.
  - В `countdown`: пар усиливается.
  - На старте: облака выхлопа выбрасываются из лотка в стороны и вверх.
  - Частицы живут в мировых координатах стола, ракета улетает от них.
- [ ] **Step 4: Проверка.**
  - `freeze=1.0` в фазе отсчёта. Для этого debug-параметр `freeze` при значении 1.0 держит фазу `countdown`: добавить в `freezeAt` ветку при `m === 1` с тестом.
  - `freeze=1.1`: ракета над столом в клубах подсвеченного дыма, видны лучи прожекторов.
- [ ] **Step 5: Commit** `feat: night launch pad with floodlights and exhaust clouds`.

### Task 10: Небо, атмосфера, звёзды, солнце

**Files:**
- Create: `src/scene/far/SkyDome.tsx`, `src/scene/far/Stars.tsx`, `src/scene/far/Sun.tsx`, `src/scene/env/Lights.tsx`, `src/scene/env/lightState.ts`, `src/scene/post/LensFlareEffect.ts`
- Modify: `src/scene/post/Effects.tsx`, `src/scene/Stage.tsx`

**Interfaces:**
- Consumes: `rig.stageF`, `rig.altM`, `fx`.
- Produces: `lightState = { sunDir: Vector3, moonDir: Vector3, keyColor: Color, keyIntensity: number }`. Это общий источник направления света для облаков (задача 11), Земли (задача 16) и событий (задача 19). `Sun.tsx` экспортирует `setSunElevation(rad: number)` для события «восход».

- [ ] **Step 1: SkyDome.** Сфера `FAR_SKY_R` с шейдером однократного рассеяния (Рэлей и Ми, аналитический), униформы `altM`, `sunDir`.
  - На земле ночь с сумеречным свечением у горизонта (солнце на −8°).
  - С высотой небо темнеет до чёрного к `stageF ≈ 2.6`.
  - Линия горизонта опускается.
- [ ] **Step 2: Stars.** `QUALITY.starCount` точек с разной яркостью и цветовой температурой, плюс тонкая полоса Млечного Пути из процедурного шума. Прозрачность растёт от `stageF` 1.5 к 2.5 (на старте видны лишь самые яркие).
- [ ] **Step 3: Sun.** Яркий диск в дальнем поле. Каждый кадр он пишет `fx.sunScreen` и `fx.sunVisible` (0, если солнце за Землёй или ниже горизонта). `LensFlareEffect`: процедурные блики (ореол, призраки вдоль оси к центру, звездчатые лучи) по `fx.sunScreen`, сила `fx.sunVisible`. GodRays от меша солнца (`QUALITY.godRays`).
- [ ] **Step 4: Lights.** Ключевой `DirectionalLight` с тенями для ракеты:
  - на этапах 0–1 лунный, холодный, слабый;
  - с `stageF ≥ 2` солнечный, тёплый, сильный, плавный переход.
  Слабый голубой заполняющий свет снизу от Земли с `stageF ≥ 2.5`.
- [ ] **Step 5: Проверка.** Кадры `freeze=1.1`, `freeze=2.2`, `freeze=4`: небо уходит от ночного с зарёй к чёрному, звёзды проявляются, ракета на орбите освещена солнцем.
- [ ] **Step 6: Commit** `feat: scattering sky, stars, sun with flares and light transition`.

### Task 11: Объёмные облака

**Files:**
- Create: `src/scene/clouds/noise.worker.ts`, `src/scene/clouds/noise.ts`, `src/scene/clouds/cloudsShader.ts`, `src/scene/post/CloudsEffect.ts`
- Modify: `src/scene/post/Effects.tsx` (облака первыми в цепочке), `src/App.tsx` (дождаться шума до конца загрузки)

**Interfaces:**
- Consumes: `CLOUD_BASE_M`, `CLOUD_TOP_M`, `rig.nearOffset`, `lightState`, `plumeLight`, `rig.thrust`, `QUALITY.cloud*`.
- Produces:
  - `loadCloudNoise(): Promise<{ shape: Data3DTexture; weather: DataTexture }>`. Генерация в воркере: Perlin-Worley `cloudNoiseSize³` в канале R, Worley-fbm в G, карта покрытия 512² в weather. Промис кешируется.
  - `class CloudsEffect extends Effect`, атрибуты `EffectAttribute.DEPTH`, конструктор `({ shape, weather })`.

- [ ] **Step 1: Шум в воркере.** Сгенерировать текстуры и передать их как transferable. Время на ноутбуке записать в README (ожидаемо 1–3 с, укладывается в загрузку).
- [ ] **Step 2: CloudsEffect.** У эффекта своя цель рендера с разрешением `QUALITY.cloudScale` от экрана.
  - **`update()`** рендерит полноэкранный квад с raymarching:
    - луч из матриц камеры пересекает слой `[CLOUD_BASE_M − nearOffset, CLOUD_TOP_M − nearOffset]` по высоте;
    - дальность не больше 40 км;
    - шагов `cloudSteps`, к свету `cloudLightSteps`;
    - Beer-Powder, фаза Хеньи-Гринштейна;
    - освещение луной из `lightState` и точечным светом факела (оранжевая подсветка изнутри при пролёте);
    - джиттер старта луча синим шумом;
    - луч обрывается на глубине сцены, чтобы ракета была внутри облаков.
  - **`mainImage`** апскейлит с учётом глубины и смешивает: `color · transmittance + scattered`.
- [ ] **Step 3: Проверка.** Кадры:
  - `freeze=1.15`: слой облаков над ракетой, снизу подсвечен прожекторами и факелом;
  - `freeze=1.45`: ракета внутри облаков, факел светит в них;
  - `freeze=2.0`: облака внизу, освещены луной, видна их фактура.
  Облака не должны выглядеть плоскими картинками. Записать FPS из `<Stats>` на этих кадрах в README, раздел «Производительность».
- [ ] **Step 4: Commit** `feat: raymarched volumetric cloud layer lit by moon and plume`.

### Task 12: Режиссёр камеры

**Files:**
- Create: `src/scene/camera/shots.ts`, `src/scene/camera/director.ts`
- Modify: `src/scene/camera/CameraRig.tsx` (простую слежку заменить режиссёром)
- Test: `src/scene/camera/shots.test.ts`, `src/scene/camera/director.test.ts`

**Interfaces:**
- Consumes: `rig`, `rocketRefs`, `fx`, `useGame.setCamLabel`, `Rng`.
- Produces:
  - `type ShotId = 'padWide' | 'padClose' | 'groundTele' | 'onboard' | 'sideChase' | 'wide' | 'capsuleFollow' | 'crashWide'`;
  - `interface CameraPose { pos: Vector3; look: Vector3; fov: number }`;
  - `SHOTS: Record<ShotId, { label: string; pose(rig: FlightRig, shotAge: number, aspect: number, out: CameraPose): void }>`. Метки в формате `CAM 1 · GROUND`, `CAM 2 · ONBOARD`, `CAM 3 · CHASE`, `CAM 4 · WIDE`;
  - `createDirector(rng: Rng): { update(rig: FlightRig, dt: number, aspect: number): { shot: ShotId; pose: CameraPose; cut: boolean } }`.

- [ ] **Step 1: Падающие тесты.**

```ts
// director.test.ts
test('in flight, cuts every 3–6 s and never repeats a shot twice in a row', () => {
  const d = createDirector(createRng(1))
  const cuts: { shot: ShotId; at: number }[] = []
  for (let t = 0; t < 120; t += 1 / 60) {
    const r = d.update(rigAt({ phase: 'flight', stageF: 3 }), 1 / 60, 16 / 9)
    if (r.cut) cuts.push({ shot: r.shot, at: t })
  }
  for (let i = 1; i < cuts.length; i++) {
    expect(cuts[i].shot).not.toBe(cuts[i - 1].shot)
    expect(cuts[i].at - cuts[i - 1].at).toBeGreaterThanOrEqual(3 - 1e-6)
    expect(cuts[i].at - cuts[i - 1].at).toBeLessThanOrEqual(6 + 1e-6)
  }
})
test('ground telephoto is only used up to stage 1', () => { /* stageF 3 for 120 s → no 'groundTele' */ })
test('countdown uses pad shots, eject follows the capsule, crash goes wide', () => {
  const d = createDirector(createRng(1))
  expect(['padWide', 'padClose']).toContain(d.update(rigAt({ phase: 'countdown' }), 0.016, 16 / 9).shot)
  expect(d.update(rigAt({ phase: 'ejected', ejected: true }), 0.016, 16 / 9).shot).toBe('capsuleFollow')
  expect(d.update(rigAt({ phase: 'crashed', crashAge: 0 }), 0.016, 16 / 9).shot).toBe('crashWide')
})
test('capsuleFollow hands back to the rocket after 1.5 s', () => { /* ejected for 1.6 s → shot is sideChase or wide */ })

// shots.test.ts
test.each([16 / 9, 9 / 19.5])('every flight shot keeps the rocket inside the central 70%% at aspect %f', (aspect) => {
  for (const id of ['groundTele', 'onboard', 'sideChase', 'wide'] as ShotId[]) {
    const pose = emptyPose()
    SHOTS[id].pose(rigAt({ phase: 'flight', stageF: 1, rocketY: 900 }), 1, aspect, pose)
    const ndc = projectRocketCenter(pose, aspect) // helper builds a PerspectiveCamera and projects (0, rocketY + 24, 0)
    expect(Math.abs(ndc.x)).toBeLessThan(0.7)
    expect(Math.abs(ndc.y)).toBeLessThan(0.7)
  }
})
```

`rigAt(partial)` дополняет `FlightRig` значениями по умолчанию.

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реализовать планы.**
  - `onboard`: камера на корпусе у межступенчатого отсека смотрит вниз вдоль ракеты на факел и Землю.
  - `groundTele`: длиннофокусный объектив с земли, FOV 8–12°, камера плавно ведёт ракету.
  - `sideChase`: камера сбоку на расстоянии 60–90 м, лёгкий снос.
  - `wide`: общий план 200–300 м.
  - В вертикальном кадре дистанция и FOV пересчитываются по `aspect`, ракета в кадре целиком.
  - Поверх любого плана:
    - FOV увеличивается на `12·speed`, а в варпе (`stageF ≥ 5`) ещё до +25°;
    - тряска (шум) с амплитудой `fx.shake + 0.4·speed·thrust` и пиком на старте.
  - Каждая смена плана:
    - ставит метку через `setCamLabel`;
    - даёт `fx.dofPulse = 1` с затуханием за 0.6 с (DOF подключается в Effects, `QUALITY.dof`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Проверка.** Сыграть раунд до ×5 в dev. Смены планов похожи на режиссуру трансляции, метка камеры в HUD меняется, в портретном окне (`shot --portrait`) ракета в кадре.
- [ ] **Step 6: Commit** `feat: broadcast camera director with portrait framing`.

### Task 13: Cash Out: отстрел капсулы

**Files:**
- Create: `src/scene/eject/Capsule.tsx`, `src/scene/eject/Parachute.tsx`, `src/scene/eject/Fairing.tsx`, `src/ui/WinBurst.tsx`, `src/ui/Confetti.tsx`, `src/platform/haptics.ts`
- Modify: `src/scene/rocket/Rocket.tsx` (скрыть капсулу на ракете после отстрела), `src/ui/Hud.tsx`

**Interfaces:**
- Consumes: событие `cashout` из `runtime.emitter`, `rig.ejectStage`, `rocketRefs.capsule`, `rocketRefs.fairing`, `plumeMaterial({ scale })`, `fx`.
- Produces: `vibrate(pattern: number | number[]): void` (только если есть `navigator.vibrate`, без исключений).

- [ ] **Step 1: Сцена отстрела.** По событию `cashout`:
  - капсула переходит в мировые координаты с текущим трансформом;
  - вспышка пиропатронов: точечный свет и спрайт;
  - обломки обтекателя: 12–20 instanced-кусков с вращением;
  - импульс вверх и вбок.
  Дальше два сценария:
  - `ejectStage ≤ 1`: через 0.6 с вытяжной парашют, через 1.2 с основной. Купол из сферического сегмента со стропами, красно-белые сектора. Капсула плавно замедляется.
  - выше: тормозные двигатели (4 маленьких факела `plumeMaterial({ scale: 0.08 })`), капсула уходит в сторону и вниз.
  Ракета продолжает полёт с усиленным факелом.
- [ ] **Step 2: HUD.**
  - **WinBurst:** `+437` шрифтом Clickable Black, счётчик от 0 до выплаты за 0.9 с, с пружинным масштабом.
  - **Confetti:** 1.2 с, canvas-слой, около 150 красно-белых частиц с гравитацией. На событии `cashout`.
  - **Призрачный множитель:** основной множитель фиксируется на `cashedAt`, рядом бледным растёт `ROCKET REACHED <multiplier>×`.
  - На Android вибрация `vibrate(40)`.
- [ ] **Step 3: Проверка.** Скриптом через `window.__crash.setNextCrash(20)` сыграть два раунда: Cash Out на ×1.3 (парашют) и на ×4 (тормозные двигатели). Камера ~1.5 с ведёт капсулу, затем возвращается к ракете. Снять кадры обоих моментов: у `shot.mjs` добавить флаг `--at <seconds>`, который снимает через N секунд после `__crashReady`, а сценарий выполняется через `--eval "<js>"` перед ожиданием.
- [ ] **Step 4: Commit** `feat: capsule eject with parachute or retro thrusters and win burst`.

### Task 14: Взрыв

**Files:**
- Create: `src/scene/crash/Explosion.tsx`, `src/scene/crash/Fireball.tsx`, `src/scene/crash/Shockwave.tsx`, `src/scene/crash/Debris.tsx`
- Modify: `src/scene/rocket/Rocket.tsx` (скрыть ракету после взрыва до следующего `betting`), `src/ui/Hud.tsx`

**Interfaces:**
- Consumes: событие `crash`, `rig.slowmo`, `rig.vtime`, `rig.crashAge`, `fx` (включая `fx.zoomBlur` и `DistortionSource` с `ring: true`), `vibrate`.

- [ ] **Step 1: Взрыв.** Все анимации идут по `rig.vtime`, поэтому slow-motion действует на всё.
  - **Fireball:** сфера с шумовым смещением и эмиссией по температуре (белый, жёлтый, оранжевый, тёмно-красный, дым), расширяется и остывает.
  - **Shockwave:** экранное кольцо через `fx.distortion` с `ring: true` плюс светящееся кольцо-плоскость.
  - **Debris:** `QUALITY.debrisPieces` instanced-обломков корпуса с материалом ракеты, вращение и тлеющие края. В атмосфере (этапы 0–1) с гравитацией и дымными шлейфами, в космосе без гравитации.
  - **Экран:**
    - `fx.flash`: белая вспышка, затем переход в красный `brandColors.red` и затухание за 0.8 с;
    - `fx.chroma`: пик 1, затухание;
    - `fx.shake`: пик;
    - `fx.zoomBlur`: импульс.
  - Если игрок уже забрал выигрыш, все длительности ×0.6.
  - На Android вибрация `vibrate([60, 40, 120])`.
- [ ] **Step 2: HUD.** В фазе `crashed` множитель становится красным и показывает `CRASHED @ 4.37×` (Clickable Black для слова, Montserrat для числа и ×), лёгкая тряска элемента.
- [ ] **Step 3: Проверка.** Через `setNextCrash`:
  - взрыв на ×1.00 на столе;
  - на ×1.5 в облаках;
  - на ×6 на орбите.
  Снять кадры на 0.3 с и 1.0 с после взрыва. Критерии: видно замедление, ударная волна искажает фон, обломки разлетаются, вспышка уходит в красный.
- [ ] **Step 4: Commit** `feat: slow-motion explosion with shockwave, debris and flash`.

### Task 15: Звук

**Files:**
- Create: `src/audio/core.ts`, `src/audio/rocket.ts`, `src/audio/sfx.ts`, `src/audio/music.ts`, `src/audio/bindings.ts`, файлы в `public/audio/`
- Modify: `src/App.tsx`, `src/ui/MuteButton.tsx`, `CREDITS.md`
- Test: `src/audio/bindings.test.ts`

**Interfaces:**
- Consumes: `runtime.emitter`, `rig`, `useGame` (`muted`, `setMuted`), `safeStorage`.
- Produces:
  - `createAudio(): AudioSystem` с методами:
    - `unlock(): void`: вызывается на первом жесте;
    - `setMuted(m: boolean): void`: плавный fade 0.15 с;
    - `update(rig: FlightRig): void`: каждый кадр;
    - `dispose(): void`.
  - `bindAudio(emitter: Emitter, sfx: SfxApi): () => void`. `SfxApi` содержит методы: `countdown(n)`, `liftoff()`, `stage(s)`, `cashout()`, `parachute()`, `crash(stage)`, `win(payout)`, `ui()`.
  - `bindVisibility(doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>, ctx: Pick<AudioContext, 'suspend' | 'resume'>, isMuted: () => boolean): () => void`.

- [ ] **Step 1: Падающие тесты.**

```ts
test('maps game events to sounds', () => {
  const calls: string[] = []
  const sfx = fakeSfx(calls) // records method names with args
  const emitter = new Emitter()
  bindAudio(emitter, sfx)
  emitter.emit({ type: 'countdown', n: 3 })
  emitter.emit({ type: 'liftoff' })
  emitter.emit({ type: 'cashout', multiplier: 2, payout: 200, stage: 1, auto: false })
  emitter.emit({ type: 'crash', multiplier: 5, cashedOut: true, stage: 3 })
  expect(calls).toEqual(['countdown:3', 'liftoff', 'cashout', 'parachute', 'win:200', 'crash:3'])
})
test('no parachute sound above stage 1', () => { /* cashout stage 2 → no 'parachute' */ })
test('muted state persists through safeStorage and defaults to unmuted when storage throws', () => { /* … */ })
test('hidden tab suspends audio, returning resumes it unless muted', () => {
  const calls: string[] = []
  const doc = fakeDocument() // hidden flag + dispatch('visibilitychange')
  let muted = false
  bindVisibility(doc, { suspend: async () => { calls.push('suspend') }, resume: async () => { calls.push('resume') } }, () => muted)
  doc.setHidden(true); doc.setHidden(false)
  muted = true; doc.setHidden(true); doc.setHidden(false)
  expect(calls).toEqual(['suspend', 'resume', 'suspend'])
})
```

- [ ] **Step 2:** FAIL. **Step 3:** реализовать `bindings.ts`. **Step 4:** PASS.
- [ ] **Step 5: Синтез** (`core.ts`, `rocket.ts`, `sfx.ts`).
  - **Граф:** AudioContext → шины sfx, music, reverb (свёртка с процедурным импульсом) → лимитер → mute-gain.
  - **Двигатель:** коричневый шум, низкочастотный фильтр и сатурация, плюс гул 30–50 Гц. Громкость и высота растут с `thrust` и `stageF`. В вакууме (`stageF > 2.5`) верха срезаются, звук глуше.
  - **Райзер:** тон, высота которого растёт с `log(m)`.
  - **Эффекты:** сигналы отсчёта; рёв старта; хлопок пиропатронов, свист и колокольчик выигрыша; хлопок парашюта; взрыв (низкий удар, шумовой взрыв, затем low-pass на 1.5 с и звон-синус); шелест на смене этапа; вход в варп.
  - **Пауза.** При `visibilitychange` контекст приостанавливается и возобновляется, если не muted.
- [ ] **Step 6: Файлы.** Найти и скачать бесплатные ассеты:
  - фоновую кинематографичную музыку;
  - голос отсчёта `three`, `two`, `one`, `liftoff`;
  - при необходимости взрыв.
  Источники: OpenGameArt, Freesound, Kenney, Pixabay. Только лицензии, которые разрешают коммерческое использование без обязательной атрибуции. Каждый файл записать в `CREDITS.md` (URL, автор, лицензия). Форматы `.ogg` и `.mp3` через Howler, громкость музыки −18 дБ, во время взрыва музыка приглушается. Если голос не найден, отсчёт идёт сигналами.
- [ ] **Step 7: Проверка.** Сыграть раунд со звуком. Двигатель нарастает, Cash Out и взрыв звучат, M и кнопка выключают звук, после перезагрузки состояние mute сохранено.
- [ ] **Step 8: Commit** `feat: synthesized rocket audio, sfx and licensed music`.

## Часть 3. Космос

### Task 16: Земля, атмосфера планеты, Луна

**Files:**
- Create: `scripts/prepare-textures.mjs`, `src/scene/far/Earth.tsx`, `src/scene/far/Moon.tsx`, `CREDITS.md`, файлы в `public/textures/earth/8k/` и `public/textures/moon/`

**Interfaces:**
- Consumes: `rig.altM`, `rig.stageF`, `lightState.sunDir`, `FAR_EARTH_D`, `QUALITY.earthTextures`, `QUALITY.moonTexture`.
- Produces: `<Earth />`, `<Moon />` в `FarField`.

- [ ] **Step 1: Текстуры.** `prepare-textures.mjs`: однократное скачивание с NASA и подготовка через sharp.
  - Источники:
    - Blue Marble Next Generation (дневная, с рельефом и батиметрией);
    - Black Marble 2016 (огни городов);
    - Blue Marble clouds;
    - маска суши и воды для бликов (если нет готовой, выделить океан по цвету дневной текстуры);
    - Луна из NASA SVS CGI Moon Kit.
  - Выход:
    - `day.jpg` и `night.jpg` 8192×4096 q85;
    - `clouds.jpg` 4096×2048 (оттенки серого);
    - `specular.jpg` 2048×1024;
    - `moon-4k.jpg`.
  - Точные URL и лицензии (общественное достояние NASA) записать в `CREDITS.md`. Готовые файлы закоммитить, во время игры они не скачиваются.
- [ ] **Step 2: Earth.** Сфера в дальнем поле: центр на `(0, −FAR_EARTH_D, 0)` относительно камеры, радиус `FAR_EARTH_D · R/(R + altKm)`, где `R = 6371`. Так угловой размер Земли верный.
  - Шейдер:
    - смешение дня и ночи по `dot(N, sunDir)` с мягким терминатором;
    - огни городов только на ночной стороне;
    - облака отдельной сферой чуть больше, с тенью на поверхности (смещение по `sunDir`);
    - блик океана по маске;
    - лёгкое вращение.
  - Атмосфера: оболочка радиусом ×1.025, BackSide, аддитивная, fresnel с цветом рассеяния: голубой на дневной стороне, оранжево-красный у терминатора.
  - Земля проявляется с `stageF` 1.8 к 2.3, на `stageF ≥ 4` заметно удаляется.
  - Положение: камера над Европой на рассвете, терминатор в кадре.
- [ ] **Step 3: Moon.** Сфера с текстурой и освещением от `sunDir`, видна с `stageF ≥ 2.8`, с этапа 4 крупнее.
- [ ] **Step 4: Проверка.** Кадры `freeze=2.5`, `freeze=5`, `freeze=12`. Критерии:
  - на 2.5 видны кривизна и тонкая голубая линия атмосферы;
  - на 5 Земля с облаками, бликом океана и огнями за терминатором;
  - на 12 Земля заметно меньше, видна Луна;
  - в кадре нет швов текстур.
- [ ] **Step 5: Commit** `feat: NASA-textured Earth with atmosphere rim and the Moon`.

### Task 17: Дальний космос и варп

**Files:**
- Create: `src/scene/far/Nebula.tsx`, `src/scene/far/Warp.tsx`
- Modify: `src/scene/far/Stars.tsx` (параллакс-слои)

**Interfaces:**
- Consumes: `rig.stageF`, `rig.speed`, `rig.vtime`, `fx`, `ZoomBlurEffect` (задача 6).
- Produces: на этапах 4–5 `Warp.tsx` пишет `fx.zoomBlur = 0.15·speed`, в варпе до 0.6.

- [ ] **Step 1: Nebula.** 2–3 процедурные объёмные туманности (fbm-шейдер на больших сферах или кубе дальнего поля), холодные цвета с одним тёплым акцентом. Появляются с `stageF` 3.6 к 4.2.
- [ ] **Step 2: Звёзды с параллаксом.** Слой ближних звёзд-частиц летит мимо камеры, скорость растёт со `speed`.
- [ ] **Step 3: Warp** с `stageF ≥ 5`:
  - звёзды вытягиваются в линии вдоль направления полёта;
  - цилиндрический тоннель из шума с хроматическим смещением цвета;
  - FOV растёт до +25° (это делает режиссёр камеры из задачи 12, здесь только визуальный слой);
  - нарастает `fx.chroma`.
- [ ] **Step 4: Проверка.** `freeze=15`: туманности и плотные звёзды. `freeze=60`: варп-тоннель, линии звёзд, zoom blur.
- [ ] **Step 5: Commit** `feat: deep space nebulae, parallax stars and warp tunnel`.

## Часть 4. Шоу и доставка

### Task 18: Attract-режим и режим ведущего

**Files:**
- Create: `src/core/attract.ts`, `src/platform/idle.ts`, `src/ui/AttractOverlay.tsx`, `src/ui/PresenterPanel.tsx`, `src/ui/PresenterDot.tsx`, `src/ui/useLongPress.ts`
- Modify: `src/App.tsx`, `src/ui/Hud.tsx`
- Test: `src/core/attract.test.ts`, `src/platform/idle.test.ts`

**Interfaces:**
- Consumes: `RoundEngine.setAttract`, `launchScripted`, `abortToBetting`, `arm`, `IDLE_TO_ATTRACT_S`, `KeyHandlers.anyInput`.
- Produces:
  - `ATTRACT_SCRIPT: { crash: number; autoAt: number | null }[]` = `[{ crash: 64, autoAt: 12 }, { crash: 3.4, autoAt: null }, { crash: 140, autoAt: 35 }, { crash: 9, autoAt: 4 }, { crash: 1.6, autoAt: 1.3 }]`;
  - `attractRound(i: number)`: циклический доступ к сценарию;
  - `createIdleTimer(ms: number, onIdle: () => void, now?: () => number): { poke(): void; tick(): void; dispose(): void }`;
  - `useLongPress(ms: number, onLong: () => void)`: возвращает обработчики pointer-событий.

- [ ] **Step 1: Падающие тесты.**

```ts
test('idle fires once after 45 s without input and re-arms after a poke', () => {
  let now = 0, fired = 0
  const t = createIdleTimer(45_000, () => fired++, () => now)
  now = 44_999; t.tick(); expect(fired).toBe(0)
  now = 45_000; t.tick(); t.tick(); expect(fired).toBe(1)
  t.poke(); now = 89_999; t.tick(); expect(fired).toBe(1)
  now = 90_000; t.tick(); expect(fired).toBe(2)
})
test('attract script cycles and includes a crash and a warp', () => {
  expect(attractRound(5)).toEqual(attractRound(0))
  expect(ATTRACT_SCRIPT.some((r) => r.autoAt === null)).toBe(true)
  expect(ATTRACT_SCRIPT.some((r) => r.crash >= 30)).toBe(true)
})
```

- [ ] **Step 2:** FAIL. **Step 3:** реализовать. **Step 4:** PASS.
- [ ] **Step 5: Подключение.**
  - **Вход в attract.** По таймеру простоя (только в `betting`, иначе таймер ждёт конца раунда): `setAttract(true)`, затем раунды из сценария друг за другом с паузой 2 с.
  - **Выход из attract.** Любой ввод (клавиша, `pointerdown` где угодно) вызывает `abortToBetting()` и `setAttract(false)`. Баланс сбрасывается до 10 000, ставка до 100, автокэшаут выключается. Переход через затемнение 0.3 с. Этот первый ввод не запускает раунд.
  - **AttractOverlay:** `PRESS SPACE TO LAUNCH`, а при `(pointer: coarse)` `TAP TO LAUNCH`. Мягко пульсирует, внизу по центру, над скрытой кнопкой.
  - **Ведущий:**
    - долгое нажатие на логотип (2 с) открывает `PresenterPanel` с кнопками `NEXT ROUND: WARP` и `NEXT ROUND: BOOM`; после выбора панель закрывается;
    - на клавиатуре те же действия по кодам `WARP` и `BOOM` из задачи 4.
  - **PresenterDot:** точка 4px у логотипа, видна, пока `snap.armed !== null`.
  - Attract-раунды и ведущий не мешают друг другу: `arm` действует на первый раунд игрока после выхода из attract.
- [ ] **Step 6: Проверка.** Подождать 45 с. Attract показывает высокий раунд с капсулой и раунд со взрывом, нажатие возвращает игру со свежим балансом. `WARP` и долгое нажатие работают.
- [ ] **Step 7: Commit** `feat: attract mode, presenter panel and code shortcuts`.

### Task 19: Редкие события

**Files:**
- Create: `src/core/rare.ts`, `src/scene/rare/RareEvents.tsx`, `src/scene/rare/Meteors.tsx`, `src/scene/rare/Aurora.tsx`, `src/scene/rare/Station.tsx`
- Modify: `src/core/round.ts` (заполнить `rare` при запуске), `src/scene/far/Sun.tsx` (сценарий восхода), `src/platform/params.ts` (debug-параметр `rare`)
- Test: `src/core/rare.test.ts`, дополнения в `src/core/round.test.ts` и `src/platform/params.test.ts`

**Interfaces:**
- Consumes: `RarePlan`, `RareKind`, `stageFloat`, `Rng`, `setSunElevation`.
- Produces:
  - `RARE_WINDOWS: Record<RareKind, [number, number]>`: окна по `stageFloat`. `sunrise` [2.2, 3.5], `aurora` [3.1, 3.9], `station` [3.2, 3.9], `meteors` [3.3, 4.8].
  - `RARE_CHANCE = 0.25`.
  - `pickRare(rng: Rng, crashPoint: number): RarePlan | null`.

- [ ] **Step 1: Падающие тесты.**

```ts
test('never schedules an event the rocket will not reach', () => {
  const rng = createRng(3)
  for (let i = 0; i < 10_000; i++) {
    const crash = sampleCrashPoint(rng())
    const plan = pickRare(rng, crash)
    if (plan) expect(plan.atStage).toBeLessThan(stageFloat(crash))
  }
})
test('fires in about a quarter of rounds that reach stage 3.5', () => {
  const rng = createRng(4)
  let hits = 0
  for (let i = 0; i < 20_000; i++) if (pickRare(rng, 100)) hits++
  expect(Math.abs(hits / 20_000 - 0.25)).toBeLessThan(0.02)
})
test('atStage lies inside the kind window', () => { /* for each plan: RARE_WINDOWS[kind][0] <= atStage <= [1] */ })
test('rounds below stage 2.2 never get an event', () => { /* crash 1.7 → always null */ })
// round.test.ts
test('launch fills snapshot.rare from pickRare and attract rounds also may get one', () => { /* … */ })
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реализовать `pickRare`.**
  - Подходят виды, у которых нижняя граница окна меньше `stageFloat(crashPoint) − 0.1`.
  - С вероятностью `RARE_CHANCE` выбирается случайный подходящий вид.
  - `atStage` берётся случайно внутри окна, но не дальше `stageFloat(crashPoint) − 0.1`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Сцена.** `RareEvents` запускает компонент, когда `rig.stageF ≥ rare.atStage`, и держит его 4–6 с.
  - **Meteors:** `QUALITY.meteorCount` огненных росчерков, входящих в атмосферу Земли ниже ракеты.
  - **Aurora:** зелёно-фиолетовые колышущиеся ленты над полярной областью Земли, шейдер на изогнутых плоскостях.
  - **Station:** оригинальная орбитальная станция: модули, солнечные панели, мигающие огни. Пролетает мимо камеры на 300–600 м, с бликами панелей.
  - **Sunrise:** солнце выходит из-за края Земли, вспышка атмосферы, блик и lens flare.
- [ ] **Step 6: Проверка.** Временный debug-параметр `rare=<kind>` (только с `debug=1`) принудительно планирует событие. Добавить его в `parseParams` с тестом. Снять кадр каждого события.
- [ ] **Step 7: Commit** `feat: rare events — meteors, aurora, station flyby, sunrise`.

---

### Task 20: Загрузка, embed, PWA, README

**Files:**
- Create: `src/ui/Splash.tsx`, `src/ui/ExitButton.tsx`, `src/platform/embed.ts`, `public/icon.svg`, `pwa-assets.config.ts`
- Modify: `vite.config.ts` (PWA), `src/App.tsx`, `README.md`, `CREDITS.md`
- Test: `src/platform/embed.test.ts`

**Interfaces:**
- Consumes: `params.embed`, `loadCloudNoise`, загрузчики текстур (drei `useProgress`), `KeyHandlers.exit`.
- Produces: `exitToLobby(target: Pick<Window, 'postMessage'> = window.parent, p: Pick<Params, 'embed'> = params): void`. Отправляет `{ type: 'clickable:exit' }` с `'*'`, но только при `p.embed`.

- [ ] **Step 1: Падающий тест.**

```ts
test('posts clickable:exit to the parent only when embedded', () => {
  const sent: unknown[] = []
  const parent = { postMessage: (m: unknown, o: string) => sent.push([m, o]) }
  exitToLobby(parent, { embed: false }); expect(sent).toEqual([])
  exitToLobby(parent, { embed: true }); expect(sent).toEqual([[{ type: 'clickable:exit' }, '*']])
})
```

- [ ] **Step 2:** FAIL. **Step 3:** реализовать. **Step 4:** PASS.
- [ ] **Step 5: Загрузка.**
  - `Splash`: чёрный экран, красный логотип по центру, тонкая красная полоса прогресса. Прогресс складывается из текстур, шума облаков, `document.fonts.ready` и PMREM.
  - До конца загрузки игра не стартует.
  - После загрузки Splash растворяется, сразу включается attract-режим (без звука до первого жеста).
  - С `?embed=1` Splash не показывается, вместо него чёрный экран до готовности.
- [ ] **Step 6: Embed.**
  - С `?embed=1` в правом верхнем углу появляется маленькая кнопка `EXIT` (`ExitButton`), она вызывает `exitToLobby()`.
  - Esc делает то же.
  - Без embed кнопки нет, Esc ничего не делает.
- [ ] **Step 7: PWA.**
  - `vite-plugin-pwa`: `registerType: 'autoUpdate'`, `workbox.globPatterns` включает `**/*.{js,css,html,woff,woff2,svg,png,jpg,ogg,mp3}`, `maximumFileSizeToCacheInBytes: 64 * 1024 * 1024`.
  - Manifest: имя `Clickable Rocket`, `display: 'fullscreen'`, `orientation: 'any'`, фон `#000000`.
  - Иконка: `public/icon.svg`, силуэт ракеты цвета `#FF1923` на чёрном. Сгенерировать иконки через `npm run icons`.
  - Service worker регистрируется только в production-сборке и не в `?embed=1`.
- [ ] **Step 8: README.**
  - Запуск на ноутбуке: `npm run build && npm run preview`.
  - Открытие с телефона по IP ноутбука в локальной сети.
  - Работа без сети после первого открытия.
  - Коды ведущего `WARP` и `BOOM`, долгое нажатие на логотип.
  - Debug-параметры.
  - Раздел «Производительность» с замерами из задачи 11.
  - Ссылка на `CREDITS.md`.
- [ ] **Step 9:** `npm run build` проходит, `npm run preview`, игра открывается на `http://<ip>:4173/` с телефона (проверяет человек, см. задачу 21).
- [ ] **Step 10: Commit** `feat: splash preload, lobby embed exit, PWA, README`.

### Task 21: E2E-тесты и финальная проверка

**Files:**
- Create: `playwright.config.ts`, `e2e/round.spec.ts`, `e2e/layout.spec.ts`, `e2e/embed.spec.ts`, `e2e/offline.spec.ts`

**Interfaces:**
- Consumes: `window.__crash`, `window.__crashReady`, `?debug=1&seed=`.

- [ ] **Step 1: Конфиг Playwright.**
  - `webServer`: `npm run build && npm run preview -- --port 4173`.
  - Проект `chromium` с `--use-angle=swiftshader --enable-unsafe-swiftshader`.
  - Проект `mobile` (iPhone 13 viewport, `hasTouch`) на Chromium.
  - Таймаут теста 120 с.
- [ ] **Step 2: Тесты.**

```ts
// round.spec.ts
test('keyboard round: launch, cash out, payout credited', async ({ page }) => {
  await page.goto('/?debug=1&seed=1'); await page.waitForFunction(() => window.__crashReady)
  await page.keyboard.press('Space') // leaves attract if active
  await page.evaluate(() => window.__crash.setNextCrash(50))
  await page.keyboard.press('Space')
  await page.waitForFunction(() => window.__crash.snap().multiplier >= 1.5)
  await page.keyboard.press('Space')
  const s = await page.evaluate(() => window.__crash.snap())
  expect(s.phase).toBe('ejected'); expect(s.balance).toBe(10_000 - 100 + s.payout)
})
test('crash shows CRASHED and records red history', async ({ page }) => { /* setNextCrash(1.3), wait phase result, expect text 'CRASHED @' and a lost chip */ })
test('touch spam never double-launches or goes negative', async ({ page }) => {
  /* mobile project: 30 rapid taps on the main button across launch and cash out;
     assert balance >= 0, history length grows by at most 1 per round, visualViewport.scale === 1 */
})

// layout.spec.ts
test('portrait and landscape keep the main button visible and inside the viewport', async ({ page }) => { /* both sizes, boundingBox within viewport */ })
test('rotating mid-flight keeps the round going and the layout valid', async ({ page }) => { /* setViewportSize 390×844 → 844×390 during flight; phase still flight; button visible */ })

// embed.spec.ts
test('embed hides splash, shows EXIT and posts clickable:exit', async ({ page }) => {
  /* host page with iframe src="/?embed=1"; listen to message; click EXIT; expect { type: 'clickable:exit' } */
})

// offline.spec.ts
test('no external network requests and no console errors', async ({ page }) => {
  /* collect requests whose host !== localhost and console errors over a full round; expect both empty */
})
```

- [ ] **Step 3:** `npm run e2e`. Ожидается PASS. Если что-то падает, исправить причину, а не тест.
- [ ] **Step 4: Визуальный прогон.** Снять кадры для обоих размеров (`npm run shot` и `--portrait`) на `freeze` = 1.0, 1.1, 1.45, 2.5, 5, 15, 60, а также моменты отстрела и взрыва. Посмотреть каждый кадр:
  - нет «дешёвой» графики из анти-целей спеки;
  - HUD совпадает с наброском A;
  - текст читается в обеих раскладках.
- [ ] **Step 5: Производительность.** В Chrome на этом ноутбуке открыть `?debug=1`, сыграть раунд до варпа. Записать в README минимальный FPS по этапам. Если ниже 60, сначала оптимизировать без потери вида: шаги облаков, частицы, DPR. Значения меняются только в `quality.ts`.
- [ ] **Step 6: Передать человеку чек-лист проверки на телефоне** (в README, раздел «Проверка на телефоне»):
  - открыть по IP;
  - сыграть 5 раундов;
  - проверить FPS через `?debug=1`;
  - проверить, нет ли потери WebGL-контекста.
  Если тормозит или теряется контекст, это сигнал для шага `medium` из спеки.
- [ ] **Step 7: Commit** `test: e2e coverage for rounds, layouts, embed and offline`.
