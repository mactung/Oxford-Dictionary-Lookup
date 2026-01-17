// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchDefinition') {
    const word = request.word.toLowerCase();
    const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${word}`;

    fetch(url)
      .then(response => {
        if (!response.ok) {
            // Try adding _1 if the standard word fails (sometimes exact matches need index)
            // Or handle 404
             if(response.status === 404) {
                 return fetch(`https://www.oxfordlearnersdictionaries.com/definition/english/${word}_1`);
             }
             throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then(html => {
          // You might check if the final URL redirected to a search page or similar
          // For now returning the HTML to content script for parsing
          sendResponse({ success: true, html: html, finalUrl: url });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Will respond asynchronously
  }
});
