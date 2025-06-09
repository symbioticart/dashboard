// Утилиты для кэширования данных

const CACHE_PREFIX = 'oura_cache_';
const CACHE_EXPIRY = 1000 * 60 * 60; // 1 час

// Сохранение данных в кэш
const saveToCache = (key, data) => {
    const cacheItem = {
        data,
        timestamp: Date.now()
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
};

// Получение данных из кэша
const getFromCache = (key) => {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Проверяем, не устарели ли данные
    if (now - timestamp > CACHE_EXPIRY) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
    }

    return data;
};

// Очистка устаревших данных
const clearExpiredCache = () => {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(CACHE_PREFIX)) {
            try {
                const { timestamp } = JSON.parse(localStorage.getItem(key));
                if (now - timestamp > CACHE_EXPIRY) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                // Если данные повреждены, удаляем их
                localStorage.removeItem(key);
            }
        }
    }
};

// Генерация ключа кэша для API запроса
const generateCacheKey = (endpoint, startDate, endDate) => {
    return `${endpoint}_${startDate}_${endDate}`;
};

export {
    saveToCache,
    getFromCache,
    clearExpiredCache,
    generateCacheKey
}; 