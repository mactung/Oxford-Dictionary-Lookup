// Centralized configuration
// keys can be overridden by .env files (VITE_API_URL) via import.meta.env

// Default to localhost, or usage import.meta.env.VITE_API_URL if defined at build time
export const API_DOMAIN = import.meta.env.VITE_API_URL || 'http://localhost:3003';
export const API_BASE_URL = `${API_DOMAIN}/api`;
