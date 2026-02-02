export function parseOxfordHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const entry = doc.querySelector('.entry') || doc.querySelector('.webtop');

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
    const senses = [];
    // The main container for definitions is usually .senses_multiple or just direct .sense elements
    // We should look for all .sense elements within the entry
    const senseElements = entry.querySelectorAll('.sense');

    senseElements.forEach(sense => {
        // Definition
        const def = sense.querySelector('.def')?.textContent;

        // CEFR Level
        // It can be an attribute [cefr="a1"] or a span inside .symbols
        let cefr = sense.getAttribute('cefr');
        if (!cefr) {
            const cefrSpan = sense.querySelector('.ox3000, .ox5000');
            if (cefrSpan) {
                // Often class="ox3ksym_a1" inside
                const classList = Array.from(cefrSpan.classList);
                // Try to find a class that looks like keysym
                // But typically the text might be inside or it's an image.
                // Inspecting usually shows a span with class 'ox3ksym_a1' inside the .ox3000 container
                const innerSym = cefrSpan.querySelector('span[class^="ox3ksym_"]');
                if (innerSym) {
                    cefr = innerSym.className.replace('ox3ksym_', '').toUpperCase();
                }
            }
        }

        if (def) {
            const examples = [];
            // Examples are usually in ul.examples > li
            // Each li might have .cf (pattern), .labels, and .x (example text)
            const exampleList = sense.querySelectorAll('.examples > li');
            if (exampleList.length > 0) {
                exampleList.forEach(li => {
                    const pattern = li.querySelector('.cf')?.textContent?.trim();
                    const label = li.querySelector('.labels')?.textContent?.trim();
                    const text = li.querySelector('.x')?.textContent?.trim();

                    if (text || pattern) {
                        examples.push({
                            pattern,
                            label,
                            text: text || ''
                        });
                    }
                });
            } else {
                // Fallback for simple examples without list structure
                sense.querySelectorAll('.x').forEach(x => {
                    examples.push({ text: x.textContent?.trim() });
                });
            }

            // Synonyms
            const synonyms = [];
            sense.querySelectorAll('.xr_s, .syn').forEach(syn => {
                let text = syn.textContent?.trim();
                // Remove "synonym" label if present
                text = text.replace(/^synonym\s*/i, '');
                if (text) synonyms.push(text);
            });

            // Grammar / Labels
            const grammar = sense.querySelector('.gram')?.textContent || '';
            const labels = sense.querySelector('.labels')?.textContent || '';

            senses.push({
                definition: def,
                examples,
                synonyms,
                cefr: cefr ? cefr.toUpperCase() : null,
                grammar,
                labels
            });
        }
    });

    // Verb Forms
    // Usually in a collapsed box .unbox[unbox="verbforms"]
    // Or just .verb_forms_table
    const verbForms = [];
    const verbFormsContainer = doc.querySelector('.verb_forms_table') || doc.querySelector('.unbox[unbox="verbforms"]');
    if (verbFormsContainer) {
        verbFormsContainer.querySelectorAll('tr').forEach(tr => {
            const formName = tr.querySelector('th')?.textContent?.trim(); // e.g., "present simple", "past tense"
            const formValue = tr.querySelector('td')?.textContent?.trim();
            if (formName && formValue) {
                verbForms.push({ form: formName, value: formValue });
            }
        });
    }

    // Idioms
    // Oxford puts idioms in .idm-gs or .idioms
    const idioms = [];
    const idiomGroups = doc.querySelectorAll('.idm-g, .idm-gs .idm-g');
    idiomGroups.forEach(idmBlock => {
        const phrase = idmBlock.querySelector('.idm')?.textContent?.trim();
        const def = idmBlock.querySelector('.def')?.textContent?.trim();
        const examples = [];
        idmBlock.querySelectorAll('.x').forEach(x => examples.push(x.textContent));

        if (phrase && def) {
            idioms.push({ phrase, definition: def, examples });
        }
    });

    // Phrasal Verbs
    // Usually a list of links in .phrasal_verb_links or .pv-gs
    const phrasalVerbs = [];
    const pvContainer = doc.querySelector('.phrasal_verb_links') || doc.querySelector('.pv-gs');
    if (pvContainer) {
        pvContainer.querySelectorAll('li, .pv-g').forEach(item => {
            // Usually just a link or a headword
            const text = item.textContent?.trim();
            // Clean up
            if (text) phrasalVerbs.push(text);
        });
    }

    // Vocabulary Building / Topics
    const topics = [];
    doc.querySelectorAll('.topic-g .topic_name').forEach(topic => {
        topics.push(topic.textContent?.trim());
    });
    // Or check .unbox[unbox="vocab"]
    const vocabBox = doc.querySelector('.unbox[unbox="vocab"]');
    if (vocabBox) {
        const title = vocabBox.querySelector('.box_title')?.textContent;
        const items = vocabBox.querySelector('.body')?.textContent;
        if (title) {
            topics.push(`${title}: ${items || ''}`.trim());
        }
    }


    return {
        headword,
        pos,
        phonetics,
        senses,
        verbForms,
        idioms,
        phrasalVerbs,
        topics
    };
}
