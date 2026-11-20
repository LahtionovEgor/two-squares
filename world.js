// world.js — карта мира и зоны «Двух квадратов».
//
// Подключается из index.html как world.js?v=N.
// ВАЖНО: при каждом изменении этого файла увеличиваем N в index.html,
// иначе Telegram может показать старую версию из своего кэша.
//
// Этап 4: в центре «Белое» стоят препятствия (плиты и палки) и лежат
// 150 синих энергетических кружочков. Остальные зоны появятся на этапах 5–9.

'use strict';

const World = {
  SIZE: 160, // мир 160 × 160 клеток (spec.md, раздел 4)
  CELL: 40,  // одна клетка на экране телефона — 40 точек

  // Зоны из spec.md (раздел 4). open: true — открыта сразу.
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

  // Где герой появляется (в клетках): середина мира
  START: { x: 80.5, y: 80.5 },

  // ---------- Препятствия центра (в клетках: x, y, ширина, высота) ----------
  // «Белый супрематизм»: светлые плиты в тонкой чёрной рамке и чёрные палки.
  // Сквозь них квадрат не проходит. Все стоят ровно (без наклона) —
  // так столкновения простые и быстрые.
  WALLS: [
    [66, 63, 6, 6, 'white'],  // большая плита слева сверху
    [86, 77, 8, 3, 'white'],  // длинная плита справа
    [80, 93, 5, 5, 'white'],  // плита снизу
    [70, 79, 3, 3, 'white'],  // маленькая плита слева от старта
    [64, 90, 10, 1, 'black'], // палка лежит
    [92, 88, 1, 9, 'black'],  // палка стоит
    [76, 66, 1, 5, 'black'],  // короткая палка сверху
  ],

  // Украшения: сквозь них можно ехать, они просто нарисованы
  DECOR: [
    { kind: 'circle', x: 92, y: 63, r: 3, color: '#F3BE0F' },              // жёлтый круг
    { kind: 'line', x1: 58, y1: 102, x2: 74, y2: 94, w: 3, color: '#D2241B' }, // красная линия
  ],

  // ---------- Ряды точек (в клетках: откуда, куда, сколько) ----------
  // Точки ложатся ровно по отрезку. Те, что попали в препятствие,
  // выкидываются; лишние обрезаются, чтобы вышло ровно DOTS_PER_ZONE.
  DOT_ROWS: [
    [60, 74, 100, 74, 21],  // ряд над стартом
    [60, 86, 100, 86, 21],  // ряд под стартом
    [62, 58, 62, 102, 23],  // столбец слева
    [98, 58, 98, 102, 23],  // столбец справа
    [66, 100, 90, 58, 18],  // диагональ снизу вверх
    [70, 60, 96, 98, 18],   // диагональ сверху вниз
    [74, 60, 96, 60, 12],   // ряд вверху
    [64, 102, 96, 102, 17], // ряд внизу
    [66, 68, 94, 68, 15],   // ряд под большой плитой
    [64, 96, 90, 96, 14],   // ряд над нижней палкой
  ],
  DOTS_PER_ZONE: 150, // spec.md, раздел 5

  walls: [], // препятствия в точках: { x, y, w, h, kind }
  dots: [],  // точки в точках экрана мира: { x, y, taken, takenAt }

  // Собрать мир заново (в начале каждого захода)
  build() {
    const c = this.CELL;
    this.walls = this.WALLS.map(([x, y, w, h, kind]) => ({ x: x * c, y: y * c, w: w * c, h: h * c, kind }));

    const dots = [];
    const near = (x, y) => dots.some((d) => Math.abs(d.x - x) < c * 0.9 && Math.abs(d.y - y) < c * 0.9);
    this.DOT_ROWS.forEach(([x1, y1, x2, y2, n]) => {
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        const x = (x1 + (x2 - x1) * t) * c + c / 2; // + полклетки: в середину клетки
        const y = (y1 + (y2 - y1) * t) * c + c / 2;
        if (this.inWall(x, y, c * 0.6)) continue;  // в препятствии — не кладём
        if (near(x, y)) continue;                  // на месте пересечения рядов — одна точка
        if (Math.hypot(x - this.START.x * c, y - this.START.y * c) < c * 1.5) continue; // не под героем
        dots.push({ x, y, taken: false, takenAt: 0 });
      }
    });
    this.dots = dots.slice(0, this.DOTS_PER_ZONE);
  },

  // Есть ли препятствие в квадрате с центром (x, y) и полустороной half?
  // Край мира — тоже стена.
  inWall(x, y, half) {
    const max = this.SIZE * this.CELL;
    if (x - half < 0 || y - half < 0 || x + half > max || y + half > max) return true;
    for (const r of this.walls) {
      if (x + half > r.x && x - half < r.x + r.w && y + half > r.y && y - half < r.y + r.h) return true;
    }
    return false;
  },

  // ---------- Рисование ----------
  //   ctx  — холст
  //   cam  — камера: точка мира (в точках), которая сейчас в центре экрана
  //   w, h — размер экрана в точках
  //   time — секунды игры (для исчезания собранных точек)
  draw(ctx, cam, w, h, time) {
    const c = this.CELL;
    const left = Math.round(cam.x - w / 2); // мировая точка в левом верхнем углу экрана
    const top = Math.round(cam.y - h / 2);
    const max = this.SIZE * c;
    // Видно ли прямоугольник на экране (с запасом) — невидимое не рисуем
    const seen = (x, y, ww, hh) => x + ww > left - 20 && x < left + w + 20 && y + hh > top - 20 && y < top + h + 20;

    // 1. Пол: маленькие крестики в углах клеток, как засечки на линейке
    ctx.fillStyle = '#C9C0AF';
    const x0 = Math.max(0, Math.floor(left / c) * c);
    const y0 = Math.max(0, Math.floor(top / c) * c);
    for (let x = x0; x <= Math.min(max, left + w + c); x += c) {
      for (let y = y0; y <= Math.min(max, top + h + c); y += c) {
        ctx.fillRect(x - left - 4, y - top - 1, 8, 2);
        ctx.fillRect(x - left - 1, y - top - 4, 2, 8);
      }
    }

    // 2. Край мира: толстая чёрная линия и тонкая снаружи, как земля в ролике
    ctx.fillStyle = '#171513';
    ctx.fillRect(-left - 4, -top - 4, max + 8, 4);     // верх
    ctx.fillRect(-left - 4, max - top, max + 8, 4);    // низ
    ctx.fillRect(-left - 4, -top - 4, 4, max + 8);     // лево
    ctx.fillRect(max - left, -top - 4, 4, max + 8);    // право
    ctx.fillRect(-left - 22, -top - 22, max + 44, 2);  // тонкие линии снаружи
    ctx.fillRect(-left - 22, max - top + 20, max + 44, 2);
    ctx.fillRect(-left - 22, -top - 22, 2, max + 44);
    ctx.fillRect(max - left + 20, -top - 22, 2, max + 44);

    // 3. Украшения
    for (const d of this.DECOR) {
      if (d.kind === 'circle') {
        if (!seen((d.x - d.r) * c, (d.y - d.r) * c, d.r * 2 * c, d.r * 2 * c)) continue;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(d.x * c - left, d.y * c - top, d.r * c, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === 'line') {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = d.w;
        ctx.beginPath();
        ctx.moveTo(d.x1 * c - left, d.y1 * c - top);
        ctx.lineTo(d.x2 * c - left, d.y2 * c - top);
        ctx.stroke();
      }
    }

    // 4. Препятствия: светлые плиты в рамке и чёрные палки
    for (const r of this.walls) {
      if (!seen(r.x, r.y, r.w, r.h)) continue;
      const x = r.x - left, y = r.y - top;
      if (r.kind === 'black') {
        ctx.fillStyle = '#171513';
        ctx.fillRect(x, y, r.w, r.h);
      } else {
        ctx.fillStyle = '#171513';            // рамка 2 точки
        ctx.fillRect(x, y, r.w, r.h);
        ctx.fillStyle = '#FBFAF3';            // светлая плита
        ctx.fillRect(x + 2, y + 2, r.w - 4, r.h - 4);
      }
    }

    // 5. Точки — синие энергетические кружочки: светлый ореол и синее ядро.
    // Собранная точка 0,2 с уменьшается и пропадает.
    // Рисуем все ореолы одним путём, потом все ядра — так быстрее.
    const POP = 0.2;
    const visible = [];
    for (const d of this.dots) {
      if (d.taken && time - d.takenAt > POP) continue;
      if (!seen(d.x - 10, d.y - 10, 20, 20)) continue;
      const k = d.taken ? 1 - (time - d.takenAt) / POP : 1; // 1 — целая, 0 — пропала
      visible.push([d.x - left, d.y - top, k]);
    }
    ctx.fillStyle = '#A3B3DB';
    ctx.beginPath();
    for (const [x, y, k] of visible) { ctx.moveTo(x + 9 * k, y); ctx.arc(x, y, 9 * k, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = '#2354C9';
    ctx.beginPath();
    for (const [x, y, k] of visible) { ctx.moveTo(x + 5 * k, y); ctx.arc(x, y, 5 * k, 0, Math.PI * 2); }
    ctx.fill();
  },
};
