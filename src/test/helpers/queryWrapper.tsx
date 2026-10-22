/**
 * React Query test wrapper: a fresh QueryClient per call with retries disabled.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export function createQueryWrapper(): {
  client: QueryClient;
  wrapper: ({ children }: { children: ReactNode }) => ReactNode;
} {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
