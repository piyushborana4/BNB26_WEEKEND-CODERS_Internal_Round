import type { AdminOverview, Booking, Drop, FairDropApi, ParticipantSession, QueueState, SimulationRun, TrafficPoint } from './domain';

const SESSION_KEY = 'fairdrop-demo-session-v1';
const SIM_KEY = 'fairdrop-demo-simulation-v1';
const now = () => new Date().toISOString();
const wait = (ms = 360) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const drop: Drop = {
  id: 'techfest-2026', name: 'TechFest 2026',
  description: 'A day for the builders, thinkers, and people shaping what comes next.',
  date: 'Saturday, November 14 · 10:00 AM', totalSeats: 50000, availableSeats: 32481, status: 'Registration open'
};

const traffic: TrafficPoint[] = Array.from({ length: 18 }, (_, i) => {
  const wave = Math.sin(i * 0.74) * 0.16 + Math.sin(i * 0.25) * 0.1;
  return { time: `${String(9 + Math.floor(i / 3)).padStart(2, '0')}:${String((i * 20) % 60).padStart(2, '0')}`, successful: 62 + wave * 100 + (i % 4) * 3, throttled: 12 + Math.max(0, wave) * 90 + (i % 3), blocked: 4 + Math.max(0, Math.sin(i * 1.2)) * 24 };
});

const overview: AdminOverview = {
  totalSeats: 50000, allocatedSeats: 31284, availableSeats: 18716, queueSize: 42891,
  activeUsers: 38421, requestRate: 24821, successfulRequests: 92481, throttledRequests: 12840,
  blockedRequests: 4218, duplicateAttempts: 4821, integrity: 99.98, traffic
};

function readSession(): ParticipantSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as ParticipantSession : null;
  } catch { return null; }
}

function writeSession(session: ParticipantSession) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

function makeBooking(session: ParticipantSession): Booking {
  return { eventName: drop.name, attendeeName: session.attendeeName, seat: 'A-4821', bookingId: 'FD-8A92X1', date: drop.date, status: 'CONFIRMED' };
}

function nextState(session: ParticipantSession): ParticipantSession {
  const tick = Number.parseInt(session.sessionId.slice(-2), 16) + Math.floor(Date.now() / 5000);
  let state: QueueState = session.state;
  let position = session.queuePosition;
  if (state === 'waiting') {
    position = Math.max(0, position - (7 + (tick % 16)));
    if (position < 2100 && tick % 9 === 0) state = 'processing';
  } else if (state === 'processing' && tick % 3 === 0) {
    state = 'allocated';
  }
  const updated = { ...session, queuePosition: position, state, lastUpdatedAt: now() };
  if (state === 'allocated') updated.booking = makeBooking(updated);
  return updated;
}

export const mockApi: FairDropApi = {
  async getCurrentDrop() { await wait(220); return { ...drop }; },
  async joinDrop({ name, email }) {
    await wait(760);
    const existing = readSession();
    if (existing && existing.email.toLowerCase() === email.trim().toLowerCase()) return existing;
    const session: ParticipantSession = {
      userId: `FD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      sessionId: Math.random().toString(16).slice(2, 10), attendeeName: name.trim(), email: email.trim(),
      queuePosition: 8427, state: 'waiting', lastUpdatedAt: now()
    };
    writeSession(session);
    return session;
  },
  async getParticipantSession() { await wait(120); return readSession(); },
  async getQueueStatus() {
    await wait(240);
    const session = readSession();
    if (!session) throw new Error('No participant session found. Join the drop to enter the waiting room.');
    if (session.state === 'waiting' || session.state === 'processing') {
      const updated = nextState(session);
      writeSession(updated);
      return updated;
    }
    return session;
  },
  async getBooking() { await wait(180); return readSession()?.booking ?? null; },
  async getAdminOverview() { await wait(260); return { ...overview, traffic: [...traffic] }; },
  async startSimulation(config) {
    await wait(400);
    const run: SimulationRun = { id: `SIM-${Date.now().toString(36).toUpperCase()}`, config, state: 'running', progress: 0, processed: 0, blocked: 0, throttled: 0, duplicates: 0, allocations: 0, startedAt: now() };
    localStorage.setItem(SIM_KEY, JSON.stringify(run));
    return run;
  },
  async getSimulation(id) {
    await wait(90);
    const raw = localStorage.getItem(SIM_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw) as SimulationRun;
    if (old.id !== id) return null;
    if (old.state === 'completed') return old;
    const progress = Math.min(100, old.progress + 13 + (old.config.intensity % 7));
    const processed = Math.min(old.config.requests, Math.round(old.config.requests * progress / 100));
    const pressure = old.config.scenario === 'Normal Traffic' ? 0.015 : old.config.scenario === 'Repeated Attempts' ? 0.62 : old.config.scenario === 'Request Flood' ? 0.78 : 0.88;
    const run: SimulationRun = {
      ...old, progress, processed, blocked: Math.round(processed * pressure * 0.54),
      throttled: Math.round(processed * pressure * 0.36), duplicates: Math.round(processed * (old.config.scenario === 'Repeated Attempts' ? 0.25 : 0.04)),
      allocations: Math.round(processed * (1 - pressure) * 0.42),
      state: progress >= 100 ? 'completed' : 'running'
    };
    if (run.state === 'completed') run.results = { rows: [
      { metric: 'Requests', normal: 10000, adversarial: old.config.requests },
      { metric: 'Accepted', normal: 9840, adversarial: Math.round(processed * (1 - pressure)), unit: 'req' },
      { metric: 'Throttled', normal: 120, adversarial: run.throttled, unit: 'req' },
      { metric: 'Blocked', normal: 40, adversarial: run.blocked, unit: 'req' },
      { metric: 'Duplicates', normal: 18, adversarial: run.duplicates, unit: 'attempts' },
      { metric: 'Allocations', normal: 9680, adversarial: run.allocations, unit: 'seats' }
    ] };
    localStorage.setItem(SIM_KEY, JSON.stringify(run));
    return run;
  },
  clearParticipantSession() { localStorage.removeItem(SESSION_KEY); },
  async simulateQueueState(state) {
    const session = readSession();
    if (!session) return null;
    const updated: ParticipantSession = { ...session, state, lastUpdatedAt: now() };
    if (state === 'allocated') updated.booking = makeBooking(updated);
    writeSession(updated);
    return updated;
  }
};
