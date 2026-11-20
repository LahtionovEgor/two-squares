// game.js — движок «Двух квадратов»: холст, цикл кадров, рисование сцен.
//
// Подключается из index.html как game.js?v=N (при изменении файла N растёт).
// Сейчас это каркас (этап 3): меню с живыми квадратами и пустой мир.
// Движение, камера, столкновения и точки — этап 4.

'use strict';

// Цвета из ролика «Про 2 квадрата. Глава вторая» (замерены по кадрам).
// Те же цвета записаны в index.html (переменные CSS) и в spec.md.
const COLORS = {
  paper: '#EAE3D5',  // бумага
  ink: '#171513',    // чёрный
  red: '#D2241B',    // красный
  wine: '#77151D',   // тёмно-красный
  yellow: '#F3BE0F', // жёлтый
  blue: '#2354C9',   // синий
  orange: '#ED6E16', // оранжевый
  violet: '#47255E', // фиолетовый
  light: '#FBFAF3',  // светлый
};

const Game = {
  canvas: null,
  ctx: null,
  w: 0, h: 0,       // размер экрана в точках (CSS-пикселях)
  dpr: 1,           // плотность пикселей, не больше 2 (spec.md, раздел 8)
  scene: 'menu',    // что рисуем: 'menu' | 'world' | 'check'
  time: 0,          // секунды с начала работы (на паузе не идут)
  fps: 60,          // сколько кадров в секунду получается на этом телефоне
  groundY: 0,       // где в меню проходит линия земли (задаёт index.html)
  running: false,   // крутится ли цикл кадров
  lastStamp: 0,     // время прошлого кадра (для расчёта шага)

  // Запуск: находим холст, подгоняем размер, делаем бумагу, крутим кадры
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.makePaper();
    window.addEventListener('resize', () => this.resize());
    this.resume();
  },

  // Подгоняем холст под экран. Рисуем в «точках», а холст внутри —
  // в пикселях с плотностью до 2: чётко и не слишком тяжело для iPhone SE.
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  // Бумага с мелким зерном, как в ролике. Рисуем зерно один раз
  // в маленькую плитку и кладём фоном страницы — каждый кадр его не трогаем.
  makePaper() {
    const size = 192; // плитка 192 × 192 пикселя, на экране 96 × 96 точек
    const tile = document.createElement('canvas');
    tile.width = tile.height = size;
    const t = tile.getContext('2d');
    const img = t.createImageData(size, size);
    const base = [0xEA, 0xE3, 0xD5]; // цвет бумаги
    for (let i = 0; i < img.data.length; i += 4) {
      const n = Math.round((Math.random() - 0.5) * 14); // зерно ±7
      img.data[i] = base[0] + n;
      img.data[i + 1] = base[1] + n;
      img.data[i + 2] = base[2] + n;
      img.data[i + 3] = 255;
    }
    t.putImageData(img, 0, 0);
    document.body.style.backgroundImage = 'url(' + tile.toDataURL('image/png') + ')';
    document.body.style.backgroundSize = (size / 2) + 'px ' + (size / 2) + 'px';
  },

  // Переключение сцены (вызывает index.html при смене экрана)
  setScene(name) {
    this.scene = name;
  },

  // Пауза: когда Mini App свернули — не тратим батарею
  pause() {
    this.running = false;
  },
  resume() {
    if (this.running) return;
    this.running = true;
    this.lastStamp = 0;
    requestAnimationFrame((t) => this.frame(t));
  },

  // Один кадр: считаем время, рисуем сцену, просим следующий кадр
  frame(stamp) {
    if (!this.running) return;
    // Шаг времени в секундах; после паузы не прыгаем вперёд больше чем на 1/20 с
    const dt = this.lastStamp ? Math.min((stamp - this.lastStamp) / 1000, 0.05) : 1 / 60;
    this.lastStamp = stamp;
    this.time += dt;
    // Плавный замер кадров в секунду (для экрана «Проверка»)
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h); // холст прозрачный, под ним бумага
    if (this.scene === 'menu') this.drawMenu(ctx);
    else if (this.scene === 'world') this.drawWorld(ctx);
    // на экране «Проверка» холст пустой — только бумага

    requestAnimationFrame((t) => this.frame(t));
  },

  // ---------- Сцена меню: земля, палки и два квадрата, как в ролике ----------
  drawMenu(ctx) {
    const w = this.w;
    const y = this.groundY || this.h * 0.7; // линия земли
    const s = Math.max(44, Math.min(90, Math.min(w, this.h) * 0.14)); // сторона квадрата
    const stick = Math.max(4, s * 0.11); // толщина палки

    drawGround(ctx, y, w);

    // Палки красные и чёрные — лежат и опираются друг на друга (кадр «Упали…»)
    const g = y - 2; // верх толстой линии земли
    drawStick(ctx, w * 0.03, g - stick / 2, s * 1.5, -0.04, stick, COLORS.red);
    drawStick(ctx, w * 0.07, g, s * 0.95, -0.95, stick, COLORS.ink);
    drawStick(ctx, w * 0.22, g, s * 0.75, -2.15, stick, COLORS.ink);
    drawStick(ctx, w * 0.66, g - stick / 2, s * 1.6, 0.03, stick, COLORS.red);
    drawStick(ctx, w * 0.72, g, s * 1.3, -0.72, stick, COLORS.ink);
    drawStick(ctx, w * 0.95, g, s * 0.85, -2.5, stick, COLORS.ink);

    // «Гравитация! Красный — наверх, чёрный — прыг за ним!»
    // Каждые 4,5 с красный прыгает, чёрный чуть позже прыгает за ним.
    const cycle = this.time % 4.5;
    const red = hop(cycle, 0.6, 0.9, s * 2.2, -0.17);
    const black = hop(cycle, 1.0, 0.75, s * 1.2, 0.14);
    drawSquare(ctx, w * 0.5 - s * 0.62, g - s / 2 + black.y, s, COLORS.ink, black.a);
    drawSquare(ctx, w * 0.5 + s * 0.62, g - s / 2 + red.y, s, COLORS.red, red.a);
  },

  // ---------- Сцена мира: пустой центр и красный квадрат ----------
  drawWorld(ctx) {
    const c = World.CELL;
    // Камера смотрит в центр мира (этап 4 — камера будет следовать за героем)
    const cam = { x: World.SIZE / 2 * c, y: World.SIZE / 2 * c };
    World.draw(ctx, cam, this.w, this.h);
    // Герой стоит в центре и чуть покачивается — «живой»
    const a = Math.sin(this.time * 2.1) * 0.05;
    drawSquare(ctx, this.w / 2, this.h / 2, c * 0.8, COLORS.red, a);
  },
};

