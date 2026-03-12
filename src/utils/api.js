import { API_BASE_URL } from '../config';

export function forceLogout() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.remove(['user', 'token'], () => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('force-logout'));
            }
        });
    } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('force-logout'));
    }
}

async function fetchServer(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            forceLogout();
        }
        return response;
    } catch (error) {
        // Network error (server down, cannot connect)
        forceLogout();
        throw error;
    }
}

export async function login(email, password) {
    const response = await fetchServer(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return response.json();
}

export async function register(email, username, password) {
    const response = await fetchServer(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
    });
    return response.json();
}

export async function syncUserVocabulary(token, vocabulary) {
    const response = await fetchServer(`${API_BASE_URL}/user/sync`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vocabulary })
    });
    return response.json();
}

export async function getLeaderboard() {
    const response = await fetchServer(`${API_BASE_URL}/leaderboard`);
    return response.json();
}

export async function recordPractice(token, points, wordsCount) {
    const response = await fetchServer(`${API_BASE_URL}/user/practice`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ points, wordsCount })
    });
    return response.json();
}
