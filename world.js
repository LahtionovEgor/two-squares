// world.js — карта мира и зоны «Двух квадратов».
//
// Подключается из index.html как world.js?v=N.
// ВАЖНО: при каждом изменении этого файла увеличиваем N в index.html,
// иначе Telegram может показать старую версию из своего кэша.
//
// Пока это каркас (этап 3): мир пустой, только бумага и клетки.
// Расположение зон на карте появится на этапах 4–5.

'use strict';

const World = {
  SIZE: 160, // мир 160 × 160 клеток (spec.md, раздел 4)
  CELL: 40,  // одна клетка на экране телефона — 40 точек

  // Зоны из spec.md (раздел 4). Пока только список, на карте их ещё нет.
  // open: true — открыта сразу; остальные открываются позже.
  zones: [
    { id: 0, name: 'Белое',              mechanic: 'сбор точек',     open: true },
    { id: 1, name: 'Чёрное тревожное',   mechanic: 'Pac-Man',        open: true },
    { id: 2, name: 'Круги',              mechanic: 'agar.io',        open: true },
    { id: 3, name: 'Стройка',            mechanic: 'Block Blast',    open: true },
    { id: 4, name: 'Скорость',           mechanic: 'Subway Surfers', open: false }, // после 2 построек
    { id: 5, name: 'Проун',              mechanic: 'Angry Birds',    open: false }, // после 2 построек
    { id: 6, name: 'Ритм',               mechanic: 'Geometry Dash',  open: false }, // после 2 построек
    { id: 7, name: 'Победа над Солнцем', mechanic: 'финал',          open: false }, // после 6 построек
  ],

  // Рисует пол мира вокруг камеры: маленькие крестики в углах клеток,
  // как засечки на линейке в ролике. Бумага под ними — это фон страницы.
  //   ctx    — холст
  //   cam    — камера: точка мира (в точках), которая сейчас в центре экрана
  //   w, h   — размер экрана в точках
  draw(ctx, cam, w, h) {
    const c = this.CELL;
    // Какие клетки видны на экране (с запасом в одну клетку)
    const left = cam.x - w / 2;
    const top = cam.y - h / 2;
    const x0 = Math.floor(left / c) * c;
    const y0 = Math.floor(top / c) * c;

    ctx.fillStyle = '#C9C0AF'; // бумага чуть темнее — тихие засечки
    for (let x = x0; x <= left + w + c; x += c) {
      for (let y = y0; y <= top + h + c; y += c) {
        const sx = Math.round(x - left); // положение на экране
        const sy = Math.round(y - top);
        ctx.fillRect(sx - 4, sy - 1, 8, 2); // горизонтальная черта крестика
        ctx.fillRect(sx - 1, sy - 4, 2, 8); // вертикальная черта
      }
    }
  },
};
