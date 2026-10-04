export type QueueState = 'waiting' | 'processing' | 'allocated' | 'soldOut' | 'throttled' | 'reconnecting' | 'error';
export type Drop = { id: string; name: string; description: string; date: string; totalSeats: number; availableSeats: number; status: string };
export type ParticipantSession = { userId: string; sessionId: string; attendeeName: string; email: string; queuePosition: number; state: QueueState; lastUpdatedAt: string; booking?: Booking };
export type Booking = { eventName: string; attendeeName: string; seat: string; bookingId: string; date: string; status: 'CONFIRMED' };
export type TrafficPoint = { time: string; successful: number; throttled: number; blocked: number };
export type AdminOverview = { totalSeats: number; allocatedSeats: number; availableSeats: number; queueSize: number; activeUsers: number; requestRate: number; successfulRequests: number; throttledRequests: number; blockedRequests: number; duplicateAttempts: number; integrity: number; traffic: TrafficPoint[] };
export type Scenario = 'Normal Traffic' | 'Request Flood' | 'Repeated Attempts' | 'Bot Burst';
export type SimulationConfig = { scenario: Scenario; clients: number; requests: number; duration: number; intensity: number };
export type SimulationRun = { id: string; config: SimulationConfig; state: 'running' | 'completed'; progress: number; processed: number; blocked: number; throttled: number; duplicates: number; allocations: number; startedAt: string; results?: SimulationComparison };
export type SimulationRow = { metric: string; normal: number; adversarial: number; unit?: string };
export type SimulationComparison = { rows: SimulationRow[] };

export interface FairDropApi {
  getCurrentDrop(): Promise<Drop>;
  joinDrop(input: { name: string; email: string }): Promise<ParticipantSession>;
  getParticipantSession(): Promise<ParticipantSession | null>;
  getQueueStatus(): Promise<ParticipantSession>;
  getBooking(): Promise<Booking | null>;
  getAdminOverview(): Promise<AdminOverview>;
  startSimulation(config: SimulationConfig): Promise<SimulationRun>;
  getSimulation(id: string): Promise<SimulationRun | null>;
  clearParticipantSession(): void;
  simulateQueueState?(state: QueueState): Promise<ParticipantSession | null>;
}
