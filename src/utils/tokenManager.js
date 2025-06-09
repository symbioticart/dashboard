// Token Manager для работы с Personal Access Tokens

const TOKEN_STORAGE_KEY = 'oura_personal_access_token';

export const TokenManager = {
    // Сохранение токена в localStorage
    saveToken: (token) => {
        try {
            localStorage.setItem(TOKEN_STORAGE_KEY, token);
            return true;
        } catch (error) {
            console.error('Error saving token:', error);
            return false;
        }
    },

    // Получение токена из localStorage
    getToken: () => {
        try {
            return localStorage.getItem(TOKEN_STORAGE_KEY);
        } catch (error) {
            console.error('Error getting token:', error);
            return null;
        }
    },

    // Удаление токена
    removeToken: () => {
        try {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Error removing token:', error);
            return false;
        }
    },

    // Проверка наличия токена
    hasToken: () => {
        return !!TokenManager.getToken();
    }
}; 