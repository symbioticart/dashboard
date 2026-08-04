// Оркестратор: день + период → полотно.
//
// Цепочка одна и та же для всех четырёх языков:
//   данные дня → посев решётки → правило автомата → поле направлений
//   → композиционная арматура → мазок → импасто.
//
// Возвращается не только картинка, но и полный набор параметров: семя,
// правило, число шагов. Это провенанс. По модели «сертификат + правило»
// продаётся не файл, а возможность воспроизвести это полотно — значит,
// параметры должны быть записаны и предъявимы.

import { hashString } from './rng';
import { runCyclic, runGrayScott, runHatch, seedFromSeries } from './automata';
import { buildField } from './field';
import { buildComposition } from './composition';
import { resolvePalette } from './palettes';
import { paintCanvas } from './brush';
import { periodById } from './periods';

// Серия отделена от основной линии Symbiotic Art (та остаётся grayscale).
// Версия входит в семя: изменение правил даёт другую серию, а не тихо
// переписывает уже выпущенные работы.
export const SERIES_ID = 'van-gogh-ca';
export const SERIES_VERSION = 1;

const makeSeed = (day, periodId) => hashString(`${SERIES_ID}/${SERIES_VERSION}/${day}/${periodId}`);

// Смешанный вариант не имеет своего языка — он выбирает язык по дню.
const resolveSpec = (period, metrics) => {
    if (period.id !== 'mixed') {
        return { spec: period.configure(metrics.norm), paletteId: period.paletteId, routing: null };
    }
    const routing = period.route(metrics.norm);
    const target = periodById(routing.chosen);
    return { spec: target.configure(metrics.norm), paletteId: target.paletteId, routing };
};

const runAutomaton = (spec, seedField, gridW, gridH, frozen, silent) => {
    const a = spec.automaton;
    // День без данных: правило не запускается. Поле остаётся таким, каким
    // его оставил последний живой сигнал — последний день окаменевает.
    const steps = silent ? 0 : a.steps;
    const common = { width: gridW, height: gridH, seedField, steps, frozen };
    if (a.type === 'cyclic') {
        return runCyclic({ ...common, states: a.states, threshold: a.threshold, range: a.range });
    }
    if (a.type === 'grayScott') {
        // Реакция-диффузия — единственный движок, которому пустоты не
        // передаются. Замороженная область работает в ней как отражающая
        // стенка: вокруг неё встаёт радиальный фронт, и пустота читается
        // не как провал, а как концентрическая мишень. Здесь глубокий сон
        // остаётся только слоем краски, не вмешиваясь в химию поля.
        return runGrayScott({ ...common, frozen: null, feed: a.feed, kill: a.kill });
    }
    return runHatch({ ...common, rule: a.rule, density: a.density });
};

/**
 * Пишет полотно дня в переданный canvas.
 *
 * @param {object} metrics  элемент из buildDayMetrics()
 * @param {string} periodId nuenen | saintRemy | auvers | mixed
 * @param {HTMLCanvasElement} canvas
 * @param {number} targetWidth ширина холста в пикселях
 */
export const paintDay = (metrics, periodId, canvas, targetWidth = 1100) => {
    const period = periodById(periodId);
    const { spec, paletteId, routing } = resolveSpec(period, metrics);
    const palette = resolvePalette(paletteId, metrics);
    const seed = makeSeed(metrics.day, periodId);

    const W = Math.round(targetWidth);
    const H = Math.round(targetWidth / palette.aspect);
    canvas.width = W;
    canvas.height = H;

    const gridW = spec.automaton.gridWidth;
    const gridH = Math.max(24, Math.round(gridW / palette.aspect));

    const composition = buildComposition(metrics, seed, gridW, gridH);
    const seedField = seedFromSeries(gridW, gridH, metrics.series, seed);
    const automaton = runAutomaton(spec, seedField, gridW, gridH, composition.frozen, metrics.silent);
    const field = buildField(automaton, gridW, gridH);

    const ctx = canvas.getContext('2d');
    const stats = paintCanvas(ctx, W, H, {
        field, composition, palette, brush: spec.brush, metrics, seed
    });

    return {
        day: metrics.day,
        periodId,
        resolvedPeriod: routing ? routing.chosen : periodId,
        routing,
        palette: { title: palette.title, years: palette.years, source: palette.source, meaning: palette.meaning },
        // Провенанс: этого достаточно, чтобы полотно было воспроизведено побайтно.
        provenance: {
            series: SERIES_ID,
            version: SERIES_VERSION,
            seed,
            automaton: spec.automaton,
            horizonY: +composition.horizonY.toFixed(4),
            voids: composition.voids.length,
            ruptures: composition.ruptures.length,
            strokes: stats.strokes,
            silent: !!metrics.silent
        },
        size: { width: W, height: H }
    };
};
