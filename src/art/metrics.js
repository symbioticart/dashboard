// Слой данных: сырые ответы Oura → параметры дня.
//
// Два правила канона, которые здесь реализованы буквально:
//
// 1. Нормализация персонально-перцентильная. Значение сигнала само по себе
//    ничего не значит: пульс покоя 52 — это много или мало только внутри
//    собственного распределения владельца. Поэтому каждый параметр
//    пересчитывается в перцентиль по всему загруженному периоду.
//
// 2. Отсутствие данных — не пропуск, а событие. День без данных помечается
//    silent: полотно окаменевает (см. paint.js). Разрыв должен быть виден.

import { clamp } from './rng';

const dayOf = (isoTimestamp) => (isoTimestamp || '').slice(0, 10);

// Перцентиль значения внутри собственного распределения владельца.
// Пустое распределение или единственный день → 0.5: нейтральная середина,
// а не выдуманная крайность.
export const percentileRank = (value, sorted) => {
    if (value == null || !sorted || sorted.length === 0) return 0.5;
    if (sorted.length === 1) return 0.5;
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
        const midIdx = (lo + hi) >> 1;
        if (sorted[midIdx] < value) lo = midIdx + 1;
        else hi = midIdx;
    }
    return clamp(lo / (sorted.length - 1), 0, 1);
};

const sortedNumbers = (values) =>
    values.filter((v) => typeof v === 'number' && isFinite(v)).sort((a, b) => a - b);

// Ряд bpm за календарный день. Это главный посевной материал:
// именно из него берётся начальное состояние клеточного автомата.
const heartRateSeriesByDay = (heartRate) => {
    const byDay = new Map();
    const items = (heartRate && heartRate.data) || [];
    for (const entry of items) {
        if (!entry || typeof entry.bpm !== 'number') continue;
        const day = dayOf(entry.timestamp);
        if (!day) continue;
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(entry.bpm);
    }
    return byDay;
};

const workoutsByDay = (workout) => {
    const byDay = new Map();
    const items = (workout && workout.data) || [];
    for (const w of items) {
        if (!w || !w.day) continue;
        if (!byDay.has(w.day)) byDay.set(w.day, []);
        byDay.get(w.day).push(w);
    }
    return byDay;
};

// Из записи сна забираем и агрегаты, и вложенные пятиминутные ряды
// (heart_rate.items, hrv.items) — они дают ночной ряд, когда общего
// ряда пульса за день мало.
const readSleepRecord = (record) => {
    const total = record.total_sleep_duration || 0;
    const deep = record.deep_sleep_duration || 0;
    const rem = record.rem_sleep_duration || 0;
    const light = record.light_sleep_duration || 0;
    const awake = record.awake_time || 0;
    const span = total + awake;
    const readiness = record.readiness || {};

    return {
        day: record.day,
        totalSleep: total,
        deepFraction: span > 0 ? deep / span : 0,
        remFraction: span > 0 ? rem / span : 0,
        lightFraction: span > 0 ? light / span : 0,
        awakeFraction: span > 0 ? awake / span : 0,
        efficiency: record.efficiency,
        latency: record.latency,
        restlessPeriods: record.restless_periods,
        averageHrv: record.average_hrv,
        lowestHeartRate: record.lowest_heart_rate,
        averageHeartRate: record.average_heart_rate,
        temperatureDeviation:
            typeof readiness.temperature_deviation === 'number'
                ? readiness.temperature_deviation
                : typeof record.temperature_deviation === 'number'
                    ? record.temperature_deviation
                    : null,
        nightHr: ((record.heart_rate && record.heart_rate.items) || []).filter(
            (v) => typeof v === 'number' && isFinite(v)
        ),
        nightHrv: ((record.hrv && record.hrv.items) || []).filter(
            (v) => typeof v === 'number' && isFinite(v)
        ),
        // Позиции пробуждений внутри ночи в долях [0..1] — из них
        // строятся разломы поля. Ряд движения даёт всплески при пробуждении.
        movementPhases: ((record.movement_30_sec || '') + '')
            .split('')
            .map((c, i, arr) => ({ level: Number(c), t: arr.length > 1 ? i / (arr.length - 1) : 0 }))
            .filter((m) => isFinite(m.level) && m.level >= 3)
            .map((m) => m.t)
    };
};

