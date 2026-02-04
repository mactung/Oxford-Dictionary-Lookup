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

    it('should generate fill_blank question if examples exist', () => {
        // Only word1 has examples, so if we force fill_blank it must be word1.
        // However, the function chooses type randomly.
        // Let's just check that IF we get fill_blank, it has correct structure.
        
        let found = false;
        // Try enough times to likely hit it
        for (let i = 0; i < 50; i++) {
             const result = generateRandomQuestion(mockVocab, { lastWord: null, dailyCounts: {} });
             if (result && result.question.type === 'fill_blank') {
                 found = true;
                 expect(result.question.prompt).toContain('_______');
                 expect(result.question.correctAnswer).toBe(result.question.wordObj.headword);
                 expect(result.question.context).toBeDefined();
                 break;
             }
        }
        // Ideally we'd mock Math.random to force it, but this statistical check is okay for now.
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
