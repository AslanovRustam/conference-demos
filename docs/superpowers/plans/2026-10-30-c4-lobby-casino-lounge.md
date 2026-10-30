# C4 лобби: редизайн «Казино-лаунж» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** заменить неоновый стиль 80-х в лобби на премиальный «Казино-лаунж»: студийные отражения, кольцо рулетки, автоматы из красной керамики и белого хрома, стеклянная сфера со знаком Clickable и фишками на орбите, интерфейс в стиле лендингов Clickable.

**Architecture:** меняется только визуальный слой `demos/lobi-3d/src/scene/*` и `src/ui/Hud.tsx`. Стор, мост с играми, сборка и вся механика остаются без изменений. Новые чистые функции (цвет сектора, позиция на орбите, тег HUD) покрываются юнит-тестами, сцена проверяется e2e-дымом и скриншотами.

**Tech Stack:** как в основном плане (three 0.186, R3F 9, drei 10, postprocessing 3, Motion 14). `RoomEnvironment` и `RoundedBoxGeometry` из `three/examples/jsm`.

**Spec:** `docs/superpowers/specs/2026-10-30-c4-lobby-design.md`, раздел 19 (заменяет визуальную часть §5–§6). Основной план: `docs/superpowers/plans/2026-10-30-c4-lobby.md`.

## Global Constraints

- Все ограничения основного плана в силе (папка, версии, бренд через `@brand`, английский UI, офлайн, 60 FPS, `frameloop="never"` в игре, контракт сообщений, клавиши).
- Git: коммитить только `git commit -m "…" -- <пути>` (в индексе лежат staged-изменения других сессий; обычный `git commit` их заберёт).
- Окружение только процедурное (`RoomEnvironment` через `PMREMGenerator`). drei `<Environment preset>` запрещён: он грузит HDR из сети.
- Палитра: фон `#0b0909`–`#0d0a0c`, керамика `#e0101a`, белый хром `#f4f5f8`, хром `#f2f3f5` metalness 1 roughness 0.14, зелёное зеро `#0b8f62`, бренд-красный акцентов `#ff1923`.
- Знак Clickable: `clickable-landings/assets/logo-mark.svg` копируется в `demos/lobi-3d/src/brand-extra/logo-mark.svg` (источник в README); `shared/brand/` не трогаем.
- data-testid существующего HUD сохраняются (`hud`, `hud-title`, `hud-subtitle`, `mute`, `prev`, `next`); новые: `play`, `hud-tag`.

## Review Focus

1. **Производительность стекла и отражений на Intel UHD.** Ожидание: медиана 60 FPS при 1920×1080 с превью; иначе — упрощённое стекло. Проверка: замер в задаче 6.
2. **Пролёт в экран после смены геометрии автомата.** Экран должен по-прежнему закрывать кадр, прожектор и корона не попадают в кадр. Проверка: e2e flow и скриншот «camera arrived» в задаче 3.
3. **PLAY на COMING SOON.** Кнопка неактивна, фаза не меняется. Проверка: e2e в задаче 5.
4. **Фокус на кнопке PLAY + Enter.** Клик по PLAY, затем Enter не должен открыть два фрейма или сломать фазу. Проверка: e2e в задаче 5.
5. **Офлайн.** Новые материалы не делают сетевых запросов. Проверка: `npm run check:games` после сборки в задаче 6.

---

### Task 1: Студийный зал: окружение, туман, тёмный пол, без неона

**Files:**
- Create: `demos/lobi-3d/src/scene/StudioEnvironment.tsx`
- Modify: `src/scene/Hall.tsx` (убрать сетку-шейдер и неоновые кольца; тёмный глянцевый пол, свет), `src/scene/LobbyCanvas.tsx` (туман `fogExp2`, фон, убрать `HoloLogo`), `src/scene/Effects.tsx` (порог bloom 0.9)
- Delete: `src/scene/HoloLogo.tsx`
- Test: `e2e/smoke.spec.ts` (уже есть)

