import React, { useEffect, useState } from 'react';
import { Trash2, Volume2, ExternalLink } from 'lucide-react';

import Quiz from './Quiz';

export default function App() {
    const [vocabulary, setVocabulary] = useState([]);

    useEffect(() => {
        chrome.storage.local.get(['vocabulary'], (result) => {
            if (result.vocabulary) {
                // Keep original order (Oldest -> Newest) in state
                setVocabulary(result.vocabulary);
            }
        });
    }, []);

    const deleteWord = (headword) => {
        // Filter by headword unique ID usually, but here headword is unique enough for now
        const newVocab = vocabulary.filter(w => w.headword !== headword);
        setVocabulary(newVocab);
        chrome.storage.local.set({ vocabulary: newVocab });
    };

    const updateWord = (updatedWord) => {
        const newVocab = vocabulary.map(w => w.headword === updatedWord.headword ? updatedWord : w);
        setVocabulary(newVocab);
        chrome.storage.local.set({ vocabulary: newVocab });
    };

    const playAudio = (url) => {
        if (url) new Audio(url).play();
    }

    // Render list in reverse order (Newest first)
    // We treat the "end" of the array as the newest items.
    const reversedList = [...vocabulary].reverse();

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800 pb-20">
            {/* Quiz Section - Always Top */}
            <div className="bg-white border-b border-gray-200 shadow-sm mb-8">
                <div className="max-w-7xl mx-auto p-8">
                    <Quiz vocabulary={vocabulary} onUpdateWord={updateWord} />
                </div>
            </div>

            {/* Vocabulary List Section */}
            <div className="max-w-7xl mx-auto px-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-oxford-blue mb-2">My Vocabulary List</h1>
                    <p className="text-gray-500">Your personal collection of saved words.</p>
                </header>

                {reversedList.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10 text-xl">
                        No words saved yet. Start exploring!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {reversedList.map((item, index) => (
                            <div key={item.headword} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-t-4 border-oxford-blue p-6 relative group">
                                <button
                                    onClick={() => deleteWord(item.headword)}
                                    className="absolute top-3 right-3 text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>

                                <div className="flex justify-between items-start mb-1">
                                    <h2 className="text-2xl font-bold text-oxford-blue">{item.headword}</h2>
                                    {/* SRS Indicator (Debug/Visual) */}
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${!item.srsLevel ? 'bg-gray-100 text-gray-400' :
                                                item.srsLevel > 3 ? 'bg-green-100 text-green-700' :
                                                    item.srsLevel > 1 ? 'bg-blue-100 text-blue-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                            }`}
                                        title={`Level ${item.srsLevel || 0}`}
                                    >
                                        L{item.srsLevel || 0}
                                    </span>
                                </div>

                                <div className="text-sm text-gray-500 italic mb-3">{item.pos}</div>

                                {item.phonetics && item.phonetics[0] && (
                                    <div className="flex items-center gap-2 mb-4 text-oxford-light font-medium">
                                        <span>/{item.phonetics[0].ipa}/</span>
                                        {item.phonetics[0].audioUrl && (
                                            <button onClick={() => playAudio(item.phonetics[0].audioUrl)} className="hover:bg-blue-50 p-1 rounded-full cursor-pointer">
                                                <Volume2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="text-gray-700 line-clamp-3 leading-relaxed mb-4">
                                    {item.senses && item.senses[0] ? item.senses[0].definition : 'No definition'}
                                </div>

                                {item.contextUrl && (
                                    <a
                                        href={item.contextUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-oxford-blue font-medium hover:underline mt-2"
                                        title={item.contextUrl}
                                    >
                                        <ExternalLink size={14} />
                                        Source
                                    </a>
                                )}

                                <a
                                    href={`https://www.oxfordlearnersdictionaries.com/definition/english/${item.headword}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-oxford-light font-medium hover:underline mt-auto pt-4"
                                >
                                    <ExternalLink size={14} />
                                    View on Oxford
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
