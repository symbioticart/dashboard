import React, { useState, useEffect } from 'react';
import { OuraService } from '../services/ouraService';

const DataDisplay = ({ token }) => {
    const [data, setData] = useState({
        sleep: null,
        activity: null,
        readiness: null,
        stress: null,
        spo2: null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchData = async () => {
        if (!token) return;

        setLoading(true);
        setError('');

        try {
            // Получаем даты для последних 7 дней
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0];

            // Получаем все данные параллельно
            const [sleep, activity, readiness, stress, spo2] = await Promise.all([
                OuraService.getSleepData(startDate, endDate),
                OuraService.getActivityData(startDate, endDate),
                OuraService.getReadinessData(startDate, endDate),
                OuraService.getStressData(startDate, endDate),
                OuraService.getSpO2Data(startDate, endDate)
            ]);

            setData({ sleep, activity, readiness, stress, spo2 });
        } catch (err) {
            setError('Ошибка при получении данных: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]);

    if (!token) {
        return <div>Пожалуйста, введите токен для получения данных</div>;
    }

    if (loading) {
        return <div>Загрузка данных...</div>;
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    return (
        <div className="data-display">
            <h2>Данные Oura Ring</h2>
            
            {/* Сон */}
            <section className="data-section">
                <h3>Сон</h3>
                {data.sleep && (
                    <div className="data-grid">
                        {data.sleep.data.map((day, index) => (
                            <div key={index} className="data-card">
                                <h4>{day.day}</h4>
                                <p>Длительность: {day.deep_sleep_duration / 3600}ч</p>
                                <p>Эффективность: {day.efficiency}%</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Активность */}
            <section className="data-section">
                <h3>Активность</h3>
                {data.activity && (
                    <div className="data-grid">
                        {data.activity.data.map((day, index) => (
                            <div key={index} className="data-card">
                                <h4>{day.day}</h4>
                                <p>Шаги: {day.steps}</p>
                                <p>Калории: {day.calories_active}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Готовность */}
            <section className="data-section">
                <h3>Готовность</h3>
                {data.readiness && (
                    <div className="data-grid">
                        {data.readiness.data.map((day, index) => (
                            <div key={index} className="data-card">
                                <h4>{day.day}</h4>
                                <p>Балл: {day.score}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Стресс */}
            <section className="data-section">
                <h3>Стресс</h3>
                {data.stress && (
                    <div className="data-grid">
                        {data.stress.data.map((day, index) => (
                            <div key={index} className="data-card">
                                <h4>{day.day}</h4>
                                <p>Время в стрессе: {day.stress_duration / 3600}ч</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* SpO2 */}
            <section className="data-section">
                <h3>SpO2</h3>
                {data.spo2 && (
                    <div className="data-grid">
                        {data.spo2.data.map((day, index) => (
                            <div key={index} className="data-card">
                                <h4>{day.day}</h4>
                                <p>Средний SpO2: {day.average_spo2}%</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default DataDisplay; 