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
        if (!vocab || vocab.length < 3) return; // Need some words

        const now = Date.now();
        // Filter due words
        let candidates = vocab.filter(w => !w.nextReview || w.nextReview <= now);
        
        // If not enough due, pick randoms to fill
        if (candidates.length < 3) {
            const others = vocab.filter(w => !candidates.includes(w));
            candidates = [...candidates, ...others].slice(0, 3);
        } else {
            // Pick random 3 from due
            candidates = candidates.sort(() => 0.5 - Math.random()).slice(0, 3);
        }

        const newQuestions = candidates.map(word => {
            const definition = word.senses?.[0]?.definition || 'No definition';
            const otherWords = vocab.filter(w => w.headword !== word.headword);
            
            // Simple Question Type: Meaning
            // We could mix types but for simplicity let's stick to Meaning or Audio-Meaning
            
            const distractors = otherWords
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map(w => w.senses?.[0]?.definition || 'No def');

            const options = [definition, ...distractors].sort(() => 0.5 - Math.random());

            return {
                wordObj: word,
                type: 'meaning',
                prompt: word.headword,
                correctAnswer: definition,
                options: options
            };
        });

        setQuestions(newQuestions);
    };

    const handleAnswer = (option) => {
        if (feedback) return;

        const currentQ = questions[currentIndex];
        const isCorrect = option === currentQ.correctAnswer;

        if (isCorrect) {
            setScore(prev => prev + 1);
            setFeedback('correct');
            updateWordProgress(currentQ.wordObj, true);
        } else {
            setFeedback('incorrect');
            updateWordProgress(currentQ.wordObj, false);
        }

        setTimeout(() => {
            if (currentIndex + 1 < questions.length) {
                setCurrentIndex(prev => prev + 1);
                setFeedback(null);
            } else {
                setShowResult(true);
            }
        }, 1500);
    };

    const updateWordProgress = (word, isCorrect) => {
        // Logic similar to Quiz.jsx but simpler
        // Failed -> Level 0. Correct -> Level + 1.
        
        const newLevel = isCorrect ? (word.srsLevel || 0) + 1 : 0;
        
        // Calculate next review (simplified version of Quiz.jsx calc)
        const days = 24 * 60 * 60 * 1000;
        let nextReview = Date.now();
        if (newLevel === 0) nextReview += 1 * days;
        else if (newLevel === 1) nextReview += 3 * days;
        else if (newLevel === 2) nextReview += 7 * days;
        else if (newLevel === 3) nextReview += 14 * days;
        else nextReview += (newLevel * 7) * days;

        const updatedWord = { ...word, srsLevel: newLevel, nextReview };

        // Update in IDB/Storage
        // We need to fetch fresh list to avoid race conditions roughly, 
        // though strictly we accepted `vocabulary` state as source of truth for this instance.
        // Better to use functional update on storage if possible, but chrome storage is async.
        // We'll just read-modify-write based on current state.
        
        chrome.storage.local.get(['vocabulary'], (result) => {
            const currentVocab = result.vocabulary || [];
            const newVocab = currentVocab.map(w => w.headword === word.headword ? updatedWord : w);
            chrome.storage.local.set({ vocabulary: newVocab });
        });
    };

    const playAudio = (url) => {
        if (url) new Audio(url).play();
    };

    if (questions.length === 0) {
        return null; // or loading
    }

    if (showResult) {
        return (
            <div className="fixed top-4 right-4 z-[999999] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-6 animate-fade-in font-sans">
                <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Brain size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Practice Complete!</h3>
                    <p className="text-gray-600 mb-6">You got {score}/{questions.length} correct.</p>
                    <button 
                        onClick={onClose}
                        className="w-full bg-oxford-blue text-white py-2 rounded-lg font-bold hover:bg-blue-800 transition-colors"
                    >
                        Close
                    </button>
                    <div className="mt-4 flex justify-between text-xs text-gray-400">
                        <button onClick={() => onSnooze(60)} className="hover:text-gray-600 underline">Snooze 1h</button>
                    </div>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];

    return (
        <div className="fixed top-4 right-4 z-[999999] w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden font-sans animate-slide-in">
            {/* Header */}
            <div className="bg-oxford-blue px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                    <Brain size={18} />
                    <span className="font-bold text-sm">Quick Review</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Snooze Options */}
                    <div className="group relative">
                        <button className="text-blue-200 hover:text-white transition-colors p-1">
                            <Clock size={16} />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-lg shadow-xl py-1 hidden group-hover:block border border-gray-100">
                            <button onClick={() => onSnooze(30)} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">Snooze 30m</button>
                            <button onClick={() => onSnooze(60)} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">Snooze 1h</button>
                            <button onClick={() => onSnooze(180)} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">Snooze 3h</button>
                            <div className="border-t border-gray-100 my-1"></div>
                            <button onClick={onTurnOff} className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1">
                                <Power size={12} /> Turn Off
                            </button>
                        </div>
                    </div>
                    
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-100">
                <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                />
            </div>

            {/* Content */}
            <div className="p-6">
                <div className="mb-6">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Definition of:</span>
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-oxford-blue">{currentQ.prompt}</h2>
                        {currentQ.wordObj.phonetics?.[0]?.audioUrl && (
                            <button 
                                onClick={() => playAudio(currentQ.wordObj.phonetics[0].audioUrl)}
                                className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
                            >
                                <Volume2 size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    {currentQ.options.map((option, idx) => {
                        let btnClass = "w-full text-left p-3 rounded-xl border text-sm transition-all duration-200 relative ";
                        const isCorrect = option === currentQ.correctAnswer;
                        
                        if (feedback) {
                            if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-900";
                            else btnClass += "bg-white border-gray-100 text-gray-400 opacity-50";
                        } else {
                            btnClass += "bg-white border-gray-200 hover:border-oxford-blue hover:bg-blue-50/50 hover:text-oxford-blue text-gray-600";
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(option)}
                                disabled={!!feedback}
                                className={btnClass}
                            >
                                {option}
                                {feedback && isCorrect && <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
