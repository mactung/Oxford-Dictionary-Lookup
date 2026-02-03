const fetch = require('node-fetch'); // You might need to install this if not native in node 18+ yet, but let's try assuming native or installing.
// Actually, node 18+ has native fetch. I'll assume node env is modern enough or use axios/http.
// Let's use simple http for zero-dep or just use the fact that I can run 'npm install node-fetch'

const BASE_URL = 'http://localhost:3003/api';

async function test() {
    console.log('--- Starting Auth & Sync Test ---');
    const timestamp = Date.now();
    const email = `testuser_${timestamp}@example.com`;
    const password = 'password123';
    const username = `TestUser_${timestamp}`;

    // 1. Register
    console.log('1. Registering...');
    try {
        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username })
        });
        const regData = await regRes.json();
        console.log('Register Response:', regData);

        if (!regData.success) {
            console.error('Registration failed');
            return;
        }

        const token = regData.token;

        // 2. Sync Words
        console.log('\n2. Syncing Words...');
        const syncRes = await fetch(`${BASE_URL}/user/sync`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                vocabulary: [
                    { headword: 'apple', srsLevel: 1, nextReview: new Date() },
                    { headword: 'banana', srsLevel: 0, nextReview: new Date() }
                ]
            })
        });
        const syncData = await syncRes.json();
        console.log('Sync Response:', syncData);

        // 3. Record Practice
        console.log('\n3. Recording Practice...');
        const practiceRes = await fetch(`${BASE_URL}/user/practice`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ points: 50, wordsCount: 5 })
        });
        const practiceData = await practiceRes.json();
        console.log('Practice Response:', practiceData);

        // 4. Get Leaderboard
        console.log('\n4. Getting Leaderboard...');
        const leadRes = await fetch(`${BASE_URL}/leaderboard`);
        const leadData = await leadRes.json();
        console.log('Leaderboard Response:', JSON.stringify(leadData, null, 2));

        console.log('\n--- Test Completed Successfully ---');

    } catch (err) {
        console.error('Test Error:', err);
    }
}

test();
