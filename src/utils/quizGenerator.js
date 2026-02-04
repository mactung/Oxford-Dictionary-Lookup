export function generateRandomQuestion(vocab, history = { lastWord: null, dailyCounts: {} }) {
    if (!vocab || vocab.length < 4) {
        console.log('QuizGenerator: Not enough vocab (needs 4+)');
        return null;
    }

    const now = Date.now();
    // Filter due words
    let candidates = vocab.filter(w => !w.nextReview || w.nextReview <= now);

    // If no due words, pick from all
    if (candidates.length === 0) {
        candidates = vocab;
    }

    const today = new Date().toISOString().split('T')[0];

    // Smart Random Filter
    let filteredCandidates = candidates.filter(w => {
        // 1. Avoid immediate predecessor
        if (w.headword === history.lastWord) return false;
        
        // 2. Limit daily appearance (max 2)
        const dayRecord = history.dailyCounts[today] || {};
        const count = dayRecord[w.headword] || 0;
        // console.log(`Checking ${w.headword}: count=${count}, today=${today}`);
        if (count >= 2) return false;

        return true;
    });

    // Fallback if too aggressive
    if (filteredCandidates.length === 0) {
        console.log('QuizGenerator: Filter too aggressive, relaxing rules.');
        filteredCandidates = candidates.filter(w => w.headword !== history.lastWord);
        if (filteredCandidates.length === 0) filteredCandidates = candidates;
    }

    // Pick ONE random word
    const word = filteredCandidates[Math.floor(Math.random() * filteredCandidates.length)];

    // New History Object to Return
    const newHistory = { 
        ...history, 
        dailyCounts: { ...history.dailyCounts } 
    };
    newHistory.lastWord = word.headword;
    
    // Deep copy the specific day record before mutating
    if (!newHistory.dailyCounts[today]) {
        newHistory.dailyCounts[today] = {};
    } else {
        newHistory.dailyCounts[today] = { ...newHistory.dailyCounts[today] };
    }
    
    newHistory.dailyCounts[today][word.headword] = (newHistory.dailyCounts[today][word.headword] || 0) + 1;

    // Prune old history
    const dateKeys = Object.keys(newHistory.dailyCounts);
    if (dateKeys.length > 5) {
        dateKeys.forEach(k => {
            if (k !== today) delete newHistory.dailyCounts[k];
        });
    }


    // Determine Type
    const types = ['meaning'];
    if (word.phonetics && word.phonetics.some(p => p.ipa)) types.push('ipa');
    if (word.senses && word.senses.some(s => s.examples && s.examples.length > 0)) types.push('fill_blank');

    const type = types[Math.floor(Math.random() * types.length)];
    let question = null;

    if (type === 'ipa') {
        const phonetic = word.phonetics.find(p => p.ipa);
        const correct = `/${phonetic.ipa}/`;
        
        const otherIpas = vocab
            .filter(w => w.headword !== word.headword && w.phonetics && w.phonetics.some(p => p.ipa))
            .map(w => `/${w.phonetics.find(p => p.ipa).ipa}/`);
        
        let uniqueDistractors = [...new Set(otherIpas)];
        let distractors = uniqueDistractors.sort(() => 0.5 - Math.random()).slice(0, 3);
        
        while (distractors.length < 3) distractors.push('/.../');

        const options = [correct, ...distractors].sort(() => 0.5 - Math.random());

        question = {
            wordObj: word,
            type: 'ipa',
            prompt: word.headword,
            correctAnswer: correct,
            options: options,
            headerText: 'Choose the correct pronunciation'
        };

    } else if (type === 'fill_blank') {
        const sense = word.senses.find(s => s.examples && s.examples.length > 0);
        const exampleObj = sense.examples[Math.floor(Math.random() * sense.examples.length)];
        const exampleText = typeof exampleObj === 'string' ? exampleObj : exampleObj.text;
        
        const prompt = exampleText.replace(new RegExp(word.headword, 'gi'), '_______');
        const correct = word.headword;
        
        const otherWords = vocab.filter(w => w.headword !== word.headword);
        let distractors = otherWords.sort(() => 0.5 - Math.random()).slice(0, 3).map(w => w.headword);
         while (distractors.length < 3) distractors.push('something'); 

        const options = [correct, ...distractors].sort(() => 0.5 - Math.random());
        
        question = {
            wordObj: word,
            type: 'fill_blank',
            prompt: prompt, 
            correctAnswer: correct,
            options: options,
            headerText: 'Fill in the blank',
            context: sense.definition
        };

    } else {
        const definition = word.senses?.[0]?.definition || 'No definition';
        const otherWords = vocab.filter(w => w.headword !== word.headword);
        
        let distractors = otherWords.sort(() => 0.5 - Math.random()).slice(0, 3).map(w => w.senses?.[0]?.definition || 'No def');
        while (distractors.length < 3) distractors.push('Random Wrong Definition ' + Math.floor(Math.random() * 100));

        const options = [definition, ...distractors].sort(() => 0.5 - Math.random());

         question = {
            wordObj: word,
            type: 'meaning',
            prompt: word.headword,
            correctAnswer: definition,
            options: options,
            headerText: 'Choose the correct meaning'
        };
    }

    return { question, newHistory };
}
