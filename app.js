// Импорты
import { validateOuraToken, saveSecureToken, getSecureToken, removeSecureToken } from './src/utils/security.js';
import { saveToCache, getFromCache, clearExpiredCache, generateCacheKey } from './src/utils/cache.js';

// Константы
const API_BASE_URL = 'https://api.ouraring.com/v2';

// DOM элементы
const tokenForm = document.getElementById('tokenForm');
const tokenInput = document.getElementById('token');
const removeTokenBtn = document.getElementById('removeToken');
const errorMessage = document.getElementById('errorMessage');
const loadingMessage = document.getElementById('loadingMessage');
const errorDisplay = document.getElementById('errorDisplay');
const dataContent = document.getElementById('dataContent');

// Функции для работы с API
const OuraService = {
    async fetchData(endpoint, startDate, endDate) {
        const token = getSecureToken();
        if (!token) throw new Error('No token available');

        // Проверяем кэш
        const cacheKey = generateCacheKey(endpoint, startDate, endDate);
        const cachedData = getFromCache(cacheKey);
        if (cachedData) {
            console.log('Using cached data for:', endpoint);
            return cachedData;
        }

        console.log('Fetching fresh data for:', endpoint);
        const response = await fetch(
            `${API_BASE_URL}/usercollection/${endpoint}?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`Failed to fetch ${endpoint} data: ${responseText}`);
        }
        
        const data = await response.json();
        
        // Сохраняем в кэш
        saveToCache(cacheKey, data);
        
        return data;
    }
};

// Функции для отображения данных
const DataDisplay = {
    showLoading() {
        loadingMessage.style.display = 'block';
        errorDisplay.style.display = 'none';
        dataContent.innerHTML = '';
    },

    showError(message) {
        loadingMessage.style.display = 'none';
        errorDisplay.style.display = 'block';
        errorDisplay.textContent = message;
        dataContent.innerHTML = '';
    },

    showData(data) {
        loadingMessage.style.display = 'none';
        errorDisplay.style.display = 'none';
        
        let html = '';
        
        // Сон
        if (data.sleep) {
            html += this.createSection('Сон', data.sleep.data, (day) => `
                <p>Длительность: ${(day.deep_sleep_duration / 3600).toFixed(1)}ч</p>
                <p>Эффективность: ${day.efficiency}%</p>
            `);
        }

        // Активность
        if (data.activity) {
            html += this.createSection('Активность', data.activity.data, (day) => `
                <p>Шаги: ${day.steps}</p>
                <p>Калории: ${day.calories_active}</p>
            `);
        }

        // Готовность
        if (data.readiness) {
            html += this.createSection('Готовность', data.readiness.data, (day) => `
                <p>Балл: ${day.score}</p>
            `);
        }

        // Стресс
        if (data.stress) {
            html += this.createSection('Стресс', data.stress.data, (day) => `
                <p>Время в стрессе: ${(day.stress_duration / 3600).toFixed(1)}ч</p>
            `);
        }

        // SpO2
        if (data.spo2) {
            html += this.createSection('SpO2', data.spo2.data, (day) => `
                <p>Средний SpO2: ${day.average_spo2}%</p>
            `);
        }

        dataContent.innerHTML = html;
    },

    createSection(title, data, renderCard) {
        return `
            <section class="data-section">
                <h3>${title}</h3>
                <div class="data-grid">
                    ${data.map(day => `
                        <div class="data-card">
                            <h4>${day.day}</h4>
                            ${renderCard(day)}
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }
};

// Обработчики событий
tokenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = tokenInput.value.trim();

    if (!token) {
        errorMessage.textContent = 'Пожалуйста, введите токен';
        return;
    }

    try {
        if (!validateOuraToken(token)) {
            errorMessage.textContent = 'Неверный формат токена';
            return;
        }

        saveSecureToken(token);
        errorMessage.textContent = '';
        removeTokenBtn.style.display = 'block';
        await fetchAndDisplayData();
    } catch (error) {
        errorMessage.textContent = 'Ошибка при сохранении токена: ' + error.message;
    }
});

removeTokenBtn.addEventListener('click', () => {
    try {
        removeSecureToken();
        tokenInput.value = '';
        removeTokenBtn.style.display = 'none';
        dataContent.innerHTML = '';
        clearExpiredCache(); // Очищаем кэш при удалении токена
    } catch (error) {
        errorMessage.textContent = 'Ошибка при удалении токена: ' + error.message;
    }
});

// Функция для получения и отображения данных
async function fetchAndDisplayData() {
    if (!getSecureToken()) return;

    DataDisplay.showLoading();

    try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

        const [sleep, activity, readiness, stress, spo2] = await Promise.all([
            OuraService.fetchData('sleep', startDate, endDate),
            OuraService.fetchData('activity', startDate, endDate),
            OuraService.fetchData('readiness', startDate, endDate),
            OuraService.fetchData('stress', startDate, endDate),
            OuraService.fetchData('spo2', startDate, endDate)
        ]);

        DataDisplay.showData({ sleep, activity, readiness, stress, spo2 });
    } catch (error) {
        DataDisplay.showError('Ошибка при получении данных: ' + error.message);
    }
}

// Инициализация
function init() {
    const savedToken = getSecureToken();
    if (savedToken) {
        tokenInput.value = savedToken;
        removeTokenBtn.style.display = 'block';
        fetchAndDisplayData();
    }
}

// Запуск приложения
init(); 