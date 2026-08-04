import React, { useCallback, useState } from 'react';
import TokenInput from './components/TokenInput';
import DataDisplay from './components/DataDisplay';
import PaintingSeries from './components/PaintingSeries';
import './App.css';

function App() {
    const [token, setToken] = useState(null);
    const [data, setData] = useState(null);

    const handleTokenSaved = (newToken) => {
        setToken(newToken);
    };

    // Ссылка должна быть стабильной: DataDisplay зовёт её из fetchData,
    // и новая функция на каждый рендер увела бы загрузку в цикл.
    const handleDataLoaded = useCallback((fetched) => {
        setData(fetched);
    }, []);

    return (
        <div className="app">
            <header className="app-header">
                <h1>Oura Ring Data Dashboard</h1>
            </header>
            <main className="app-main">
                <TokenInput onTokenSaved={handleTokenSaved} />
                <DataDisplay token={token} onDataLoaded={handleDataLoaded} />
                {data && <PaintingSeries data={data} />}
            </main>
        </div>
    );
}

export default App;
