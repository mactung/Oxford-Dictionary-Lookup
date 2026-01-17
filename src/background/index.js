// src/background/index.js

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
