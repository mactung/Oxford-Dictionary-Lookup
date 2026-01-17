import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';

const HOST_ID = 'oxford-lookup-host';

let root = null;
let shadowRoot = null;
let reactRoot = null;

function getHost() {
    let host = document.getElementById(HOST_ID);
    if (!host) {
        host = document.createElement('div');
        host.id = HOST_ID;
        host.style.position = 'absolute';
        host.style.zIndex = '2147483647';
        host.style.top = '0px';
        host.style.left = '0px';
        document.body.appendChild(host);

        shadowRoot = host.attachShadow({ mode: 'open' });

        // Inject Tailwind Styles
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = chrome.runtime.getURL('assets/newtab.css');
        shadowRoot.appendChild(styleLink);

        const container = document.createElement('div');
        container.className = 'font-sans text-base'; // Reset
        shadowRoot.appendChild(container);

        reactRoot = ReactDOM.createRoot(container);
    }
    return { host, shadowRoot, reactRoot };
}

function removeHost() {
    const host = document.getElementById(HOST_ID);
    if (host) {
        // We probably shouldn't unmount fully if we want to reuse, but for now let's unmount to clear state
        if (reactRoot) reactRoot.unmount();
        host.remove();
        reactRoot = null;
        shadowRoot = null;
    }
}

// Global state for simple icon handling
let iconElement = null;

const createIcon = (x, y, selectionText) => {
    if (iconElement) iconElement.remove();

    iconElement = document.createElement('div');
    // We can't use tailwind classes here easily on the top level unless we inject styles globally.
    // So sticking to inline styles or basic class for the icon, OR injecting a style tag to head.
    Object.assign(iconElement.style, {
        position: 'absolute',
        top: `${y - 45}px`,
        left: `${x}px`,
        width: '32px',
        height: '32px',
        backgroundColor: '#002147',
        borderRadius: '50%',
        cursor: 'pointer',
        zIndex: '2147483647',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        fontFamily: 'serif'
    });
    iconElement.textContent = 'Ox';

    // Prevent document selection logic from interfering
    iconElement.addEventListener('mousedown', (e) => e.stopPropagation());
    iconElement.addEventListener('mouseup', (e) => e.stopPropagation());

    // Click event to open
    iconElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        mountPopup(x, y - 5, selectionText);
        if (iconElement) iconElement.remove();
        iconElement = null;
    });

    document.body.appendChild(iconElement);
};

const mountPopup = (x, y, text) => {
    const { reactRoot } = getHost();
    reactRoot.render(<Popup x={x} y={y} word={text} onClose={removeHost} />);
};

// Event Listeners
document.addEventListener('mouseup', (e) => {
    // If inside our shadow dom, ignore (handled by React)
    const host = document.getElementById(HOST_ID);
    if (host && host.contains(e.target)) return;

    // Wait slightly to let selection finalize
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text.length > 0 && /^[a-zA-Z\s-]+$/.test(text) && text.split(' ').length < 4) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const x = rect.left + window.scrollX + (rect.width / 2);
            const y = rect.top + window.scrollY;

            // Remove any generic existing popup
            // removeHost(); 

            createIcon(x, y, text);
        } else {
            // Clicked clear
            if (iconElement) iconElement.remove();
            iconElement = null;
            // Don't close popup immediately if interacting with it? 
            // We use a ClickOutside listener in React instead usually but this is global.
            // If we clicked outside the host, remove host.
            if (host && !host.contains(e.target)) {
                removeHost();
            }
        }
    }, 10);
});

// --- Styles Injection ---
const style = document.createElement('style');
style.textContent = `
    .ox-saved-highlight {
        background-color: #ffeb3b; 
        color: black;
        cursor: pointer;
        border-bottom: 2px solid #fbc02d;
    }
`;
document.head.appendChild(style);

// --- Highlighting Logic ---
function highlightSavedWords() {
    chrome.storage.local.get(['vocabulary'], (result) => {
        const vocabulary = result.vocabulary || [];
        if (vocabulary.length === 0) return;

        const wordsToHighlight = new Set(vocabulary.map(v => v.headword.toLowerCase()));

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    if (node.parentElement && ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // Skip if already highlighted
                    if (node.parentElement && node.parentElement.classList.contains('ox-saved-highlight')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodesToReplace = [];

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = node.nodeValue;

            // Simple regex construction for matching words boundary
            // Note: This regex needs to be safe. 
            // We'll iterate words to find matches.
            // A better approach for many words is creating one big regex.

            let hasMatch = false;
            // Escape special chars in words
            const escapeRegExp = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`\\b(${Array.from(wordsToHighlight).map(escapeRegExp).join('|')})\\b`, 'gi');

            if (pattern.test(text)) {
                nodesToReplace.push({ node, pattern });
            }
        }

        nodesToReplace.forEach(({ node, pattern }) => {
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            const text = node.nodeValue;

            // Reset regex
            pattern.lastIndex = 0;
            let match;

            while ((match = pattern.exec(text)) !== null) {
                const before = text.slice(lastIndex, match.index);
                if (before) fragment.appendChild(document.createTextNode(before));

                const span = document.createElement('span');
                span.className = 'ox-saved-highlight';
                const matchedWord = match[0]; // Capture value
                span.textContent = matchedWord;

                // Add click event
                span.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const rect = span.getBoundingClientRect();
                    const x = rect.left + window.scrollX; // Align left
                    const y = rect.bottom + window.scrollY + 5; // Below the word

                    mountPopup(x, y, matchedWord);
                });

                fragment.appendChild(span);

                lastIndex = pattern.lastIndex;
            }

            const after = text.slice(lastIndex);
            if (after) fragment.appendChild(document.createTextNode(after));

            node.parentNode.replaceChild(fragment, node);
        });
    });
}

// Run highlighting on load and when storage changes
highlightSavedWords();

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.vocabulary) {
        // Re-run highlighting? 
        // Ideally we only add new ones, but re-running is safer for sync
        highlightSavedWords();
    }
});
