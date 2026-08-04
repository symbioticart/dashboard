// Композиционная арматура.
//
// Автомат сам по себе даёт бесконечную однородную ткань — обои. У ван Гога
// вихрь всегда во что-то упирается: кипарис, горизонт, край поля. Поэтому
// поверх автомата строятся три структуры, и все три взяты из данных, а не
// придуманы ради вида:
//
//   горизонт  — доля суток во сне: граница сна и бодрствования становится
//               границей земли и неба;
//   пустоты   — эпизоды глубокого сна: области, куда волна не заходит.
//               Провал сознания как непрокрашенный, глухой массив;
//   разломы   — пробуждения и беспокойство: поле рвётся, мазок обрывается.
//               Разрыв — событие, а не шум, и он должен быть виден.

import { clamp, hash2, makeRng, r2Point, smoothstep } from './rng';

export const buildComposition = (metrics, seed, width, height) => {
    const n = metrics.norm;
    const rng = makeRng(seed ^ 0x9e3779b9);

    // Горизонт. Больше сна — ниже горизонт, больше ночного неба.
    const horizonY = clamp(0.72 - metrics.sleepShare * 0.8, 0.18, 0.82);

    // Пустоты глубокого сна. Их число и размер растут с долей глубокой фазы:
    // чем глубже провал, тем больше на холсте того, чего нет.
    const voidCount = metrics.silent ? 0 : Math.round(1 + n.deep * 4);
    const voids = [];
    // Размер пустоты задаётся по высоте и пересчитывается в ширину через
    // пропорцию холста. Иначе на широком формате Овера те же доли дают
    // пятна во весь холст, и работа схлопывается в несколько клякс.
    const aspect = width / height;
    for (let i = 0; i < voidCount; i++) {
        const [px, py] = r2Point(i, (seed % 512) + 7);
        // Вытянутые по вертикали массивы: у ван Гога вертикаль — кипарис,
        // единственная форма, разрезающая вихрь неба сверху донизу.
        const radiusY = (0.07 + n.deep * 0.12) * (0.6 + rng() * 0.7);
        voids.push({
            x: px,
            y: clamp(py * 0.9 + 0.05, 0.05, 0.95),
            rx: (radiusY * (0.35 + rng() * 0.3)) / aspect,
            ry: radiusY
        });
    }

    // Разломы. Позиции берём из фаз движения внутри ночи; если ряда движения
    // нет — из доли бодрствования, чтобы разлом всё равно был засвидетельствован.
    const rupturePhases = metrics.ruptures.length
        ? metrics.ruptures
        : Array.from({ length: Math.round(n.awake * 3) }, (_, i) => (i + 1) / (Math.round(n.awake * 3) + 1));
    const ruptures = rupturePhases.slice(0, 6).map((t, i) => ({
        x: clamp(t, 0.04, 0.96),
        tilt: (hash2(i, 1, seed) / 4294967296 - 0.5) * 0.5,
        width: 0.004 + n.restless * 0.012
    }));

    // Маски в разрешении решётки. voidMask — мягкая, чтобы край пустоты
    // не читался как вырезанная дырка; frozen — жёсткая, для автомата.
    const voidMask = new Float32Array(width * height);
    const frozen = new Uint8Array(width * height);
    const breakMask = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        const fy = y / (height - 1);
        for (let x = 0; x < width; x++) {
            const fx = x / (width - 1);
            const i = y * width + x;

            let v = 0;
            for (const o of voids) {
                const dx = (fx - o.x) / o.rx;
                const dy = (fy - o.y) / o.ry;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 1) v = Math.max(v, smoothstep(1 - d));
            }
            voidMask[i] = v;
            if (v > 0.55) frozen[i] = 1;

            let b = 0;
            for (const r of ruptures) {
                const rx = r.x + (fy - 0.5) * r.tilt;
                const d = Math.abs(fx - rx);
                if (d < r.width * 3) b = Math.max(b, smoothstep(1 - d / (r.width * 3)));
            }
            breakMask[i] = b;
        }
    }

    return { horizonY, voids, ruptures, voidMask, frozen, breakMask };
};
