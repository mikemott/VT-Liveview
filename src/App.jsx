import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WeatherMap from './WeatherMap'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

// Validate required environment variables
const requiredEnvVars = {
  VITE_PROTOMAPS_API_KEY: import.meta.env.VITE_PROTOMAPS_API_KEY
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0 && import.meta.env.PROD) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  // In production, you might want to show an error page instead
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false
    }
  }
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="App">
          <WeatherMap />
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
