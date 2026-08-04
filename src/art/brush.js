// Кисть и масло.
//
// Здесь решается, будет ли это живописью или фильтром «под ван Гога».
// Четыре вещи отделяют одно от другого, и все четыре сделаны честно:
//
//   1. Мазок — полилиния, проинтегрированная вдоль поля автомата,
//      а не заливка пикселей. Направление удара и есть рисунок.
//   2. Холст закрыт целиком. У ван Гога нет непрокрашенных мест: сначала
//      подмалёвок широкой кистью, потом корпусный слой внахлёст. Разреженные
//      мазки на грунте дают не живопись, а узор.
//   3. У мазка есть тело и щетина: сплошная полоса плюс несколько прочерков
//      внутри неё. Борозды — то, по чему глаз читает масло.
//   4. Импасто настоящее: параллельно холсту копится буфер высоты, он
//      сглаживается, нормируется и в конце по нему считается нормаль и
//      ложится направленный свет. Ключевое — умеренность: пересвеченный
//      рельеф читается как штампованный пластик, а не как краска.

import { clamp, lerp, makeRng, r2Point, smoothstep } from './rng';
import { sampleAngle, sampleScalar } from './field';
import { accentColor, earthColor, skyColor, toCss } from './palettes';

// Направление мазка — директор: θ и θ+π неразличимы. Приводим угол
// к ближайшему к предыдущему, иначе мазок дёргается на пол-оборота.
const alignAngle = (angle, ref) => {
    let a = angle;
    while (a - ref > Math.PI / 2) a -= Math.PI;
    while (a - ref < -Math.PI / 2) a += Math.PI;
    return a;
};

const stampHeight = (height, W, H, cx, cy, r, amount) => {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(H - 1, Math.ceil(cy + r));
    const r2 = r * r || 1;
    for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        const row = y * W;
        for (let x = x0; x <= x1; x++) {
            const dx = x - cx;
            const d2 = dx * dx + dy * dy;
            if (d2 > r2) continue;
            height[row + x] += amount * (1 - d2 / r2);
        }
    }
};

// Разделимое размытие буфера высоты. Без него нормаль считается по
// пиксельным зазубринам стампов, и свет ложится зернистой рябью —
// именно она и читается как пластик.
const blurHeight = (src, W, H, radius) => {
    const tmp = new Float32Array(W * H);
    const out = new Float32Array(W * H);
    const span = radius * 2 + 1;
    for (let y = 0; y < H; y++) {
        const row = y * W;
        let acc = 0;
        for (let x = -radius; x <= radius; x++) acc += src[row + clamp(x, 0, W - 1)];
        for (let x = 0; x < W; x++) {
            tmp[row + x] = acc / span;
            acc -= src[row + clamp(x - radius, 0, W - 1)];
            acc += src[row + clamp(x + radius + 1, 0, W - 1)];
        }
    }
    for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let y = -radius; y <= radius; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
        for (let y = 0; y < H; y++) {
            out[y * W + x] = acc / span;
            acc -= tmp[clamp(y - radius, 0, H - 1) * W + x];
            acc += tmp[clamp(y + radius + 1, 0, H - 1) * W + x];
        }
    }
    return out;
};

// Линия горизонта не по линейке: она гуляет вместе с полем автомата и
// переходит широкой полосой. Прямая граница читалась бы как склейка двух
// картинок, а не как край поля под небом.
const HORIZON_BAND = 0.13;
const horizonAt = (field, composition, u) => {
    // Выборка по сжатой координате даёт низкую частоту: горизонт должен
    // ходить крупной волной, а не дрожать вместе с текстурой.
    const s = sampleScalar(field.scalar, field.width, field.height, u * 0.3 + 0.2, composition.horizonY);
    return composition.horizonY + (s - 0.5) * 0.18;
};

/**
 * Один мазок: интегрирование вдоль поля + отрисовка тела и щетины.
 */
