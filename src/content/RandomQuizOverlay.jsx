import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Power, Check, Brain, Volume2 } from 'lucide-react';

export default function RandomQuizOverlay({ onClose, onSnooze, onTurnOff }) {
    const [vocabulary, setVocabulary] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect'

    // Load vocabulary on mount
    useEffect(() => {
        chrome.storage.local.get(['vocabulary'], (result) => {
            if (result.vocabulary) {
                setVocabulary(result.vocabulary);
                generateQuestions(result.vocabulary);
            }
        });
    }, []);

    const generateQuestions = (vocab) => {
        console.log('RandomQuizOverlay: Generating questions from vocab size', vocab.length);
        if (!vocab || vocab.length < 4) {
            console.log('RandomQuizOverlay: Not enough vocab (needs 4+)');
            return;
        }

        const now = Date.now();
        // Filter due words
        let candidates = vocab.filter(w => !w.nextReview || w.nextReview <= now);

        // If no due words, pick from all
        if (candidates.length === 0) {
            candidates = vocab;
        }

        // --- Smart Random Logic ---
        chrome.storage.local.get(['randomHistory'], (result) => {
            const history = result.randomHistory || { lastWord: null, dailyCounts: {} };
            const today = new Date().toISOString().split('T')[0];

            let filteredCandidates = candidates.filter(w => {
                // 1. Avoid immediate predecessor
                if (w.headword === history.lastWord) return false;
                
                // 2. Limit daily appearance (max 2)
                const dayRecord = history.dailyCounts[today] || {};
                const count = dayRecord[w.headword] || 0;
                if (count >= 2) return false;

                return true;
            });

            // Fallback if too aggressive
            if (filteredCandidates.length === 0) {
                console.log('RandomQuizOverlay: Filter too aggressive, relaxing rules.');
                // Relax 1: Allow last word if huge pool? No, just allow repeat daily.
                filteredCandidates = candidates.filter(w => w.headword !== history.lastWord);
                
                if (filteredCandidates.length === 0) {
                    // Just pick anything
                    filteredCandidates = candidates;
                }
            }

            // Pick ONE random word
            const word = filteredCandidates[Math.floor(Math.random() * filteredCandidates.length)];

            // Update History
            const newHistory = { ...history };
            newHistory.lastWord = word.headword;
            if (!newHistory.dailyCounts[today]) newHistory.dailyCounts[today] = {};
            newHistory.dailyCounts[today][word.headword] = (newHistory.dailyCounts[today][word.headword] || 0) + 1;
            
            // Cleanup old dates? (Optional optimization)
            // For now, keep it simple. If object gets huge, we can prune keys != today.
            const dateKeys = Object.keys(newHistory.dailyCounts);
            if (dateKeys.length > 5) {
               dateKeys.forEach(k => {
                   if (k !== today) delete newHistory.dailyCounts[k];
               });
            }

            chrome.storage.local.set({ randomHistory: newHistory });


            const definition = word.senses?.[0]?.definition || 'No definition';
            const otherWords = vocab.filter(w => w.headword !== word.headword);

            let distractors = otherWords
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map(w => w.senses?.[0]?.definition || 'No def');

            // Fill with dummy if needed
            while (distractors.length < 3) {
                distractors.push('Random Wrong Definition ' + Math.floor(Math.random() * 100));
            }

            const options = [definition, ...distractors].sort(() => 0.5 - Math.random());

            const question = {
                wordObj: word,
                type: 'meaning',
                prompt: word.headword,
                correctAnswer: definition,
                options: options
            };

            console.log('RandomQuizOverlay: Question set', question);
            setQuestions([question]); 
        });
    };

    const handleAnswer = (option) => {
        if (feedback) return;

        const currentQ = questions[currentIndex];
        const isCorrect = option === currentQ.correctAnswer;

        if (isCorrect) {
            setScore(prev => prev + 1);
            setFeedback('correct');
            // updateWordProgress(currentQ.wordObj, true); // Decoupled: No SRS update
        } else {
            setFeedback('incorrect');
            // updateWordProgress(currentQ.wordObj, false); // Decoupled: No SRS update
        }

        // Show result immediately after small delay or just stay there?
        // User asked for 1 question. After answer, we should probably show "Correct/Incorrect" state 
        // and then offer "Close" or "Snooze".
        // Let's switch to result screen after 1s
        setTimeout(() => {
            setShowResult(true);
        }, 1000);
    };

    // Decoupled: logic removed
    // const updateWordProgress = (word, isCorrect) => { ... }

    const playAudio = (url) => {
        if (url) new Audio(url).play();
    };

    if (questions.length === 0) {
        return null;
    }

    // Common Close/Snooze Footer
    const FooterActions = () => (
        <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>Busy? Snooze for later:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => onSnooze(30)} className="py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1">
                    <Clock size={12} /> 30m
                </button>
                <button onClick={() => onSnooze(60)} className="py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1">
                    <Clock size={12} /> 1h
                </button>
                <button onClick={() => onSnooze(180)} className="py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1">
                    <Clock size={12} /> 3h
                </button>
            </div>
            <button onClick={onTurnOff} className="mt-2 text-xs text-red-400 hover:text-red-500 hover:underline text-center w-full">
                Turn off Random Practice
            </button>
        </div>
    );

    if (showResult) {
        return (
            <div className="fixed inset-0 z-[2147483647] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-sans">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm relative animate-scale-up">
                    <div className="text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${feedback === 'correct' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {feedback === 'correct' ? <Check size={32} /> : <X size={32} />}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                            {feedback === 'correct' ? 'Excellent!' : 'Needs Review'}
                        </h3>
                        {feedback !== 'correct' && (
                            <div className="mb-4 bg-red-50 p-3 rounded-lg text-sm text-red-800">
                                <strong>Correct Meaning:</strong><br />
                                {questions[0].correctAnswer}
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="w-full bg-oxford-blue text-white py-3 rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/10"
                        >
                            Continue Browsing
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];

    return (
        <div className="fixed inset-0 z-[2147483647] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-md relative animate-slide-up">
                {/* Header */}
                <div className="bg-oxford-blue px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Brain size={20} className="text-blue-300" />
                        <span className="font-bold text-base">Quick Vocabulary Check</span>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6 text-center">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Choose the correct meaning</span>
                        <div className="flex items-center justify-center gap-3 mb-2">
                            <h2 className="text-3xl font-bold text-oxford-blue">{currentQ.prompt}</h2>
                            {currentQ.wordObj.phonetics?.[0]?.audioUrl && (
                                <button
                                    onClick={() => playAudio(currentQ.wordObj.phonetics[0].audioUrl)}
                                    className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors ring-4 ring-blue-50/50"
                                >
                                    <Volume2 size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {currentQ.options.map((option, idx) => {
                            let btnClass = "w-full text-left p-4 rounded-xl border text-sm transition-all duration-200 relative group ";
                            const isCorrect = option === currentQ.correctAnswer;

                            if (feedback) {
                                if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-900 font-medium";
                                else btnClass += "bg-gray-50 border-gray-100 text-gray-400 opacity-50";
                            } else {
                                btnClass += "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-md hover:-translate-y-0.5 text-gray-700";
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(option)}
                                    disabled={!!feedback}
                                    className={btnClass}
                                >
                                    <span className="mr-6 block leading-snug">{option}</span>
                                    {feedback && isCorrect && <Check size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600" />}
                                    {!feedback && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-gray-200 group-hover:border-blue-400"></div>}
                                </button>
                            );
                        })}
                    </div>

                    <FooterActions />
                </div>
            </div>
        </div>
    );
}
