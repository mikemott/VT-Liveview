/**
 * One river gauge's flood stages, impacts and hydrograph (VTL-81).
 */
import { useQuery } from '@tanstack/react-query';
import { fetchRiverGauge, type RiverGaugeDetail } from '../services/riverApi';

export function useRiverGauge(id: string) {
  return useQuery<RiverGaugeDetail>({
    queryKey: ['river', 'gauge', id],
    queryFn: () => fetchRiverGauge(id),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  });
}
