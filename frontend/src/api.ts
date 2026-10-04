import type { FairDropApi } from './domain';
import { httpApi } from './httpApi';
import { mockApi } from './mockApi';

const mode = import.meta.env.VITE_FAIR_DROP_MODE ?? 'mock';
export const api: FairDropApi = mode === 'http' ? httpApi : mockApi;
export const isDemoMode = mode !== 'http';
