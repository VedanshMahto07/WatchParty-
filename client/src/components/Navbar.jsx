import React, { useState } from 'react';
import { 
  Tv, 
  Users, 
  Copy, 
  Check, 
  Activity, 
  Film, 
  LogOut, 
  Share2, 
  Crown,
  Wifi
} from 'lucide-react';

export default function Navbar({ 
  room, 
  currentUser, 
  onLeave, 
  onOpenDiscovery, 
  onOpenDiagnostics,
  stats 
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = () => {
    const url = `${window.location.origin}?room=${room.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHealthy = stats.p95 <= 250 && stats.drift <= 500;

  return (
    <header className="h-16 border-b border-dark-700 bg-dark-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Room Info */}
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">WatchParty</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Ultra-Sync Realtime Cinema</p>
          </div>
        </div>

        {/* Room Code Badge with Copy */}
        <div className="flex items-center gap-1.5 bg-dark-800 border border-dark-700/80 rounded-lg px-2.5 py-1.5">
          <span className="text-xs text-slate-400 font-medium">Room:</span>
          <span className="text-xs font-mono font-bold text-indigo-400 tracking-wider">
            {room.id}
          </span>
          <button
            onClick={handleCopyInvite}
            title="Copy invite link"
            className="ml-1.5 p-1 hover:bg-dark-700 rounded text-slate-400 hover:text-white transition flex items-center gap-1 text-[11px]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold hidden md:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Share</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Controls & Status */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Real-time Health & Drift Pill */}
        <button
          onClick={onOpenDiagnostics}
          title="Click to view full network and drift diagnostics"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-dark-800/90 border border-dark-700 text-xs hover:border-dark-600 transition group"
        >
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-300">RTT: <span className="text-emerald-400 font-semibold">{stats.rtt}ms</span></span>
            <span className="hidden lg:inline text-slate-400">|</span>
            <span className="hidden lg:inline text-slate-300">p95: <span className="text-indigo-400 font-semibold">{stats.p95}ms</span></span>
            <span className="hidden xl:inline text-slate-400">|</span>
            <span className="hidden xl:inline text-slate-300">Drift: <span className="text-pink-400 font-semibold">{stats.drift}ms</span></span>
          </div>
          <Activity className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition ml-0.5" />
        </button>

        {/* Movie Discovery Button */}
        <button
          onClick={onOpenDiscovery}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          <Film className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Movie Discovery</span>
        </button>

        {/* User Badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-dark-800 border border-dark-700 text-xs">
          <span className="text-base select-none">{currentUser?.avatar || '🍿'}</span>
          <div className="flex flex-col text-left">
            <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1">
              {currentUser?.username}
              {currentUser?.isHost && (
                <Crown className="w-3 h-3 text-amber-400 inline" title="Room Host" />
              )}
            </span>
          </div>
        </div>

        {/* Leave Room Button */}
        <button
          onClick={onLeave}
          title="Leave Watch Party"
          className="p-2 rounded-lg bg-dark-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 border border-dark-700 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

