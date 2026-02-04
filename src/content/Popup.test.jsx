import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Popup from './Popup';

// Mock Parser
vi.mock('../utils/parser', () => ({
    parseOxfordHTML: vi.fn((html) => {
        if (html === 'error') return { error: 'Failed' };
        return {
            headword: 'test',
            pos: 'noun',
            phonetics: [{ type: 'BrE', ipa: 'test', audioUrl: 'test.mp3' }],
            senses: [{ definition: 'a test definition', examples: ['example 1'] }],
            idioms: []
        };
    })
}));

describe('Popup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render loading state initially', () => {
        render(<Popup x={0} y={0} word="test" onClose={() => { }} />);
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render data after fetch', async () => {
        chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
            if (cb) cb({ success: true, html: '<div>mock html</div>' });
        });

        render(<Popup x={0} y={0} word="test" onClose={() => { }} />);

        await waitFor(() => {
            expect(screen.getByText('test')).toBeInTheDocument();
            expect(screen.getByText('noun')).toBeInTheDocument();
            expect(screen.getByText('a test definition')).toBeInTheDocument();
        });
    });

    it('should handle save toggle', async () => {
        // Stateful Mock
        let storedVocab = [];
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({ vocabulary: storedVocab }));
        chrome.storage.local.set.mockImplementation((data) => {
            if (data.vocabulary) storedVocab = data.vocabulary;
        });

        // Mock fetch success
        chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
            if (cb) cb({ success: true, html: '<div>mock html</div>' });
        });

        render(<Popup x={0} y={0} word="test" onClose={() => { }} />);

        // Wait for load
        await waitFor(() => screen.getByText('Save'));

        const saveBtn = screen.getByText('Save');
        fireEvent.click(saveBtn);

        // Check optimistic UI
        expect(screen.getByText('Saved')).toBeInTheDocument();

        // Check storage update (Add)
        expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
        expect(storedVocab).toHaveLength(1);
        expect(storedVocab[0].headword).toBe('test');

        // Click again to unsave
        fireEvent.click(saveBtn);

        // Check UI back to Save
        expect(screen.getByText('Save')).toBeInTheDocument();

        // Check storage update (Remove)
        expect(chrome.storage.local.set).toHaveBeenCalledTimes(2);
        expect(storedVocab).toHaveLength(0);
    });
});
