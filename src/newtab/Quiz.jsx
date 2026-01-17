import React, { useState, useEffect } from 'react';
import { Check, X, Clock, Brain, ArrowLeft } from 'lucide-react';

export default function Quiz({ vocabulary, onUpdateWord, onExit }) {
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showScore, setShowScore] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isReviewAhead, setIsReviewAhead] = useState(false);

    useEffect(() => {
        // Only generate if we are not currently in the middle of a session?
        // Or if the vocab length changes drastically.
        // For simplicity, we reset if vocabulary changes (e.g. first load).
        if (questions.length === 0) {
            generateQuestions();
        }
    }, [vocabulary]);

    const calculateNextReview = (level) => {
        const now = Date.now();
        const minutes = 60 * 1000;
        const hours = 60 * minutes;
        const days = 24 * hours;

        switch (level) {
            case 0: return now + 1 * minutes;
            case 1: return now + 10 * minutes;
            case 2: return now + 1 * days;
            case 3: return now + 3 * days;
            default: return now + (level - 3) * 7 * days;
        }
    };

    const generateQuestions = (reviewAhead = false) => {
        setIsReviewAhead(reviewAhead);

        if (vocabulary.length < 4) return;

        const now = Date.now();

        // Filter due words
        let candidates = vocabulary.filter(w => {
            if (!w.nextReview) return true; // New/Legacy
            return w.nextReview <= now;
        });

        // If reviewing ahead, take non-due words sorted by next review
        if (reviewAhead && candidates.length < 5) {
            const others = vocabulary.filter(w => !candidates.includes(w))
                .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
            candidates = [...candidates, ...others];
        }

        // Shuffle candidates
        const shuffled = [...candidates].sort(() => 0.5 - Math.random());
        // Limit to 5 per session
        const selectedWords = shuffled.slice(0, 5);

        const newQuestions = selectedWords.map(word => {
            // Correct Answer
            const correctDefinition = word.senses && word.senses[0] ? word.senses[0].definition : 'No definition';

            // Distractors
            const distractors = vocabulary
                .filter(w => w.headword !== word.headword)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map(w => w.senses && w.senses[0] ? w.senses[0].definition : 'No definition');

            // Mix answers
            const options = [...distractors, correctDefinition].sort(() => 0.5 - Math.random());

            return {
                wordObj: word, // Keep full object reference
                correctAnswer: correctDefinition,
                options
            };
        });

        if (newQuestions.length > 0) {
            setQuestions(newQuestions);
            setCurrentQuestionIndex(0);
            setScore(0);
            setShowScore(false);
            setSelectedAnswer(null);
        } else {
            setQuestions([]);
        }
    };

    const handleAnswerClick = (option) => {
        if (selectedAnswer) return;

        setSelectedAnswer(option);
        const currentQ = questions[currentQuestionIndex];
        const isCorrect = option === currentQ.correctAnswer;

        if (isCorrect) {
            setScore(score + 1);

            // Update SRS - Increase Level
            const currentLevel = currentQ.wordObj.srsLevel || 0;
            const newLevel = currentLevel + 1;
            const nextReview = calculateNextReview(newLevel);

            onUpdateWord({
                ...currentQ.wordObj,
                srsLevel: newLevel,
                nextReview
            });

        } else {
            // Update SRS - Reset to 0
            const nextReview = calculateNextReview(0);
            onUpdateWord({
                ...currentQ.wordObj,
                srsLevel: 0,
                nextReview
            });
        }

        setTimeout(() => {
            const nextQuestion = currentQuestionIndex + 1;
            if (nextQuestion < questions.length) {
                setCurrentQuestionIndex(nextQuestion);
                setSelectedAnswer(null);
            } else {
                setShowScore(true);
            }
        }, 1500);
    };

    // Need at least 4 words
    if (vocabulary.length < 4) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center bg-white rounded-3xl p-10 shadow-xl max-w-lg mx-auto">
                <Brain className="text-gray-200 mb-6" size={80} />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Need more words</h2>
                <p className="text-gray-500 mb-8">You need at least 4 saved words to unlock practice quizzes.</p>
                <button onClick={onExit} className="text-gray-400 hover:text-gray-600 font-medium">Close</button>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl p-10 shadow-xl max-w-lg mx-auto">
                <div className="bg-green-100 p-6 rounded-full mb-6">
                    <Check className="text-green-500" size={48} />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">You're all set!</h2>
                <p className="text-gray-500 mb-8 text-lg">You have no words due for review right now.</p>

                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={() => generateQuestions(true)}
                        className="w-full bg-oxford-blue text-white py-3.5 rounded-xl font-bold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <Clock size={20} />
                        Review Ahead
                    </button>
                    <button
                        onClick={onExit}
                        className="w-full text-gray-400 hover:bg-gray-50 py-3 rounded-xl font-medium transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (showScore) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl p-10 shadow-xl max-w-lg mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Session Complete!</h2>
                <div className="text-6xl font-bold text-green-500 mb-8">{score} <span className="text-gray-300 text-4xl">/ {questions.length}</span></div>

                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={() => generateQuestions(false)}
                        className="w-full bg-oxford-blue text-white py-3.5 rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/10"
                    >
                        Continue Reviewing
                    </button>
                    <button
                        onClick={onExit}
                        className="w-full border border-gray-200 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="max-w-2xl mx-auto w-full">
            <div className={`bg-white rounded-3xl shadow-xl overflow-hidden transition-all relative ${isReviewAhead ? 'border-4 border-orange-100' : ''}`}>
                <button onClick={onExit} className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors">
                    <X size={24} />
                </button>

                <div className="p-8 md:p-12">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Question {currentQuestionIndex + 1} of {questions.length}</span>
                            {isReviewAhead && <span className="ml-2 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold uppercase">Review Ahead</span>}
                        </div>
                        <div className="bg-blue-50 text-oxford-blue px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                            Score: {score}
                        </div>
                    </div>

                    {/* Question */}
                    <div className="text-center mb-12">
                        <h2 className="text-gray-400 text-sm font-medium mb-3 uppercase tracking-wide">Definition of</h2>
                        <h1 className="text-4xl md:text-5xl font-bold text-oxford-blue mb-2">{currentQuestion.wordObj.headword}</h1>
                    </div>

                    {/* Options */}
                    <div className="grid gap-3">
                        {currentQuestion.options.map((option, index) => {
                            let buttonClass = "w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex justify-between items-center group relative overflow-hidden ";
                            const isSelected = selectedAnswer === option;
                            const isCorrect = option === currentQuestion.correctAnswer;

                            if (selectedAnswer) {
                                if (isSelected && isCorrect) {
                                    buttonClass += "bg-green-50 border-green-500 text-green-900 shadow-sm z-10 scale-[1.02]";
                                } else if (isSelected && !isCorrect) {
                                    buttonClass += "bg-red-50 border-red-500 text-red-900 shadow-sm z-10 scale-[1.02]";
                                } else if (isCorrect) {
                                    buttonClass += "bg-green-50 border-green-300 text-green-800 opacity-100";
                                } else {
                                    buttonClass += "bg-gray-50 border-gray-100 opacity-30 grayscale blur-[1px]";
                                }
                            } else {
                                buttonClass += "bg-white border-gray-100 hover:border-oxford-blue hover:bg-blue-50/30 hover:shadow-lg hover:-translate-y-0.5";
                            }

                            return (
                                <button
                                    key={index}
                                    onClick={() => handleAnswerClick(option)}
                                    disabled={!!selectedAnswer}
                                    className={buttonClass}
                                >
                                    <span className="font-medium text-[16px] leading-snug relative z-10">{option}</span>
                                    {selectedAnswer && isCorrect && <Check size={24} className="text-green-600 shrink-0 ml-4 relative z-10" />}
                                    {selectedAnswer && isSelected && !isCorrect && <X size={24} className="text-red-600 shrink-0 ml-4 relative z-10" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
