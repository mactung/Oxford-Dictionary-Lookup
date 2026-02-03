const API_BASE_URL = 'http://localhost:3003/api';

export async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return response.json();
}

export async function register(email, username, password) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
    });
    return response.json();
}

export async function syncUserVocabulary(token, vocabulary) {
    const response = await fetch(`${API_BASE_URL}/user/sync`, {
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
    const response = await fetch(`${API_BASE_URL}/leaderboard`);
    return response.json();
}

export async function recordPractice(token, points, wordsCount) {
    const response = await fetch(`${API_BASE_URL}/user/practice`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ points, wordsCount })
    });
    return response.json();
}
