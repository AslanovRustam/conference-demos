# Clickable · конференционные демо

Игры и 3D-лобби для стенда Clickable. Каждое демо — отдельный Vite-проект в `demos/`:

| Папка | Что это |
|---|---|
| `demos/lobi-3d/` | 3D-лобби «Казино-лаунж»: карусель автоматов, из которой открываются игры |
| `demos/crash-3d/` | Crash «Ракета» |
| `demos/plinko-3d/` | Plinko 3D |
| `demos/slot-3d/` | слот Clickable Vault |
| `shared/brand/` | общий бренд: логотип, цвета, шрифты |
| `docs/` | концепции, дизайн-документы и планы |

Живая версия (лобби со всеми играми): **https://clickable-lobby.vercel.app**

## Как обновить живую страницу

Лобби и все игры публикуются одним сайтом на Vercel (проект `clickable-lobby`). Vercel **не** связан с GitHub: push в репозиторий страницу не обновляет. Сайт собирается на своём компьютере, и на Vercel заливается готовая папка.

Нужно один раз: Node.js 24+, зависимости во всех демо (`npm install` в каждой папке `demos/*`) и вход в Vercel CLI (`npx vercel login`, аккаунт с проектом `clickable-lobby`).

Все команды выполняются из `demos/lobi-3d`:

```bash
cd demos/lobi-3d

# 1. Собрать все игры из их папок (в .games-build/)
npm run build:games

# 2. Если игры менялись — перезаписать видеопревью для автоматов (нужен GPU, ~2 мин)
npm run record:previews

# 3. Собрать лобби вместе с играми в dist/ и проверить сайт
npm run build
npm run check:games

# 4. Посмотреть локально перед публикацией: http://localhost:4173
npm run serve

# 5. Опубликовать на https://clickable-lobby.vercel.app
npx vercel deploy dist --prod --yes --project clickable-lobby
```

Шаги 1 и 3 вместе (плюс проверка) делает `npm run build:all`.

Если менялось только лобби, а не игры, шаги 1–2 можно пропустить: `npm run build` берёт игры из последней сборки.

## Настройки лобби

Список игр и число автоматов — в `demos/lobi-3d/games.config.json`. Подробности (поля конфига, контракт для игр, клавиши ведущего, офлайн-запуск на стенде) — в [`demos/lobi-3d/README.md`](demos/lobi-3d/README.md).