// Сводит все выборки в упорядоченный список дней с сырыми значениями.
const collectRawDays = (data) => {
    const sleepRecords = ((data && data.sleep && data.sleep.data) || [])
        .filter((r) => r && r.day)
        .map(readSleepRecord);

    // На один календарный день Oura может отдать несколько сессий сна.
    // Берём самую длинную — это «ночь», остальное дневной сон.
    const sleepByDay = new Map();
    for (const rec of sleepRecords) {
        const prev = sleepByDay.get(rec.day);
        if (!prev || rec.totalSleep > prev.totalSleep) sleepByDay.set(rec.day, rec);
    }

    const hrByDay = heartRateSeriesByDay(data && data.heartRate);
    const woByDay = workoutsByDay(data && data.workout);

    const present = [...new Set([...sleepByDay.keys(), ...hrByDay.keys(), ...woByDay.keys()])]
        .filter(Boolean)
        .sort();
    if (present.length === 0) return [];

    // Календарь достраивается сплошняком от первого дня до последнего.
    // День, которого нет ни в одной выборке, обязан появиться в списке как
    // молчание: пропущенный день — не отсутствие строки в таблице, а событие.
    // Если его просто не показать, разрыв станет невидимым, а канон требует
    // обратного — смерть и отсутствие должны быть видны.
    const days = [];
    const cursor = new Date(`${present[0]}T00:00:00Z`);
    const last = new Date(`${present[present.length - 1]}T00:00:00Z`);
    while (cursor <= last) {
        days.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days
        .map((day) => {
            const sleep = sleepByDay.get(day) || null;
            const dayHr = hrByDay.get(day) || [];
            const workouts = woByDay.get(day) || [];
            // Посевной ряд: дневной пульс, а если его нет — ночной из записи сна.
            const series = dayHr.length >= 8 ? dayHr : sleep ? sleep.nightHr : [];
            return {
                day,
                sleep,
                series,
                hrvSeries: sleep ? sleep.nightHrv : [],
                calories: workouts.reduce((s, w) => s + (w.calories || 0), 0),
                distance: workouts.reduce((s, w) => s + (w.distance || 0), 0),
                workoutCount: workouts.length,
                // Молчание: за день нет ни сна, ни пульса, ни движения.
                silent: !sleep && dayHr.length === 0 && workouts.length === 0
            };
        });
};

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const stdev = (values) => {
    if (values.length < 2) return 0;
    const m = mean(values);
    return Math.sqrt(mean(values.map((v) => (v - m) * (v - m))));
};

/**
 * Главная функция слоя. Возвращает массив дней, где каждый день несёт
 * и сырые значения (для подписи под работой), и нормированные параметры
 * norm.* в диапазоне [0..1] — именно они управляют автоматом и кистью.
 */
export const buildDayMetrics = (data) => {
    const raw = collectRawDays(data);
    if (raw.length === 0) return [];

    // Собственные распределения владельца по всему загруженному периоду.
    const dist = {
        restingHr: sortedNumbers(raw.map((d) => d.sleep && d.sleep.lowestHeartRate)),
        averageHr: sortedNumbers(raw.map((d) => d.sleep && d.sleep.averageHeartRate)),
        hrv: sortedNumbers(raw.map((d) => d.sleep && d.sleep.averageHrv)),
        efficiency: sortedNumbers(raw.map((d) => d.sleep && d.sleep.efficiency)),
        deep: sortedNumbers(raw.map((d) => d.sleep && d.sleep.deepFraction)),
        rem: sortedNumbers(raw.map((d) => d.sleep && d.sleep.remFraction)),
        awake: sortedNumbers(raw.map((d) => d.sleep && d.sleep.awakeFraction)),
        latency: sortedNumbers(raw.map((d) => d.sleep && d.sleep.latency)),
        restless: sortedNumbers(raw.map((d) => d.sleep && d.sleep.restlessPeriods)),
        totalSleep: sortedNumbers(raw.map((d) => d.sleep && d.sleep.totalSleep)),
        calories: sortedNumbers(raw.map((d) => d.calories)),
        // Разброс дневного пульса — насколько день был «рваным».
        hrSpread: sortedNumbers(raw.map((d) => (d.series.length > 2 ? stdev(d.series) : null))),
        temperature: sortedNumbers(raw.map((d) => d.sleep && d.sleep.temperatureDeviation))
    };

    return raw.map((d, index) => {
        const s = d.sleep;
        const p = (value, key) => percentileRank(value, dist[key]);

        const norm = {
            // Нервная система как погода поля: высокий HRV — живой автомат,
            // низкий — застывший, вязкий.
            hrv: s ? p(s.averageHrv, 'hrv') : 0.5,
            restingHr: s ? p(s.lowestHeartRate, 'restingHr') : 0.5,
            averageHr: s ? p(s.averageHeartRate, 'averageHr') : 0.5,
            // Глубокий сон — область, куда волна не заходит: провал сознания.
            deep: s ? p(s.deepFraction, 'deep') : 0.5,
            rem: s ? p(s.remFraction, 'rem') : 0.5,
            // Бодрствование внутри ночи — источник разломов.
            awake: s ? p(s.awakeFraction, 'awake') : 0.5,
            efficiency: s ? p(s.efficiency, 'efficiency') : 0.5,
            latency: s ? p(s.latency, 'latency') : 0.5,
            restless: s ? p(s.restlessPeriods, 'restless') : 0.5,
            totalSleep: s ? p(s.totalSleep, 'totalSleep') : 0.5,
            // Усилие тела — длина и энергия мазка, толщина краски.
            effort: p(d.calories, 'calories'),
            spread: d.series.length > 2 ? p(stdev(d.series), 'hrSpread') : 0.5,
            // Температурное отклонение сдвигает палитру: земля ↔ кобальт.
            temperature: s && s.temperatureDeviation != null ? p(s.temperatureDeviation, 'temperature') : 0.5
        };

        // Доля суток во сне — из неё берётся линия горизонта:
        // граница сна и бодрствования становится границей земли и неба.
        const sleepShare = s && s.totalSleep ? clamp(s.totalSleep / 86400, 0.05, 0.6) : 0.28;

        return {
            day: d.day,
            index,
            silent: d.silent,
            series: d.series,
            hrvSeries: d.hrvSeries,
            sleepShare,
            ruptures: s ? s.movementPhases : [],
            norm,
            // Сырые значения — для экспликации под работой. Работа
            // свидетельствует данные, а не прячет их.
            raw: {
                totalSleepHours: s && s.totalSleep ? +(s.totalSleep / 3600).toFixed(2) : null,
                deepSleepHours: s ? +(((s.deepFraction * (s.totalSleep || 0)) / 3600) || 0).toFixed(2) : null,
                efficiency: s ? s.efficiency : null,
                averageHrv: s ? s.averageHrv : null,
                lowestHeartRate: s ? s.lowestHeartRate : null,
                averageHeartRate: s ? s.averageHeartRate : null,
                restlessPeriods: s ? s.restlessPeriods : null,
                calories: d.calories || null,
                workoutCount: d.workoutCount,
                hrSamples: d.series.length
            }
        };
    });
};
