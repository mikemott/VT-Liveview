/**
 * Public EV charging stations (DOE AFDC) via the backend (VTL-81).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface EvCharger {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
  network: string | null;
  networkUrl: string | null;
  dcFastPorts: number;
  level2Ports: number;
  /** Highest rated power across the station's ports, when reported */
  maxKw: number | null;
  /** e.g. ["CCS", "NACS (Tesla)"] */
  connectors: string[];
  hours: string | null;
  pricing: string | null;
  facility: string | null;
  /** YYYY-MM-DD */
  lastConfirmed: string | null;
}

export async function fetchEvChargers(): Promise<EvCharger[]> {
  const res = await fetch(`${BACKEND_URL}/api/ev-chargers`);
  if (!res.ok) throw new Error(`EV chargers unavailable (HTTP ${res.status})`);
  const body = (await res.json()) as { stations?: EvCharger[] };
  return body.stations ?? [];
}
