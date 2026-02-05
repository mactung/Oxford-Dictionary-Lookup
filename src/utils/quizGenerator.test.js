import { describe, it, expect } from 'vitest';
import { generateRandomQuestion } from './quizGenerator';

describe('quizGenerator', () => {
    const mockVocab = [
        {
            headword: 'word1',
            senses: [{ definition: 'def1', examples: ['Example for word1'] }],
            phonetics: [{ ipa: 'ipa1' }]
        },
        {
            headword: 'word2',
            senses: [{ definition: 'def2' }], // No examples
            phonetics: [] // No IPA
        },
        {
            headword: 'word3',
            senses: [{ definition: 'def3' }],
            phonetics: []
        },
        {
            headword: 'word4',
            senses: [{ definition: 'def4' }],
            phonetics: []
        }
    ];

    it('should return null if vocab is too small', () => {
        const result = generateRandomQuestion([], {});
        expect(result).toBeNull();
    });

    it('should generate a question and update history', () => {
        const history = { lastWord: null, dailyCounts: {} };
        const result = generateRandomQuestion(mockVocab, history);
        
        expect(result).not.toBeNull();
        expect(result.question).toBeDefined();
        expect(result.newHistory).toBeDefined();
        expect(result.newHistory.lastWord).toEqual(result.question.wordObj.headword);
    });

    it('should respect daily limit (max 2 per word)', () => {
        const today = new Date().toISOString().split('T')[0];
        // word1 has appeared 2 times today
        const history = { 
            lastWord: 'word2', 
            dailyCounts: { [today]: { 'word1': 2 } } 
        };

        // Try many times, should never pick word1
        for (let i = 0; i < 20; i++) {
            const result = generateRandomQuestion(mockVocab, history);
            if (result) {
                expect(result.question.wordObj.headword).not.toBe('word1');
            }
        }
    });

    it('should include words with srsLevel 0 even if not due', () => {
        const futureDate = Date.now() + 86400000; // Tomorrow
        const mockVocabWithSRS = [
            {
                headword: 'learningWord',
                senses: [{ definition: 'def' }],
                phonetics: [],
                srsLevel: 0,
                nextReview: futureDate // Not due yet
            },
            {
                headword: 'masteredWord',
                senses: [{ definition: 'def' }],
                phonetics: [],
                srsLevel: 5,
                nextReview: futureDate // Not due yet
            },
            { headword: 'dummy1', senses: [{ definition: 'd' }], phonetics: [], srsLevel: 3, nextReview: futureDate },
            { headword: 'dummy2', senses: [{ definition: 'd' }], phonetics: [], srsLevel: 3, nextReview: futureDate }
        ];

        // Should pick learningWord because srsLevel is 0
        // Should NOT pick masteredWord because it's not due and srsLevel > 0
        
        let checkedCount = 0;
        for (let i = 0; i < 10; i++) {
            const result = generateRandomQuestion(mockVocabWithSRS, { lastWord: null, dailyCounts: {} });
            if (result) {
                expect(result.question.wordObj.headword).toBe('learningWord');
                checkedCount++;
            }
        }
        expect(checkedCount).toBeGreaterThan(0);
    });

    it('should filter out completed types based on srsProgress', () => {
        // Only word1 allows IPA
        const progress = { 'word1': ['meaning', 'spelling'] };
        // So only 'ipa' should be left (or it forces IPA if available)
        
        // We need to force picking word1, but still have enough vocab to run
        const mockVocabSingle = [
            mockVocab[0], // word1
            { headword: 'dummy1', senses: [{ definition: 'd' }], phonetics: [], srsLevel: 3 },
            { headword: 'dummy2', senses: [{ definition: 'd' }], phonetics: [], srsLevel: 3 },
            { headword: 'dummy3', senses: [{ definition: 'd' }], phonetics: [], srsLevel: 3 }
        ];
        
        // The generator picks from filtered candidates. 
        // We need to make sure dummies are NOT picked if we want to test word1 specifically.
        // Or we just check that IF word1 is picked, it is IPA.
        // Dummies are not 'Due' (undefined nextReview means due? In code: (!w.nextReview || ...) so yes.
        // Let's make dummies NOT due.
        const future = Date.now() + 99999999;
        mockVocabSingle.forEach((w, i) => { if (i>0) w.nextReview = future; });
        // word1 nextReview undefined -> due.
        
        for (let i = 0; i < 20; i++) {
             const result = generateRandomQuestion(mockVocabSingle, { lastWord: null, dailyCounts: {} }, progress);
             if (result && result.question.wordObj.headword === 'word1') {
                 expect(result.question.type).toBe('ipa');
             }
        }
    });

    it('should avoid immediate repeat of last word', () => {
         const history = { lastWord: 'word1', dailyCounts: {} };
         // Should not pick word1
         for (let i = 0; i < 10; i++) {
            const result = generateRandomQuestion(mockVocab, history);
            if (result) {
                expect(result.question.wordObj.headword).not.toBe('word1');
            }
         }
    });
});
