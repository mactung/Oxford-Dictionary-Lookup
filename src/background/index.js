// src/background/index.js

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

// --- Message Handling ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchDefinition') {
        const rawWord = request.word;
        // Basic cleaning: trim whitespace and convert to lowercase
        const word = rawWord.trim().toLowerCase();

        const directUrl = `https://www.oxfordlearnersdictionaries.com/definition/english/${word}`;
        const searchUrl = `https://www.oxfordlearnersdictionaries.com/search/english/?q=${encodeURIComponent(word)}`;

        // Helper to check if a response page is actually a search result list (meaning no exact match/redirect)
        // Note: Oxford usually redirects "search?q=governments" to ".../definition/english/government"

        // 1. Try Direct URL
        fetch(directUrl)
            .then(response => {
                if (response.ok) return response;
                // 2. If 404, try Search URL (handles plurals/conjugations)
                if (response.status === 404) {
                    console.log(`Direct lookup failed for ${word}, trying search fallback...`);
                    return fetch(searchUrl);
                }
                throw new Error('Network response was not ok');
            })
            .then(response => {
                if (!response.ok) {
                    // 3. Last resort: try appending _1 (sometimes helpful for simple homonyms)
                    if (response.status === 404) {
                        return fetch(`https://www.oxfordlearnersdictionaries.com/definition/english/${word}_1`);
                    }
                    throw new Error('Network response was not ok');
                }
                return response;
            })
            .then(response => {
                // Check if we ultimately failed after fallback
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

        return true; // Will respond asynchronously
    }
});

// Make available globally for manual debugging
self.checkAndTriggerQuiz = checkAndTriggerQuiz;
globalThis.checkAndTriggerQuiz = checkAndTriggerQuiz;
console.log('Random Practice: Debug function checkAndTriggerQuiz exposed');
