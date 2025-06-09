import React, { useState, useEffect, useCallback } from 'react';
import { OuraService } from '../services/ouraService';

// Helper function to format date to YYYY-MM-DD
const getFormattedDate = (date) => date.toISOString().split('T')[0];

const DataDisplay = ({ token }) => {
    const [data, setData] = useState({
        sleep: null,
        heartRate: null,
        workout: null,
        personalInfo: null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Calculate initial start date (7 days ago) and end date (current date)
    const initialFetchEndDate = new Date();
    const initialFetchStartDate = new Date(initialFetchEndDate);
    initialFetchStartDate.setDate(initialFetchEndDate.getDate() - 7);

    // State for the date picker
    const [selectedStartDate, setSelectedStartDate] = useState(getFormattedDate(initialFetchStartDate));
    // State to store the actual end date used for the last successful fetch (current date)
    const [actualFetchEndDate, setActualFetchEndDate] = useState(getFormattedDate(initialFetchEndDate));

    const fetchData = useCallback(async () => {
        if (!token || !selectedStartDate) return; // Ensure token and start date are available

        setLoading(true);
        setError('');

        try {
            // Always fetch data up to the current date
            const currentEndDate = getFormattedDate(new Date());
            setActualFetchEndDate(currentEndDate); // Update actualFetchEndDate state for export naming

            const [sleep, heartRate, workout, personalInfo] = await Promise.all([
                OuraService.getSleepData(selectedStartDate, currentEndDate),
                OuraService.getHeartRateData(selectedStartDate, currentEndDate),
                OuraService.getWorkoutData(selectedStartDate, currentEndDate),
                OuraService.getPersonalInfo()
            ]);

            setData({ sleep, heartRate, workout, personalInfo });
        } catch (err) {
            setError('Ошибка при получении данных: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [token, selectedStartDate]); // Depend on token and selectedStartDate

    useEffect(() => {
        if (token && selectedStartDate) {
            fetchData();
        }
    }, [token, selectedStartDate, fetchData]); // Add selectedStartDate to dependencies

    const handleExportData = () => {
        // Use selectedStartDate and actualFetchEndDate for the filename
        const filename = `oura_data_${selectedStartDate}_to_${actualFetchEndDate}.json`;
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    };

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

            <div className="date-picker-container" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <label htmlFor="startDate">Начальная дата:</label>
                <input
                    type="date"
                    id="startDate"
                    value={selectedStartDate}
                    onChange={(e) => setSelectedStartDate(e.target.value)}
                    className="form-control"
                    // Optional: set max date to current date
                    max={getFormattedDate(new Date())}
                    style={{ width: 'auto' }}
                />
                <p style={{ display: 'inline-block', margin: '0' }}>Конечная дата: {actualFetchEndDate}</p>
                {data.sleep || data.heartRate || data.workout || data.personalInfo ? (
                    <button onClick={handleExportData} className="btn btn-primary" style={{ marginLeft: 'auto' }}>
                        Экспортировать данные в .json
                    </button>
                ) : null}
            </div>
            
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

            {/* Пульс */}
            <section className="data-section">
                <h3>Пульс</h3>
                {data.heartRate && (data.heartRate.data && data.heartRate.data.length > 0 ? (
                    <div className="data-grid">
                        {data.heartRate.data.slice(0, 7).map((entry, index) => (
                            <div key={index} className="data-card">
                                <h4>{new Date(entry.timestamp).toLocaleDateString()}</h4>
                                <p>BPM: {entry.bpm}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>Нет данных о пульсе за последние 7 дней.</p>
                ))}
            </section>

            {/* Тренировки */}
            <section className="data-section">
                <h3>Тренировки</h3>
                {data.workout && (data.workout.data && data.workout.data.length > 0 ? (
                    <div className="data-grid">
                        {data.workout.data.map((workout, index) => (
                            <div key={index} className="data-card">
                                <h4>{workout.day} - {workout.activity}</h4>
                                <p>Калории: {workout.calories}</p>
                                <p>Дистанция: {workout.distance ? `${(workout.distance / 1000).toFixed(2)} км` : 'N/A'}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>Нет данных о тренировках за последние 7 дней.</p>
                ))}
            </section>

            {/* Личная информация */}
            <section className="data-section">
                <h3>Личная информация</h3>
                {data.personalInfo && (
                    <div className="data-grid">
                        <div className="data-card">
                            <p>Возраст: {data.personalInfo.age}</p>
                            <p>Вес: {data.personalInfo.weight} кг</p>
                            <p>Рост: {data.personalInfo.height} м</p>
                            <p>Пол: {data.personalInfo.biological_sex}</p>
                            <p>Email: {data.personalInfo.email}</p>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

export default DataDisplay; 