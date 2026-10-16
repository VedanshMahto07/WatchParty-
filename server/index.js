import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 5000,
  pingTimeout: 7000
});

// Initial curated movie catalog for instant discovery & recommendation with verified 200 OK video streams
const CATALOG = [
  {
    id: 'movie-1',
    title: 'Oceans: Wild Nature HD',
    genre: 'Documentary / Nature',
    category: 'Documentary',
    year: 2021,
    duration: '46s',
    rating: '8.9',
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    poster: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80',
    description: 'Spectacular underwater cinematography exploring ocean wildlife, coral reefs, and sea creatures.'
  },
  {
    id: 'movie-2',
    title: 'Big Buck Bunny (Trailer)',
    genre: 'Animation / Comedy',
    category: 'Animation',
    year: 2008,
    duration: '33s',
    rating: '8.4',
    url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    description: 'A large, lovable rabbit deals with bullying forest creatures in this iconic open-source masterpiece.'
  },
  {
    id: 'movie-3',
    title: 'Sintel: The Dragon Hunter',
    genre: 'Fantasy / Adventure',
    category: 'Fantasy',
    year: 2010,
    duration: '52s',
    rating: '8.8',
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    description: 'A lonely young woman finds a baby dragon, but when it is kidnapped, she embarks on a dangerous journey.'
  },
  {
    id: 'movie-4',
    title: 'View From A Blue Moon',
    genre: 'Action / Surfing',
    category: 'Action',
    year: 2023,
    duration: '3m 15s',
    rating: '8.7',
    url: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-576p.mp4',
    poster: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600&auto=format&fit=crop&q=80',
    description: 'Breathtaking surf cinematography shot in 4K across the most exotic oceans on Earth.'
  },
  {
    id: 'movie-5',
    title: 'Blooming Botanicals',
    genre: 'Macro / Nature',
    category: 'Documentary',
    year: 2024,
    duration: '10s',
    rating: '7.9',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    poster: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop&q=80',
    description: 'High-speed timelapse of vibrant spring flowers blooming in ultra-detail.'
  }
];

// Room state store in memory
// Map<roomId, RoomState>
const rooms = new Map();

// Global latency tracking metrics for p95 calculations
const latencySamples = [];
const MAX_SAMPLES = 500;

function recordLatency(latencyMs) {
  if (typeof latencyMs === 'number' && latencyMs >= 0) {
    latencySamples.push(latencyMs);
    if (latencySamples.length > MAX_SAMPLES) {
      latencySamples.shift();
    }
  }
}

function calculateP95() {
  if (latencySamples.length === 0) return 0;
  const sorted = [...latencySamples].sort((a, b) => a - b);
  const p95Index = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * 0.95)
  );
  return Math.round(sorted[p95Index] * 10) / 10;
}

function getEffectiveCurrentTime(room) {
  if (!room.playback.isPlaying) {
    return room.playback.currentTime;
  }
  const elapsedSec = (Date.now() - room.playback.lastUpdatedAt) / 1000;
  return room.playback.currentTime + elapsedSec * room.playback.playbackRate;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    activeRooms: rooms.size,
    totalConnections: io.engine.clientsCount,
    p95LatencyMs: calculateP95(),
    timestamp: Date.now()
  });
});

app.get('/api/movies', (req, res) => {
  const { query, category } = req.query;
  let results = [...CATALOG];

  if (category && category !== 'All') {
    results = results.filter(m => m.category.toLowerCase() === category.toLowerCase());
  }

  if (query) {
    const q = query.toLowerCase().trim();
    results = results.filter(m => 
      m.title.toLowerCase().includes(q) ||
      m.genre.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
    );
  }

  res.json(results);
});

