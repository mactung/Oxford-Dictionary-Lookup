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
                if (response.localData) {
                    setData(response.localData);
                } else {
                    const parsed = parseOxfordHTML(response.html);
                    if (!parsed.error) {
                        setData(parsed);
                        chrome.runtime.sendMessage({ action: 'syncToCloud', data: parsed });
                    } else {
                        setError(parsed.error);
                        setData(null); // Ensure data is null if there's a parsing error
                    }
                }
            } else {
                setError('Definition not found');
            }
            setLoading(false);
        });
    }, [word]);

    const playAudio = (url) => {
        if (url) new Audio(url).play();
    };

    const handleSave = () => {
        if (!data || !data.headword) return;

        // Optimistic toggle
        const newSavedState = !saved;
        setSaved(newSavedState);

        chrome.storage.local.get(['vocabulary'], (result) => {
            const vocabulary = result.vocabulary || [];
            const exists = vocabulary.some(item => item.headword === data.headword);

            let newVocab;
            if (newSavedState && !exists) {
                // Add
                newVocab = [...vocabulary, {
                    ...data,
                    contextUrl: window.location.href,
                    srsLevel: 0,
                    nextReview: Date.now()
                }];
            } else if (!newSavedState && exists) {
                // Remove
                newVocab = vocabulary.filter(item => item.headword !== data.headword);
            } else {
                return; // State matches
            }

            chrome.storage.local.set({ vocabulary: newVocab });
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
                                        {sense.cefr && (
                                            <span className="text-[10px] font-bold text-oxford-blue bg-blue-100 px-1.5 py-0.5 rounded mr-2 align-middle border border-blue-200" title={`CEFR Level: ${sense.cefr}`}>
                                                {sense.cefr}
                                            </span>
                                        )}
                                        {sense.definition}
                                    </div>
                                    {sense.examples && sense.examples.length > 0 && (
                                        <ul className="text-gray-500 pl-4 space-y-1 mt-1 border-l-2 border-gray-100">
                                            {sense.examples.map((ex, j) => (
                                                <li key={j} className="italic">
                                                    {ex.pattern && (
                                                        <span className="font-bold text-oxford-blue bg-blue-50/50 px-1 rounded mr-1 not-italic">
                                                            {ex.pattern}
                                                        </span>
                                                    )}
                                                    {ex.label && (
                                                        <span className="text-xs uppercase font-bold text-gray-400 mr-1 not-italic border border-gray-200 px-1 rounded">
                                                            {ex.label}
                                                        </span>
                                                    )}
                                                    {ex.text}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                            {(!data.senses || data.senses.length === 0) && (
                                <div className="text-gray-400 italic">No detailed definitions found.</div>
                            )}

                            {/* Verb Forms */}
                            {data.verbForms && data.verbForms.length > 0 && (
                                <div className="mt-4 border-t border-gray-100 pt-3">
                                    <h3 className="font-bold text-gray-700 mb-2 text-xs uppercase tracking-wider">Verb Forms</h3>
                                    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2 border border-gray-100">
                                        {data.verbForms.map((vf, index) => (
                                            <div key={index} className="flex justify-between items-center">
                                                <span className="text-gray-500 text-xs">{vf.form}</span>
                                                <span className="font-medium text-gray-800">{vf.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Phrasal Verbs */}
                            {data.phrasalVerbs && data.phrasalVerbs.length > 0 && (
                                <div className="mt-4 border-t border-gray-100 pt-3">
                                    <h3 className="font-bold text-gray-700 mb-2 text-xs uppercase tracking-wider">Phrasal Verbs</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {data.phrasalVerbs.map((pv, index) => (
                                            <span key={index} className="bg-orange-50 text-orange-700 px-2.5 py-1 rounded-md text-sm border border-orange-100 font-medium hover:bg-orange-100 transition-colors cursor-default">
                                                {pv}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Idioms */}
                            {data.idioms && data.idioms.length > 0 && (
                                <div className="mt-4 border-t border-gray-100 pt-3">
                                    <h3 className="font-bold text-gray-700 mb-2 text-xs uppercase tracking-wider">Idioms</h3>
                                    <div className="space-y-3">
                                        {data.idioms.map((idm, index) => (
                                            <div key={index} className="text-sm bg-purple-50 p-3 rounded-lg border border-purple-100">
                                                <div className="font-bold text-purple-900 mb-1">{idm.phrase}</div>
                                                <div className="text-purple-800/80">{idm.definition}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Topics / Vocab Building */}
                            {data.topics && data.topics.length > 0 && (
                                <div className="mt-4 border-t border-gray-100 pt-3">
                                    <h3 className="font-bold text-gray-700 mb-2 text-xs uppercase tracking-wider">Vocabulary Building</h3>
                                    <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm border border-green-100">
                                        {data.topics.map((t, i) => (
                                            <div key={i} className="font-medium">{t}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