**Interfaces:**
- Produces: `<StudioEnvironment intensity?: number />` — ставит `scene.environment` из `new RoomEnvironment()` через `PMREMGenerator.fromScene(..., 0.04)`, освобождает текстуру при размонтировании.

- [ ] **Step 1:** Реализовать `StudioEnvironment`; в `LobbyCanvas` фон `#0b0909`, `<fogExp2 attach="fog" args={['#0b0909', 0.045]} />`. Пол: круг радиусом 30, `MeshPhysicalMaterial({ color: '#070607', roughness: .3, metalness: .5, clearcoat: .8, envMapIntensity: .12 })`. Свет: ключевой тёплый `SpotLight` сверху-спереди (`#fff1e0`), слабый ambient. Тонмаппинг выбрать по скриншоту (NEUTRAL или ACES): керамика должна остаться красной, а не оранжевой.
- [ ] **Step 2:** Запустить `npx playwright test smoke`. Ожидание: PASS (нет ошибок в консоли). Открыть `test-results/hall.png`: чёрный зал без сетки, видны отражения на полу.
- [ ] **Step 3:** Commit `feat(lobby): studio environment for the casino lounge`.

---

### Task 2: Платформа-рулетка

**Files:**
- Create: `demos/lobi-3d/src/scene/roulette.ts`, `src/scene/RouletteRing.tsx`
- Test: `src/scene/roulette.test.ts`
- Modify: `src/scene/Hall.tsx` (платформа = кольцо + центральный глянцевый диск с `MeshReflectorMaterial`)

**Interfaces:**
- Produces: `segmentColor(i: number): 'green' | 'red' | 'black'`; `ROULETTE_SEGMENTS = 37`; `<RouletteRing inner: number outer: number />`.

- [ ] **Step 1: Падающий тест**

```ts
test('one green zero, then red and black alternate', () => {
  expect(segmentColor(0)).toBe('green')
  expect(segmentColor(1)).toBe('red')
  expect(segmentColor(2)).toBe('black')
  expect(segmentColor(36)).toBe('black')
  const colors = Array.from({ length: ROULETTE_SEGMENTS }, (_, i) => segmentColor(i))
  expect(colors.filter((c) => c === 'red')).toHaveLength(18)
  expect(colors.filter((c) => c === 'black')).toHaveLength(18)
})
```

- [ ] **Step 2:** `npx vitest run src/scene/roulette` → FAIL.
- [ ] **Step 3:** Реализовать. `RouletteRing`: 37 секторов `RingGeometry(inner, outer, 4, 1, θ, Δθ·0.96)` с `MeshPhysicalMaterial` (`#e0101a` / `#15161c` / `#0b8f62`, roughness .4, clearcoat .6), хромовые торы по внутреннему и внешнему краю, вращение `0.05 рад/с`. Кольцо: `inner = RADIUS + 0.55`, `outer = RADIUS + 1.25`. Центральный диск радиусом `RADIUS + 0.5` с прежним `MeshReflectorMaterial` (тёмный).
- [ ] **Step 4:** `npx vitest run src/scene/roulette && npx playwright test smoke` → PASS; скриншот: кольцо рулетки под автоматами.
- [ ] **Step 5:** Commit `feat(lobby): roulette ring platform`.

---

### Task 3: Автоматы из керамики и хрома

**Files:**
- Modify: `demos/lobi-3d/src/scene/Cabinet.tsx` (материалы, корона с лампой, хромовый цоколь и рамка; без неоновых полос), `src/scene/Carousel.tsx` (прожектор над передней позицией), `src/scene/screenMaterial.ts` (скан-линии 0.04 вместо 0.14, без красной рамки)
- Create: `src/scene/materials.ts`
- Test: `src/scene/materials.test.ts`

**Interfaces:**
- Produces: `materials.ts`: `chrome()`, `whiteChrome()`, `ceramicRed()`, `lacquerDark()` → `THREE.MeshPhysicalMaterial` (общие инстансы, создаются один раз); `lampColor(active: boolean, flash: number): THREE.Color` — активный тёпло-белый `#fff1e0`×2, неактивный `#ff1923`×0.6, при `flash > 0` смешивается к `#ff1923`×3.

