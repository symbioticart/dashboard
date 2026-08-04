// Из состояния автомата — поле направлений мазка.
//
// Это мост между алгоритмом и живописью. У ван Гога мазок не заливка,
// а вектор: направление удара кистью и есть рисунок. Поэтому автомат
// используется не как картинка, которую раскрашивают, а как поле, вдоль
// линий уровня которого кисть ведёт.
//
// Две технические тонкости, без которых мазок ломается:
//   1. Для циклического автомата градиент считается по фазе через (cos, sin),
//      иначе на шве состояний 0/n возникает ложный обрыв.
//   2. Направление мазка — не вектор, а директор (θ и θ+π неразличимы).
//      Интерполируется удвоенный угол, иначе соседние мазки взаимно гасятся.

import { clamp } from './rng';

const wrap = (v, n) => (v < 0 ? v + n : v >= n ? v - n : v);

export const buildField = (automaton, width, height) => {
    const { scalar, cos, sin, cyclic } = automaton;
    // Директор хранится как удвоенный угол — так его можно интерполировать.
    const dirX = new Float32Array(width * height);
    const dirY = new Float32Array(width * height);
    const energy = new Float32Array(width * height);
    let maxMag = 1e-6;

    for (let y = 0; y < height; y++) {
        const ym = wrap(y - 1, height) * width;
        const yp = wrap(y + 1, height) * width;
        const yc = y * width;
        for (let x = 0; x < width; x++) {
            const xm = wrap(x - 1, width);
            const xp = wrap(x + 1, width);
            let gx;
            let gy;
            if (cyclic) {
                // d(phase) = cos * d(sin) - sin * d(cos)
                const c = cos[yc + x];
                const s = sin[yc + x];
                gx = c * (sin[yc + xp] - sin[yc + xm]) - s * (cos[yc + xp] - cos[yc + xm]);
                gy = c * (sin[yp + x] - sin[ym + x]) - s * (cos[yp + x] - cos[ym + x]);
            } else {
                gx = scalar[yc + xp] - scalar[yc + xm];
                gy = scalar[yp + x] - scalar[ym + x];
            }
            const mag = Math.hypot(gx, gy);
            if (mag > maxMag) maxMag = mag;
            energy[yc + x] = mag;
            // Мазок идёт по линии уровня — перпендикулярно градиенту.
            const theta = Math.atan2(gy, gx) + Math.PI / 2;
            dirX[yc + x] = Math.cos(2 * theta);
            dirY[yc + x] = Math.sin(2 * theta);
        }
    }
    for (let i = 0; i < energy.length; i++) energy[i] = clamp(energy[i] / maxMag, 0, 1);

    return { dirX, dirY, energy, scalar, width, height };
};

// Билинейная выборка скалярного поля в нормированных координатах [0..1].
export const sampleScalar = (data, width, height, u, v) => {
    const fx = clamp(u, 0, 0.9999) * (width - 1);
    const fy = clamp(v, 0, 0.9999) * (height - 1);
    const x0 = fx | 0;
    const y0 = fy | 0;
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = data[y0 * width + x0];
    const b = data[y0 * width + x1];
    const c = data[y1 * width + x0];
    const d = data[y1 * width + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
};

// Направление мазка в точке. Интерполируется удвоенный угол,
// половина берётся после — так директор не схлопывается.
export const sampleAngle = (field, u, v) => {
    const { dirX, dirY, width, height } = field;
    const x = sampleScalar(dirX, width, height, u, v);
    const y = sampleScalar(dirY, width, height, u, v);
    return Math.atan2(y, x) / 2;
};
