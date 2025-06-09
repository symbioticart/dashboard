import React, { useState, useEffect } from 'react';
import { TokenManager } from '../utils/tokenManager';

const TokenInput = ({ onTokenSaved }) => {
    const [token, setToken] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // Проверяем наличие сохраненного токена при загрузке
        const savedToken = TokenManager.getToken();
        if (savedToken) {
            setToken(savedToken);
            onTokenSaved(savedToken);
        }
    }, [onTokenSaved]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!token.trim()) {
            setError('Пожалуйста, введите токен');
            return;
        }

        if (TokenManager.saveToken(token)) {
            onTokenSaved(token);
        } else {
            setError('Ошибка при сохранении токена');
        }
    };

    const handleRemoveToken = () => {
        if (TokenManager.removeToken()) {
            setToken('');
            onTokenSaved(null);
        } else {
            setError('Ошибка при удалении токена');
        }
    };

    return (
        <div className="token-input-container">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="token">Personal Access Token:</label>
                    <input
                        type="text"
                        id="token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Введите ваш токен"
                        className="form-control"
                    />
                </div>
                {error && <div className="error-message">{error}</div>}
                <div className="button-group">
                    <button type="submit" className="btn btn-primary">
                        Сохранить токен
                    </button>
                    {TokenManager.hasToken() && (
                        <button
                            type="button"
                            onClick={handleRemoveToken}
                            className="btn btn-danger"
                        >
                            Удалить токен
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default TokenInput; 