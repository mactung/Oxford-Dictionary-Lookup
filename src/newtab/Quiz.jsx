import React, { useState, useEffect } from 'react';
import { Check, X, Clock, Brain } from 'lucide-react';

export default function Quiz({ vocabulary, onUpdateWord }) {
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
            <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Brain className="text-gray-300 mb-3" size={48} />
                <p className="text-oxford-blue font-medium">Keep saving words!</p>
                <p className="text-gray-500 text-sm">You need at least 4 saved words to unlock practice quizzes.</p>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Check className="text-green-500 mb-4 bg-green-100 p-3 rounded-full" size={64} />
                <h2 className="text-2xl font-bold text-oxford-blue mb-2">All Caught Up!</h2>
                <p className="text-gray-500 mb-6">You have no words due for review right now.</p>

                <button
                    onClick={() => generateQuestions(true)}
                    className="flex items-center gap-2 text-oxford-blue hover:text-blue-700 font-medium transition-colors"
                >
                    <Clock size={18} />
                    Review Ahead (Practice anyway)
                </button>
            </div>
        );
    }

    if (showScore) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <h2 className="text-2xl font-bold text-oxford-blue mb-2">Session Complete!</h2>
                <div className="text-5xl font-bold text-green-500 mb-6">{score} <span className="text-gray-300 text-3xl">/ {questions.length}</span></div>

                <p className="text-gray-500 mb-6">Come back later for more scheduled reviews.</p>

                <button
                    onClick={() => generateQuestions(false)}
                    className="bg-oxford-blue text-white px-8 py-3 rounded-lg hover:bg-blue-800 transition-colors font-medium shadow-md"
                >
                    Update & Continue
                </button>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="max-w-2xl mx-auto">
            <div className={`overflow-hidden transition-all ${isReviewAhead ? 'border-orange-200' : ''}`}>
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Question {currentQuestionIndex + 1} of {questions.length}</span>
                        {isReviewAhead && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold">Extra Practice</span>}
                    </div>
                    <div className="bg-blue-50 text-oxford-blue px-3 py-1 rounded-full text-sm font-bold">
                        Score: {score}
                    </div>
                </div>

                {/* Question */}
                <div className="text-center mb-8">
                    <h2 className="text-gray-500 text-sm mb-2">What is the definition of</h2>
                    <h1 className="text-4xl font-bold text-oxford-blue">{currentQuestion.wordObj.headword}?</h1>
                </div>

                {/* Options */}
                <div className="grid gap-3">
                    {currentQuestion.options.map((option, index) => {
                        let buttonClass = "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex justify-between items-center group ";
                        const isSelected = selectedAnswer === option;
                        const isCorrect = option === currentQuestion.correctAnswer;

                        if (selectedAnswer) {
                            if (isSelected && isCorrect) {
                                buttonClass += "bg-green-50 border-green-500 text-green-900 shadow-sm";
                            } else if (isSelected && !isCorrect) {
                                buttonClass += "bg-red-50 border-red-500 text-red-900 shadow-sm";
                            } else if (isCorrect) {
                                buttonClass += "bg-green-50 border-green-300 text-green-800";
                            } else {
                                buttonClass += "bg-gray-50 border-gray-100 opacity-40 grayscale";
                            }
                        } else {
                            buttonClass += "bg-white border-gray-100 hover:border-oxford-blue hover:bg-blue-50/50 hover:shadow-md";
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => handleAnswerClick(option)}
                                disabled={!!selectedAnswer}
                                className={buttonClass}
                            >
                                <span className="font-medium text-[15px] leading-snug">{option}</span>
                                {selectedAnswer && isCorrect && <Check size={20} className="text-green-600 shrink-0 ml-3" />}
                                {selectedAnswer && isSelected && !isCorrect && <X size={20} className="text-red-600 shrink-0 ml-3" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
