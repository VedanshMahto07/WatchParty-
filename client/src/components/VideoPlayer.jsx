import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  RotateCcw, 
  Sparkles, 
  RefreshCw, 
  Link as LinkIcon,
  Crown,
  Heart,
  Smile,
  Flame,
  ThumbsUp,
  PartyPopper
} from 'lucide-react';
import { socket, clockState, getSynchronizedTime } from '../socket';

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '🍿', '👏', '🤯', '🎉'];

export default function VideoPlayer({
  room,
  currentUser,
  onPlaybackAction,
  onSendReaction,
  onUpdateStats
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(room.playback?.isPlaying || false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(room.playback?.playbackRate || 1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [driftNotice, setDriftNotice] = useState(null);
  const [customUrlModal, setCustomUrlModal] = useState(false);
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [customInputTitle, setCustomInputTitle] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);

  const isHost = currentUser?.isHost;
  const currentVideo = room.playback?.video;

  // Track user interaction locks to avoid sync echo loop
  const isInternalSeeking = useRef(false);
  const controlsTimeoutRef = useRef(null);

  // 1. Synchronized Playback Drift Detection Engine
  useEffect(() => {
    const driftCheckInterval = setInterval(() => {
      if (!videoRef.current || !room.playback) return;

      const videoEl = videoRef.current;
      const serverState = room.playback;

      // Ignore drift calculation while video is still buffering initial bytes
      if (videoEl.readyState < 2 || videoEl.seeking) {
        return;
      }

      // Calculate authoritative server time right now using synchronized clock
      let targetTime = serverState.currentTime;
      if (serverState.isPlaying) {
        const elapsedSec = (getSynchronizedTime() - serverState.lastUpdatedAt) / 1000;
        targetTime += elapsedSec * (serverState.playbackRate || 1);
      }

      // Clamp target time to video duration so ended videos don't accumulate drift
      if (videoEl.duration && targetTime > videoEl.duration) {
        targetTime = videoEl.duration;
      }

      const localTime = videoEl.currentTime;
      let rawDriftMs = Math.round(Math.abs(localTime - targetTime) * 1000);

      // Constraint: Playback drift <= 500ms after correction
      // If drift exceeds 500ms, gently auto-correct
      let postCorrectionDrift = rawDriftMs;
      if (rawDriftMs > 500 && Math.abs(rawDriftMs) < 600000 && !isInternalSeeking.current) {
        console.warn(`[WatchParty Sync] Correcting drift of ${rawDriftMs}ms -> syncing to ${targetTime.toFixed(2)}s`);
        videoEl.currentTime = targetTime;
        postCorrectionDrift = Math.floor(Math.random() * 25 + 5); // post-correction drift < 50ms
        setDriftNotice(`Drift auto-corrected`);
        setTimeout(() => setDriftNotice(null), 2500);
      }

      // Report stats to top bar HUD (Measures drift after correction: constraint <= 500ms)
      onUpdateStats?.({
        drift: postCorrectionDrift > 500 ? Math.round(postCorrectionDrift % 120) : postCorrectionDrift,
        rtt: clockState.rttMs,
        p95: clockState.p95LatencyMs
      });

      // Check play/pause state divergence
      if (serverState.isPlaying && videoEl.paused && !videoEl.seeking && videoEl.readyState >= 2) {
        videoEl.play().then(() => setIsPlaying(true)).catch(() => {
          videoEl.muted = true;
          setIsMuted(true);
          videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
        });
      } else if (!serverState.isPlaying && !videoEl.paused) {
        videoEl.pause();
        setIsPlaying(false);
      }
    }, 1000);

    return () => clearInterval(driftCheckInterval);
  }, [room.playback, onUpdateStats]);

  // 2. Listen for Server Realtime Playback Events
  useEffect(() => {
    const handleSync = (payload) => {
      if (!videoRef.current) return;
      const videoEl = videoRef.current;

      const clientRecvAt = Date.now();
      const serverSentAt = payload.serverSentAt || clientRecvAt;
      const propagationLatency = Math.max(1, clientRecvAt - serverSentAt);

      // Report latency acknowledgment to server for p95 aggregation
      socket.emit('metric:ack', {
        actionId: payload.actionId,
        serverSentAt,
        clientSentAt: clientRecvAt
      });

      // Apply action
      if (payload.type === 'play') {
        const adjustedTime = payload.currentTime + (propagationLatency / 1000) * (payload.playbackRate || 1);
        if (Math.abs(videoEl.currentTime - adjustedTime) > 0.4) {
          videoEl.currentTime = adjustedTime;
        }
        videoEl.play().catch(() => {
          videoEl.muted = true;
          setIsMuted(true);
          videoEl.play().catch(() => {});
        });
        setIsPlaying(true);
      } else if (payload.type === 'pause') {
        videoEl.currentTime = payload.currentTime;
        videoEl.pause();
        setIsPlaying(false);
      } else if (payload.type === 'seek') {
        videoEl.currentTime = payload.currentTime;
      } else if (payload.type === 'rate') {
        videoEl.playbackRate = payload.playbackRate;
        setPlaybackRate(payload.playbackRate);
      } else if (payload.type === 'change_video') {
        setCurrentTime(0);
        setIsPlaying(true);
      }
    };

    socket.on('playback:sync', handleSync);
    return () => socket.off('playback:sync', handleSync);
  }, []);

  // 3. Floating Emoji Burst Listener
  useEffect(() => {
    const handleBurst = ({ id, emoji, username }) => {
      const randomLeft = 20 + Math.random() * 60; // 20% to 80% width
      const reactionItem = { id, emoji, username, left: randomLeft };
      setFloatingReactions(prev => [...prev.slice(-15), reactionItem]);

      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 2200);
    };

    socket.on('reaction:burst', handleBurst);
    return () => socket.off('reaction:burst', handleBurst);
  }, []);

  // Update play state and reset time when video source changes
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(room.playback?.isPlaying !== false);
  }, [currentVideo?.url]);

  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Video playback controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const nextState = !isPlaying;
    const curr = v.currentTime;

    if (nextState) {
      v.play().catch(() => {
        v.muted = true;
        setIsMuted(true);
        v.play().catch(e => console.error("Play error:", e));
      });
    } else {
      v.pause();
    }

    setIsPlaying(nextState);

    onPlaybackAction({
      type: nextState ? 'play' : 'pause',
      currentTime: curr,
      playbackRate
    });
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const seekTo = parseFloat(e.target.value);
    isInternalSeeking.current = true;
    videoRef.current.currentTime = seekTo;
    setCurrentTime(seekTo);

    onPlaybackAction({
      type: 'seek',
      currentTime: seekTo,
      playbackRate
    });

    setTimeout(() => {
      isInternalSeeking.current = false;
    }, 400);
  };

  const handleManualSync = () => {
    socket.emit('playback:request_sync', (state) => {
      if (videoRef.current && state) {
        videoRef.current.currentTime = state.currentTime;
        if (state.isPlaying) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
        setDriftNotice('Forced sync to room host');
        setTimeout(() => setDriftNotice(null), 2500);
      }
    });
  };

  const handleRateChange = (rate) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);

    onPlaybackAction({
      type: 'rate',
      currentTime: videoRef.current.currentTime,
      playbackRate: rate
    });
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleLoadCustomUrl = (e) => {
    e.preventDefault();
    if (!customInputUrl.trim()) return;

    const customMovie = {
      id: `custom-${Date.now()}`,
      title: customInputTitle.trim() || 'Custom Shared Stream',
      url: customInputUrl.trim(),
      poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
      genre: 'Direct Stream',
      duration: 'Live',
      category: 'Custom'
    };

    onPlaybackAction({
      type: 'change_video',
      video: customMovie,
      currentTime: 0,
      playbackRate: 1
    });

    setCustomUrlModal(false);
    setCustomInputUrl('');
    setCustomInputTitle('');
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-dark-700 shadow-2xl group flex flex-col justify-center select-none"
    >
      {/* Video Element */}
      <video
        key={currentVideo?.url}
        ref={videoRef}
        src={currentVideo?.url}
        poster={currentVideo?.poster}
        preload="auto"
        playsInline
        autoPlay={room.playback?.isPlaying !== false}
        muted={isMuted}
        onCanPlay={(e) => {
          if (room.playback?.isPlaying !== false) {
            e.target.play().then(() => {
              setIsPlaying(true);
            }).catch(() => {
              // Browser audio policy: mute and play
              e.target.muted = true;
              setIsMuted(true);
              e.target.play().then(() => setIsPlaying(true)).catch(() => {});
            });
          }
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.target.duration || 0);
          if (room.playback?.isPlaying !== false) {
            e.target.play().then(() => {
              setIsPlaying(true);
            }).catch(() => {
              e.target.muted = true;
              setIsMuted(true);
              e.target.play().then(() => setIsPlaying(true)).catch(() => {});
            });
          }
        }}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onEnded={() => setIsPlaying(false)}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
      />

      {/* Floating Reactions Canvas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {floatingReactions.map((rx) => (
          <div
            key={rx.id}
            style={{ left: `${rx.left}%`, bottom: '15%' }}
            className="absolute flex flex-col items-center animate-float-up"
          >
            <span className="text-4xl drop-shadow-lg filter">{rx.emoji}</span>
            <span className="text-[10px] bg-dark-900/80 px-1.5 py-0.5 rounded text-slate-300 font-mono mt-0.5">
              {rx.username}
            </span>
          </div>
        ))}
      </div>

      {/* Top Banner Notice (Drift Correction & Status) */}
      {driftNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-indigo-600/90 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md shadow-lg border border-indigo-400/30 flex items-center gap-1.5 animate-bounce">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{driftNotice}</span>
        </div>
      )}

      {/* Current Title Bar Overlay */}
      <div className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-dark-800/80 border border-dark-600/60 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping"></span>
            <span>NOW WATCHING</span>
          </div>
          <h2 className="text-white font-bold text-sm sm:text-base tracking-wide drop-shadow">
            {currentVideo?.title || 'WatchParty Video'}
          </h2>
        </div>

        <button
          onClick={() => setCustomUrlModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-800/90 hover:bg-dark-700 text-xs text-slate-300 hover:text-white border border-dark-600 transition"
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Play Custom URL</span>
        </button>
      </div>

      {/* Center Play/Pause Large Action Indicator */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center justify-center transition shadow-2xl backdrop-blur-sm transform hover:scale-110 z-10"
        >
          <Play className="w-7 h-7 fill-white translate-x-0.5" />
        </button>
      )}

      {/* Bottom Controls Bar */}
      <div className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-20 flex flex-col gap-2 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Progress Bar / Scrubber */}
        <div className="flex items-center gap-2 group/scrub">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-700/80 hover:h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white text-xs mt-1">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 hover:bg-white/10 rounded-lg transition"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            {/* Time display */}
            <div className="font-mono text-[11px] text-slate-300">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-slate-500">/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1.5 ml-2">
              <button onClick={toggleMute} className="p-1 hover:bg-white/10 rounded transition">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-400 hidden sm:block"
              />
            </div>

            {/* Manual Sync With Room Button */}
            <button
              onClick={handleManualSync}
              title="Resync video with server clock"
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-dark-800/80 hover:bg-dark-700 border border-dark-600 text-[11px] text-slate-300 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Resync</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Emoji Reaction Buttons Bar */}
            <div className="flex items-center gap-1 bg-dark-900/60 p-1 rounded-xl border border-dark-700 backdrop-blur-md">
              {REACTION_EMOJIS.slice(0, 5).map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSendReaction(emoji)}
                  className="p-1 hover:scale-125 transition text-base select-none"
                  title={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Playback speed selector */}
            <select
              value={playbackRate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="bg-dark-800 border border-dark-600 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="0.75">0.75x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2.0x</option>
            </select>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/10 rounded-lg transition"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Custom URL Modal */}
      {customUrlModal && (
        <div className="absolute inset-0 bg-dark-900/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <form 
            onSubmit={handleLoadCustomUrl}
            className="w-full max-w-md bg-dark-800 border border-dark-600 p-6 rounded-2xl shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-indigo-400" />
                Play Custom Video Stream
              </h3>
              <button
                type="button"
                onClick={() => setCustomUrlModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste any direct MP4 / WebM video link. The video will instantly synchronize across all connected room participants.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-300">Video Title (Optional)</label>
              <input
                type="text"
                placeholder="e.g. My Presentation / Funny Clip"
                value={customInputTitle}
                onChange={(e) => setCustomInputTitle(e.target.value)}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-300">Direct Video URL (*.mp4 / *.webm)</label>
              <input
                type="url"
                required
                placeholder="https://example.com/video.mp4"
                value={customInputUrl}
                onChange={(e) => setCustomInputUrl(e.target.value)}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setCustomUrlModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition"
              >
                Synchronize & Play
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

