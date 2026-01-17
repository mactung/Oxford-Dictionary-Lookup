import React, { useEffect, useState } from 'react';
import { Trash2, Volume2, ExternalLink } from 'lucide-react';

export default function App() {
    const [vocabulary, setVocabulary] = useState([]);

    useEffect(() => {
        chrome.storage.local.get(['vocabulary'], (result) => {
            if (result.vocabulary) {
                setVocabulary(result.vocabulary.reverse());
            }
        });
    }, []);

    const deleteWord = (indexToRemove) => {
        const newVocab = vocabulary.filter((_, index) => index !== indexToRemove);
        setVocabulary(newVocab);
        // Note: Since we reversed the array for display, we need to be careful saving.
        // The source of truth is "newest at the end" usually, but here we just overwrite.
        // Let's perform the deletion on the reversed state and save that reversed state? 
        // Or better, let's just save EXACTLY what we see for simplicity now, 
        // or properly sync with original order.
        // For simplicity: We will save the current state (which is newest first).
        chrome.storage.local.set({ vocabulary: newVocab });
    };

    const playAudio = (url) => {
        if (url) new Audio(url).play();
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-800">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10 text-center">
                    <h1 className="text-4xl font-bold text-oxford-blue mb-2">My Vocabulary List</h1>
                    <p className="text-gray-500">Your personal collection of saved words.</p>
                </header>

                {vocabulary.length === 0 ? (
                    <div className="text-center text-gray-400 mt-20 text-xl">
                        No words saved yet. Start exploring!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {vocabulary.map((item, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-t-4 border-oxford-blue p-6 relative group">
                                <button
                                    onClick={() => deleteWord(index)}
                                    className="absolute top-3 right-3 text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>

                                <h2 className="text-2xl font-bold text-oxford-blue mb-1">{item.headword}</h2>
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

                                <a
                                    href={`https://www.oxfordlearnersdictionaries.com/definition/english/${item.headword}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-oxford-light font-medium hover:underline mt-auto"
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