const paintStroke = (ctx, args) => {
    const { field, composition, palette, brush, height, W, H, rng, startU, startV, silent } = args;

    // Масштаб мазка меняется по холсту: в небе длинный ведущий мазок,
    // в земле короткий рубленый. Это не приём ради разнообразия — так
    // построена «Звёздная ночь» и так же «Пшеничное поле».
    const startSkyness = 1 - smoothstep((startV - horizonAt(field, composition, startU)) / HORIZON_BAND + 0.5);
    const scale = lerp(brush.earthLength, brush.skyLength, startSkyness);

    const stepPx = Math.max(2, W * 0.0026);
    const lengthJitter = 0.6 + rng() * 0.8;
    const maxSteps = Math.max(4, Math.round((brush.lengthBase * W * lengthJitter * scale) / stepPx));
    // Кривизна мазка задаётся периодом: вихрь Сен-Реми гнётся,
    // штриховка Нюэнена почти прямая.
    const maxTurn = 0.012 + brush.curl * 0.2;

    let u = startU;
    let v = startV;
    let x = u * W;
    let y = v * H;

    let angle;
    const fieldAngle = sampleAngle(field, u, v);
    if (brush.mode === 'hatch') {
        // Две господствующие семьи углов, крест-накрест. Это Нюэнен:
        // плотность держится плетением, а не потоком.
        const side = rng() < 0.5 ? -1 : 1;
        const base = brush.hatchAngle + side * (Math.PI / 2) * 0.62 + (rng() - 0.5) * brush.hatchSpread;
        angle = lerp(base, alignAngle(fieldAngle, base), brush.fieldWeight);
    } else {
        angle = fieldAngle + (rng() - 0.5) * 0.22;
    }

    const points = [[x, y]];
    for (let s = 0; s < maxSteps; s++) {
        const target = alignAngle(sampleAngle(field, u, v), angle);
        angle += clamp((target - angle) * brush.fieldWeight, -maxTurn, maxTurn);
        x += Math.cos(angle) * stepPx;
        y += Math.sin(angle) * stepPx;
        u = x / W;
        v = y / H;
        if (u < -0.03 || u > 1.03 || v < -0.03 || v > 1.03) break;
        // Овер: мазок обрывается на разломе поля, а не переползает его.
        if (brush.breakOnEdge && sampleScalar(composition.breakMask, field.width, field.height, u, v) > 0.55) {
            break;
        }
        points.push([x, y]);
    }
    if (points.length < 2) return false;

    // Цвет берётся в середине мазка: у ван Гога мазок — единица цвета,
    // а не градиент.
    const mid = points[Math.floor(points.length / 2)];
    const mu = clamp(mid[0] / W, 0, 1);
    const mv = clamp(mid[1] / H, 0, 1);
    const raw = sampleScalar(field.scalar, field.width, field.height, mu, mv);
    // Тональная кривая периода: тёмный ван Гог держится в низком ключе,
    // светлое — редкое событие, а не половина холста.
    const value = clamp(Math.pow(clamp(raw, 0, 1), palette.tone) * 0.94 + 0.03, 0, 1);
    const voidness = sampleScalar(composition.voidMask, field.width, field.height, mu, mv);
    const energy = sampleScalar(field.energy, field.width, field.height, mu, mv);

    const skyness = 1 - smoothstep((mv - horizonAt(field, composition, mu)) / HORIZON_BAND + 0.5);
    const sky = skyColor(palette, value);
    const earth = earthColor(palette, value);
    let rgb = [
        lerp(earth[0], sky[0], skyness),
        lerp(earth[1], sky[1], skyness),
        lerp(earth[2], sky[2], skyness)
    ];

    // Акцент — редкая высокая нота: звёзды и жёлтый у Сен-Реми, лампа
    // у Нюэнена, вороны у Овера. Он привязан к самым светлым местам поля,
    // а не разбросан по вероятности: рассыпанный по всему холсту акцент
    // перестаёт быть источником света и превращается в конфетти.
    const isAccent = !silent && value > (brush.accentValue || 0) && rng() < brush.accentRate;
    if (isAccent) rgb = accentColor(palette, rng());

    // Пустота глубокого сна тянет цвет к грунту: туда волна не заходит.
    if (voidness > 0) {
        const k = smoothstep(voidness);
        rgb = [
            lerp(rgb[0], palette.ground[0], k * 0.9),
            lerp(rgb[1], palette.ground[1], k * 0.9),
            lerp(rgb[2], palette.ground[2], k * 0.9)
        ];
    }
    if (silent) {
        rgb = [
            lerp(rgb[0], palette.ground[0], 0.85),
            lerp(rgb[1], palette.ground[1], 0.85),
            lerp(rgb[2], palette.ground[2], 0.85)
        ];
    }

    const width = Math.max(1.2, brush.widthBase * W * (0.7 + energy * 0.6) * (1 - voidness * 0.35));

    const trace = (offset, lw, style, alpha) => {
        const nx = -Math.sin(angle) * offset;
        const ny = Math.cos(angle) * offset;
        ctx.strokeStyle = style;
        ctx.lineWidth = lw;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(points[0][0] + nx, points[0][1] + ny);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0] + nx, points[i][1] + ny);
        ctx.stroke();
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Тело мазка — сплошная полоса. Именно она закрывает холст.
    trace(0, width, toCss(rgb), silent ? 0.55 : 0.96);
    // Щетина — прочерки внутри тела: кисть заряжена несколькими красками.
    const bristles = brush.bristles;
    for (let b = 0; b < bristles; b++) {
        const off = (b - (bristles - 1) / 2) * (width / bristles);
        const t = (rng() - 0.5) * 0.34;
        trace(
            off,
            Math.max(0.7, (width / bristles) * 0.55),
            toCss([rgb[0] * (1 + t * 0.5), rgb[1] * (1 + t * 0.4), rgb[2] * (1 + t * 0.32)]),
            silent ? 0.25 : 0.42
        );
    }
    ctx.globalAlpha = 1;

    // Толщина краски. Усилие тела — в буквальной высоте слоя.
    const load = brush.impasto * (0.45 + energy * 0.8) * (1 - voidness * 0.7) * (silent ? 0.12 : 1);
    const stride = Math.max(1, Math.round(width * 0.5));
    for (let i = 0; i < points.length; i += stride) {
        stampHeight(height, W, H, points[i][0], points[i][1], width * 0.6, load);
    }
    return true;
};

