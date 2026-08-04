// Четыре периода = четыре пластических языка = четыре автомата.
//
// Здесь живёт карта данных: какой сигнал Oura управляет каким параметром
// правила и каким свойством мазка. Ни один параметр не выставлен «на глаз» —
// у каждого есть сигнал и смысл. Это требование канона: data→parameter,
// никакой декоративной случайности.

import { clamp, lerp } from './rng';
import { HATCH_RULES } from './automata';

// Общая грамматика мазка: усилие тела задаёт длину и толщину краски,
// разброс пульса — разнобой, глубина сна — тишину незакрашенного холста.
const commonBrush = (n) => ({
    effort: n.effort,
    spread: n.spread,
    restless: n.restless
});

export const PERIODS = [
    {
        id: 'nuenen',
        paletteId: 'nuenen',
        automaton: 'hatch',
        title: 'Нюэнен',
        subtitle: 'life-подобный автомат с накоплением',
        // Плетение, а не поток: правило выбирается по эффективности сна —
        // от рассыпанного зерна «жизни» до крупных цельных масс «голосования».
        // Связная ночь даёт связную форму, рваная — рассыпанное поле.
        configure: (n) => ({
            automaton: {
                type: 'hatch',
                rule: HATCH_RULES[clamp(Math.floor(n.efficiency * HATCH_RULES.length), 0, HATCH_RULES.length - 1)],
                density: 0.22 + n.effort * 0.34,
                steps: Math.round(18 + n.totalSleep * 42),
                // Решётка намеренно грубая: клетка крупнее мазка, иначе
                // плетение автомата уходит под масштаб кисти и остаётся шумом.
                gridWidth: 110
            },
            brush: {
                ...commonBrush(n),
                // Штриховка: два господствующих угла вместо потока.
                // Крест-накрест — то, чем Нюэнен держит плотность без вихря.
                mode: 'hatch',
                hatchAngle: lerp(-0.9, -0.35, n.averageHr),
                hatchSpread: 0.12 + n.spread * 0.22,
                fieldWeight: 0.3,
                strokeDensity: 1,
                lengthBase: 0.030 + n.effort * 0.022,
                widthBase: 0.0072 + n.effort * 0.0032,
                bristles: 4,
                curl: 0.1,
                skyLength: 1.15,
                earthLength: 0.8,
                impasto: 0.55 + n.effort * 0.5,
                // Лампа в «Едоках картофеля» одна. Акцент допускается только
                // на самом светлом участке поля, иначе свет рассыпается
                // по холсту искрами и перестаёт быть источником.
                accentRate: 0.3,
                accentValue: 0.93
            }
        })
    },
    {
        id: 'saintRemy',
        paletteId: 'saintRemy',
        automaton: 'cyclic',
        title: 'Сен-Реми, ночь',
        subtitle: 'циклический клеточный автомат (Griffeath, 1988)',
        // Вихрь не нарисован — он следствие правила. Число состояний растёт
        // с HRV: живая нервная система даёт богатую фазу и тонкие спирали,
        // подавленная — грубые, застывшие блоки.
        configure: (n) => ({
            automaton: {
                type: 'cyclic',
                states: Math.round(10 + n.hrv * 8),
                threshold: Math.round(1 + (1 - n.hrv) * 2),
                range: n.restingHr > 0.7 ? 2 : 1,
                steps: Math.round(38 + n.restingHr * 76),
                gridWidth: 190
            },
            brush: {
                ...commonBrush(n),
                mode: 'flow',
                fieldWeight: 1,
                strokeDensity: 1.15,
                lengthBase: 0.055 + n.hrv * 0.055,
                widthBase: 0.0058 + n.effort * 0.0030,
                bristles: 5,
                curl: 0.85 + n.hrv * 0.5,
                // Небо «Звёздной ночи» написано длинным ведущим мазком,
                // кипарис и поле — коротким.
                skyLength: 1.45,
                earthLength: 0.62,
                impasto: 0.85 + n.effort * 0.6,
                accentRate: 0.14 + n.rem * 0.1,
                accentValue: 0.66
            }
        })
    },
    {
        id: 'auvers',
        paletteId: 'auvers',
        automaton: 'grayScott',
        title: 'Овер',
        subtitle: 'реакция-диффузия Грея — Скотта',
        // Подача растёт с рваностью дня, убыль падает с долей бодрствования
        // внутри ночи — чем беспокойнее ночь, тем сильнее поле рвётся.
        configure: (n) => ({
            automaton: {
                type: 'grayScott',
                // Диапазон выверен прогоном: при F ≳ 0.030 реакция гаснет
                // и поле вырождается в равномерную заливку. Здесь оба
                // параметра держатся в живой полосе при любых данных —
                // день не должен уметь убить работу.
                feed: 0.012 + n.spread * 0.009,
                kill: 0.043 + (1 - n.awake) * 0.005,
                steps: Math.round(250 + n.effort * 350),
                // Решётка мельче мазка: реакция-диффузия работает как грунтовая
                // фактура под кистью, а не как самостоятельный узор. Крупные
                // разборчивые кольца сразу читаются как «генеративная картинка»
                // и убивают живописное чтение.
                gridWidth: 320
            },
            brush: {
                ...commonBrush(n),
                mode: 'flow',
                fieldWeight: 0.85,
                strokeDensity: 1.2,
                // Короткий рубленый мазок Овера.
                lengthBase: 0.024 + n.effort * 0.018,
                widthBase: 0.0052 + n.effort * 0.0026,
                bristles: 3,
                curl: 0.35,
                // Грозовое небо тянется горизонталью, пшеница рубится в клочья.
                skyLength: 1.5,
                earthLength: 0.55,
                // Мазок обрывается на разломе, а не переползает его.
                breakOnEdge: true,
                impasto: 0.7 + n.effort * 0.55,
                // Вороны садятся стаей, а не поодиночке.
                accentRate: 0.13 + n.restless * 0.08,
                accentValue: 0.7
            }
        })
    },
    {
        id: 'mixed',
        automaton: 'routed',
        title: 'Смешанная система',
        subtitle: 'период выбирают данные дня',
        // Четвёртый вариант не имеет своего языка: он выбирает язык по дню.
        // Тяжёлый, землистый день уходит в Нюэнен; рваный — в Овер;
        // живой — в Сен-Реми. Правило выбора детерминировано и объявлено.
        route: (n) => {
            const scores = {
                nuenen: 0.45 * (1 - n.hrv) + 0.3 * n.deep + 0.25 * (1 - n.effort),
                auvers: 0.5 * n.awake + 0.3 * n.restless + 0.2 * n.spread,
                saintRemy: 0.4 * n.hrv + 0.3 * n.rem + 0.3 * n.efficiency
            };
            let best = 'saintRemy';
            for (const key of Object.keys(scores)) if (scores[key] > scores[best]) best = key;
            return { chosen: best, scores };
        }
    }
];

export const periodById = (id) => PERIODS.find((p) => p.id === id);
