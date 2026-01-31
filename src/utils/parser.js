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
    const allPhonetics = [];
    entry.querySelectorAll('.phonetics > div').forEach(div => {
        const type = div.classList.contains('phons_br') ? 'BrE' :
            div.classList.contains('phons_n_am') ? 'NAmE' : '';
        const ipa = div.querySelector('.phon')?.textContent || '';
        const audioUrl = div.querySelector('.sound')?.getAttribute('data-src-mp3');

        if ((ipa || audioUrl) && type) {
            allPhonetics.push({ type, ipa, audioUrl });
        }
    });

    // Filter: Keep only the first BrE and first NAmE
    const phonetics = [];
    const bre = allPhonetics.find(p => p.type === 'BrE');
    const name = allPhonetics.find(p => p.type === 'NAmE');

    if (bre) phonetics.push(bre);
    if (name) phonetics.push(name);

    // Definitions and Examples
    // Definitions, Synonyms, and Examples
    const senses = [];
    const senseElements = doc.querySelectorAll('.sense');

    senseElements.forEach(sense => {
        const def = sense.querySelector('.def')?.textContent;
        if (def) {
            const examples = [];
            sense.querySelectorAll('.x').forEach(x => {
                examples.push(x.textContent);
            });

            // Capture synonyms for this sense
            const synonyms = [];
            sense.querySelectorAll('.xr_s').forEach(syn => {
                // Oxford sometimes puts commas or 'synonym' labels. We just want the word.
                // Structure: <span class="xr">synonym <a href="...">word</a></span> or similar.
                // We will grab the text content of .xr_s usually, or .xh inside .xr.
                // Actually .xr_s seems to be a specific class for synonyms in some versions.
                // Let's try .xr_s and .syn
                let text = syn.textContent?.trim();
                if (text) synonyms.push(text);
            });

            // Backup check for .syn (synonym block)
            if (synonyms.length === 0) {
                sense.querySelectorAll('.syn, .xr').forEach(el => {
                    if (el.textContent.includes('synonym')) {
                        const clean = el.textContent.replace('synonym', '').trim();
                        if (clean) synonyms.push(clean);
                    }
                });
            }

            senses.push({ definition: def, examples: examples, synonyms: synonyms });
        }
    });

    // Idioms
    const idioms = [];
    doc.querySelectorAll('.idm-g').forEach(idmBlock => {
        const phrase = idmBlock.querySelector('.idm')?.textContent?.trim();
        const def = idmBlock.querySelector('.def')?.textContent?.trim();
        if (phrase && def) {
            idioms.push({ phrase, definition: def });
        }
    });

    return {
        headword,
        pos,
        phonetics,
        senses,
        idioms
    };
}