- [ ] **Step 1: Падающий тест**

```ts
test('lamp: warm white when active, dim red otherwise, bright red while flashing', () => {
  const on = lampColor(true, 0), off = lampColor(false, 0), flash = lampColor(false, 1)
  expect(on.r).toBeGreaterThan(1.5); expect(on.g).toBeGreaterThan(1.2)
  expect(off.r).toBeLessThan(1); expect(off.g).toBeLessThan(0.1)
  expect(flash.r).toBeGreaterThan(2)
})
```

- [ ] **Step 2:** `npx vitest run src/scene/materials` → FAIL.
- [ ] **Step 3:** Реализовать материалы и автомат: корпус `RoundedBox` (`CABINET`, радиус 0.14) из `ceramicRed()`, корона `RoundedBox(w+0.06, 0.24, d+0.05)` из `whiteChrome()` с лампой (тонкий бокс `w-0.3 × 0.03` на переднем крае, `MeshBasicMaterial` с `lampColor`, `toneMapped:false`), цоколь `chrome()` высотой 0.14, рамка экрана `chrome()`. Подсветка активного — прожектор (`SpotLight` `#fff1e0`, угол 0.35) над `(0, 6, RADIUS + 1.5)`, нацелен на `(0, 1.2, RADIUS)`, в `Carousel` (не в каждом автомате). Отказ: дрожь как раньше + `flash` в лампу.
- [ ] **Step 4:** `npx vitest run && npx playwright test smoke flow` → PASS. Скриншот «camera arrived» (как в основном плане, задача 10): экран закрывает кадр.
- [ ] **Step 5:** Commit `feat(lobby): ceramic and chrome cabinets`.

---

### Task 4: Стеклянная сфера со знаком, фишки на орбите, искры

**Files:**
- Create: `demos/lobi-3d/src/brand-extra/logo-mark.svg` (копия из лендингов), `src/scene/GlassCore.tsx`, `src/scene/ChipOrbit.tsx`, `src/scene/orbit.ts`, `src/scene/Sparks.tsx`
- Test: `src/scene/orbit.test.ts`
- Modify: `src/scene/LobbyCanvas.tsx`, `src/scene/layout.ts` (`CORE = { y: 3.0, radius: 0.9 }`)

**Interfaces:**
- Produces: `orbitPosition(i: number, n: number, t: number, radius: number, tilt: number): [number, number, number]` — равномерно по кругу, угол `2πi/n + t·0.35`, наклон плоскости `tilt` вокруг оси X.

- [ ] **Step 1: Падающий тест**

```ts
test('orbit spreads items evenly on a tilted circle', () => {
  const p0 = orbitPosition(0, 4, 0, 2, 0)
  expect(p0[0]).toBeCloseTo(2); expect(p0[1]).toBeCloseTo(0); expect(p0[2]).toBeCloseTo(0)
  const p1 = orbitPosition(1, 4, 0, 2, 0)
  expect(p1[0]).toBeCloseTo(0); expect(p1[2]).toBeCloseTo(2)
  const tilted = orbitPosition(1, 4, 0, 2, Math.PI / 6)
  expect(Math.hypot(...tilted)).toBeCloseTo(2); expect(tilted[1]).not.toBeCloseTo(0)
})
```

- [ ] **Step 2:** `npx vitest run src/scene/orbit` → FAIL.
- [ ] **Step 3:** Реализовать. `GlassCore`: сфера `CORE.radius` с `MeshPhysicalMaterial({ transmission: 1, thickness: 1.2, ior: 1.5, roughness: .02, clearcoat: 1 })`, внутри знак из `logo-mark.svg?raw` (`SVGLoader` → `ExtrudeGeometry`, ширина 0.9, `MeshBasicMaterial` `#ff1923`×3, `toneMapped:false`, плавное покачивание и пульс 0.93–1.07), `PointLight` `#ff1923` (сила ~20, дистанция 8). `ChipOrbit`: 10 предметов на `orbitPosition(i, 10, t, 1.7, 0.35)` вокруг `CORE.y`; 7 фишек (`CylinderGeometry(0.2, 0.2, 0.05)`, материалы керамика / белый хром / тёмный лак, торцы с canvas-текстурой «точек» по краю) и 3 кубика (`RoundedBoxGeometry(0.26)`, белые, точки canvas-текстурой на гранях); каждый медленно вращается. `Sparks`: ~200 красных аддитивных точек, медленно дрейфуют вверх, size 0.045.
- [ ] **Step 4:** `npx vitest run && npx playwright test smoke` → PASS; скриншот: сфера с красным знаком, фишки.
- [ ] **Step 5:** Commit `feat(lobby): glass core with the Clickable mark and orbiting chips`.

