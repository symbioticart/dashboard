// Утилиты для безопасности

// Простая функция шифрования (в реальном приложении используйте более надежное решение)
const encrypt = (text) => {
    return btoa(text); // Базовое кодирование в base64
};

const decrypt = (text) => {
    return atob(text); // Декодирование из base64
};

// Валидация токена Oura
const validateOuraToken = (token) => {
    // Проверяем базовый формат токена
    if (!token || typeof token !== 'string') {
        return false;
    }

    // Проверяем длину (типичная длина токена Oura)
    if (token.length < 20 || token.length > 100) {
        return false;
    }

    // Проверяем, что токен содержит только допустимые символы
    const validTokenRegex = /^[A-Za-z0-9-_]+$/;
    return validTokenRegex.test(token);
};

// Безопасное сохранение токена
const saveSecureToken = (token) => {
    if (!validateOuraToken(token)) {
        throw new Error('Invalid token format');
    }
    const encryptedToken = encrypt(token);
    localStorage.setItem('oura_personal_access_token', encryptedToken);
};

// Безопасное получение токена
const getSecureToken = () => {
    const encryptedToken = localStorage.getItem('oura_personal_access_token');
    if (!encryptedToken) return null;
    return decrypt(encryptedToken);
};

// Удаление токена
const removeSecureToken = () => {
    localStorage.removeItem('oura_personal_access_token');
};

export {
    validateOuraToken,
    saveSecureToken,
    getSecureToken,
    removeSecureToken
}; 