import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RandomQuizOverlay from './RandomQuizOverlay';

describe.skip('RandomQuizOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const mockVocab = [
        {
            headword: 'test',
            senses: [{ definition: 'def 1' }],
            nextReview: 0
        },
        {
            headword: 'other',
            senses: [{ definition: 'def 2' }],
            nextReview: 0
        }
    ];

    it('should not render if no vocab', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({ vocabulary: [] }));
        render(<RandomQuizOverlay onClose={() => { }} onSnooze={() => { }} onTurnOff={() => { }} />);
        expect(screen.queryByText('Quick Vocabulary Check')).not.toBeInTheDocument();
    });

    it('should render quiz if vocab exists', async () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({ vocabulary: mockVocab }));
        render(<RandomQuizOverlay onClose={() => { }} onSnooze={() => { }} onTurnOff={() => { }} />);

        await waitFor(() => {
            expect(screen.getByText('Quick Vocabulary Check')).toBeInTheDocument();
        });
    });

    it.skip('should handle answer and show result (1 question limit)', async () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({ vocabulary: mockVocab }));
        render(<RandomQuizOverlay onClose={() => { }} onSnooze={() => { }} onTurnOff={() => { }} />);

        // Wait for question
        await waitFor(() => screen.getByText('test') || screen.getByText('other'));

        const options = screen.getAllByRole('button');
        const answerOptions = options.filter(btn => btn.className.includes('w-full text-left'));

        fireEvent.click(answerOptions[0]);

        // Advance timer
        await vi.advanceTimersByTimeAsync(1500);

        // Check for result text (Excellent or Needs Review)
        const resultTitle = screen.queryByText(/Excellent!|Needs Review/);
        expect(resultTitle).toBeInTheDocument();
    });
});
