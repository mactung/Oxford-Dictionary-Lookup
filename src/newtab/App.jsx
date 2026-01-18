
import React, { useEffect, useState } from 'react';
import { Trash2, Volume2, ExternalLink, Home, BookOpen, Brain, Search, TrendingUp, Award, Plus, Loader2, Check } from 'lucide-react';
import { parseOxfordHTML } from '../utils/parser';

import Quiz from './Quiz';

export default function App() {
    const [vocabulary, setVocabulary] = useState([]);
    const [activeTab, setActiveTab] = useState('home'); // home, library
    const [isQuizActive, setIsQuizActive] = useState(false);

    // Search/Add State
    const [dashboardSearch, setDashboardSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchedWordData, setSearchedWordData] = useState(null);
    const [searchError, setSearchError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // Library Search State
    const [librarySearchQuery, setLibrarySearchQuery] = useState('');

    useEffect(() => {
        chrome.storage.local.get(['vocabulary'], (result) => {
            if (result.vocabulary) {
                // Keep original order (Oldest -> Newest) in state
                setVocabulary(result.vocabulary);
            }
        });
    }, []);

    const deleteWord = (headword, e) => {
        e.stopPropagation();
        if (confirm(`Delete "${headword}" ? `)) {
            const newVocab = vocabulary.filter(w => w.headword !== headword);
            setVocabulary(newVocab);
            chrome.storage.local.set({ vocabulary: newVocab });
        }
    };

    const updateWord = (updatedWord) => {
        const newVocab = vocabulary.map(w => w.headword === updatedWord.headword ? updatedWord : w);
        setVocabulary(newVocab);
        chrome.storage.local.set({ vocabulary: newVocab });
    };

    const playAudio = (url, e) => {
        if (e) e.stopPropagation();
        if (url) new Audio(url).play();
    }

    // --- Search & Add Logic ---
    const handleDashboardSearch = (e) => {
        e.preventDefault();
        const wordToSearch = dashboardSearch.trim();
        if (!wordToSearch) return;

        // 1. Check if locally exists
        const existing = vocabulary.find(w => w.headword.toLowerCase() === wordToSearch.toLowerCase());
        if (existing) {
            setSearchedWordData({ ...existing, isExisting: true });
            setShowAddModal(true);
            return;
        }

        // 2. Fetch from Oxford
        setIsSearching(true);
        setSearchError(null);
        setSearchedWordData(null);
        setShowAddModal(true); // Show modal in loading state

        chrome.runtime.sendMessage({ action: 'fetchDefinition', word: wordToSearch }, (response) => {
            setIsSearching(false);
            if (response && response.success) {
                const parsed = parseOxfordHTML(response.html);
                if (parsed.error) {
                    setSearchError(parsed.error);
                } else {
                    setSearchedWordData(parsed);
                }
            } else {
                setSearchError(response?.error || 'Failed to fetch definition.');
            }
        });
    };

    const handleAddWord = () => {
        if (!searchedWordData) return;

        const newWord = {
            ...searchedWordData,
            contextUrl: 'New Tab', // Source
            srsLevel: 0,
            nextReview: Date.now()
        };

        const newVocab = [...vocabulary, newWord];
        setVocabulary(newVocab);
        chrome.storage.local.set({ vocabulary: newVocab });

        setSearchedWordData({ ...newWord, isExisting: true }); // Mark as existing now
        setDashboardSearch(''); // Clear input
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setSearchedWordData(null);
        setSearchError(null);
        setIsSearching(false);
    };

    // --- Derived State ---
    const reversedList = [...vocabulary].reverse();
    const filteredList = reversedList.filter(w => w.headword.toLowerCase().includes(librarySearchQuery.toLowerCase()));

    const dueWordsCount = vocabulary.filter(w => {
        if (!w.nextReview) return true;
        return w.nextReview <= Date.now();
    }).length;

    const masteredWordsCount = vocabulary.filter(w => (w.srsLevel || 0) >= 4).length;

    // --- Components ---

    const StatsCard = ({ title, value, icon: Icon, color }) => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
            <div>
                <p className="text-gray-500 text-sm font-medium">{title}</p>
                <p className="text-3xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    );

    const WordCard = ({ item }) => (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative animate-fade-in">
            <button
                onClick={(e) => deleteWord(item.headword, e)}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 z-10"
                title="Delete"
            >
                <Trash2 size={16} />
            </button>

            <div className="flex justify-between items-start mb-2 pr-8">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{item.headword}</h3>
                    <span className="text-xs text-gray-400 font-medium italic">{item.pos}</span>
                </div>
                {/* Level Badge */}
                <div
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${(item.srsLevel || 0) >= 4 ? 'bg-green-100 text-green-700' :
                        (item.srsLevel || 0) >= 2 ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                        }`}
                >
                    Lvl {item.srsLevel || 0}
                </div>
            </div>

            {/* Phonetics Section */}
            {item.phonetics && item.phonetics.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {item.phonetics.map((p, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg text-oxford-blue text-sm">
                            {p.type && <span className="text-[10px] font-bold uppercase text-blue-400">{p.type}</span>}
                            <span className="font-mono text-xs">/{p.ipa}/</span>
                            {p.audioUrl && (
                                <button
                                    onClick={(e) => playAudio(p.audioUrl, e)}
                                    className="hover:scale-110 transition-transform text-blue-600"
                                >
                                    <Volume2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Senses & Examples */}
            <div className="space-y-3 mt-4">
                {item.senses && item.senses.map((sense, i) => (
                    <div key={i} className="text-sm">
                        <div className="text-gray-800 font-medium leading-snug mb-1">
                            <span className="text-gray-400 mr-2">{i + 1}.</span>
                            {sense.definition}
                        </div>
                        {sense.examples && sense.examples.length > 0 && (
                            <ul className="text-gray-500 pl-6 space-y-0.5 border-l-2 border-gray-100 mt-1">
                                {sense.examples.map((ex, j) => (
                                    <li key={j} className="italic text-xs">"{ex}"</li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
                {(!item.senses || item.senses.length === 0) && (
                    <div className="text-gray-400 italic text-sm">No details found.</div>
                )}
            </div>

            <div className="flex items-center justify-end mt-4 pt-3 border-t border-gray-50">
                <a
                    href={`https://www.oxfordlearnersdictionaries.com/definition/english/${item.headword}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-oxford-blue transition-colors flex items-center gap-1 text-xs"
                >
                    Review Context <ExternalLink size={12} />
                </a>
            </div>
        </div>
    );

    // --- Main Render ---

    if (isQuizActive) {
        return (
            <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col animate-fade-in">
                <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-center p-6">
                    <Quiz
                        vocabulary={vocabulary}
                        onUpdateWord={updateWord}
                        onExit={() => setIsQuizActive(false)}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 pb-24 selection:bg-blue-100">
            {/* Top Navigation / Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-oxford-blue text-white p-2 rounded-lg">
                            <BookOpen size={20} />
                        </div>
                        <span className="font-bold text-xl text-oxford-blue tracking-tight">Oxford<span className="text-blue-500">Vocab</span></span>
                    </div>
                    {/* Tab Switcher */}
                    <div className="hidden md:flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('home')}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'home' ? 'bg-white text-oxford-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('library')}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'library' ? 'bg-white text-oxford-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Library
                        </button>
                    </div>
                    <div className="w-8"></div> {/* Spacer balance */}
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {activeTab === 'home' && (
                    <div className="space-y-10 animate-slide-up">
                        {/* Greeting & Date */}
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl font-bold text-gray-900">Good Afternoon!</h1>
                            <p className="text-gray-500 mt-1">Ready to expand your vocabulary today?</p>
                        </div>

                        {/* Search & Add Bar */}
                        <div className="relative max-w-2xl mx-auto md:mx-0">
                            <form onSubmit={handleDashboardSearch} className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    className="w-full bg-white pl-12 pr-4 py-4 rounded-2xl shadow-sm border border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-lg"
                                    placeholder="Search dictionary or add a new word..."
                                    value={dashboardSearch}
                                    onChange={(e) => setDashboardSearch(e.target.value)}
                                />
                                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-100 hover:bg-oxford-blue hover:text-white text-gray-600 p-2 rounded-xl transition-all">
                                    <Plus size={20} />
                                </button>
                            </form>
                        </div>

                        {/* Progress Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatsCard
                                title="Words to Review"
                                value={dueWordsCount}
                                icon={Brain}
                                color="bg-orange-400"
                            />
                            <StatsCard
                                title="Total Words"
                                value={vocabulary.length}
                                icon={BookOpen}
                                color="bg-blue-500"
                            />
                            <StatsCard
                                title="Mastered"
                                value={masteredWordsCount}
                                icon={Award}
                                color="bg-green-500"
                            />
                        </div>

                        {/* Call to Action */}
                        <div className="bg-oxford-blue rounded-3xl p-8 text-white relative overflow-hidden shadow-xl group cursor-pointer transition-transform hover:scale-[1.01]" onClick={() => setIsQuizActive(true)}>
                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">Daily Practice Session</h2>
                                    <p className="text-blue-100 max-w-md">
                                        {dueWordsCount > 0
                                            ? `You have ${dueWordsCount} words waiting for review. Keep your streak alive!`
                                            : "You're all caught up! Review ahead to reinforce your memory."}
                                    </p>
                                </div>
                                <button className="bg-white text-oxford-blue px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-colors whitespace-nowrap">
                                    Start Session
                                </button>
                            </div>
                            {/* Decorative background circles */}
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-5 rounded-full pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-500 opacity-20 rounded-full blur-2xl pointer-events-none"></div>
                        </div>
                    </div>
                )}

                {activeTab === 'library' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <h2 className="text-2xl font-bold text-gray-900">My Dictionary</h2>
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search your words..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    value={librarySearchQuery}
                                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {filteredList.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                <Search className="mx-auto text-gray-300 mb-4" size={48} />
                                <p className="text-gray-500 text-lg">No words found.</p>
                                {vocabulary.length === 0 && <p className="text-sm text-gray-400">Try saving some words from the web!</p>}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {filteredList.map((item) => (
                                    <WordCard key={item.headword} item={item} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-2 flex justify-around z-40 pb-safe">
                <button
                    onClick={() => setActiveTab('home')}
                    className={`flex flex-col items-center p-2 rounded-lg w-full ${activeTab === 'home' ? 'text-oxford-blue' : 'text-gray-400'}`}
                >
                    <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Home</span>
                </button>
                <button
                    onClick={() => setActiveTab('library')}
                    className={`flex flex-col items-center p-2 rounded-lg w-full ${activeTab === 'library' ? 'text-oxford-blue' : 'text-gray-400'}`}
                >
                    <BookOpen size={24} strokeWidth={activeTab === 'library' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Library</span>
                </button>
            </div>

            {/* Add Word Modal / Overlay */}
            {showAddModal && (
                <div
                    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={closeAddModal}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-oxford-blue text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Word Lookup</h3>
                            <button onClick={closeAddModal} className="hover:text-red-200 transition-colors"><Plus className="rotate-45" size={24} /></button>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {isSearching ? (
                                <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                                    <Loader2 className="animate-spin mb-3 text-oxford-blue" size={32} />
                                    <p>Searching Oxford Dictionary...</p>
                                </div>
                            ) : searchError ? (
                                <div className="py-8 text-center">
                                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Search size={32} />
                                    </div>
                                    <p className="text-gray-800 font-bold mb-1">Not Found</p>
                                    <p className="text-gray-500 text-sm mb-6">{searchError}</p>
                                    <button onClick={closeAddModal} className="text-oxford-blue font-medium hover:underline">Try another word</button>
                                </div>
                            ) : searchedWordData ? (
                                <div>
                                    {/* HEADWORD */}
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <h2 className="text-3xl font-bold text-gray-900">{searchedWordData.headword}</h2>
                                        <span className="text-gray-500 italic font-serif">{searchedWordData.pos}</span>
                                    </div>

                                    {/* PHONETICS */}
                                    {searchedWordData.phonetics && searchedWordData.phonetics.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-6">
                                            {searchedWordData.phonetics.map((p, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full text-oxford-blue">
                                                    {p.audioUrl && (
                                                        <button onClick={() => playAudio(p.audioUrl)} className="hover:scale-110 transition-transform">
                                                            <Volume2 size={16} />
                                                        </button>
                                                    )}
                                                    <span className="font-mono text-sm">/{p.ipa}/</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* DEFINITION */}
                                    <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                                        <p className="font-medium text-gray-800 mb-2">
                                            {searchedWordData.senses?.[0]?.definition}
                                        </p>
                                        {searchedWordData.senses?.[0]?.examples?.[0] && (
                                            <p className="text-gray-500 italic text-sm pl-3 border-l-2 border-blue-200">
                                                "{searchedWordData.senses[0].examples[0]}"
                                            </p>
                                        )}
                                    </div>

                                    {/* ACTION BUTTON */}
                                    {searchedWordData.isExisting ? (
                                        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-bold mb-2">
                                            <Check size={20} /> Already in Library
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleAddWord}
                                            className="w-full bg-oxford-blue text-white py-3.5 rounded-xl font-bold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10"
                                        >
                                            <Plus size={20} /> Add to Vocabulary
                                        </button>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

