import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupApp from './PopupApp';
import '../index.css'; // Reuse global styles for tailwind

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <PopupApp />
    </React.StrictMode>
);
