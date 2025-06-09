import { TokenManager } from '../utils/tokenManager';

const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://corsproxy.io/?https://api.ouraring.com/v2'
    : '/v2';

export const OuraService = {
    // Получение данных о сне
    getSleepData: async (startDate, endDate) => {
        const token = TokenManager.getToken();
        if (!token) throw new Error('No token available');

        const response = await fetch(
            `${API_BASE_URL}/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch sleep data');
        return response.json();
    },

    // Получение данных о пульсе
    getHeartRateData: async (startDate, endDate) => {
        const token = TokenManager.getToken();
        if (!token) throw new Error('No token available');

        const response = await fetch(
            `${API_BASE_URL}/usercollection/heartrate?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch heart rate data');
        return response.json();
    },

    // Получение данных о тренировках
    getWorkoutData: async (startDate, endDate) => {
        const token = TokenManager.getToken();
        if (!token) throw new Error('No token available');

        const response = await fetch(
            `${API_BASE_URL}/usercollection/workout?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch workout data');
        return response.json();
    },

    // Получение личной информации
    getPersonalInfo: async () => {
        const token = TokenManager.getToken();
        if (!token) throw new Error('No token available');

        const response = await fetch(
            `${API_BASE_URL}/usercollection/personal_info`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch personal info');
        return response.json();
    }
}; 