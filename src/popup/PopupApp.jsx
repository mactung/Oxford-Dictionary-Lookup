import React, { useState, useEffect } from 'react';
import { Search, Loader2, Volume2, TrendingUp, X, Star } from 'lucide-react';
import { parseOxfordHTML } from '../utils/parser';

export default function PopupApp() {
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (data && data.headword) {
            checkSavedStatus(data.headword);
        } else {
            setSaved(false);
        }
    }, [data]);

    const checkSavedStatus = (headword) => {
        chrome.storage.local.get(['vocabulary'], (result) => {
            const vocabulary = result.vocabulary || [];
            const isSaved = vocabulary.some(item => item.headword === headword);
            setSaved(isSaved);
        });
    };

    const handleSave = () => {
        if (!data || !data.headword) return;

        // Optimistic UI update
        const newSavedState = !saved;
        setSaved(newSavedState);

        chrome.storage.local.get(['vocabulary'], (result) => {
            const vocabulary = result.vocabulary || [];
            let newVocab;

            if (newSavedState) {
                // Add to vocabulary
                // Check dup again to be safe
                if (!vocabulary.some(item => item.headword === data.headword)) {
                    newVocab = [...vocabulary, {
                        ...data,
                        contextUrl: 'Extension Popup', // Distinct context
                        srsLevel: 0,
                        nextReview: Date.now()
                    }];
                } else {
                    newVocab = vocabulary;
                }
            } else {
                // Remove from vocabulary
                newVocab = vocabulary.filter(item => item.headword !== data.headword);
            }

            if (newVocab) {
                chrome.storage.local.set({ vocabulary: newVocab });
            }
        });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);
        setSaved(false);

        chrome.runtime.sendMessage({ action: 'fetchDefinition', word: query.trim() }, (response) => {
            setLoading(false);
            if (response && response.success) {
                const parsed = parseOxfordHTML(response.html);
                if (parsed.error) {
                    setError(parsed.error);
                } else {
                    setData(parsed);
                }
            } else {
                setError(response?.error || 'Failed to fetch definition');
            }
        });
    };

    const playAudio = (url) => {
        if (url) new Audio(url).play();
    };

    return (
        <div className="w-[400px] h-[500px] bg-gray-50 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-oxford-blue p-4 shrink-0 flex items-center gap-2">
                <form onSubmit={handleSearch} className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 text-white placeholder-blue-200 border border-white/20 focus:outline-none focus:bg-white focus:text-gray-900 focus:placeholder-gray-400 transition-all text-sm"
                        placeholder="Search Oxford Dictionary..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => { setQuery(''); setData(null); setError(null); setSaved(false); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                            <X size={14} />
                        </button>
                    )}
                </form>

                {data && (
                    <button
                        onClick={handleSave}
                        className={`p-2 rounded-lg transition-colors border ${saved
                            ? 'bg-yellow-400 text-white border-yellow-500 hover:bg-yellow-500'
                            : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/20 hover:text-white'
                            }`}
                        title={saved ? "Remove from learning list" : "Save to learning list"}
                    >
                        <Star size={20} fill={saved ? "currentColor" : "none"} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                        <Loader2 className="animate-spin text-oxford-blue" size={32} />
                        <span className="text-sm font-medium">Searching...</span>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-3">
                            <Search size={24} />
                        </div>
                        <p className="text-gray-900 font-bold mb-1">No results found</p>
                        <p className="text-gray-500 text-sm">{error}</p>
                    </div>
                ) : data ? (
                    <div className="animate-fade-in">
                        {/* Headword */}
                        <div className="flex items-baseline gap-2 mb-3">
                            <h1 className="text-2xl font-bold text-gray-900">{data.headword}</h1>
                            <span className="text-sm italic text-gray-500 font-serif">{data.pos}</span>
                        </div>

                        {/* Phonetics */}
                        {data.phonetics && data.phonetics.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-6">
                                {data.phonetics.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-md text-oxford-blue text-xs border border-blue-100">
                                        {p.type && <span className="font-bold text-[10px] uppercase text-blue-400">{p.type}</span>}
                                        <span className="font-mono">/{p.ipa}/</span>
                                        {p.audioUrl && (
                                            <button
                                                onClick={() => playAudio(p.audioUrl)}
                                                className="hover:scale-110 transition-transform ml-0.5"
                                            >
                                                <Volume2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Definitions */}
                        <div className="space-y-4 mb-6">
                            {data.senses?.map((sense, idx) => (
                                <div key={idx} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                                    <div className="flex gap-2.5">
                                        <span className="text-oxford-blue font-bold text-xs bg-blue-50 h-5 w-5 flex items-center justify-center rounded-full shrink-0 border border-blue-100 mt-0.5">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 text-sm mb-2 leading-snug">
                                                {sense.definition}
                                            </p>

                                            {/* Synonyms */}
                                            {sense.synonyms && sense.synonyms.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Syns:</span>
                                                    {sense.synonyms.map((syn, k) => (
                                                        <span key={k} className="bg-gray-50 px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-medium border border-gray-100">
                                                            {syn}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Examples */}
                                            {sense.examples && sense.examples.length > 0 && (
                                                <ul className="space-y-1 pl-2 border-l-2 border-orange-100/50">
                                                    {sense.examples.map((ex, j) => (
                                                        <li key={j} className="text-xs text-gray-500 italic">
                                                            {typeof ex === 'object' ? (
                                                                <>
                                                                    {ex.pattern && (
                                                                        <span className="font-bold text-oxford-blue not-italic mr-1">
                                                                            {ex.pattern}
                                                                        </span>
                                                                    )}
                                                                    {ex.text}
                                                                </>
                                                            ) : ex}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Idioms */}
                        {data.idioms && data.idioms.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-200">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <TrendingUp size={14} /> Idioms
                                </h3>
                                <div className="space-y-2">
                                    {data.idioms.map((idm, idx) => (
                                        <div key={idx} className="bg-orange-50/50 p-2.5 rounded-lg border border-orange-100/50">
                                            <p className="font-bold text-gray-800 text-xs mb-0.5">{idm.phrase}</p>
                                            <p className="text-[10px] text-gray-500">{idm.definition}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 text-center">
                            <a
                                href={`https://www.oxfordlearnersdictionaries.com/definition/english/${data.headword}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-oxford-blue hover:underline font-medium"
                            >
                                View full entry on Oxford Learners Dictionaries
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <Search size={32} />
                        </div>
                        <p className="font-medium text-gray-400">Search for a word</p>
                    </div>
                )}
            </div>
        </div>
    );
}
