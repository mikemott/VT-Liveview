export interface LakeTemperature {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  temperatureFahrenheit: number | null;
  comfortLevel: 'cold' | 'comfortable' | 'warm' | 'unknown';
  timestamp: string;
  usgsGaugeId: string | null;
  description: string | null;
}
