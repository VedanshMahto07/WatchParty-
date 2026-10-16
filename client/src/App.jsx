import React, { useState, useEffect } from 'react';
import { socket, startTimeSync } from './socket';
import Navbar from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import SidePanel from './components/SidePanel';
import MovieDiscovery from './components/MovieDiscovery';
import DiagnosticsModal from './components/DiagnosticsModal';
import Lobby from './components/Lobby';

export default function App() {
  const [room, setRoom] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [lobbyError, setLobbyError] = useState(null);

  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  // Live HUD metrics
  const [stats, setStats] = useState({
    rtt: 0,
    p95: 12,
    drift: 0
  });

  // Start NTP clock sync
  useEffect(() => {
    const stopSync = startTimeSync();
    return () => stopSync();
  }, []);

  // Socket room events
  useEffect(() => {
    // User joined
    socket.on('room:user_joined', ({ user, chatMsg, totalUsers }) => {
      setRoom(prev => {
        if (!prev) return prev;
        const exists = prev.users.some(u => u.id === user.id);
        const updatedUsers = exists ? prev.users : [...prev.users, user];
        return {
          ...prev,
          users: updatedUsers,
          chat: [...prev.chat, chatMsg]
        };
      });
    });

    // User left
    socket.on('room:user_left', ({ userId, users, chatMsg }) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          users,
          chat: [...prev.chat, chatMsg]
        };
      });
    });

    // Host transferred
    socket.on('room:host_transferred', ({ newHostId, users, message }) => {
      setRoom(prev => {
        if (!prev) return prev;
        const chatUpdate = message
          ? [
              ...prev.chat,
              {
                id: `msg-${Date.now()}`,
                userId: 'system',
                username: 'System',
                text: message,
                timestamp: Date.now(),
                isSystem: true
              }
            ]
          : prev.chat;

        return {
          ...prev,
          hostId: newHostId,
          users,
          chat: chatUpdate
        };
      });

      setCurrentUser(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          isHost: prev.id === newHostId
        };
      });
    });

    // New chat message
    socket.on('chat:new_message', (msg) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          chat: [...prev.chat, msg]
        };
      });
    });

    // Playlist updated
    socket.on('playlist:updated', (playlist) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          playlist
        };
      });
    });

    // Poll updated
    socket.on('poll:updated', (poll) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          poll
        };
      });
    });

    // Playback sync from server
    socket.on('playback:sync', (payload) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          playback: {
            ...prev.playback,
            currentTime: payload.currentTime,
            isPlaying: payload.isPlaying,
            playbackRate: payload.playbackRate || prev.playback.playbackRate,
            video: payload.video || prev.playback.video,
            lastUpdatedAt: payload.serverSentAt || Date.now()
          }
        };
      });
    });

    return () => {
      socket.off('room:user_joined');
      socket.off('room:user_left');
      socket.off('room:host_transferred');
      socket.off('chat:new_message');
      socket.off('playlist:updated');
      socket.off('poll:updated');
      socket.off('playback:sync');
    };
  }, []);

  // Room Actions
  const handleCreateRoom = ({ username, avatar }) => {
    setLobbyError(null);
    socket.emit('room:create', { username, avatar }, (res) => {
      if (res.success) {
        setRoom(res.room);
        setCurrentUser(res.user);
        // update browser address bar with room code
        window.history.pushState({}, '', `?room=${res.room.id}`);
      } else {
        setLobbyError(res.error || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = ({ roomId, username, avatar }) => {
    setLobbyError(null);
    socket.emit('room:join', { roomId, username, avatar }, (res) => {
      if (res.success) {
        setRoom(res.room);
        setCurrentUser(res.user);
        window.history.pushState({}, '', `?room=${res.room.id}`);
      } else {
        setLobbyError(res.error || 'Failed to join room');
      }
    });
  };

  const handleLeaveRoom = () => {
    window.location.href = window.location.origin;
  };

  const handlePlaybackAction = (data) => {
    socket.emit('playback:action', data);
  };

  const handleSendReaction = (emoji) => {
    socket.emit('reaction:send', { emoji });
  };

  const handleSendMessage = (text) => {
    socket.emit('chat:send', { text });
  };

  const handlePlayMovie = (movie) => {
    socket.emit('playlist:play_now', movie);
  };

  const handleAddToPlaylist = (movie) => {
    socket.emit('playlist:add', movie);
  };

  const handleRemovePlaylistItem = (index) => {
    socket.emit('playlist:remove', index);
  };

  const handleTransferHost = (newHostId) => {
    socket.emit('room:transfer_host', { newHostId });
  };

  // If not in a room yet, render Lobby
  if (!room) {
    return (
      <Lobby
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        error={lobbyError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        room={room}
        currentUser={currentUser}
        onLeave={handleLeaveRoom}
        onOpenDiscovery={() => setIsDiscoveryOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        stats={stats}
      />

      {/* Main Content Layout */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto flex flex-col lg:flex-row gap-6">
        {/* Left Stage: Video Player & Theater Details */}
        <div className="flex-1 flex flex-col gap-4">
          <VideoPlayer
            room={room}
            currentUser={currentUser}
            onPlaybackAction={handlePlaybackAction}
            onSendReaction={handleSendReaction}
            onUpdateStats={(newStats) => setStats(prev => ({ ...prev, ...newStats }))}
          />

          {/* Under-video Theater Info Card */}
          <div className="bg-dark-850 border border-dark-700/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-400">
                  {room.playback?.video?.category || 'Cinematic'}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {room.playback?.video?.year || 2024}
                </span>
              </div>
              <h3 className="font-bold text-lg text-white mt-0.5">
                {room.playback?.video?.title}
              </h3>
              <p className="text-xs text-slate-400 max-w-xl mt-1">
                {room.playback?.video?.description || 'Watching synchronized with friends in this room.'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <button
                onClick={() => setIsDiscoveryOpen(true)}
                className="flex-1 sm:flex-none px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-200 border border-dark-600 rounded-xl text-xs font-semibold transition"
              >
                Change Movie
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Chat, Queue, Polls, Peers */}
        <SidePanel
          room={room}
          currentUser={currentUser}
          onSendMessage={handleSendMessage}
          onPlayMovie={handlePlayMovie}
          onRemovePlaylistItem={handleRemovePlaylistItem}
          onTransferHost={handleTransferHost}
        />
      </main>

      {/* Modals */}
      <MovieDiscovery
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
        onPlayMovie={handlePlayMovie}
        onAddToPlaylist={handleAddToPlaylist}
        currentMovieId={room.playback?.video?.id}
      />

      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        stats={stats}
        room={room}
      />
    </div>
  );
}

