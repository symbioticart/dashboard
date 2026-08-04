import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDayMetrics } from '../art/metrics';
import { PERIODS } from '../art/periods';
import { paintDay } from '../art/paint';

const PREVIEW_WIDTH = 760;

// Стоимость письма растёт как куб масштаба: число мазков идёт с площадью,
// а цена мазка — с его длиной и шириной в пикселях. Замеры на этой машине:
// 760px ≈ 1 с, 1400px ≈ 9 с, 2000px ≈ 23 с. Поэтому размеры экспорта
// объявлены явно, со временем ожидания, а не спрятаны за одной кнопкой.
const EXPORT_SIZES = [
    { width: 1400, label: '1400px', hint: '≈10 с' },
    { width: 2400, label: '2400px', hint: '≈40 с' }
];

// Один холст на период. Рендер вынесен наружу и запускается по очереди,
// иначе четыре автомата подряд вешают поток.
const PaintingCard = ({ period, metrics, result, onExport, busy }) => {
    return (
        <figure className="painting-card">
            <canvas className="painting-canvas" data-period={period.id} />
            <figcaption>
                <div className="painting-title">
                    <strong>{period.title}</strong>
                    <span className="painting-sub">{period.subtitle}</span>
                </div>
                {result && (
                    <>
                        <p className="painting-meaning">{result.palette.meaning}</p>
                        <dl className="painting-provenance">
                            <div>
                                <dt>Холсты-источники</dt>
                                <dd>{result.palette.source}</dd>
                            </div>
                            <div>
                                <dt>Правило</dt>
                                <dd>{describeAutomaton(result.provenance.automaton)}</dd>
                            </div>
                            <div>
                                <dt>Семя</dt>
                                <dd>
                                    {result.provenance.seed} · {result.provenance.strokes} мазков ·{' '}
                                    {result.provenance.voids} пустот · {result.provenance.ruptures} разломов
                                </dd>
                            </div>
                            {result.routing && (
                                <div>
                                    <dt>Выбор языка</dt>
                                    <dd>
                                        данные дня выбрали «{result.resolvedPeriod}»
                                        {' — '}
                                        {Object.entries(result.routing.scores)
                                            .map(([k, v]) => `${k} ${v.toFixed(2)}`)
                                            .join(', ')}
                                    </dd>
                                </div>
                            )}
                            {result.provenance.silent && (
                                <div>
                                    <dt>Молчание</dt>
                                    <dd>за этот день данных нет — полотно окаменело на грунте</dd>
                                </div>
                            )}
                        </dl>
                    </>
                )}
                <div className="painting-actions">
                    {EXPORT_SIZES.map((size) => (
                        <button
                            key={size.width}
                            className="btn btn-primary"
                            disabled={busy || !metrics}
                            onClick={() => onExport(period.id, size.width)}
                        >
                            PNG {size.label} <span className="btn-hint">{size.hint}</span>
                        </button>
                    ))}
                </div>
            </figcaption>
        </figure>
    );
};

const describeAutomaton = (a) => {
    if (a.type === 'cyclic') {
        return `циклический автомат: ${a.states} состояний, порог ${a.threshold}, радиус ${a.range}, ${a.steps} шагов`;
    }
    if (a.type === 'grayScott') {
        return `реакция-диффузия: F=${a.feed.toFixed(4)}, k=${a.kill.toFixed(4)}, ${a.steps} шагов`;
    }
    return `life-подобное правило «${a.rule.name}» (B${a.rule.birth.join('')}/S${a.rule.survive.join(
        ''
    )}), плотность посева ${a.density.toFixed(2)}, ${a.steps} поколений`;
};

