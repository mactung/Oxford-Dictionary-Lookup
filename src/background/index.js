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

            if (!randomPracticeEnabled) return;
            
            // Need at least a few words to quiz
            if (vocabulary.length < 3) return;

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
            triggerQuizInActiveTab(specificTabId);
        }
    );
}

function triggerQuizInActiveTab(specificTabId = null) {
    const trigger = (tab) => {
        // Should strictly not run on sensitive pages or internal browser pages
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
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
                // Update Last Time only if successfully triggered
                chrome.storage.local.set({ randomPracticeLastTime: Date.now() });
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
        const word = request.word.toLowerCase();
        const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${word}`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 404) {
                        return fetch(`https://www.oxfordlearnersdictionaries.com/definition/english/${word}_1`);
                    }
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(html => {
                sendResponse({ success: true, html: html, finalUrl: url });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });

        return true; // Will respond asynchronously
    }
});
