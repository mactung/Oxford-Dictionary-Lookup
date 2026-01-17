// content.js

let parsedData = null;
let currentSelection = null;
let iconElement = null;
let popupContainer = null;
let shadowRoot = null;

// --- Parsing Logic ---
function parseOxfordHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Check if we landed on a search result list or a direct definition
    // If it's a list, we might need to take the first one or show list (MVP: assume direct or first match)

    // Main container usually has id "main_column" or class "entry"
    const entry = doc.querySelector('.webtop');

    if (!entry) {
        // Fallback: detect if it's a "Did you mean?" page
        if (doc.querySelector('.result-list')) {
            return { error: 'Word not found directly. Please try a more specific word.' };
        }
        return { error: 'Definition not found.' };
    }

    const headword = entry.querySelector('.headword')?.textContent || '';
    const pos = entry.querySelector('.pos')?.textContent || '';

    // Phonetics
    const phonetics = [];
    entry.querySelectorAll('.phonetics > div').forEach(div => {
        const type = div.classList.contains('phons_br') ? 'BrE' :
            div.classList.contains('phons_n_am') ? 'NAmE' : '';
        const ipa = div.querySelector('.phon')?.textContent || '';
        const audioUrl = div.querySelector('.sound')?.getAttribute('data-src-mp3');

        if (ipa || audioUrl) {
            phonetics.push({ type, ipa, audioUrl });
        }
    });

    // Definitions and Examples
    // Oxford structure: .senses_multiple .sense OR .senses_single .sense
    const senses = [];
    const senseElements = doc.querySelectorAll('.sense');

    senseElements.forEach(sense => {
        const def = sense.querySelector('.def')?.textContent;
        if (def) {
            const examples = [];
            sense.querySelectorAll('.x').forEach(x => {
                examples.push(x.textContent);
            });
            senses.push({ definition: def, examples: examples });
        }
    });

    return {
        headword,
        pos,
        phonetics,
        senses
    };
}

// --- UI Logic ---

function createIcon(x, y) {
    removeIcon(); // Ensure only one icon exists

    iconElement = document.createElement('div');
    iconElement.className = 'oxford-lookup-icon';
    // Position icon slightly above text selection ending
    iconElement.style.left = `${x}px`;
    iconElement.style.top = `${y - 40}px`;

    // Trigger popup on hover
    iconElement.addEventListener('mouseenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPopup(x, y);
    });

    document.body.appendChild(iconElement);
}

function removeIcon() {
    if (iconElement) {
        iconElement.remove();
        iconElement = null;
    }
}

function createPopup() {
    if (popupContainer) return;

    popupContainer = document.createElement('div');
    popupContainer.id = 'oxford-lookup-host';
    // Style the host to be unobtrusive
    popupContainer.style.position = 'absolute';
    popupContainer.style.zIndex = '2147483647';
    popupContainer.style.top = '0';
    popupContainer.style.left = '0';

    document.body.appendChild(popupContainer);
    shadowRoot = popupContainer.attachShadow({ mode: 'open' });

    // Inject Styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('styles.css');
    shadowRoot.appendChild(styleLink);

    const wrapper = document.createElement('div');
    wrapper.className = 'oxford-popup';
    // Initial hidden state or loading
    wrapper.innerHTML = `
        <div class="header">
            <h1>Oxford Dictionary</h1>
            <div style="display: flex; gap: 10px; align-items: center;">
                <button class="save-btn" title="Save to Vocabulary">★ Save</button>
                <button class="close-btn">×</button>
            </div>
        </div>
        <div class="content">
            <div class="loading">Loading...</div>
        </div>
    `;
    shadowRoot.appendChild(wrapper);

    // Button listeners
    wrapper.querySelector('.close-btn').addEventListener('click', removePopup);
    wrapper.querySelector('.save-btn').addEventListener('click', () => saveWord());
}

