// src/background/index.js
import { API_BASE_URL } from '../config';

const ALARM_NAME = 'randomPracticeCheck';
const CHECK_INTERVAL_MIN = 1; // Check every 1 minute

// --- Alarm Management ---

function setupAlarm() {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MIN });
    console.log('Random Practice: Alarm created/updated with period', CHECK_INTERVAL_MIN);
}

chrome.runtime.onInstalled.addListener(() => {
    setupAlarm();
});

chrome.runtime.onStartup.addListener(() => {
    setupAlarm();
});

// --- Main Logic ---

// Also listen for Tab Updates (Navigation) to trigger "On Page Load" if due
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        checkAndTriggerQuiz(tabId);
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        checkAndTriggerQuiz();
    }
});

function checkAndTriggerQuiz(specificTabId = null) {
    chrome.storage.local.get(
        ['randomPracticeEnabled', 'randomPracticeFrequency', 'randomPracticeLastTime', 'randomPracticeSnoozeUntil', 'vocabulary'],
        (result) => {
            const {
                randomPracticeEnabled,
                randomPracticeFrequency = 60,
                randomPracticeLastTime = 0,
                randomPracticeSnoozeUntil = 0,
                vocabulary = []
            } = result;

            console.log('Random Practice Check:', {
                enabled: randomPracticeEnabled,
                vocabLength: vocabulary.length,
                lastTime: new Date(randomPracticeLastTime),
                snooze: new Date(randomPracticeSnoozeUntil)
            });

            if (!randomPracticeEnabled) {
                console.log('Random Practice: Disabled');
                return;
            }

            // Need at least 4 words to quiz (for multiple choice options)
            if (vocabulary.length < 4) {
                console.log('Random Practice: Not enough vocabulary (needs 4+)');
                return;
            }

            const now = Date.now();

            // Check Snooze
            if (now < randomPracticeSnoozeUntil) {
                console.log('Random Practice: Snoozed until', new Date(randomPracticeSnoozeUntil));
                return;
            }

            // Check Frequency
            // Special handling for Test Mode (1 minute) -> Treat as "Almost Always" (e.g., 5 seconds cooldown)
            // This allows testing "every time I visit a page"
            let intervalMs = randomPracticeFrequency * 60 * 1000;
            if (randomPracticeFrequency === 1) {
                intervalMs = 5000; // 5 seconds cooldown for testing
            }

            const nextDue = randomPracticeLastTime + intervalMs;

            if (now < nextDue) {
                console.log('Random Practice: Not due yet. Next due:', new Date(nextDue));
                return;
            }

            // Trigger Quiz
            console.log('Random Practice: Conditions met, triggering...');
            triggerQuizInActiveTab(specificTabId);
        }
    );
}

function triggerQuizInActiveTab(specificTabId = null) {
    const trigger = (tab) => {
        // Should strictly not run on sensitive pages or internal browser pages
        // If we don't have 'tabs' permission, tab.url might be undefined. We'll try anyway.
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://'))) {
            console.log('Random Practice: Skipped invalid url', tab.url);
            return;
        }

        console.log('Random Practice: Triggering quiz on tab', tab.id);

        chrome.tabs.sendMessage(tab.id, { action: 'triggerRandomQuiz' }, (response) => {
            // Check for errors (e.g. content script not loaded)
            if (chrome.runtime.lastError) {
                console.log('Random Practice: Could not send message to tab (maybe no content script):', chrome.runtime.lastError.message);
                return;
            }

            if (response && response.success) {
                console.log('Random Practice: Successfully triggered on tab', tab.id);
                // Update Last Time only if successfully triggered
                chrome.storage.local.set({ randomPracticeLastTime: Date.now() });
            } else {
                console.log('Random Practice: Tab responded but failed', response);
            }
        });
    };

    if (specificTabId) {
        chrome.tabs.get(specificTabId, (tab) => {
            if (chrome.runtime.lastError || !tab) return;
            trigger(tab);
        });
    } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) return;
            trigger(tabs[0]);
        });
    }
}

// --- Dictionary Sync (Developer Tool) ---
const SYNC_SERVER_URL = `${API_BASE_URL}/sync`;
const USER_SYNC_URL = `${API_BASE_URL}/user/sync`;

