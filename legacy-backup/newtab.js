document.addEventListener('DOMContentLoaded', loadVocabulary);

function loadVocabulary() {
    chrome.storage.local.get(['vocabulary'], (result) => {
        const vocabulary = result.vocabulary || [];
        const grid = document.getElementById('vocab-grid');
        const emptyState = document.getElementById('empty-state');

        grid.innerHTML = '';

        if (vocabulary.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Reverse to show newest first
        vocabulary.slice().reverse().forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'vocab-card';

            // Find first phonetic if available
            const ipa = item.phonetics && item.phonetics[0] ? `/${item.phonetics[0].ipa}/` : '';

            // Find first definition
            const def = item.senses && item.senses[0] ? item.senses[0].definition : 'No definition found';

            card.innerHTML = `
                <button class="delete-btn" title="Delete">×</button>
                <div class="word">${item.headword}</div>
                <div class="pos">${item.pos}</div>
                <span class="phonetic">${ipa}</span>
                <div class="definition">${def}</div>
            `;

            // Adjust index for original array (since we are iterating reversed copy)
            const originalIndex = vocabulary.length - 1 - index;

            card.querySelector('.delete-btn').addEventListener('click', () => {
                deleteWord(originalIndex);
            });

            grid.appendChild(card);
        });
    });
}

function deleteWord(index) {
    chrome.storage.local.get(['vocabulary'], (result) => {
        const vocabulary = result.vocabulary || [];
        vocabulary.splice(index, 1);

        chrome.storage.local.set({ vocabulary: vocabulary }, () => {
            loadVocabulary();
        });
    });
}
