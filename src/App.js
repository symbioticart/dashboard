import React, { useState } from 'react';
import TokenInput from './components/TokenInput';
import DataDisplay from './components/DataDisplay';
import './App.css';

function App() {
    const [token, setToken] = useState(null);

    const handleTokenSaved = (newToken) => {
        setToken(newToken);
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>Oura Ring Data Dashboard</h1>
            </header>
            <main className="app-main">
                <TokenInput onTokenSaved={handleTokenSaved} />
                <DataDisplay token={token} />
            </main>
        </div>
    );
}

export default App; 