// Сохранение готового холста. Вынесено из компонента: не зависит ни от
// какого состояния, а внутри создавало бы новую ссылку на каждый рендер.
const downloadCanvas = (canvas, day, periodId, result) => {
    canvas.toBlob((blob) => {
        if (!blob) return;
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `${result.provenance.series}_${day}_${periodId}_seed${result.provenance.seed}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    }, 'image/png');
};

const PaintingSeries = ({ data }) => {
    const days = useMemo(() => buildDayMetrics(data), [data]);
    const [selectedDay, setSelectedDay] = useState(null);
    const [results, setResults] = useState({});
    const [progress, setProgress] = useState(null);
    const containerRef = useRef(null);
    const runRef = useRef(0);

    // По умолчанию — последний день загруженного периода.
    useEffect(() => {
        if (days.length === 0) {
            setSelectedDay(null);
            return;
        }
        setSelectedDay((prev) => (prev && days.some((d) => d.day === prev) ? prev : days[days.length - 1].day));
    }, [days]);

    const metrics = useMemo(() => days.find((d) => d.day === selectedDay) || null, [days, selectedDay]);

    // Рендер по одному полотну за кадр: автоматы считаются на главном потоке,
    // и без пауз интерфейс замерзает на несколько секунд.
    useEffect(() => {
        if (!metrics || !containerRef.current) return;
        const run = ++runRef.current;
        let cancelled = false;
        setResults({});

        const renderNext = (index) => {
            if (cancelled || run !== runRef.current) return;
            if (index >= PERIODS.length) {
                setProgress(null);
                return;
            }
            const period = PERIODS[index];
            setProgress({ index, total: PERIODS.length, title: period.title });
            const canvas = containerRef.current.querySelector(`canvas[data-period="${period.id}"]`);
            if (!canvas) {
                setTimeout(() => renderNext(index + 1), 0);
                return;
            }
            let result = null;
            try {
                result = paintDay(metrics, period.id, canvas, PREVIEW_WIDTH);
            } catch (err) {
                // Один сбойный период не должен уносить остальные три.
                console.error(`Не удалось написать полотно «${period.title}»`, err);
            }
            if (cancelled || run !== runRef.current) return;
            if (result) setResults((prev) => ({ ...prev, [period.id]: result }));
            setTimeout(() => renderNext(index + 1), 0);
        };

        const timer = setTimeout(() => renderNext(0), 0);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [metrics]);

    const handleExport = useCallback(
        (periodId, width) => {
            if (!metrics) return;
            // Письмо блокирует поток на десятки секунд. Сначала отдаём кадр,
            // чтобы кнопки успели отрисоваться заблокированными, — иначе
            // страница просто молча замирает.
            setProgress({ index: 0, total: 1, title: `экспорт ${width}px` });
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                const result = paintDay(metrics, periodId, canvas, width);
                downloadCanvas(canvas, metrics.day, periodId, result);
                setProgress(null);
            }, 32);
        },
        [metrics]
    );


    // Провенанс всей серии дня — то, что уходит в сертификат.
    const handleExportProvenance = useCallback(() => {
        if (!metrics) return;
        const payload = {
            day: metrics.day,
            normalized: metrics.norm,
            raw: metrics.raw,
            sleepShare: metrics.sleepShare,
            silent: metrics.silent,
            paintings: results
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `van-gogh-ca_${metrics.day}_provenance.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    }, [metrics, results]);

    if (days.length === 0) {
        return (
            <section className="data-section">
                <h3>Серия «van Gogh / клеточные автоматы»</h3>
                <p>Нет данных для письма. Загрузите период выше — один день даёт одно полотно.</p>
            </section>
        );
    }

    return (
        <section className="data-section painting-series">
            <h3>Серия «van Gogh / клеточные автоматы»</h3>
            <p className="series-note">
                Один день = одно полотно. Начальное состояние автомата целиком вычислено из ряда пульса за
                этот день — ни одного обращения к случайности во всей серии. Правило разворачивает день во
                времени, поле автомата задаёт направление мазка, глубокий сон становится пустотами, куда
                волна не заходит, пробуждения — разломами поля. Цвет здесь работает как цитата: палитра
                мёртвого художника, наложенная на живые данные. Основная линия Symbiotic Art остаётся
                grayscale.
            </p>

            <div className="series-controls">
                <label htmlFor="painting-day">День:</label>
                <select
                    id="painting-day"
                    className="form-control"
                    style={{ width: 'auto' }}
                    value={selectedDay || ''}
                    onChange={(e) => setSelectedDay(e.target.value)}
                >
                    {days.map((d) => (
                        <option key={d.day} value={d.day}>
                            {d.day}
                            {d.silent ? ' — молчание' : ''}
                        </option>
                    ))}
                </select>
                <button className="btn btn-primary" onClick={handleExportProvenance} disabled={!metrics}>
                    Экспортировать провенанс .json
                </button>
                {progress && (
                    <span className="series-progress">
                        пишется {progress.index + 1}/{progress.total}: {progress.title}…
                    </span>
                )}
            </div>

            {metrics && (
                <dl className="series-metrics">
                    <div>
                        <dt>Сон</dt>
                        <dd>
                            {metrics.raw.totalSleepHours != null ? `${metrics.raw.totalSleepHours} ч` : '—'}
                            {metrics.raw.efficiency != null ? `, эффективность ${metrics.raw.efficiency}%` : ''}
                        </dd>
                    </div>
                    <div>
                        <dt>HRV / пульс покоя</dt>
                        <dd>
                            {metrics.raw.averageHrv != null ? metrics.raw.averageHrv : '—'} /{' '}
                            {metrics.raw.lowestHeartRate != null ? metrics.raw.lowestHeartRate : '—'}
                        </dd>
                    </div>
                    <div>
                        <dt>Усилие</dt>
                        <dd>
                            {metrics.raw.calories != null ? `${metrics.raw.calories} ккал` : '—'}
                            {metrics.raw.workoutCount ? `, ${metrics.raw.workoutCount} тренировки` : ''}
                        </dd>
                    </div>
                    <div>
                        <dt>Посев</dt>
                        <dd>{metrics.raw.hrSamples} измерений пульса</dd>
                    </div>
                </dl>
            )}

            <div className="painting-grid" ref={containerRef}>
                {PERIODS.map((period) => (
                    <PaintingCard
                        key={period.id}
                        period={period}
                        metrics={metrics}
                        result={results[period.id]}
                        onExport={handleExport}
                        busy={!!progress}
                    />
                ))}
            </div>
        </section>
    );
};

export default PaintingSeries;
