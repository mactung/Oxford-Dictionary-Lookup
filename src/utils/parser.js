export function parseOxfordHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const entry = doc.querySelector('.webtop');

    if (!entry) {
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
