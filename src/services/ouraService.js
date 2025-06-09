import { TokenManager } from '../utils/tokenManager';

const API_BASE_URL = 'https://api.ouraring.com/v2';

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

    // Получение данных об активности
    getActivityData: async (startDate, endDate) => {
        const token = TokenManager.getToken();
        if (!token) throw new Error('No token available');

        const response = await fetch(
            `${API_BASE_URL}/usercollection/activity?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch activity data');
        return response.json();
    },

    // Получение данных о готовности
    getReadinessData: async (startDate, endDate) => {
        const token = TokenManager.getToken();
        if (!token) throw new Error('No token available');

        const response = await fetch(
            `${API_BASE_URL}/usercollection/readiness?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch readiness data');
        return response.json();
    },

    // Получение данных о стрессе
    getStressData: async (startDate, endDate) => {
        const token = TokenManager.getToken();
        if (!token) throw new Error('No token available');

        const response = await fetch(
            `${API_BASE_URL}/usercollection/stress?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch stress data');
        return response.json();
    },

    // Получение данных о SpO2
    getSpO2Data: async (startDate, endDate) => {
        const token = TokenManager.getToken();
        if (!token) throw new Error('No token available');

        const response = await fetch(
            `${API_BASE_URL}/usercollection/spo2?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch SpO2 data');
        return response.json();
    }
}; 