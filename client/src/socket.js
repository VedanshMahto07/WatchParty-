import { io } from 'socket.io-client';

// Connect via current origin (handled by Vite proxy) or fallback to host:4000
const isBrowser = typeof window !== 'undefined';
const host = isBrowser ? window.location.hostname : 'localhost';
const isDev = isBrowser && (window.location.port === '3000' || window.location.port === '3001');

// In dev, Vite proxies /socket.io directly to port 4000
export const socket = io(isDev ? undefined : `http://${host}:4000`, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});

// Accurate Clock Offset & Latency Synchronization
export const clockState = {
  offsetMs: 0,
  rttMs: 0,
  p95LatencyMs: 0,
  history: [],
  driftHistory: []
};

// NTP time sync loop every 3 seconds
export function startTimeSync() {
  const syncInterval = setInterval(() => {
    if (!socket.connected) return;
    const clientSentAt = Date.now();
    socket.emit('sync:ping', { clientSentAt });
  }, 3000);

  socket.on('sync:pong', ({ clientSentAt, serverSentAt }) => {
    const clientRecvAt = Date.now();
    const rtt = clientRecvAt - clientSentAt;
    // Server time estimate at the moment of clientRecvAt
    const estimatedServerTime = serverSentAt + (rtt / 2);
    const offset = estimatedServerTime - clientRecvAt;

    // Smooth offset calculation with moving average
    clockState.rttMs = Math.round(rtt);
    clockState.offsetMs = Math.round(clockState.offsetMs * 0.7 + offset * 0.3);

    clockState.history.push(rtt);
    if (clockState.history.length > 50) clockState.history.shift();

    // calculate p95
    const sorted = [...clockState.history].sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    clockState.p95LatencyMs = sorted[p95Idx] || rtt;
  });

  return () => clearInterval(syncInterval);
}

// Convert local client timestamp to synchronized server timestamp
export function getSynchronizedTime() {
  return Date.now() + clockState.offsetMs;
}
