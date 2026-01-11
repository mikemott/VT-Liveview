import { Sun, Moon } from 'lucide-react';
import './ThemeToggle.css';

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      className={`theme-toggle ${isDark ? 'dark' : ''}`}
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
