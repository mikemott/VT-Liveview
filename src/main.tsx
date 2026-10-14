import { createRoot } from 'react-dom/client'
import './styles/design-system.css' // Must be first - provides CSS variables
import './index.css'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <App />
)
