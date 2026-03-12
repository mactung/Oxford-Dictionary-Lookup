import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupApp from './PopupApp';
import '../index.css'; // Reuse global styles for tailwind
import '../i18n'; // Initialize i18n

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <PopupApp />
    </React.StrictMode>
);
