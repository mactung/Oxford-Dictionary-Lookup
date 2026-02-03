
import React, { useEffect, useState } from 'react';
import { Trash2, Volume2, ExternalLink, Home, BookOpen, Brain, Search, TrendingUp, Award, Plus, Loader2, Check, Settings, Clock, Power, User, X } from 'lucide-react';
import { parseOxfordHTML } from '../utils/parser';

import Quiz from './Quiz';
import LoginComponent from '../components/LoginComponent';
import LeaderboardComponent from '../components/LeaderboardComponent';
import { syncUserVocabulary } from '../utils/api';

export default function App() {
    const [vocabulary, setVocabulary] = useState([]);

    const [activeTab, setActiveTab] = useState('home'); // home, library, leaderboard
    const [isQuizActive, setIsQuizActive] = useState(false);

    // User / Auth State
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Search/Add State
    const [dashboardSearch, setDashboardSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchedWordData, setSearchedWordData] = useState(null);
    const [searchError, setSearchError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // Library Search State
    const [librarySearchQuery, setLibrarySearchQuery] = useState('');

    // Bookmarks State
    const [bookmarkFolders, setBookmarkFolders] = useState([]);
    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [folderBookmarks, setFolderBookmarks] = useState([]);

    // Random Practice State
    const [randomPracticeEnabled, setRandomPracticeEnabled] = useState(false);
    const [randomPracticeFrequency, setRandomPracticeFrequency] = useState(60); // minutes

    useEffect(() => {
        chrome.storage.local.get(['vocabulary', 'randomPracticeEnabled', 'randomPracticeFrequency'], (result) => {
            if (result.vocabulary) {
                // Filter out corrupted items (missing headword) to prevent crashes
                const validVocab = result.vocabulary.filter(item => item && item.headword);

                // Keep original order (Oldest -> Newest) in state
                setVocabulary(validVocab);

                // Self-heal: If we found invalid items, update storage
                if (validVocab.length !== result.vocabulary.length) {
                    chrome.storage.local.set({ vocabulary: validVocab });
                }
            }

            // Load Random Practice Settings
            if (result.randomPracticeEnabled !== undefined) setRandomPracticeEnabled(result.randomPracticeEnabled);
            if (result.randomPracticeFrequency !== undefined) setRandomPracticeFrequency(result.randomPracticeFrequency);
        });

        // Load User
        chrome.storage.local.get(['user', 'token'], (result) => {
            if (result.user && result.token) {
                setUser(result.user);
                setToken(result.token);
            }
        });

        // Load saved folder selection
        chrome.storage.local.get(['selectedFolderId'], (result) => {
            if (result.selectedFolderId) {
                setSelectedFolderId(result.selectedFolderId);
            }
        });

        // Fetch all bookmark folders
        if (chrome.bookmarks) {
            chrome.bookmarks.getTree((tree) => {
                const folders = [];
                const traverse = (nodes) => {
                    nodes.forEach(node => {
                        if (node.children) {
                            // It's a folder (or root)
                            if (node.id !== '0') { // Skip root
                                folders.push({ id: node.id, title: node.title });
                            }
                            traverse(node.children);
                        }
                    });
                };
                traverse(tree);
                setBookmarkFolders(folders);
            });
        }
    }, []);

    // Fetch bookmarks when folder changes
    useEffect(() => {
        if (selectedFolderId && chrome.bookmarks) {
            chrome.bookmarks.getChildren(selectedFolderId, (children) => {
                const bookmarks = children.filter(node => node.url); // Only actual bookmarks
                setFolderBookmarks(bookmarks);
                chrome.storage.local.set({ selectedFolderId });
            });
        } else {
            setFolderBookmarks([]);
        }
    }, [selectedFolderId]);

    // Save Random Practice Settings
    const toggleRandomPractice = () => {
        const newValue = !randomPracticeEnabled;
        setRandomPracticeEnabled(newValue);
        chrome.storage.local.set({ randomPracticeEnabled: newValue });

        // Also update alarm immediately if possible (background script handles alarm on storage change typically, 
        // but we might need to notify it or let it observe storage)
        // We will implement storage listener in background script.
    };

    const changeFrequency = (minutes) => {
        const val = parseInt(minutes);
        setRandomPracticeFrequency(val);
        const updates = { randomPracticeFrequency: val };

        // If switching to test mode (1 min), reset timer to trigger sooner
        if (val === 1) {
            updates.randomPracticeLastTime = 0;
            updates.randomPracticeSnoozeUntil = 0;
        }

        chrome.storage.local.set(updates);
    };

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

    // --- Auth Logic ---
    const handleLoginSuccess = (userData, tokenData) => {
        setUser(userData);
        setToken(tokenData);
        chrome.storage.local.set({ user: userData, token: tokenData });
        performSync(tokenData);
    };

    const handleLogout = () => {
        setUser(null);
        setToken(null);
        chrome.storage.local.remove(['user', 'token']);
    };

    const performSync = (authToken) => {
        const localVocab = [...vocabulary];
        syncUserVocabulary(authToken, localVocab).then(res => {
            if (res.success && res.vocabulary) {
                console.log('Sync success (New Tab)');
                const serverVocab = res.vocabulary;
                const localMap = new Map(localVocab.map(i => [i.headword, i]));
                const merged = [...localVocab];
                
                let changed = false;
                serverVocab.forEach(sv => {
                    if (!localMap.has(sv.headword)) {
                        merged.push({
                            headword: sv.headword,
                            pos: 'unknown',
                            srsLevel: sv.srs_level,
                            nextReview: new Date(sv.next_review).getTime(),
                            contextUrl: 'Synced',
                            definition: 'Synced via New Tab'
                        });
                        changed = true;
                    }
                });

                if (changed) {
                    setVocabulary(merged); // Update state
                    chrome.storage.local.set({ vocabulary: merged });
                }
            }
        }).catch(err => console.error('Sync failed', err));
    };

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
            // Trigger Auto Sync even for existing words (to ensure DB has them)
            chrome.runtime.sendMessage({ action: 'syncToCloud', data: existing });
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
                    // Trigger Auto Sync
                    chrome.runtime.sendMessage({ action: 'syncToCloud', data: parsed });
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
                                    <li key={j} className="italic text-xs">
                                        {typeof ex === 'object' ? (
                                            <>
                                                {ex.pattern && (
                                                    <span className="font-bold text-oxford-blue not-italic bg-blue-50 px-1 rounded mr-1">
                                                        {ex.pattern}
                                                    </span>
                                                )}
                                                {ex.label && (
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 mr-1 not-italic border border-gray-200 px-1 rounded">
                                                        {ex.label}
                                                    </span>
                                                )}
                                                {ex.text}
                                            </>
                                        ) : (
                                            ex // Render legacy string examples directly
                                        )}
                                    </li>
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
                        <button
                            onClick={() => setActiveTab('leaderboard')}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'leaderboard' ? 'bg-white text-oxford-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Leaderboard
                        </button>
                    </div>

                    
                    {/* User Profile Button */}
                    <button 
                        onClick={() => setShowProfileModal(true)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${user ? 'bg-blue-50 text-oxford-blue' : 'text-gray-400 hover:bg-gray-100'}`}
                        title="Profile & Leaderboard"
                    >
                        {user ? (
                            <>
                                <div className="w-8 h-8 rounded-full bg-oxford-blue text-white flex items-center justify-center text-xs font-bold">
                                    {user.username[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-bold hidden md:inline">{user.username}</span>
                            </>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User size={20} className="text-gray-500" />
                            </div>
                        )}
                    </button>
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

                        {/* Bookmarks Section */}
                        <div className="max-w-4xl mx-auto md:mx-0">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <BookOpen size={20} className="text-blue-500" />
                                    Quick Access
                                </h2>
                                <select
                                    value={selectedFolderId || ''}
                                    onChange={(e) => setSelectedFolderId(e.target.value)}
                                    className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none hover:border-gray-300 transition-colors"
                                >
                                    <option value="" disabled>Select a folder</option>
                                    {bookmarkFolders.map(folder => (
                                        <option key={folder.id} value={folder.id}>{folder.title}</option>
                                    ))}
                                </select>
                            </div>

                            {folderBookmarks.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {folderBookmarks.map(bookmark => (
                                        <a
                                            key={bookmark.id}
                                            href={bookmark.url}
                                            className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3 group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                                                <img
                                                    src={`chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(bookmark.url)}&size=32`}
                                                    alt=""
                                                    className="w-5 h-5 object-contain"
                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-600 transition-colors">
                                                {bookmark.title || bookmark.url}
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            ) : selectedFolderId ? (
                                <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-200">
                                    <p className="text-gray-400 text-sm">No bookmarks in this folder.</p>
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-200">
                                    <p className="text-gray-400 text-sm">Select a folder to view bookmarks.</p>
                                </div>
                            )}
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

                        {/* Settings: Random Practice */}
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-1">
                                        <Brain size={20} className="text-blue-500" />
                                        Random Practice Mode
                                    </h2>
                                    <p className="text-gray-500 text-sm max-w-md">
                                        Occasionally show a quick quiz while you browse the web to reinforce your memory.
                                    </p>
                                </div>

                                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl">
                                    {randomPracticeEnabled && (
                                        <div className="flex items-center gap-2 mr-2">
                                            <Clock size={16} className="text-gray-400" />
                                            <select
                                                value={randomPracticeFrequency}
                                                onChange={(e) => changeFrequency(e.target.value)}
                                                className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer"
                                            >
                                                <option value="1">Every 1 min (Test)</option>
                                                <option value="30">Every 30 mins</option>
                                                <option value="60">Every 1 hour</option>
                                                <option value="120">Every 2 hours</option>
                                                <option value="240">Every 4 hours</option>
                                            </select>
                                        </div>
                                    )}

                                    <button
                                        onClick={toggleRandomPractice}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all text-sm ${randomPracticeEnabled
                                            ? 'bg-blue-100 text-blue-700 shadow-sm'
                                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                            }`}
                                    >
                                        <Power size={16} />
                                        {randomPracticeEnabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                            </div>
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

                {activeTab === 'leaderboard' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Leaderboard</h2>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <LeaderboardComponent />
                        </div>
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
                <button
                    onClick={() => setActiveTab('leaderboard')}
                    className={`flex flex-col items-center p-2 rounded-lg w-full ${activeTab === 'leaderboard' ? 'text-oxford-blue' : 'text-gray-400'}`}
                >
                    <Award size={24} strokeWidth={activeTab === 'leaderboard' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Leader</span>
                </button>
            </div>

            {/* Add Word Modal / Overlay */}
            {showAddModal && (
                <div
                    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={closeAddModal}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-oxford-blue text-white px-6 py-4 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold">Word Lookup</h3>
                            <button onClick={closeAddModal} className="hover:text-red-200 transition-colors"><Plus className="rotate-45" size={24} /></button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
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

                                    {/* DETAILED DEFINITIONS */}
                                    <div className="space-y-4 mb-6">
                                        {searchedWordData.senses?.map((sense, idx) => (
                                            <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                <div className="flex gap-2">
                                                    <span className="text-oxford-blue font-bold text-sm bg-blue-100 h-6 w-6 flex items-center justify-center rounded-full shrink-0">{idx + 1}</span>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-gray-800 mb-2 leading-relaxed">
                                                            {sense.definition}
                                                        </p>

                                                        {/* Synonyms */}
                                                        {sense.synonyms && sense.synonyms.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Synonyms:</span>
                                                                {sense.synonyms.map((syn, k) => (
                                                                    <span key={k} className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs text-gray-600 font-medium">
                                                                        {syn}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Examples */}
                                                        {sense.examples && sense.examples.length > 0 && (
                                                            <ul className="text-gray-500 italic text-sm pl-3 border-l-2 border-blue-200 space-y-1">
                                                                {sense.examples.map((ex, j) => (
                                                                    <li key={j}>
                                                                        {typeof ex === 'object' ? (
                                                                            <>
                                                                                {ex.pattern && (
                                                                                    <span className="font-bold text-oxford-blue not-italic bg-blue-50 px-1 rounded mr-1">
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

                                    {/* IDIOMS */}
                                    {searchedWordData.idioms && searchedWordData.idioms.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <TrendingUp size={16} /> Idioms
                                            </h3>
                                            <div className="space-y-3">
                                                {searchedWordData.idioms.map((idm, idx) => (
                                                    <div key={idx} className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                                        <p className="font-bold text-gray-800 text-sm mb-1">{idm.phrase}</p>
                                                        <p className="text-xs text-gray-600">{idm.definition}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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

            {/* Profile Modal */}
            {showProfileModal && (
                <div
                    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowProfileModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-oxford-blue text-white px-6 py-4 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <User size={20} /> User Profile
                            </h3>
                            <button onClick={() => setShowProfileModal(false)} className="hover:text-red-200 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <LoginComponent 
                                user={user} 
                                onLoginSuccess={handleLoginSuccess}
                                onLogout={handleLogout}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

