import React, { useState, useEffect } from 'react';
import { 
  Tv, 
  Sparkles, 
  ArrowRight, 
  Users, 
  Zap, 
  ShieldCheck, 
  Film, 
  Flame,
  Clock,
  Radio
} from 'lucide-react';

const AVATARS = ['🍿', '🎬', '🚀', '🐱', '🦊', '⚡', '🎧', '🔥'];

export default function Lobby({
  onCreateRoom,
  onJoinRoom,
  error
}) {
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('🍿');
  const [roomCode, setRoomCode] = useState('');
  const [tab, setTab] = useState('create'); // 'create' | 'join'

  // Check URL query params for ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      setRoomCode(code.toUpperCase());
      setTab('join');
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalName = username.trim() || `MovieFan-${Math.floor(Math.random() * 899 + 100)}`;

    if (tab === 'create') {
      onCreateRoom({ username: finalName, avatar });
    } else {
      if (!roomCode.trim()) return;
      onJoinRoom({ roomId: roomCode.trim().toUpperCase(), username: finalName, avatar });
    }
  };

  const handleQuickDemo = () => {
    onCreateRoom({
      username: username.trim() || 'Cinema Host',
      avatar
    });
  };

  return (
    <div className="min-h-screen bg-[#090a0f] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo and Tagline */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 text-white shadow-xl shadow-indigo-500/25 mb-4">
            <Tv className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            WatchParty <span className="text-indigo-400 font-mono text-sm px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">LIVE</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">
            Synchronized cinema rooms with ultra-low latency playback, live reactions & movie discovery.
          </p>
        </div>

        {/* Card */}
        <div className="bg-dark-850/90 border border-dark-700/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {/* Tab Switcher */}
          <div className="flex bg-dark-900/80 p-1 rounded-xl mb-6 border border-dark-700/60">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                tab === 'create'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create New Room
            </button>
            <button
              type="button"
              onClick={() => setTab('join')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                tab === 'join'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Join with Code
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Your Nickname
              </label>
              <input
                type="text"
                placeholder="e.g. Alex (or leave blank for random)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Avatar Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Select Your Avatar
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`h-10 rounded-xl text-xl flex items-center justify-center transition ${
                      avatar === av
                        ? 'bg-indigo-600/30 border-2 border-indigo-500 scale-105'
                        : 'bg-dark-900 border border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Room Code if Join */}
            {tab === 'join' && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  6-Letter Room Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="e.g. ALPHA7"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-sm font-mono tracking-widest text-indigo-400 uppercase placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 group mt-2"
            >
              <span>{tab === 'create' ? 'Launch Watch Party' : 'Enter Party Room'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
          </form>

          {/* Quick Demo Shortcut */}
          <div className="mt-4 pt-4 border-t border-dark-700/60 text-center">
            <button
              onClick={handleQuickDemo}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
            >
              Instant 1-Click Launch (Host Ready) &rarr;
            </button>
          </div>
        </div>

        {/* Technical Constraints Badge Row */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="bg-dark-850/60 border border-dark-700/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-mono">Propagation</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">&le; 250ms p95</span>
          </div>
          <div className="bg-dark-850/60 border border-dark-700/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-mono">Drift Sync</span>
            <span className="text-xs font-bold text-pink-400 font-mono">&le; 500ms auto</span>
          </div>
          <div className="bg-dark-850/60 border border-dark-700/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-mono">Capacity</span>
            <span className="text-xs font-bold text-indigo-400 font-mono">10+ Peers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

