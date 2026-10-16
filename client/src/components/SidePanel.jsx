import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  ListMusic, 
  Vote, 
  Users, 
  Send, 
  Crown, 
  Trash2, 
  Play, 
  Plus, 
  CheckCircle2, 
  BarChart3,
  UserCheck
} from 'lucide-react';
import { socket } from '../socket';

export default function SidePanel({
  room,
  currentUser,
  onSendMessage,
  onPlayMovie,
  onRemovePlaylistItem,
  onTransferHost
}) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'playlist' | 'polls' | 'users'
  const [chatInput, setChatInput] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showPollCreator, setShowPollCreator] = useState(false);

  const chatBottomRef = useRef(null);

  // Auto-scroll chat to latest
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room.chat, activeTab]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleCreatePoll = (e) => {
    e.preventDefault();
    const validOptions = pollOptions.filter(o => o.trim().length > 0);
    if (!pollQuestion.trim() || validOptions.length < 2) return;

    socket.emit('poll:create', {
      question: pollQuestion.trim(),
      options: validOptions
    });

    setShowPollCreator(false);
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  const handleVote = (optionId) => {
    socket.emit('poll:vote', { optionId });
  };

  const isHost = currentUser?.isHost;
  const activePoll = room.poll;
  const totalVotes = activePoll?.options.reduce((sum, opt) => sum + opt.votes.length, 0) || 0;

  return (
    <aside className="w-full lg:w-96 bg-dark-850 border border-dark-700 rounded-2xl flex flex-col h-[600px] lg:h-auto overflow-hidden shadow-xl">
      {/* Tab Navigation */}
      <div className="flex border-b border-dark-700 bg-dark-900/60 p-1 gap-1">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'chat'
              ? 'bg-dark-800 text-white shadow-sm border border-dark-600/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
          {room.chat?.length > 1 && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.2 rounded-full font-mono">
              {room.chat.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('playlist')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'playlist'
              ? 'bg-dark-800 text-white shadow-sm border border-dark-600/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListMusic className="w-3.5 h-3.5" />
          <span>Queue</span>
          {room.playlist?.length > 0 && (
            <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 py-0.2 rounded-full font-mono">
              {room.playlist.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('polls')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'polls'
              ? 'bg-dark-800 text-white shadow-sm border border-dark-600/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Vote className="w-3.5 h-3.5" />
          <span>Polls</span>
          {activePoll?.active && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'users'
              ? 'bg-dark-800 text-white shadow-sm border border-dark-600/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Peers</span>
          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded-full font-mono">
            {room.users?.length || 1}
          </span>
        </button>
      </div>

      {/* Tab 1: Live Chat */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {room.chat?.map((msg) => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="text-center my-2">
                    <span className="inline-block px-3 py-1 rounded-full bg-dark-800 border border-dark-700 text-[11px] text-slate-400">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.userId === currentUser?.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs select-none">{msg.avatar}</span>
                    <span className="text-[11px] font-semibold text-slate-300">
                      {msg.username}
                    </span>
                    {msg.isHost && (
                      <Crown className="w-3 h-3 text-amber-400 inline" title="Host" />
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-dark-800 border border-dark-700 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-dark-700 bg-dark-900/60 flex items-center gap-2">
            <input
              type="text"
              placeholder="Type message to room..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl shadow-md transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Shared Playlist */}
      {activeTab === 'playlist' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Upcoming Queue ({room.playlist?.length || 0})
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {room.playlist?.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-dark-800 border border-dark-700/80 hover:border-dark-600 transition group"
              >
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-12 h-12 rounded-lg object-cover bg-black"
                />
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-white truncate">{item.title}</h5>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{item.duration} • {item.category}</p>
                </div>
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                  <button
                    onClick={() => onPlayMovie(item)}
                    title="Play now"
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                  </button>
                  <button
                    onClick={() => onRemovePlaylistItem(idx)}
                    title="Remove from queue"
                    className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {(!room.playlist || room.playlist.length === 0) && (
              <div className="text-center py-12 text-slate-500 text-xs">
                Queue is empty. Use Movie Discovery to add trailers & movies!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Interactive Group Polls */}
      {activeTab === 'polls' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Group Decisions
              </span>
              {!showPollCreator && (
                <button
                  onClick={() => setShowPollCreator(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Poll</span>
                </button>
              )}
            </div>

            {/* Poll Creator Form */}
            {showPollCreator && (
              <form onSubmit={handleCreatePoll} className="mb-4 p-3.5 rounded-xl bg-dark-800 border border-indigo-500/40 space-y-2.5">
                <span className="text-xs font-bold text-white block">Create Watch Party Poll</span>
                <input
                  type="text"
                  placeholder="e.g. Which movie to play next?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-dark-900 border border-dark-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                {pollOptions.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const updated = [...pollOptions];
                      updated[i] = e.target.value;
                      setPollOptions(updated);
                    }}
                    className="w-full px-2.5 py-1.5 bg-dark-900 border border-dark-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                ))}
                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    + Add option
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPollCreator(false)}
                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                    >
                      Launch Poll
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Active Poll Display */}
            {activePoll && (
              <div className="p-4 rounded-xl bg-dark-800 border border-dark-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-white text-xs leading-snug">{activePoll.question}</h5>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activePoll.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}`}>
                    {activePoll.active ? 'ACTIVE' : 'CLOSED'}
                  </span>
                </div>

                <div className="space-y-2">
                  {activePoll.options.map((option) => {
                    const count = option.votes.length;
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const hasVoted = option.votes.includes(currentUser?.id);

                    return (
                      <button
                        key={option.id}
                        disabled={!activePoll.active}
                        onClick={() => handleVote(option.id)}
                        className={`w-full text-left p-2.5 rounded-lg border relative overflow-hidden transition group ${
                          hasVoted
                            ? 'border-indigo-500 bg-indigo-950/40 text-white'
                            : 'border-dark-700 bg-dark-900/50 hover:border-dark-600 text-slate-300'
                        }`}
                      >
                        {/* Progress Bar Fill */}
                        <div
                          style={{ width: `${percent}%` }}
                          className="absolute inset-y-0 left-0 bg-indigo-600/20 transition-all duration-500 pointer-events-none"
                        />
                        <div className="relative z-10 flex items-center justify-between text-xs">
                          <span className="font-medium flex items-center gap-1.5">
                            {hasVoted && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 inline" />}
                            {option.text}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {percent}% ({count})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] text-slate-500 flex justify-between items-center pt-1 border-t border-dark-700/60 font-mono">
                  <span>Total votes: {totalVotes}</span>
                  {activePoll.active && isHost && (
                    <button
                      onClick={() => socket.emit('poll:close')}
                      className="text-rose-400 hover:text-rose-300 text-[11px]"
                    >
                      End Poll
                    </button>
                  )}
                </div>
              </div>
            )}

            {!activePoll && !showPollCreator && (
              <div className="text-center py-12 text-slate-500 text-xs">
                No active poll. Launch a poll to decide together what to watch next!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Room Participants & Host Transfer */}
      {activeTab === 'users' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Connected Participants ({room.users?.length || 1})
            </span>
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Live Sync
            </span>
          </div>

          <div className="space-y-2">
            {room.users?.map((user) => {
              const isUserHost = user.isHost || user.id === room.hostId;
              const isMe = user.id === currentUser?.id;

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-dark-800 border border-dark-700/80"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg select-none">{user.avatar || '🍿'}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">
                          {user.username} {isMe && '(You)'}
                        </span>
                        {isUserHost && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5" /> HOST
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Connected: {new Date(user.joinedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Host Transfer Action */}
                  {isHost && !isMe && !isUserHost && (
                    <button
                      onClick={() => onTransferHost(user.id)}
                      className="px-2 py-1 bg-dark-700 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 rounded-lg text-[10px] font-semibold border border-dark-600 transition flex items-center gap-1"
                      title="Make this user the Room Host"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Make Host</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

