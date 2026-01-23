import { createRoot } from 'react-dom/client'
import './styles/design-system.css' // Must be first - provides CSS variables
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <App />
)
