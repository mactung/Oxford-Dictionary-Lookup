export function generateRandomQuestion(vocab, history = { lastWord: null, dailyCounts: {} }, srsProgress = {}) {
    if (!vocab || vocab.length < 4) {
        console.log('QuizGenerator: Not enough vocab (needs 4+)');
        return null;
    }

    const now = Date.now();
    // Filter due words OR words currently being learned (srsLevel 0)
    let candidates = vocab.filter(w => (!w.nextReview || w.nextReview <= now) || (w.srsLevel === 0));

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


    // Determine All Valid Types
    const allTypes = ['meaning'];
    if (word.phonetics && word.phonetics.some(p => p.ipa)) allTypes.push('ipa');
    allTypes.push('spelling'); 
    
    // Filter types based on Progress
    const completedTypes = srsProgress[word.headword] || [];
    const availableTypes = allTypes.filter(t => !completedTypes.includes(t));

    // If all types completed (edge case, should have been cleared), reset available
    const typesToChoose = availableTypes.length > 0 ? availableTypes : allTypes;

    // Pick ONE type
    const type = typesToChoose[Math.floor(Math.random() * typesToChoose.length)];
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

    } else if (type === 'spelling') {
        const definition = word.senses?.[0]?.definition || 'No definition';
        
        question = {
            wordObj: word,
            type: 'spelling',
            prompt: definition,
            correctAnswer: word.headword,
            headerText: 'Type the correct word'
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
