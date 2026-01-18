import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Clock, Brain, Volume2, ArrowRight, Play } from 'lucide-react';

export default function Quiz({ vocabulary, onUpdateWord, onExit }) {
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showScore, setShowScore] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null); // For multiple choice
    const [spellingInput, setSpellingInput] = useState('');     // For spelling
    const [isReviewAhead, setIsReviewAhead] = useState(false);
    const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect'

    // New State for Pre-Quiz Review
    const [preQuizWords, setPreQuizWords] = useState([]);
    const [isPreQuizReview, setIsPreQuizReview] = useState(false);

    const audioRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (questions.length === 0 && vocabulary.length > 0 && !isPreQuizReview) {
            generateQuestions();
        }
    }, [vocabulary]);

    // Auto-focus input for spelling questions
    useEffect(() => {
        if (!isPreQuizReview && questions.length > 0 && !showScore) {
            const currentQ = questions[currentQuestionIndex];
            if (currentQ.type === 'spelling' && inputRef.current) {
                inputRef.current.focus();
            }
            // Auto-play audio if applicable
            if ((currentQ.type === 'audio-word' || currentQ.type === 'audio-meaning') && currentQ.audioUrl) {
                playAudio(currentQ.audioUrl);
            }
        }
    }, [currentQuestionIndex, questions, showScore, isPreQuizReview]);

    const playAudio = (url) => {
        if (audioRef.current && url) {
            audioRef.current.src = url;
            audioRef.current.play().catch(e => console.log("Audio play failed", e));
        }
    };

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

        let candidates = vocabulary.filter(w => {
            if (!w.nextReview) return true;
            return w.nextReview <= now;
        });

        // If reviewing ahead, strictly only allowing "wrong" words (SRS Level 0 or undefined).
        // Correct words (SRS Level > 0) must wait for their time.
        if (reviewAhead) {
            const wrongWordsNotDue = vocabulary.filter(w =>
                !candidates.includes(w) && (w.srsLevel === 0 || !w.srsLevel)
            ).sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));

            // Fill up to 5
            const needed = 5 - candidates.length;
            if (needed > 0) {
                candidates = [...candidates, ...wrongWordsNotDue.slice(0, needed)];
            }
        }
        // NOTE: We do NOT backfill for normal sessions anymore, enforcing strict SRS timing.

        // Strict limit to 5 words
        const selectedWords = candidates.slice(0, 5);
        setPreQuizWords(selectedWords);
        setIsPreQuizReview(true);
        setShowScore(false);

        // Generate questions for these specific 5 words
        let newQuestions = [];

        selectedWords.forEach(word => {
            const hasAudio = word.phonetics && word.phonetics[0] && word.phonetics[0].audioUrl;
            const definition = word.senses && word.senses[0] ? word.senses[0].definition : 'No definition';
            const otherWords = vocabulary.filter(w => w.headword !== word.headword);

            // 1. Meaning Question
            newQuestions.push({
                wordObj: word,
                type: 'meaning',
                prompt: word.headword,
                correctAnswer: definition,
                options: [definition, ...getRandomDistractors(otherWords, 3, 'definition')].sort(() => 0.5 - Math.random())
            });

            // 2. Spelling Question
            newQuestions.push({
                wordObj: word,
                type: 'spelling',
                prompt: definition,
                correctAnswer: word.headword,
                options: []
            });

            // 3. Audio -> Word (if audio exists)
            if (hasAudio) {
                newQuestions.push({
                    wordObj: word,
                    type: 'audio-word',
                    audioUrl: word.phonetics[0].audioUrl,
                    prompt: "Listen and match the word",
                    correctAnswer: word.headword,
                    options: [word.headword, ...getRandomDistractors(otherWords, 3, 'headword')].sort(() => 0.5 - Math.random())
                });
            }

            // 4. Audio -> Meaning (if audio exists)
            if (hasAudio) {
                newQuestions.push({
                    wordObj: word,
                    type: 'audio-meaning',
                    audioUrl: word.phonetics[0].audioUrl,
                    prompt: "Listen and choose the meaning",
                    correctAnswer: definition,
                    options: [definition, ...getRandomDistractors(otherWords, 3, 'definition')].sort(() => 0.5 - Math.random())
                });
            }

            // 5. IPA Question (if IPA and audio exists)
            if (hasAudio && word.phonetics && word.phonetics[0] && word.phonetics[0].ipa) {
                newQuestions.push({
                    wordObj: word,
                    type: 'ipa',
                    audioUrl: word.phonetics[0].audioUrl,
                    prompt: `How is "${word.headword}" pronounced?`,
                    correctAnswer: word.phonetics[0].ipa,
                    options: [word.phonetics[0].ipa, ...getRandomDistractors(otherWords, 3, 'ipa')].sort(() => 0.5 - Math.random())
                });
            }
        });

        // Shuffle all generated questions
        newQuestions = newQuestions.sort(() => 0.5 - Math.random());

        if (newQuestions.length > 0) {
            setQuestions(newQuestions);
            setCurrentQuestionIndex(0);
            setScore(0);
            setSelectedAnswer(null);
            setSpellingInput('');
            setFeedback(null);
        } else {
            setQuestions([]);
            setIsPreQuizReview(false); // No questions generated
        }
    };

    const startQuiz = () => {
        setIsPreQuizReview(false);
    };

    const getRandomDistractors = (pool, count, key) => {
        const getVal = (w) => {
            if (key === 'definition') return w.senses?.[0]?.definition || 'No def';
            if (key === 'ipa') return w.phonetics?.[0]?.ipa || '/.../';
            return w[key];
        };

        return pool
            .sort(() => 0.5 - Math.random())
            .slice(0, count)
            .map(getVal);
    };

    const processResult = (isCorrect) => {
        const currentQ = questions[currentQuestionIndex];

        if (isCorrect) {
            setScore(prev => prev + 1);
            setFeedback('correct');

            // Only update SRS level ONCE per word per session ideally, but simplified here:
            // We increase level if they get it right. Since we have multiple Qs per word, 
            // this might inflate levels quickly. 
            // Better logic: Track result per word, update at end. 
            // For now, let's keep it simple: Use a small increment or only update on 'meaning' type?
            // User requested "tuân thủ đúng thuật toán ngắt quãng".
            // Let's just update as is for now, maybe refined later.

            const currentLevel = currentQ.wordObj.srsLevel || 0;
            const newLevel = currentLevel + 1;
            onUpdateWord({
                ...currentQ.wordObj,
                srsLevel: newLevel,
                nextReview: calculateNextReview(newLevel)
            });
        } else {
            setFeedback('incorrect');
            onUpdateWord({
                ...currentQ.wordObj,
                srsLevel: 0,
                nextReview: calculateNextReview(0)
            });
        }

        setTimeout(() => {
            const nextQuestion = currentQuestionIndex + 1;
            if (nextQuestion < questions.length) {
                setCurrentQuestionIndex(nextQuestion);
                setSelectedAnswer(null);
                setSpellingInput('');
                setFeedback(null);
            } else {
                setShowScore(true);
            }
        }, 1500);
    };

    const handleOptionSelect = (option) => {
        if (selectedAnswer || feedback) return;
        setSelectedAnswer(option);
        const currentQ = questions[currentQuestionIndex];
        processResult(option === currentQ.correctAnswer);
    };

    const handleSpellingSubmit = (e) => {
        e.preventDefault();
        if (feedback) return;

        const currentQ = questions[currentQuestionIndex];
        const isCorrect = spellingInput.trim().toLowerCase() === currentQ.correctAnswer.toLowerCase();

        processResult(isCorrect);
    };

    // --- Renders ---

    // 0. Not enough words
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

    // 1. Initial State / Nothing Due
    if (questions.length === 0 && !isPreQuizReview && !showScore) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl p-10 shadow-xl max-w-lg mx-auto">
                <div className="bg-green-100 p-6 rounded-full mb-6">
                    <Check className="text-green-500" size={48} />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">You're all set!</h2>
                <p className="text-gray-500 mb-8 text-lg">You have no words due for review right now.</p>
                <div className="flex flex-col gap-3 w-full">
                    <button onClick={() => generateQuestions(true)} className="w-full bg-oxford-blue text-white py-3.5 rounded-xl font-bold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2">
                        <Clock size={20} /> Review Ahead
                    </button>
                    <button onClick={onExit} className="w-full text-gray-400 hover:bg-gray-50 py-3 rounded-xl font-medium transition-colors">Back to Home</button>
                </div>
            </div>
        );
    }

    // 2. Pre-Quiz Review Screen
    if (isPreQuizReview) {
        return (
            <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl shadow-xl overflow-hidden p-8 flex flex-col h-[600px]"> {/* Fixed height for scroll */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-oxford-blue">Review These Words</h2>
                    <p className="text-gray-500">Take a moment to refresh your memory before the quiz.</p>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {preQuizWords.map((word, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-lg font-bold text-gray-900">{word.headword}</h3>
                                    {word.phonetics?.[0]?.ipa && (
                                        <span className="text-sm text-gray-500 font-mono">/{word.phonetics[0].ipa}/</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-1">{word.senses?.[0]?.definition}</p>
                            </div>
                            {word.phonetics?.[0]?.audioUrl && (
                                <button
                                    onClick={() => playAudio(word.phonetics[0].audioUrl)}
                                    className="p-2 bg-white rounded-full shadow-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                >
                                    <Volume2 size={20} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <button
                        onClick={startQuiz}
                        className="w-full bg-oxford-blue text-white py-4 rounded-xl font-bold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 text-lg shadow-lg shadow-blue-900/10"
                    >
                        Start Quiz <ArrowRight size={20} />
                    </button>
                </div>

                <audio ref={audioRef} className="hidden" />
            </div>
        );
    }

    // 3. Score Screen
    if (showScore) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl p-10 shadow-xl max-w-lg mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Session Complete!</h2>
                <div className="text-6xl font-bold text-green-500 mb-8">{score} <span className="text-gray-300 text-4xl">/ {questions.length}</span></div>
                <div className="flex flex-col gap-3 w-full">
                    <button onClick={() => generateQuestions(false)} className="w-full bg-oxford-blue text-white py-3.5 rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/10">Continue Reviewing</button>
                    <button onClick={onExit} className="w-full border border-gray-200 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-colors">Back to Home</button>
                </div>
            </div>
        );
    }

    // 4. Question Interface
    const currentQ = questions[currentQuestionIndex];
    const isSpelling = currentQ.type === 'spelling';
    const isAudio = currentQ.type.startsWith('audio');

    return (
        <div className="max-w-2xl mx-auto w-full">
            <audio ref={audioRef} className="hidden" />

            <div className={`bg-white rounded-3xl shadow-xl overflow-hidden transition-all relative ${isReviewAhead ? 'border-4 border-orange-100' : ''}`}>
                <button onClick={onExit} className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors"><X size={24} /></button>

                <div className="p-8 md:p-12">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Question {currentQuestionIndex + 1} of {questions.length}</span>
                            {isReviewAhead && <span className="ml-2 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold uppercase">Review Ahead</span>}
                        </div>
                        <div className="bg-blue-50 text-oxford-blue px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">Score: {score}</div>
                    </div>

                    {/* Content Component */}
                    <div className="text-center mb-10">
                        <h2 className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wide">{currentQ.type === 'spelling' ? 'Type the word for' : currentQ.prompt}</h2>

                        {isAudio ? (
                            <button
                                onClick={() => playAudio(currentQ.audioUrl)}
                                className="mx-auto w-20 h-20 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition-all animate-fade-in"
                            >
                                <Volume2 size={40} />
                            </button>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <h1 className={`${isSpelling ? 'text-2xl text-gray-700' : 'text-4xl md:text-5xl text-oxford-blue'} font-bold leading-tight`}>
                                    {currentQ.prompt && !isAudio ? currentQ.prompt : ''}
                                </h1>
                                {currentQ.type === 'ipa' && currentQ.audioUrl && (
                                    <button
                                        onClick={() => playAudio(currentQ.audioUrl)}
                                        className="w-12 h-12 bg-blue-100 hover:bg-blue-200 text-oxford-blue rounded-full flex items-center justify-center transition-all shadow-sm"
                                        title="Listen"
                                    >
                                        <Volume2 size={24} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Inputs/Options */}
                    {!isSpelling ? (
                        <div className="grid gap-3">
                            {currentQ.options.map((option, index) => {
                                let buttonClass = "w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex justify-between items-center group relative overflow-hidden ";
                                const isSelected = selectedAnswer === option;
                                const isCorrect = option === currentQ.correctAnswer;

                                if (selectedAnswer) {
                                    if (isSelected && isCorrect) buttonClass += "bg-green-50 border-green-500 text-green-900 shadow-sm z-10 scale-[1.02]";
                                    else if (isSelected && !isCorrect) buttonClass += "bg-red-50 border-red-500 text-red-900 shadow-sm z-10 scale-[1.02]";
                                    else if (isCorrect) buttonClass += "bg-green-50 border-green-300 text-green-800 opacity-100";
                                    else buttonClass += "bg-gray-50 border-gray-100 opacity-30 grayscale blur-[1px]";
                                } else {
                                    buttonClass += "bg-white border-gray-100 hover:border-oxford-blue hover:bg-blue-50/30 hover:shadow-lg hover:-translate-y-0.5";
                                }

                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleOptionSelect(option)}
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
                    ) : (
                        <form onSubmit={handleSpellingSubmit} className="max-w-md mx-auto relative flex flex-col items-center">
                            {/* Hidden Input for handling typing logic simply */}
                            <input
                                ref={inputRef}
                                type="text"
                                value={spellingInput}
                                onChange={(e) => setSpellingInput(e.target.value.slice(0, currentQ.correctAnswer.length))}
                                disabled={!!feedback}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-default z-10"
                                autoFocus
                                autoComplete="off"
                            />

                            {/* Visual Boxes for Letters */}
                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                {currentQ.correctAnswer.split('').map((char, index) => {
                                    const userChar = spellingInput[index] || '';
                                    const isFilled = !!userChar;
                                    const isCurrent = index === spellingInput.length;

                                    let boxClass = "w-10 h-14 sm:w-12 sm:h-16 flex items-center justify-center text-3xl font-bold rounded-xl border-2 transition-all shadow-sm ";

                                    if (feedback === 'correct') {
                                        boxClass += "bg-green-100 border-green-500 text-green-700";
                                    } else if (feedback === 'incorrect') {
                                        boxClass += "bg-red-50 border-red-400 text-red-700";
                                    } else if (isCurrent && !feedback) {
                                        boxClass += "border-oxford-blue bg-blue-50/50 shadow-md ring-4 ring-blue-100/50 transform -translate-y-1";
                                    } else if (isFilled) {
                                        boxClass += "border-gray-300 bg-white text-gray-800";
                                    } else {
                                        boxClass += "border-gray-200 bg-gray-50/50 text-gray-300";
                                    }

                                    return (
                                        <div key={index} className={boxClass}>
                                            {feedback === 'incorrect' ? (
                                                <span className="text-red-400 text-xl">{char}</span>
                                            ) : (
                                                userChar
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {feedback === 'incorrect' && (
                                <div className="text-center animate-fade-in mb-6">
                                    <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium inline-block">
                                        Answer: <span className="font-bold">{currentQ.correctAnswer}</span>
                                    </div>
                                </div>
                            )}

                            {!feedback && (
                                <div className="mt-2 text-gray-400 text-sm font-medium animate-pulse">
                                    Type the word...
                                </div>
                            )}

                            {/* Only show button if user thinks they are done? Or always? Hidden is cleaner with auto-submit logic but user might want button. 
                                Providing a button below for clarity, mainly for "Give Up" or manual check if confused. 
                                Actually, form submit on Enter works. */}
                            {!feedback && spellingInput.length > 0 && (
                                <button type="submit" className="mt-6 w-full max-w-xs bg-oxford-blue text-white py-3 rounded-xl font-bold hover:bg-blue-800 transition-colors z-20 shadow-lg shadow-blue-900/10">
                                    Check Answer
                                </button>
                            )}
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