// ---------- Простые фигуры: из них собрана вся игра ----------

// Квадрат: центр (x, y), сторона size, цвет, поворот в радианах
function drawSquare(ctx, x, y, size, color, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle || 0);
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

// Палка: от точки (x, y) длиной len под углом angle, толщиной thick
function drawStick(ctx, x, y, len, angle, thick, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillRect(0, -thick / 2, len, thick);
  ctx.restore();
}

// Земля из ролика: толстая чёрная линия, под ней тонкая, между ними засечки
function drawGround(ctx, y, w) {
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, Math.round(y) - 2, w, 4);  // толстая линия
  ctx.fillRect(0, Math.round(y) + 16, w, 2); // тонкая линия
  const step = Math.max(80, w / 8);          // засечки как на линейке
  for (let x = step / 2; x < w; x += step) {
    ctx.fillRect(Math.round(x) - 1, Math.round(y), 2, 14);
  }
}

// Прыжок: где квадрат в момент t (секунды внутри цикла).
// start — когда прыгнуть, dur — сколько длится, height — высота, tilt — наклон.
// Возвращает сдвиг вверх y и угол a.
function hop(t, start, dur, height, tilt) {
  const p = (t - start) / dur; // доля прыжка: 0 — оттолкнулся, 1 — приземлился
  if (p <= 0 || p >= 1) return { y: 0, a: 0 };
  return {
    y: -4 * height * p * (1 - p),     // парабола: вверх и обратно
    a: Math.sin(p * Math.PI) * tilt,  // в полёте наклоняется, к земле — ровно
  };
}
