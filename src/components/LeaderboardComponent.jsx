import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../utils/api';
import { Trophy, Medal, User, Flame, BookOpen } from 'lucide-react';

export default function LeaderboardComponent() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            const res = await getLeaderboard();
            if (res.success) {
                setLeaderboard(res.leaderboard);
            }
        } catch (error) {
            console.error('Failed to load leaderboard', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-center p-4 text-xs text-gray-400">Loading leaderboard...</div>;
    }

    return (
        <div className="mt-6 mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <Trophy size={14} className="text-yellow-500" /> Leaderboard
            </h3>
            
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                {leaderboard.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">No data yet</div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {leaderboard.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                        ${index === 0 ? 'bg-yellow-100 text-yellow-600' : 
                                          index === 1 ? 'bg-gray-100 text-gray-600' :
                                          index === 2 ? 'bg-orange-100 text-orange-600' : 'text-gray-400'}
                                    `}>
                                        {index + 1}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-800 flex items-center gap-1">
                                            {entry.username}
                                            {index === 0 && <Medal size={12} className="text-yellow-500" />}
                                        </span>
                                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                                            <span className="flex items-center gap-1" title="Mastered Words">
                                                <BookOpen size={10} className="text-green-500" /> 
                                                <span className="font-bold text-gray-600">{entry.mastered_words || 0}</span>
                                            </span>
                                            <span className="flex items-center gap-1" title="Steak">
                                                <Flame size={10} className="text-orange-500" />
                                                <span className="font-bold text-gray-600">{entry.streak_days || 0}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="font-mono text-sm font-bold text-oxford-blue">
                                    {entry.total_points || 0} pts
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
