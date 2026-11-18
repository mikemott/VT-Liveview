/**
 * Checked ski resort cameras (VTL-88). The backend re-checks every 30 minutes.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchSkiWebcams, type SkiWebcams } from '../services/skiWebcamsApi';

export function useSkiWebcams() {
  return useQuery<SkiWebcams>({
    queryKey: ['ski', 'webcams'],
    queryFn: fetchSkiWebcams,
    staleTime: 30 * 60 * 1000,
    refetchInterval: false,
    retry: 1,
  });
}
