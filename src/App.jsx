import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WeatherMap from './WeatherMap'
import './App.css'

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
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <WeatherMap />
      </div>
    </QueryClientProvider>
  )
}

export default App
