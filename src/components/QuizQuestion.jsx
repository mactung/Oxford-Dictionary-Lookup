import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Check, X } from 'lucide-react';

export default function QuizQuestion({ question, feedback, selectedAnswer, onAnswer }) {
    const [spellingInput, setSpellingInput] = useState('');
    const inputRef = useRef(null);

    // Reset spelling input when question changes
    useEffect(() => {
        setSpellingInput('');
        if (question?.type === 'spelling' && inputRef.current && !feedback) {
            // Tiny delay to ensure render
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [question]);

    if (!question) return null;

    const playAudio = (url) => {
        if (url) new Audio(url).play();
    };

    const handleSpellingSubmit = (e) => {
        e.preventDefault();
        if (feedback) return;
        onAnswer(spellingInput);
    };

    const isSpelling = question.type === 'spelling';

    // Header Text Logic: Use provided prop OR derive default
    const headerText = question.headerText || (
        isSpelling ? 'Type the word for' : 
        question.type === 'ipa' ? 'Choose the correct pronunciation' :
        question.type === 'fill_blank' ? 'Fill in the blank' :
        question.type.startsWith('audio') ? 'Listen and choose' :
        'Choose the correct meaning'
    );

    return (
        <div className="p-6">
            <div className="mb-6 text-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                    {headerText}
                </span>

                {/* Prompt Display */}
                <div className="flex flex-col items-center justify-center gap-3 mb-2">
                    {/* Prompt Text */}
                    {!question.type.startsWith('audio') && (
                         <h2 className={`${question.type === 'fill_blank' ? 'text-xl italic text-gray-600' : isSpelling ? 'text-xl font-medium text-gray-700' : 'text-3xl font-bold text-oxford-blue'}`}>
                            {question.prompt}
                        </h2>
                    )}
                   
                   {/* Audio Button */}
                    {(question.wordObj?.phonetics?.[0]?.audioUrl || question.audioUrl) && question.type !== 'fill_blank' && question.type !== 'spelling' && (
                        <button
                            onClick={() => playAudio(question.audioUrl || question.wordObj?.phonetics?.[0]?.audioUrl)}
                            className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors ring-4 ring-blue-50/50"
                        >
                            <Volume2 size={32} />
                        </button>
                    )}

                    {/* Hint for Fill Blank */}
                    {question.type === 'fill_blank' && question.context && (
                        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                            Hint: {question.context}
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {!isSpelling ? (
                    question.options.map((option, idx) => {
                        let btnClass = "w-full text-left p-4 rounded-xl border text-sm transition-all duration-200 relative group ";
                        const isCorrect = option === question.correctAnswer;
                        const isSelected = selectedAnswer === option;

                        if (feedback) {
                            if (isCorrect) {
                                btnClass += "bg-green-50 border-green-500 text-green-900 font-medium opacity-100";
                            } else if (isSelected) {
                                btnClass += "bg-red-50 border-red-500 text-red-900 font-medium opacity-100";
                            } else {
                                btnClass += "bg-gray-50 border-gray-100 text-gray-400 opacity-50";
                            }
                        } else {
                            btnClass += "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-md hover:-translate-y-0.5 text-gray-700";
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => onAnswer(option)}
                                disabled={!!feedback}
                                className={btnClass}
                            >
                                <span className="mr-6 block leading-snug">{option}</span>
                                {feedback && isCorrect && <Check size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600" />}
                                {feedback && isSelected && !isCorrect && <X size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-red-600" />}
                                {!feedback && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-gray-200 group-hover:border-blue-400"></div>}
                            </button>
                        );
                    })
                ) : (
                    <form onSubmit={handleSpellingSubmit} className="max-w-md mx-auto relative flex flex-col items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={spellingInput}
                            onChange={(e) => setSpellingInput(e.target.value.slice(0, question.correctAnswer.length))}
                            disabled={!!feedback}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-default z-10"
                            autoFocus
                            autoComplete="off"
                        />

                        <div className="flex flex-nowrap py-4 px-2 justify-center mb-6 w-full" style={{ gap: question.correctAnswer.length > 8 ? '4px' : '8px' }}>
                            {question.correctAnswer.split('').map((char, index) => {
                                const userChar = spellingInput[index] || '';
                                const isFilled = !!userChar;
                                const isCurrent = index === spellingInput.length;
                                const len = question.correctAnswer.length;

                                // Dynamic sizing based on word length
                                const boxSize = len <= 6 ? { width: 44, height: 52, fontSize: 22 }
                                    : len <= 8 ? { width: 38, height: 46, fontSize: 20 }
                                    : len <= 10 ? { width: 32, height: 40, fontSize: 18 }
                                    : len <= 12 ? { width: 28, height: 36, fontSize: 16 }
                                    : { width: 24, height: 32, fontSize: 14 };

                                let boxClass = "shrink-0 flex items-center justify-center font-bold rounded-lg border-2 transition-all shadow-sm ";

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
                                    <div key={index} className={boxClass} style={{
                                        width: boxSize.width,
                                        height: boxSize.height,
                                        fontSize: boxSize.fontSize,
                                        lineHeight: 1,
                                    }}>
                                        {feedback === 'incorrect' ? (
                                            <span style={{ fontSize: boxSize.fontSize - 2 }} className="text-red-400">{char}</span>
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
                                    Answer: <span className="font-bold">{question.correctAnswer}</span>
                                </div>
                            </div>
                        )}

                         {!feedback && spellingInput.length > 0 && (
                            <button type="submit" className="mt-2 w-full max-w-xs bg-oxford-blue text-white py-3 rounded-xl font-bold hover:bg-blue-800 transition-colors z-20 shadow-lg shadow-blue-900/10">
                                Check Answer
                            </button>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
