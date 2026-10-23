import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WeatherMap from './WeatherMap';
import ErrorBoundary from './components/ErrorBoundary';
import MapUnavailable from './components/MapUnavailable';
import { isWebGLSupported } from './utils/webgl';
import { getEnv } from './types';
import './App.css';

// Validate environment variables on startup using Zod schema.
// In production, this throws if required variables are missing,
// which will be caught by the ErrorBoundary.
// In development, it logs errors but continues with defaults.
getEnv();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App(): React.ReactNode {
  // null = map can render; string = why it can't (no WebGL, or map construction failed)
  const [mapUnavailableReason, setMapUnavailableReason] = useState<string | null>(() =>
    isWebGLSupported() ? null : 'WebGL is not available in this browser',
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="App">
          {mapUnavailableReason ? (
            <MapUnavailable reason={mapUnavailableReason} />
          ) : (
            <WeatherMap onMapUnavailable={setMapUnavailableReason} />
          )}
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
