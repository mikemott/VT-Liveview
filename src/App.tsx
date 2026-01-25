import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WeatherMap from './WeatherMap'
import ErrorBoundary from './components/ErrorBoundary'
import ToastContainer from './components/ToastContainer'
import { getEnv } from './types'
import './App.css'

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
      refetchOnWindowFocus: false
    }
  }
})

function App(): React.ReactNode {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="App">
          <WeatherMap />
          <ToastContainer />
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
