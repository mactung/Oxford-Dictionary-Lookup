import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Clock, Brain, Volume2, ArrowRight, Play } from 'lucide-react';
import QuizQuestion from '../components/QuizQuestion';
import { calculateNextReview, updateSRS } from '../utils/srs';

export default function Quiz({ vocabulary, onUpdateWord, onExit }) {
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showScore, setShowScore] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null); // For multiple choice
    const [isReviewAhead, setIsReviewAhead] = useState(false);
    const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect'

    // New State for Pre-Quiz Review
    const [preQuizWords, setPreQuizWords] = useState([]);
    const [isPreQuizReview, setIsPreQuizReview] = useState(false);

    const audioRef = useRef(null);


    const failedHeadwords = useRef(new Set()); // Track words that have been failed in this session

    useEffect(() => {
        if (questions.length === 0 && vocabulary.length > 0 && !isPreQuizReview) {
            generateQuestions();
        }
    }, [vocabulary]);

    // Auto-play audio moved to QuizQuestion or managed here? 
    // QuizQuestion manages audio playback for buttons, but maybe not auto-play.
    // Let's keep auto-play here for specific types if desired, OR let QuizQuestion handle it.
    // For consistency, let's let QuizQuestion handle on mount if we add that prop.
    // OR just keep it simple: QuizQuestion has buttons. Auto-play might be annoying if not expected.
    // The previous code auto-played for 'audio-word' and 'audio-meaning'.
    
    useEffect(() => {
        if (!isPreQuizReview && questions.length > 0 && !showScore) {
            const currentQ = questions[currentQuestionIndex];
             // Auto-play audio if applicable
            if ((currentQ.type === 'audio-word' || currentQ.type === 'audio-meaning') && currentQ.audioUrl) {
                // We can't easily auto-play from here without ref to audio element which is now unused or different.
                // Let's rely on user clicking "play" for now, or play centrally.
                 if (audioRef.current) {
                    audioRef.current.src = currentQ.audioUrl;
                    audioRef.current.play().catch(e => {});
                 }
            }
        }
    }, [currentQuestionIndex, questions, showScore, isPreQuizReview]);

    const playAudio = (url) => {
        if (audioRef.current && url) {
            audioRef.current.src = url;
            audioRef.current.play().catch(e => console.log("Audio play failed", e));
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

            // 4. Fill in the Blank (if examples exist)
            const exampleSense = word.senses?.find(s => s.examples && s.examples.length > 0);
            if (exampleSense) {
                const exampleObj = exampleSense.examples[Math.floor(Math.random() * exampleSense.examples.length)];
                const exampleText = typeof exampleObj === 'string' ? exampleObj : exampleObj.text;
                const blankPrompt = exampleText.replace(new RegExp(word.headword, 'gi'), '_______');
                
                newQuestions.push({
                    wordObj: word,
                    type: 'fill_blank',
                    prompt: blankPrompt,
                    correctAnswer: word.headword,
                    options: [word.headword, ...getRandomDistractors(otherWords, 3, 'headword')].sort(() => 0.5 - Math.random()),
                    context: exampleSense.definition,
                    headerText: 'Fill in the blank'
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
            setFeedback(null);
            failedHeadwords.current.clear(); // Reset failed words tracking
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
        const headword = currentQ.wordObj.headword;

        if (isCorrect) {
            setScore(prev => prev + 1);
            setFeedback('correct');

            // If the word has already been failed in this session, do not increment SRS.
            // Ensure it remains at SRS Level 0.
            if (failedHeadwords.current.has(headword)) {
                onUpdateWord({
                    ...currentQ.wordObj,
                    srsLevel: 0,
                    nextReview: calculateNextReview(0)
                });
            } else {
                // Use shared helper
                onUpdateWord(updateSRS(currentQ.wordObj, true));
            }
        } else {
            // Mark word as failed for the rest of this session
            failedHeadwords.current.add(headword);

            setFeedback('incorrect');
            onUpdateWord(updateSRS(currentQ.wordObj, false));
        }

        const delay = (!isCorrect && currentQ.type === 'spelling') ? 3000 : 1500;

        setTimeout(() => {
            const nextQuestion = currentQuestionIndex + 1;
            if (nextQuestion < questions.length) {
                setCurrentQuestionIndex(nextQuestion);
                setSelectedAnswer(null);
                setFeedback(null);
            } else {
                setShowScore(true);
            }
        }, delay);
    };

    const handleAnswer = (answer) => {
        if (selectedAnswer || feedback) return;
        
        const currentQ = questions[currentQuestionIndex];
        setSelectedAnswer(answer); // Track what they effectively chose/typed

        let isCorrect = false;
        if (currentQ.type === 'spelling') {
             isCorrect = answer.trim().toLowerCase() === currentQ.correctAnswer.toLowerCase();
        } else {
             isCorrect = answer === currentQ.correctAnswer;
        }

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

    return (
        <div className="max-w-2xl mx-auto w-full">
            <audio ref={audioRef} className="hidden" />

            <div className={`bg-white rounded-3xl shadow-xl overflow-hidden transition-all relative ${isReviewAhead ? 'border-4 border-orange-100' : ''}`}>
                <button onClick={onExit} className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors"><X size={24} /></button>

                <div className="pt-8 px-8 md:px-12 pb-0">
                    {/* Header Score Row */}
                    <div className="flex justify-between items-center mb-0">
                        <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Question {currentQuestionIndex + 1} of {questions.length}</span>
                            {isReviewAhead && <span className="ml-2 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold uppercase">Review Ahead</span>}
                        </div>
                        <div className="bg-blue-50 text-oxford-blue px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">Score: {score}</div>
                    </div>
                </div>

                <QuizQuestion 
                    question={currentQ}
                    feedback={feedback}
                    selectedAnswer={selectedAnswer}
                    onAnswer={handleAnswer}
                />
            </div>
        </div>
    );
}