function updatePopupContent(data) {
    if (!shadowRoot) return;

    const contentDiv = shadowRoot.querySelector('.content');

    if (data.error) {
        contentDiv.innerHTML = `<div class="error">${data.error}</div>`;
        return;
    }

    let html = `
        <h1 class="headword">${data.headword} <span class="pos">${data.pos}</span></h1>
    `;

    // Phonetics
    if (data.phonetics && data.phonetics.length > 0) {
        html += `<div class="phonetics-container">`;
        data.phonetics.forEach(p => {
            html += `<div class="phonetics">
                ${p.type ? `<strong>${p.type}</strong>` : ''}
                <span>/${p.ipa}/</span>
                ${p.audioUrl ? `<span class="sound-icon" data-url="${p.audioUrl}" title="Listen">🔊</span>` : ''}
            </div>`;
        });
        html += `</div>`;
    }

    // Senses
    if (data.senses && data.senses.length > 0) {
        data.senses.forEach((sense, index) => {
            html += `
                <div class="def-block">
                    <span class="definition">${index + 1}. ${sense.definition}</span>
                    ${sense.examples.map(ex => `<span class="example">${ex}</span>`).join('')}
                </div>
            `;
        });
    } else {
        html += `<div class="error">No definitions found.</div>`;
    }

    contentDiv.innerHTML = html;

    // Add audio listeners
    contentDiv.querySelectorAll('.sound-icon').forEach(icon => {
        icon.addEventListener('click', () => {
            const url = icon.getAttribute('data-url');
            if (url) {
                const audio = new Audio(url);
                audio.play();
            }
        });
    });
}

function showPopup(x, y) {
    removeIcon();
    createPopup();

    // Position popup
    const popup = shadowRoot.querySelector('.oxford-popup');

    // Basic viewport boundary checks could be added here
    popup.style.left = `${x}px`;
    popup.style.top = `${y - 5}px`;

    // Fetch data
    const word = currentSelection.toString().trim();
    chrome.runtime.sendMessage({ action: 'fetchDefinition', word: word }, (response) => {
        if (response && response.success) {
            parsedData = parseOxfordHTML(response.html);
            updatePopupContent(parsedData);
        } else {
            parsedData = { error: 'Failed to fetch definition.' };
            updatePopupContent(parsedData);
        }
    });
}

function removePopup() {
    if (popupContainer) {
        popupContainer.remove();
        popupContainer = null;
        shadowRoot = null;
    }
}


function saveWord() {
    if (!parsedData || parsedData.error) return;

    if (!shadowRoot) return;
    const saveBtn = shadowRoot.querySelector('.save-btn');
    if (saveBtn) saveBtn.textContent = 'Saving...';

    chrome.storage.local.get(['vocabulary'], (result) => {
        const vocabulary = result.vocabulary || [];

        // Simple check to avoid duplicates based on headword
        const exists = vocabulary.some(item => item.headword === parsedData.headword);

        if (!exists) {
            vocabulary.push(parsedData);
            chrome.storage.local.set({ vocabulary: vocabulary }, () => {
                if (saveBtn) saveBtn.textContent = '★ Saved';
                setTimeout(() => { if (saveBtn) saveBtn.textContent = '★ Save'; }, 2000);
            });
        } else {
            if (saveBtn) saveBtn.textContent = 'Exists';
            setTimeout(() => { if (saveBtn) saveBtn.textContent = '★ Save'; }, 2000);
        }
    });
}

// --- Event Listeners ---

document.addEventListener('mouseup', (e) => {
    // If inside our own popup, ignore
    if (popupContainer && popupContainer.contains(e.target)) return;
    // If inside shadow dom (events retarget), check composed path
    // Simple check: if selection is empty, remove everything

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0 && /^[a-zA-Z\s-]+$/.test(text)) { // Basic validation
        currentSelection = selection; // Store for valid usage
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Convert viewport coordinates to document coordinates
        const x = rect.left + window.scrollX;
        const y = rect.top + window.scrollY;

        // If popup is already open, do we close it? 
        // Let's decide: selecting new text closes old popup and shows icon
        removePopup();
        createIcon(x + rect.width / 2, y); // Center icon
    } else {
        // Clicked elsewhere, clear
        // Need to allow clicking on the icon itself
        setTimeout(() => { // Timeout to let click event on icon fire first if applicable
            if (!iconElement || !iconElement.contains(e.target)) {
                removeIcon();
            }
        }, 100);
    }
});

// Remove popup on click outside
document.addEventListener('mousedown', (e) => {
    if (popupContainer && !popupContainer.contains(e.target)) {
        // Also check if we are clicking inside the shadow DOM?
        // Native event.target won't see inside shadow DOM if used globally, 
        // but since our container is Light DOM, containing Shadow DOM, checking container is usually enough.
        removePopup();
    }
});
