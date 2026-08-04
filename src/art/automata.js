// Клеточные автоматы — то, что порождает форму.
//
// Главное ограничение канона: автомат не имеет права стартовать от шума.
// Начальная конфигурация решётки целиком вычисляется из ряда пульса за день:
// позиция клетки берётся из детерминированного хэша координат, а значение —
// из дневного ряда. Поле наследует распределение физиологии дня, а дальше
// правило разворачивает его во времени. Автомат ничего не «придумывает» —
// он раскрывает день.
//
// Три движка, по одному на пластический язык:
//   cyclic     — циклический автомат (Griffeath, 1988): сам рождает вихри
//   grayScott  — реакция-диффузия: волновые фронты и разрывы
//   hatch      — life-подобные правила с накоплением: плотная ткань, штриховка

import { clamp, hash2 } from './rng';

const wrap = (v, n) => (v < 0 ? v + n : v >= n ? v - n : v);

// Ряд дня → функция «нормированное значение по индексу».
// Если ряда нет (день без данных), возвращаем константу: поле замрёт.
const seriesSampler = (series) => {
    const clean = (series || []).filter((v) => typeof v === 'number' && isFinite(v));
    if (clean.length === 0) return { sample: () => 0.5, length: 0 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of clean) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
    }
    const span = hi - lo || 1;
    return {
        sample: (i) => (clean[((i % clean.length) + clean.length) % clean.length] - lo) / span,
        length: clean.length
    };
};

/**
 * Ранговая нормировка поля.
 *
 * Растяжка по min/max обманчива: у плотных правил почти все клетки жмутся
 * к одному концу, и после растяжки холст выходит одноцветным — светлая каша
 * или плоская заливка. Ранг же гарантирует полный тональный разброс при любом
 * правиле и любом дне: каждая клетка получает свою долю в распределении поля.
 *
 * Это та же логика, что и персональные перцентили в данных: значение само
 * по себе ничего не значит, значимо только место в собственном распределении.
 */
const equalize = (scalar) => {
    const n = scalar.length;
    const stride = Math.max(1, Math.floor(n / 2048));
    const sample = [];
    for (let i = 0; i < n; i += stride) sample.push(scalar[i]);
    sample.sort((a, b) => a - b);
    const m = sample.length;
    if (m < 2) return scalar;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const v = scalar[i];
        let lo = 0;
        let hi = m;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (sample[mid] < v) lo = mid + 1;
            else hi = mid;
        }
        out[i] = lo / (m - 1);
    }
    return out;
};

/**
 * Посев решётки дневным рядом. Позиция — из хэша, значение — из данных.
 * Так распределение дня раскладывается по плоскости без единого
 * обращения к случайности.
 */
export const seedFromSeries = (w, h, series, seed) => {
    const { sample, length } = seriesSampler(series);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = hash2(x, y, seed) % (length || 1);
            out[y * w + x] = sample(idx);
        }
    }
    return out;
};

/**
 * Циклический клеточный автомат.
 * Клетка в состоянии s переходит в (s+1) mod states, если среди соседей
 * набирается threshold клеток, уже находящихся в состоянии (s+1).
 * Из однородного посева это правило само, без вмешательства, порождает
 * капли → дефекты → спирали. Спираль здесь не нарисована — она следствие.
 */
export const runCyclic = (opts) => {
    const { width: w, height: h, seedField, states, threshold, range, steps, frozen } = opts;
    let grid = new Uint8Array(w * h);
    for (let i = 0; i < grid.length; i++) {
        grid[i] = Math.min(states - 1, Math.floor(seedField[i] * states));
    }
    const frozenStates = frozen ? Uint8Array.from(grid) : null;
    let next = new Uint8Array(w * h);

    for (let step = 0; step < steps; step++) {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (frozen && frozen[i]) {
                    next[i] = frozenStates[i];
                    continue;
                }
                const s = grid[i];
                const target = (s + 1) % states;
                let count = 0;
                for (let dy = -range; dy <= range; dy++) {
                    const yy = wrap(y + dy, h) * w;
                    for (let dx = -range; dx <= range; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (grid[yy + wrap(x + dx, w)] === target) count++;
                    }
                }
                next[i] = count >= threshold ? target : s;
            }
        }
        const tmp = grid;
        grid = next;
        next = tmp;
    }

    // Состояние — циклическая величина, поэтому наружу отдаём его как фазу
    // в векторном виде (cos, sin). Иначе на шве 0/n возникает ложный обрыв,
    // и мазок ломается там, где поле на самом деле непрерывно.
    const cos = new Float32Array(w * h);
    const sin = new Float32Array(w * h);
    const scalar = new Float32Array(w * h);
    for (let i = 0; i < grid.length; i++) {
        const phase = (grid[i] / states) * Math.PI * 2;
        cos[i] = Math.cos(phase);
        sin[i] = Math.sin(phase);
        scalar[i] = grid[i] / (states - 1);
    }
    return { scalar: equalize(scalar), cos, sin, cyclic: true };
};

/**
 * Реакция-диффузия Грея — Скотта. Два «вещества»: U подаётся с плотностью F,
 * V выедает U и убивается со скоростью F+k. В узкой полосе параметров
 * система идёт волнами и рвётся — отсюда обрывы и турбулентность Овера.
 */