function syncDataToCloud(data) {
    // 1. Dictionary Entry Sync (Object with headword)
    if (typeof data === 'object' && data.headword) {
        console.log('Syncing dictionary entry:', data.headword);
        fetch(SYNC_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(res => {
            if (res.ok) console.log('Dict Sync success:', data.headword);
            else console.log('Dict Sync failed:', res.status);
        }).catch(err => console.log('Dict Sync error:', err.message));
        return;
    }

    // 2. User SRS Sync (Trigger String)
    if (data === 'srs_update') {
        console.log('Triggering User SRS Sync...');
        chrome.storage.local.get(['vocabulary', 'authToken'], (result) => {
            const { vocabulary, authToken } = result;

            if (!authToken) {
                console.log('User Sync: No auth token, skipping.');
                return;
            }
            if (!vocabulary) {
                console.log('User Sync: No vocabulary to sync.');
                return;
            }

            fetch(USER_SYNC_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ vocabulary })
            })
            .then(res => res.json())
            .then(json => {
                if (json.success) console.log('User SRS Sync success.');
                else console.log('User SRS Sync failed:', json.error);
            })
            .catch(err => console.log('User SRS Sync connection error:', err.message));
        });
        return;
    }
    
    console.log('Unknown sync data type:', data);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncToCloud') {
        syncDataToCloud(request.data);
        return false; // Async not needed (fire and forget)
    }

    if (request.action === 'fetchDefinition') {
        const rawWord = request.word;
        // Basic cleaning: trim whitespace and convert to lowercase
        const word = rawWord.trim().toLowerCase();

        const directUrl = `https://www.oxfordlearnersdictionaries.com/definition/english/${word}`;
        const searchUrl = `https://www.oxfordlearnersdictionaries.com/search/english/?q=${encodeURIComponent(word)}`;

        // Helper to check if a response page is actually a search result list (meaning no exact match/redirect)
        // Note: Oxford usually redirects "search?q=governments" to ".../definition/english/government"

        // 1. Try Local Server First
        fetch(`${API_BASE_URL}/entry/${encodeURIComponent(word)}`)
            .then(response => {
                if (response.ok) return response.json();
                throw new Error('Local not found');
            })
            .then(localData => {
                console.log('Found locally:', localData.headword);
                // We need to convert this JSON back to HTML or handle it in the popup.
                // The current popup expects HTML to parse OR raw data if we update it.
                // UPDATING STRATEGY: 
                // The popup `PopupApp.jsx` likely calls `parseOxfordHTML(html)`.
                // If we return JSON here, `PopupApp.jsx` needs to handle it.
                // Let's check `PopupApp.jsx` first? 
                // NO, for now let's wrap it in a structure that PopupApp can detect, OR simpler:
                // Just return the JSON object in a specific property like `localData`.
                sendResponse({ success: true, localData: localData, finalUrl: 'local' });
            })
            .catch(() => {
                // 2. Fallback to Oxford Direct URL
                console.log(`Local lookup failed for ${word}, trying Oxford...`);
                fetch(directUrl)
                    .then(response => {
                        if (response.ok) return response;
                        if (response.status === 404) {
                            return fetch(searchUrl);
                        }
                        throw new Error('Network response was not ok');
                    })
                    .then(response => {
                        if (!response.ok) {
                            if (response.status === 404) {
                                return fetch(`https://www.oxfordlearnersdictionaries.com/definition/english/${word}_1`);
                            }
                            throw new Error('Network response was not ok');
                        }
                        return response;
                    })
                    .then(response => {
                        if (!response.ok) throw new Error('Not found');
                        return Promise.all([response.text(), response.url]);
                    })
                    .then(([html, finalUrl]) => {
                        sendResponse({ success: true, html: html, finalUrl: finalUrl });
                    })
                    .catch(error => {
                        console.error('Fetch error:', error);
                        sendResponse({ success: false, error: 'Definition not found' });
                    });
            });

        return true; // Will respond asynchronously
    }
});

// Make available globally for manual debugging
self.checkAndTriggerQuiz = checkAndTriggerQuiz;
globalThis.checkAndTriggerQuiz = checkAndTriggerQuiz;
console.log('Random Practice: Debug function checkAndTriggerQuiz exposed');