/**
 * Свет по буферу высоты. Нормаль из градиента сглаженной высоты, ламбертово
 * освещение сверху слева — так холст снимают музейные фотографы, и так
 * импасто читается как рельеф краски.
 *
 * Высота предварительно нормируется: без этого сила света зависела бы от
 * числа мазков, и плотные полотна получались бы хромированными.
 */
const applyImpasto = (ctx, rawHeight, W, H, palette, strength, relief) => {
    let maxH = 1e-6;
    for (let i = 0; i < rawHeight.length; i++) if (rawHeight[i] > maxH) maxH = rawHeight[i];
    const scale = relief / maxH;
    for (let i = 0; i < rawHeight.length; i++) rawHeight[i] *= scale;

    const height = blurHeight(rawHeight, W, H, Math.max(1, Math.round(W / 700)));
    const image = ctx.getImageData(0, 0, W, H);
    const px = image.data;
    const lx = -0.62;
    const ly = -0.62;
    const lz = 0.48;
    const tint = palette.lightTint;

    for (let y = 0; y < H; y++) {
        const ym = y > 0 ? (y - 1) * W : y * W;
        const yp = y < H - 1 ? (y + 1) * W : y * W;
        const yc = y * W;
        for (let x = 0; x < W; x++) {
            const gx = height[yc + (x < W - 1 ? x + 1 : x)] - height[yc + (x > 0 ? x - 1 : x)];
            const gy = height[yp + x] - height[ym + x];
            const inv = 1 / Math.hypot(gx, gy, 1);
            const shade = ((-gx * lx - gy * ly + lz) * inv - lz) * strength;
            const i = (yc + x) * 4;
            if (shade > 0) {
                // Блик не выжигает цвет: чем светлее краска, тем меньше добавка.
                px[i] += shade * (tint[0] / 255) * 150 * (1 - px[i] / 255);
                px[i + 1] += shade * (tint[1] / 255) * 150 * (1 - px[i + 1] / 255);
                px[i + 2] += shade * (tint[2] / 255) * 150 * (1 - px[i + 2] / 255);
            } else {
                px[i] += shade * 110 * (px[i] / 255 + 0.2);
                px[i + 1] += shade * 110 * (px[i + 1] / 255 + 0.2);
                px[i + 2] += shade * 105 * (px[i + 2] / 255 + 0.2);
            }
        }
    }
    ctx.putImageData(image, 0, 0);
};

/**
 * Полный проход по холсту: грунт → подмалёвок → корпусный слой → свет.
 */
export const paintCanvas = (ctx, W, H, config) => {
    const { field, composition, palette, brush, metrics, seed } = config;
    const rng = makeRng(seed);
    const silent = !!metrics.silent;
    const height = new Float32Array(W * H);

    // Грунт. Тёмный, потому что масло всегда высветляет: класть надо
    // на тёмное, иначе слой уходит в серость.
    ctx.fillStyle = toCss(palette.ground);
    ctx.fillRect(0, 0, W, H);

    const area = (W * H) / (1000 * 1000);
    const baseCount = Math.round(15000 * brush.strokeDensity * area);

    // Подмалёвок: широкая кисть, задача одна — закрыть холст массами.
    // Без него корпусный слой ложится на грунт и просвечивает дырами.
    const underBrush = {
        ...brush,
        lengthBase: brush.lengthBase * 2.2,
        widthBase: brush.widthBase * 5,
        bristles: 2,
        impasto: brush.impasto * 0.18,
        accentRate: 0,
        breakOnEdge: 0
    };
    const underCount = Math.round(baseCount * (silent ? 0.02 : 0.2));
    for (let i = 0; i < underCount; i++) {
        const [u, v] = r2Point(i, (seed % 1024) + 31);
        paintStroke(ctx, {
            field, composition, palette, brush: underBrush, height, W, H, rng,
            startU: u, startV: v, silent
        });
    }

    // Корпусный слой. День без данных почти не пишется: полотно окаменевает
    // на грунте, и это и есть изображение отсутствия.
    const count = Math.round(baseCount * (silent ? 0.05 : 1));
    const offset = (seed % 4096) + 1013;
    let placed = 0;
    for (let i = 0; placed < count && i < count * 3; i++) {
        const [u, v] = r2Point(i, offset);
        const voidness = sampleScalar(composition.voidMask, field.width, field.height, u, v);
        const energy = sampleScalar(field.energy, field.width, field.height, u, v);
        // Отбор точек почти равномерный: сильный перекос по энергии обводит
        // структуру автомата контуром, и она начинает читаться как схема.
        const accept = (0.72 + energy * 0.28) * (1 - voidness * 0.75);
        if (rng() > accept) continue;
        if (
            paintStroke(ctx, {
                field, composition, palette, brush, height, W, H, rng,
                startU: u, startV: v, silent
            })
        ) {
            placed++;
        }
    }

    applyImpasto(ctx, height, W, H, palette, silent ? 0.4 : 0.85, W * 0.0016);
    return { strokes: placed, underStrokes: underCount };
};
