import { createRoot } from 'react-dom/client';
import './styles/design-system.css'; // Must be first - provides CSS variables
import './index.css';
import App from './App';
import { queryToHash } from './utils/sharePreview';

// A shared link carries the view in its query string (for link previews,
// VTL-70); the app reads it from the hash, so move it there before the map starts
const sharedHash = queryToHash(window.location.search, window.location.hash);
if (sharedHash) window.history.replaceState(null, '', `${window.location.pathname}${sharedHash}`);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(<App />);
