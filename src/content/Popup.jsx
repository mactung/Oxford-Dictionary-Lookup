import React, { useEffect, useState } from 'react';
import { Volume2, Star, X, Loader2 } from 'lucide-react';
import { parseOxfordHTML } from '../utils/parser';

export default function Popup({ x, y, word, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (data && data.headword) {
            chrome.storage.local.get(['vocabulary'], (result) => {
                const vocabulary = result.vocabulary || [];
                const exists = vocabulary.some(item => item.headword === data.headword);
                setSaved(exists);
            });
        }
    }, [data]);

    useEffect(() => {
        setLoading(true);
        chrome.runtime.sendMessage({ action: 'fetchDefinition', word }, (response) => {
            if (response && response.success) {
                const parsed = parseOxfordHTML(response.html);
                if (parsed.error) {
                    setError(parsed.error);
                    setData(null);
                } else {
                    setData(parsed);
                }
            } else {
                setError(response?.error || 'Failed to fetch');
            }
            setLoading(false);
        });
    }, [word]);

    const playAudio = (url) => {
        if (url) new Audio(url).play();
    };

    const handleSave = () => {
        if (!data || !data.headword) return;
        setSaved(true);

        chrome.storage.local.get(['vocabulary'], (result) => {
            const vocabulary = result.vocabulary || [];
            const exists = vocabulary.some(item => item.headword === data.headword);
            if (!exists) {
                const newVocab = [...vocabulary, {
                    ...data,
                    contextUrl: window.location.href,
                    srsLevel: 0,
                    nextReview: Date.now()
                }];
                chrome.storage.local.set({ vocabulary: newVocab });
            }
        });
    };

    return (
        <div
            className="absolute bg-white rounded-lg shadow-2xl border border-gray-100 overflow-hidden w-[380px] max-h-[500px] flex flex-col font-sans text-left"
            style={{ top: y, left: x, zIndex: 999999 }}
            onMouseDown={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
            {/* Header */}
            <div className="bg-oxford-blue text-white px-4 py-3 flex justify-between items-center shrink-0">
                <h1 className="font-bold text-lg">Oxford Dictionary</h1>
                <div className="flex items-center gap-2">
                    {data && (
                        <button
                            onClick={handleSave}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${saved ? 'bg-white text-oxford-blue border-white' : 'border-white/40 hover:bg-white/10'}`}
                        >
                            <Star size={12} fill={saved ? "currentColor" : "none"} />
                            {saved ? 'Saved' : 'Save'}
                        </button>
                    )}
                    <button onClick={onClose} className="hover:text-red-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <Loader2 className="animate-spin mb-2" />
                        <span>Loading...</span>
                    </div>
                ) : error ? (
                    <div className="text-red-500 text-center py-4">{error}</div>
                ) : data ? (
                    <div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <h2 className="text-2xl font-bold text-oxford-blue">{data.headword}</h2>
                            <span className="text-gray-500 italic">{data.pos}</span>
                        </div>

                        {data.phonetics && data.phonetics.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-4">
                                {data.phonetics.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1 text-oxford-light bg-blue-50 px-2 py-1 rounded-full text-sm">
                                        {p.type && <span className="font-bold text-xs uppercase text-gray-400 mr-1">{p.type}</span>}
                                        <span>/{p.ipa}/</span>
                                        {p.audioUrl && (
                                            <Volume2
                                                size={14}
                                                className="cursor-pointer hover:scale-110 transition-transform ml-1"
                                                onClick={() => playAudio(p.audioUrl)}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-4">
                            {data.senses && data.senses.map((sense, i) => (
                                <div key={i} className="text-sm">
                                    <div className="font-semibold text-gray-800 mb-1">
                                        <span className="text-oxford-blue mr-1">{i + 1}.</span>
                                        {sense.definition}
                                    </div>
                                    {sense.examples && sense.examples.length > 0 && (
                                        <ul className="text-gray-500 pl-4 space-y-1 mt-1 border-l-2 border-gray-100">
                                            {sense.examples.map((ex, j) => (
                                                <li key={j} className="italic">"{ex}"</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                            {(!data.senses || data.senses.length === 0) && (
                                <div className="text-gray-400 italic">No detailed definitions found.</div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
