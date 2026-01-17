
import React, { useEffect, useState } from 'react';
import { Trash2, Volume2, ExternalLink, Home, BookOpen, Brain, Search, TrendingUp, Award } from 'lucide-react';

import Quiz from './Quiz';

export default function App() {
    const [vocabulary, setVocabulary] = useState([]);
    const [activeTab, setActiveTab] = useState('home'); // home, library
    const [isQuizActive, setIsQuizActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
        e.stopPropagation();
        if (url) new Audio(url).play();
    }

    // --- Derived State ---
    const reversedList = [...vocabulary].reverse();
    const filteredList = reversedList.filter(w => w.headword.toLowerCase().includes(searchQuery.toLowerCase()));

    const dueWordsCount = vocabulary.filter(w => {
        if (!w.nextReview) return true;
        return w.nextReview <= Date.now();
    }).length;

    const masteredWordsCount = vocabulary.filter(w => (w.srsLevel || 0) >= 4).length;

    // --- Components ---

    const StatsCard = ({ title, value, icon: Icon, color }) => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`p - 3 rounded - xl ${color} `}>
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
                    className={`text - [10px] font - bold px - 2 py - 0.5 rounded - full uppercase tracking - wide ${(item.srsLevel || 0) >= 4 ? 'bg-green-100 text-green-700' :
                        (item.srsLevel || 0) >= 2 ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                        } `}
                >
                    Lvl {item.srsLevel || 0}
                </div>
            </div>

            <div className="text-gray-600 text-sm line-clamp-2 mb-4 h-10 leading-relaxed">
                {item.senses && item.senses[0] ? item.senses[0].definition : 'No definition'}
            </div>

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                <div className="flex gap-2">
                    {item.phonetics && item.phonetics[0] && item.phonetics[0].audioUrl && (
                        <button
                            onClick={(e) => playAudio(item.phonetics[0].audioUrl, e)}
                            className="text-gray-400 hover:text-oxford-blue transition-colors bg-gray-50 hover:bg-blue-50 p-1.5 rounded-md"
                        >
                            <Volume2 size={14} />
                        </button>
                    )}
                    <a
                        href={`https://www.oxfordlearnersdictionaries.com/definition/english/${item.headword}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-oxford-blue transition-colors bg-gray-50 hover:bg-blue-50 p-1.5 rounded-md"
                    >
                        <ExternalLink size={14} />
                    </a >
                </div >
            </div >
        </div >
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
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Good Afternoon!</h1>
                            <p className="text-gray-500 mt-1">Ready to expand your vocabulary today?</p>
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
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
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
        </div>
    );
}