---

### Task 5: Интерфейс в стиле лендингов

**Files:**
- Modify: `demos/lobi-3d/src/ui/Hud.tsx`, `src/styles/app.css`
- Create: `src/ui/hudTag.ts`
- Test: `src/ui/hudTag.test.ts`, `e2e/hud.spec.ts`

**Interfaces:**
- Consumes: стор (`slots`, `activeIndex`, `enter`), `applyAction`, `brandLogo.white`
- Produces: `hudTag(slots: Slot[], index: number): string` — для игры `GAME 02 / 03` (номер среди игровых слотов / их число), для COMING SOON `COMING SOON`.

- [ ] **Step 1: Падающие тесты**

```ts
// slots: [game a, soon, game b, soon]
test('hudTag numbers games among game slots only', () => {
  expect(hudTag(slots, 0)).toBe('GAME 01 / 02')
  expect(hudTag(slots, 2)).toBe('GAME 02 / 02')
  expect(hudTag(slots, 1)).toBe('COMING SOON')
})
```

e2e `hud.spec.ts`: (а) `play` активна на игре и открывает её (`phase === 'entering'`); (б) на COMING SOON `play` `disabled`, клик не меняет фазу; (в) клик по `play`, затем сразу `Enter` → `game-frame` count 1; (г) `hud-tag` и логотип видны.
- [ ] **Step 2:** `npx vitest run src/ui && npx playwright test hud` → FAIL.
- [ ] **Step 3:** Реализовать: логотип `brandLogo.white` слева сверху; подпись внизу слева или по центру (решить по скриншоту) — тег с красной точкой (`hud-tag`), заголовок `brandFonts.display`, подпись; красная кнопка-таблетка `PLAY` (`border-radius: 999px`, `brandFonts.display`, uppercase, тень `rgba(255,25,35,.55)`, блик при hover как `.btn::after` на лендингах), `disabled` для COMING SOON; стрелки и звук — круглые 3.4rem с обводкой `rgba(255,255,255,.18)`. Подсказка клавиш остаётся.
- [ ] **Step 4:** `npx vitest run && npx playwright test hud navigation` → PASS; скриншот `test-results/hud.png` при 1920×1080.
- [ ] **Step 5:** Commit `feat(lobby): landing-style hud with play pill`.

---

### Task 6: Кадр, производительность, финальная проверка

**Files:**
- Modify: `demos/lobi-3d/src/scene/layout.ts` (поза камеры под новый центр), `README.md` (знак из `brand-extra`, рекомендация добавить его в `shared/brand`), при необходимости `GlassCore.tsx` (упрощённое стекло)

- [ ] **Step 1:** Подобрать `CAMERA_HOME` по скриншоту: сфера с фишками над передним автоматом, кольцо рулетки целиком, подпись HUD не наезжает на автомат.
- [ ] **Step 2:** Замер: `npm run build`, продакшен-сборка в Chrome с GPU (`--use-angle=d3d11`), `?fps=1&attractIdle=1`, 30 с. Ожидание: медиана 60 при 1920×1080. Если ниже 58 — заменить transmission на стекло без преломления (`transmission: 0`, `opacity .35`, `transparent`, `envMapIntensity 2`, френель через `clearcoat`) и замерить снова.
- [ ] **Step 3:** `npm run build:all` → сборка и `check:games` без предупреждений; `npm test && npm run e2e` → всё PASS.
- [ ] **Step 4:** Commit `feat(lobby): casino lounge framing and performance`.