export const runGrayScott = (opts) => {
    const { width: w, height: h, seedField, feed, kill, steps, frozen } = opts;
    const Du = 0.16;
    const Dv = 0.08;
    let u = new Float32Array(w * h);
    let v = new Float32Array(w * h);
    let u2 = new Float32Array(w * h);
    let v2 = new Float32Array(w * h);

    // V засевается дневным рядом: очаги реакции стоят там, где был пульс.
    for (let i = 0; i < u.length; i++) {
        u[i] = 1 - seedField[i] * 0.5;
        v[i] = seedField[i] > 0.62 ? seedField[i] * 0.5 : 0;
    }

    const lap = (f, x, y) => {
        const xm = wrap(x - 1, w);
        const xp = wrap(x + 1, w);
        const ym = wrap(y - 1, h) * w;
        const yp = wrap(y + 1, h) * w;
        const yc = y * w;
        return (
            0.2 * (f[yc + xm] + f[yc + xp] + f[ym + x] + f[yp + x]) +
            0.05 * (f[ym + xm] + f[ym + xp] + f[yp + xm] + f[yp + xp]) -
            f[yc + x]
        );
    };

    for (let step = 0; step < steps; step++) {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (frozen && frozen[i]) {
                    u2[i] = 1;
                    v2[i] = 0;
                    continue;
                }
                const uu = u[i];
                const vv = v[i];
                const uvv = uu * vv * vv;
                u2[i] = clamp(uu + (Du * lap(u, x, y) - uvv + feed * (1 - uu)), 0, 1);
                v2[i] = clamp(vv + (Dv * lap(v, x, y) + uvv - (feed + kill) * vv), 0, 1);
            }
        }
        let t = u;
        u = u2;
        u2 = t;
        t = v;
        v = v2;
        v2 = t;
    }

    // Наружу отдаём концентрацию V: сперва грубая растяжка, затем ранговая
    // нормировка — в устойчивых режимах V занимает очень узкую полосу.
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < v.length; i++) {
        if (v[i] < lo) lo = v[i];
        if (v[i] > hi) hi = v[i];
    }
    const span = hi - lo || 1;
    const scalar = new Float32Array(w * h);
    for (let i = 0; i < v.length; i++) scalar[i] = (v[i] - lo) / span;
    return { scalar: equalize(scalar), cyclic: false };
};

// Life-подобные правила, упорядоченные по размеру связной массы:
// от рассыпанного зерна к крупным цельным телам. Ими управляет
// эффективность сна — связная ночь даёт связную форму.
//
// Правила отобраны прогоном, а не по названиям: maze и mazectric при
// плотном посеве вырождаются в равномерный шум на клеточном масштабе
// (σ≈0.45 без всякой структуры) и в живописи читаются как телевизионная
// рябь, поэтому в наборе их нет.
export const HATCH_RULES = [
    { name: 'life', birth: [3], survive: [2, 3] },
    { name: 'walledcities', birth: [4, 5, 6, 7, 8], survive: [2, 3, 4, 5] },
    { name: 'coral', birth: [3], survive: [4, 5, 6, 7, 8] },
    { name: 'diamoeba', birth: [3, 5, 6, 7, 8], survive: [5, 6, 7, 8] },
    { name: 'vote', birth: [5, 6, 7, 8], survive: [4, 5, 6, 7, 8] }
];

// Усреднение по соседям. Устойчивые правила дают почти двоичное поле;
// без этого прохода массы выходят с жестяным краем и без полутона,
// а живопись живёт как раз на краю массы.
const smoothScalar = (data, w, h, passes) => {
    let src = data;
    for (let p = 0; p < passes; p++) {
        const out = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let acc = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    const yy = wrap(y + dy, h) * w;
                    for (let dx = -1; dx <= 1; dx++) acc += src[yy + wrap(x + dx, w)];
                }
                out[y * w + x] = acc / 9;
            }
        }
        src = out;
    }
    return src;
};

/**
 * Life-подобный автомат с накоплением. Само по себе бинарное поле дало бы
 * плоскую графику; поэтому копится «жар» — сколько поколений клетка была
 * жива. Жар и есть тон: плотность краски там, где жизнь держалась дольше.
 */
export const runHatch = (opts) => {
    const { width: w, height: h, seedField, rule, density, steps, frozen } = opts;
    const birth = new Uint8Array(9);
    const survive = new Uint8Array(9);
    for (const n of rule.birth) birth[n] = 1;
    for (const n of rule.survive) survive[n] = 1;

    let grid = new Uint8Array(w * h);
    for (let i = 0; i < grid.length; i++) grid[i] = seedField[i] > 1 - density ? 1 : 0;
    let next = new Uint8Array(w * h);
    const heat = new Float32Array(w * h);

    for (let step = 0; step < steps; step++) {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (frozen && frozen[i]) {
                    next[i] = grid[i];
                    continue;
                }
                let n = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    const yy = wrap(y + dy, h) * w;
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        n += grid[yy + wrap(x + dx, w)];
                    }
                }
                next[i] = grid[i] ? survive[n] : birth[n];
            }
        }
        const tmp = grid;
        grid = next;
        next = tmp;
        for (let i = 0; i < grid.length; i++) heat[i] += grid[i] ? 1 : -0.45;
    }

    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < heat.length; i++) {
        if (heat[i] < lo) lo = heat[i];
        if (heat[i] > hi) hi = heat[i];
    }
    const span = hi - lo || 1;
    const scalar = new Float32Array(w * h);
    for (let i = 0; i < heat.length; i++) scalar[i] = (heat[i] - lo) / span;
    return { scalar: equalize(smoothScalar(scalar, w, h, 1)), cyclic: false };
};
