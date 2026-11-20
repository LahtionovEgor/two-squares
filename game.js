// game.js — движок «Двух квадратов»: холст, цикл кадров, рисование сцен.
//
// Подключается из index.html как game.js?v=N (при изменении файла N растёт).
// Этап 4 «Ядро»: герой едет за пальцем (плавающий джойстик), смах — рывок,
// камера следует за героем, препятствия не пускают, точки собираются.

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

// Два героя (spec.md, раздел 5). speed — клеток в секунду.
// grip — «сцепление»: чем больше, тем быстрее квадрат разгоняется и тормозит.
// Красный лёгкий (откликается сразу), чёрный тяжёлый (катится с инерцией).
const HEROES = {
  red:   { color: COLORS.red, speed: 5, grip: 14 },
  black: { color: COLORS.ink, speed: 4, grip: 6 },
};

// Управление (spec.md, раздел 6). Все числа можно подкручивать здесь.
const CONTROL = {
  stickMax: 40,      // на сколько точек отвести палец для полной скорости
  dashCells: 3,      // рывок — на 3 клетки
  dashSpeed: 16,     // скорость рывка, клеток в секунду (3 клетки ≈ 0,19 с)
  dashCooldown: 1.5, // перезарядка рывка, секунды
  flickTime: 220,    // смах: палец оторван быстрее чем за 0,22 с…
  flickDist: 28,     // …и прошёл больше 28 точек
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

  // --- Игра (сцена 'world') ---
  paused: false,    // пауза: мир стоит, но рисуется
  hero: null,       // герой: где он, скорость, рывок
  cam: { x: 0, y: 0 }, // камера: какая точка мира в центре экрана
  stick: { active: false, id: 0, ox: 0, oy: 0, x: 0, y: 0, t0: 0 }, // палец-джойстик
  stats: { energy: 0, lives: 3, taken: 0 }, // энергия до 100, жизни, всего собрано
  onChange: null,   // index.html: обновить табло
  onFeel: null,     // index.html: вибрация ('light', 'success' …)

  // Запуск: находим холст, подгоняем размер, делаем бумагу, крутим кадры
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.makePaper();
    window.addEventListener('resize', () => this.resize());
    this.listenTouches();
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

    if (this.scene === 'world' && !this.paused) this.update(dt);

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

  // ================= Сцена мира =================

  // Новый заход: собрать мир, поставить героя на старт, обнулить счёт.
  // kind — 'red' или 'black' (выбор квадрата появится в меню на этапе 6).
  startRun(kind) {
    World.build();
    const c = World.CELL;
    this.hero = {
      kind: kind || 'red',
      x: World.START.x * c, y: World.START.y * c, // центр героя в точках мира
      vx: 0, vy: 0,          // скорость, точек в секунду
      half: c * 0.4,         // полсторона: квадрат 32 × 32 точки
      dash: 0,               // сколько точек рывка осталось проехать
      dx: 0, dy: 0,          // направление рывка
      cooldown: 0,           // сколько секунд до следующего рывка
    };
    this.cam.x = this.hero.x;
    this.cam.y = this.hero.y;
    this.stats = { energy: 0, lives: 3, taken: 0 };
    this.stick.active = false;
    this.paused = false;
    this.changed();
  },

  setPaused(on) {
    this.paused = on;
    this.stick.active = false; // палец «отпускаем», чтобы после паузы не ехать само
  },

  changed() { if (this.onChange) this.onChange(this.stats); },
  feel(kind) { if (this.onFeel) this.onFeel(kind); },

  // ---------- Пальцы ----------
  // Плавающий джойстик: где коснулся — там центр, куда ведёшь — туда едешь.
  // Быстрый смах с отрывом пальца — рывок. Слушаем только первый палец.
  listenTouches() {
    const cv = this.canvas;
    const s = this.stick;
    const playing = () => this.scene === 'world' && !this.paused && this.hero;

    cv.addEventListener('pointerdown', (e) => {
      if (!playing() || s.active) return;
      s.active = true;
      s.id = e.pointerId;
      s.ox = s.x = e.clientX;
      s.oy = s.y = e.clientY;
      s.t0 = performance.now();
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener('pointermove', (e) => {
      if (!s.active || e.pointerId !== s.id) return;
      s.x = e.clientX;
      s.y = e.clientY;
    });
    const up = (e) => {
      if (!s.active || e.pointerId !== s.id) return;
      s.active = false;
      // Смах: быстро и далеко → рывок в сторону смаха
      const dx = e.clientX - s.ox, dy = e.clientY - s.oy;
      const len = Math.hypot(dx, dy);
      const quick = performance.now() - s.t0 < CONTROL.flickTime;
      if (playing() && e.type === 'pointerup' && quick && len > CONTROL.flickDist) this.dash(dx / len, dy / len);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  },

  // Рывок на 3 клетки (если перезарядка прошла)
  dash(dx, dy) {
    const h = this.hero;
    if (h.cooldown > 0) return;
    h.dash = CONTROL.dashCells * World.CELL;
    h.dx = dx;
    h.dy = dy;
    h.cooldown = CONTROL.dashCooldown;
    this.feel('light');
  },

  // ---------- Шаг игры: движение, столкновения, точки, камера ----------
  update(dt) {
    const h = this.hero;
    if (!h) return;
    const c = World.CELL;
    const p = HEROES[h.kind];
    const s = this.stick;
    h.cooldown = Math.max(0, h.cooldown - dt);

    // 1. Куда хочет ехать игрок: направление пальца, сила — насколько отвёл
    let tx = 0, ty = 0;
    if (s.active) {
      const dx = s.x - s.ox, dy = s.y - s.oy;
      const len = Math.hypot(dx, dy);
      if (len > 4) { // мёртвая зона 4 точки: дрожь пальца не двигает квадрат
        const k = Math.min(len / CONTROL.stickMax, 1) * p.speed * c;
        tx = dx / len * k;
        ty = dy / len * k;
      }
    }
    // 2. Плавно подводим скорость к желаемой (инерция зависит от героя)
    const a = 1 - Math.exp(-p.grip * dt);
    h.vx += (tx - h.vx) * a;
    h.vy += (ty - h.vy) * a;

    // 3. Сдвиг за кадр: обычное движение + рывок
    let mx = h.vx * dt, my = h.vy * dt;
    if (h.dash > 0) {
      const step = Math.min(h.dash, CONTROL.dashSpeed * c * dt);
      mx += h.dx * step;
      my += h.dy * step;
      h.dash -= step;
    }
    this.moveHero(mx, my);

    // 4. Собираем точки, которых коснулся квадрат
    const reach = h.half + 6;
    for (const d of World.dots) {
      if (d.taken) continue;
      if (Math.abs(d.x - h.x) < reach && Math.abs(d.y - h.y) < reach) {
        d.taken = true;
        d.takenAt = this.time;
        this.stats.taken++;
        this.stats.energy++;
        if (this.stats.energy >= 100) { // 100 энергии = +1 жизнь
          this.stats.energy -= 100;
          this.stats.lives++;
          this.feel('success');
        }
        this.changed();
      }
    }

    // 5. Камера плавно догоняет героя и не заглядывает за край мира
    const f = 1 - Math.exp(-8 * dt);
    this.cam.x += (h.x - this.cam.x) * f;
    this.cam.y += (h.y - this.cam.y) * f;
    const max = World.SIZE * c;
    this.cam.x = Math.min(Math.max(this.cam.x, this.w / 2 - 30), max - this.w / 2 + 30);
    this.cam.y = Math.min(Math.max(this.cam.y, this.h / 2 - 30), max - this.h / 2 + 30);
  },

  // Двигаем героя маленькими шажками (не больше 8 точек), чтобы на рывке
  // он не «проскочил» сквозь тонкую палку. По x и по y — отдельно:
  // упёрся боком — продолжает скользить вдоль стены.
  moveHero(mx, my) {
    const h = this.hero;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 8));
    const sx = mx / steps, sy = my / steps;
    for (let i = 0; i < steps; i++) {
      if (sx) {
        if (World.inWall(h.x + sx, h.y, h.half)) { h.vx = 0; if (Math.abs(h.dx) > 0.3) h.dash = 0; }
        else h.x += sx;
      }
      if (sy) {
        if (World.inWall(h.x, h.y + sy, h.half)) { h.vy = 0; if (Math.abs(h.dy) > 0.3) h.dash = 0; }
        else h.y += sy;
      }
    }
  },

  // ---------- Рисуем мир, героя и джойстик ----------
  drawWorld(ctx) {
    const h = this.hero;
    if (!h) return;
    const cam = { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
    World.draw(ctx, cam, this.w, this.h, this.time);

    // Где герой на экране
    const x = h.x - cam.x + this.w / 2;
    const y = h.y - cam.y + this.h / 2;
    const size = h.half * 2;

    // Линии скорости за летящим квадратом (как в ролике): три штриха сзади
    if (h.dash > 0) {
      ctx.strokeStyle = '#E3A49C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      [-10, 0, 10].forEach((o, i) => {
        const back = size * 0.7 + i * 6;             // откуда начинается штрих
        const len = 22 + (i === 1 ? 14 : 0);          // средний длиннее
        const px = -h.dy * o, py = h.dx * o;          // сдвиг поперёк полёта
        ctx.moveTo(x - h.dx * back + px, y - h.dy * back + py);
        ctx.lineTo(x - h.dx * (back + len) + px, y - h.dy * (back + len) + py);
      });
      ctx.stroke();
    }

    // Герой: чуть наклоняется по ходу движения — «живой»
    const p = HEROES[h.kind];
    const tilt = (h.vx / (p.speed * World.CELL)) * 0.14 + Math.sin(this.time * 2.1) * 0.03;
    drawSquare(ctx, x, y, size, p.color, tilt);

    // Джойстик: кольцо там, где коснулся, и квадратик, куда ведёшь (по макету)
    const s = this.stick;
    if (s.active && !this.paused) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.ox, s.oy, 44, 0, Math.PI * 2);
      ctx.stroke();
      const dx = s.x - s.ox, dy = s.y - s.oy;
      const len = Math.hypot(dx, dy);
      const k = len > 32 ? 32 / len : 1; // квадратик не уходит дальше кольца
      drawSquare(ctx, s.ox + dx * k, s.oy + dy * k, 22, COLORS.ink, 0);
    }
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
