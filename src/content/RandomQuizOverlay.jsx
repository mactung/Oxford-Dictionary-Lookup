// in RandomQuizOverlay.jsx

import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Check, Brain, Volume2 } from 'lucide-react';
import QuizQuestion from '../components/QuizQuestion';
import { generateRandomQuestion } from '../utils/quizGenerator';

export default function RandomQuizOverlay({ onClose, onSnooze, onTurnOff }) {
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect'

    // Load vocabulary on mount
    useEffect(() => {
        chrome.storage.local.get(['vocabulary', 'randomHistory'], (result) => {
            if (result.vocabulary) {
                generateQuestions(result.vocabulary, result.randomHistory);
            }
        });
    }, []);

    const generateQuestions = (vocab, history) => {
        const result = generateRandomQuestion(vocab, history);
        
        if (result && result.question) {
            console.log('RandomQuizOverlay: Question set', result.question);
            setQuestions([result.question]);
            
            // Save updated history
            chrome.storage.local.set({ randomHistory: result.newHistory });
        } else {
             console.log('RandomQuizOverlay: No question generated');
        }
    };

    const handleAnswer = (option) => {
        if (feedback) return;
        setSelectedAnswer(option);

        const currentQ = questions[currentIndex];
        const isCorrect = option === currentQ.correctAnswer;

        if (isCorrect) {
            setScore(prev => prev + 1);
            setFeedback('correct');
        } else {
            setFeedback('incorrect');
        }

        setTimeout(() => {
            setShowResult(true);
        }, 1000);
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
                <QuizQuestion 
                    question={currentQ}
                    feedback={feedback}
                    selectedAnswer={selectedAnswer}
                    onAnswer={handleAnswer}
                />
                <div className="px-6 pb-6">
                     <FooterActions />
                </div>
            </div>
        </div>
    );
}
