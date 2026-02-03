import React, { useState } from 'react';
import { login, register } from '../utils/api';
import { Loader2, User, LogOut } from 'lucide-react';

export default function LoginComponent({ onLoginSuccess, onLogout, user }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let res;
            if (isRegistering) {
                res = await register(email, username, password);
            } else {
                res = await login(email, password);
            }

            if (res.success) {
                onLoginSuccess(res.user, res.token);
            } else {
                setError(res.error || 'Authentication failed');
            }
        } catch (err) {
            setError('Network error. Is server running?');
        } finally {
            setLoading(false);
        }
    };

    if (user) {
        return (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                        {user.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-800">{user.username}</span>
                        <span className="text-[10px] text-gray-500">{user.email}</span>
                    </div>
                </div>
                <button 
                    onClick={onLogout}
                    className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                >
                    <LogOut size={16} />
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                <User size={16} />
                {isRegistering ? 'Create Account' : 'Login to Sync'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-3">
                {isRegistering && (
                    <input
                        type="text"
                        placeholder="Username"
                        required
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                )}
                
                <input
                    type="email"
                    placeholder="Email"
                    required
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                
                <input
                    type="password"
                    placeholder="Password"
                    required
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-1.5 bg-oxford-blue text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2"
                >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {isRegistering ? 'Sign Up' : 'Sign In'}
                </button>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
                        className="text-xs text-gray-500 hover:text-oxford-blue hover:underline"
                    >
                        {isRegistering ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </form>
        </div>
    );
}
