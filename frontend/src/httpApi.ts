import type { AdminOverview, Booking, Drop, FairDropApi, ParticipantSession, SimulationConfig, SimulationRun } from './domain';

/** Mapping adapter for the currently documented API. Admin simulation methods remain explicit placeholders until those APIs exist. */
const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');
const participantKey = 'fairdrop-http-participant-v1';
type StoredParticipant = { userId: string; sessionId: string; attendeeName: string; email: string };
function getStoredParticipant(): StoredParticipant | null {
  try { const value = localStorage.getItem(participantKey); return value ? JSON.parse(value) as StoredParticipant : null; } catch { return null; }
}
function normalizeQueueState(status: string): ParticipantSession['state'] {
  switch (status.toUpperCase()) {
    case 'ALLOCATED': return 'allocated';
    case 'PROCESSING': return 'processing';
    case 'SOLD_OUT': return 'soldOut';
    case 'THROTTLED': return 'throttled';
    default: return 'waiting';
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

export const httpApi: FairDropApi = {
  async getCurrentDrop() {
    const value = await request<{ id: number; name: string; total_seats: number; available_seats: number; status: string }>('/event');
    return { id: String(value.id), name: value.name, description: '', date: '', totalSeats: value.total_seats, availableSeats: value.available_seats, status: value.status } satisfies Drop;
  },
  async joinDrop(input) {
    const value = await request<{ userId: number; sessionId: string; queuePosition: number; status: string }>('/join', { method: 'POST', body: JSON.stringify(input) });
    const participant = { userId: String(value.userId), sessionId: value.sessionId, attendeeName: input.name, email: input.email };
    localStorage.setItem(participantKey, JSON.stringify(participant));
    return { ...participant, queuePosition: value.queuePosition, state: value.status.toLowerCase() === 'waiting' ? 'waiting' : 'processing', lastUpdatedAt: new Date().toISOString() };
  },
  async getParticipantSession() {
    const participant = getStoredParticipant();
    if (!participant) return null;
    try {
      const queue = await request<{ queuePosition: number; status: string }>(`/queue/${encodeURIComponent(participant.userId)}`);
      const state = normalizeQueueState(queue.status);
      return { ...participant, queuePosition: queue.queuePosition, state, lastUpdatedAt: new Date().toISOString() };
    } catch { return null; }
  },
  async getQueueStatus() {
    const participant = getStoredParticipant();
    if (!participant) throw new Error('No participant reference found. Join the drop to enter the waiting room.');
    const queue = await request<{ queuePosition: number; status: string }>(`/queue/${encodeURIComponent(participant.userId)}`);
    const state = normalizeQueueState(queue.status);
    let booking: Booking | undefined;
    if (state === 'allocated') booking = (await httpApi.getBooking()) ?? undefined;
    return { ...participant, queuePosition: queue.queuePosition, state, lastUpdatedAt: new Date().toISOString(), ...(booking ? { booking } : {}) };
  },
  async getBooking() {
    const participant = getStoredParticipant();
    if (!participant) return null;
    try {
      const value = await request<{ bookingId: number; userId: number; eventName: string; seatNumber: string; bookingStatus: string; createdAt: string }>(`/booking/${encodeURIComponent(participant.userId)}`);
      return { eventName: value.eventName, attendeeName: participant.attendeeName, seat: value.seatNumber, bookingId: String(value.bookingId), date: value.createdAt, status: 'CONFIRMED' };
    } catch { return null; }
  },
  async getAdminOverview() {
    const stats = await request<{ totalUsers: number; queueSize: number; totalSeats: number; allocatedSeats: number; availableSeats: number; totalBookings: number }>('/core-statistics');
    return { totalSeats: stats.totalSeats, allocatedSeats: stats.allocatedSeats, availableSeats: stats.availableSeats, queueSize: stats.queueSize, activeUsers: Number.NaN, requestRate: Number.NaN, successfulRequests: Number.NaN, throttledRequests: Number.NaN, blockedRequests: Number.NaN, duplicateAttempts: Number.NaN, integrity: Number.NaN, traffic: [] } satisfies AdminOverview;
  },
  async startSimulation(_config: SimulationConfig) { throw new Error('Simulation endpoints are not implemented by the current backend. Switch to demo mode to run a local simulation.'); },
  async getSimulation(_id: string): Promise<SimulationRun | null> { return null; },
  clearParticipantSession() { localStorage.removeItem(participantKey); }
};