// Socket.IO Real-time Connection Handler
io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUser = null;

  // 1. NTP-style Clock Synchronization
  // Calculates client-server clock offset and RTT
  socket.on('sync:ping', (data) => {
    socket.emit('sync:pong', {
      clientSentAt: data.clientSentAt,
      serverRecvAt: Date.now(),
      serverSentAt: Date.now()
    });
  });

  // Client acknowledging event received to measure true propagation latency
  socket.on('metric:ack', ({ actionId, clientSentAt, serverSentAt }) => {
    const propagationMs = Date.now() - serverSentAt;
    recordLatency(propagationMs);
  });

  // 2. Create Room
  socket.on('room:create', ({ username, avatar }, callback) => {
    let roomId = generateRoomCode();
    while (rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const defaultMovie = CATALOG[0];

    const newRoom = {
      id: roomId,
      hostId: socket.id,
      createdAt: Date.now(),
      users: new Map(),
      playback: {
        video: defaultMovie,
        isPlaying: false,
        currentTime: 0,
        lastUpdatedAt: Date.now(),
        playbackRate: 1
      },
      playlist: [CATALOG[0], CATALOG[1], CATALOG[2]],
      chat: [
        {
          id: `msg-${Date.now()}`,
          userId: 'system',
          username: 'Cinema Host',
          text: `Welcome to Room #${roomId}! Invite friends to watch together in real time.`,
          timestamp: Date.now(),
          isSystem: true
        }
      ],
      poll: null
    };

    currentUser = {
      id: socket.id,
      username: username || 'Party Host',
      avatar: avatar || '🍿',
      isHost: true,
      joinedAt: Date.now()
    };

    newRoom.users.set(socket.id, currentUser);
    rooms.set(roomId, newRoom);
    currentRoomId = roomId;

    socket.join(roomId);

    const roomSnapshot = serializeRoom(newRoom);
    callback({ success: true, room: roomSnapshot, user: currentUser });
  });

  // 3. Join Room
  socket.on('room:join', ({ roomId, username, avatar }, callback) => {
    const formattedId = (roomId || '').trim().toUpperCase();
    const room = rooms.get(formattedId);

    if (!room) {
      return callback({ success: false, error: 'Room not found. Check the code or create a new room.' });
    }

    currentUser = {
      id: socket.id,
      username: username || `Viewer-${Math.floor(Math.random() * 900 + 100)}`,
      avatar: avatar || '🎬',
      isHost: room.users.size === 0 || room.hostId === socket.id,
      joinedAt: Date.now()
    };

    room.users.set(socket.id, currentUser);
    currentRoomId = formattedId;
    socket.join(formattedId);

    // Announce late joiner to chat
    const joinMsg = {
      id: `msg-${Date.now()}`,
      userId: 'system',
      username: 'System',
      text: `${currentUser.username} hopped into the watch party! 🎉`,
      timestamp: Date.now(),
      isSystem: true
    };
    room.chat.push(joinMsg);

    // Notify other peers
    socket.to(formattedId).emit('room:user_joined', {
      user: currentUser,
      chatMsg: joinMsg,
      totalUsers: room.users.size
    });

    const roomSnapshot = serializeRoom(room);
    callback({ success: true, room: roomSnapshot, user: currentUser });
  });

  // 4. Synchronized Playback Actions (Play / Pause / Seek / Speed)
  socket.on('playback:action', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const { type, currentTime, playbackRate, video } = data;
    const now = Date.now();

    if (type === 'play') {
      room.playback.isPlaying = true;
      room.playback.currentTime = currentTime;
      room.playback.lastUpdatedAt = now;
    } else if (type === 'pause') {
      room.playback.isPlaying = false;
      room.playback.currentTime = currentTime;
      room.playback.lastUpdatedAt = now;
    } else if (type === 'seek') {
      room.playback.currentTime = currentTime;
      room.playback.lastUpdatedAt = now;
    } else if (type === 'rate') {
      room.playback.playbackRate = playbackRate || 1;
      room.playback.currentTime = currentTime;
      room.playback.lastUpdatedAt = now;
    } else if (type === 'change_video') {
      room.playback.video = video;
      room.playback.currentTime = 0;
      room.playback.isPlaying = true;
      room.playback.lastUpdatedAt = now;
    }

    const payload = {
      actionId: `act-${now}-${Math.random()}`,
      type,
      currentTime: room.playback.currentTime,
      isPlaying: room.playback.isPlaying,
      playbackRate: room.playback.playbackRate,
      video: room.playback.video,
      serverSentAt: now,
      senderId: socket.id,
      senderName: currentUser ? currentUser.username : 'Participant'
    };

    // Broadcast immediately to everyone in room including sender confirmation
    io.to(currentRoomId).emit('playback:sync', payload);
  });

  // 5. Late Join / Reconnection Catchup Sync Request
  socket.on('playback:request_sync', (callback) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    callback({
      currentTime: getEffectiveCurrentTime(room),
      isPlaying: room.playback.isPlaying,
      playbackRate: room.playback.playbackRate,
      video: room.playback.video,
      serverSentAt: Date.now()
    });
  });

  // 6. Live Chat Messages
  socket.on('chat:send', ({ text }) => {
    if (!currentRoomId || !text || !text.trim()) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: socket.id,
      username: currentUser ? currentUser.username : 'Viewer',
      avatar: currentUser ? currentUser.avatar : '🍿',
      isHost: room.hostId === socket.id,
      text: text.trim(),
      timestamp: Date.now()
    };

    room.chat.push(message);
    if (room.chat.length > 200) room.chat.shift();

    io.to(currentRoomId).emit('chat:new_message', message);
  });

  // 7. Interactive Floating Emoji Reactions Burst
  socket.on('reaction:send', ({ emoji }) => {
    if (!currentRoomId) return;
    io.to(currentRoomId).emit('reaction:burst', {
      id: `rx-${Date.now()}-${Math.random()}`,
      emoji: emoji || '❤️',
      username: currentUser ? currentUser.username : 'Viewer',
      serverSentAt: Date.now()
    });
  });

  // 8. Shared Playlist Queue Operations
  socket.on('playlist:add', (movie) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.playlist.push(movie);
    io.to(currentRoomId).emit('playlist:updated', room.playlist);
  });

  socket.on('playlist:remove', (index) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (index >= 0 && index < room.playlist.length) {
      room.playlist.splice(index, 1);
      io.to(currentRoomId).emit('playlist:updated', room.playlist);
    }
  });

  socket.on('playlist:play_now', (movie) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.playback.video = movie;
    room.playback.currentTime = 0;
    room.playback.isPlaying = true;
    room.playback.lastUpdatedAt = Date.now();

    io.to(currentRoomId).emit('playback:sync', {
      type: 'change_video',
      video: movie,
      currentTime: 0,
      isPlaying: true,
      playbackRate: 1,
      serverSentAt: Date.now(),
      senderName: currentUser ? currentUser.username : 'Host'
    });
  });

  // 9. Interactive Group Polls
  socket.on('poll:create', ({ question, options }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const poll = {
      id: `poll-${Date.now()}`,
      question,
      options: (options || []).map((opt, idx) => ({
        id: idx,
        text: opt,
        votes: [] // user socket IDs
      })),
      createdBy: currentUser ? currentUser.username : 'Host',
      createdAt: Date.now(),
      active: true
    };

    room.poll = poll;
    io.to(currentRoomId).emit('poll:updated', poll);
  });

  socket.on('poll:vote', ({ optionId }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.poll || !room.poll.active) return;

    // Remove any previous vote from this user
    room.poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(uid => uid !== socket.id);
    });

    // Add current vote
    const target = room.poll.options.find(opt => opt.id === optionId);
    if (target) {
      target.votes.push(socket.id);
    }

    io.to(currentRoomId).emit('poll:updated', room.poll);
  });

  socket.on('poll:close', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.poll) return;

    room.poll.active = false;
    io.to(currentRoomId).emit('poll:updated', room.poll);
  });

  // 10. Transfer Host Role
  socket.on('room:transfer_host', ({ newHostId }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostId !== socket.id) return;

    if (room.users.has(newHostId)) {
      room.hostId = newHostId;
      for (const [id, user] of room.users.entries()) {
        user.isHost = (id === newHostId);
      }
      io.to(currentRoomId).emit('room:host_transferred', {
        newHostId,
        users: Array.from(room.users.values())
      });
    }
  });

  // 11. Disconnect and Host Re-election
  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const wasHost = room.hostId === socket.id;
    const departedUser = room.users.get(socket.id);
    room.users.delete(socket.id);

    if (room.users.size === 0) {
      // Room empty - cleanup after grace period
      setTimeout(() => {
        if (rooms.has(currentRoomId) && rooms.get(currentRoomId).users.size === 0) {
          rooms.delete(currentRoomId);
        }
      }, 60000);
      return;
    }

    // Auto promote next user if host left
    if (wasHost && room.users.size > 0) {
      const nextHostId = room.users.keys().next().value;
      room.hostId = nextHostId;
      const newHost = room.users.get(nextHostId);
      if (newHost) newHost.isHost = true;

      io.to(currentRoomId).emit('room:host_transferred', {
        newHostId,
        users: Array.from(room.users.values()),
        message: `${newHost.username} is now the watch party host.`
      });
    }

    const leaveMsg = {
      id: `msg-${Date.now()}`,
      userId: 'system',
      username: 'System',
      text: `${departedUser ? departedUser.username : 'A viewer'} left the room.`,
      timestamp: Date.now(),
      isSystem: true
    };
    room.chat.push(leaveMsg);

    io.to(currentRoomId).emit('room:user_left', {
      userId: socket.id,
      users: Array.from(room.users.values()),
      chatMsg: leaveMsg
    });
  });
});

function serializeRoom(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    users: Array.from(room.users.values()),
    playback: {
      ...room.playback,
      effectiveCurrentTime: getEffectiveCurrentTime(room)
    },
    playlist: room.playlist,
    chat: room.chat,
    poll: room.poll
  };
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🎬 WatchParty Synchronization Server running on http://localhost:${PORT}`);
  console.log(`⏱️ NTP Clock Sync & Low-Latency Engine active`);
});

