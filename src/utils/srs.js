export const calculateNextReview = (level) => {
    const now = Date.now();
    const days = 24 * 60 * 60 * 1000;

    switch (level) {
        case 0: return now + 1 * days;
        case 1: return now + 3 * days;
        case 2: return now + 7 * days;
        case 3: return now + 14 * days;
        default: return now + (level * 7) * days;
    }
};

export const updateSRS = (wordObj, isCorrect) => {
    let newLevel = wordObj.srsLevel || 0;

    if (isCorrect) {
        newLevel += 1;
    } else {
        newLevel = 0; // Reset on failure
    }

    return {
        ...wordObj,
        srsLevel: newLevel,
        nextReview: calculateNextReview(newLevel)
    };
};
