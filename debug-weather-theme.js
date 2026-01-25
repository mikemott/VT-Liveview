// Debug Weather Theme
// Copy and paste this into your browser console at http://localhost:5173

console.log('=== WEATHER THEME DEBUG ===');
console.log('');

// 1. Check HTML classes
console.log('1. HTML element classes:', document.documentElement.className);
console.log('');

// 2. Check CSS variables
const root = document.documentElement;
const accentColor = getComputedStyle(root).getPropertyValue('--color-accent-primary');
const bgGlass = getComputedStyle(root).getPropertyValue('--color-bg-glass');
const shadow = getComputedStyle(root).getPropertyValue('--shadow-xl');

console.log('2. Current CSS Variables:');
console.log('   --color-accent-primary:', accentColor);
console.log('   --color-bg-glass:', bgGlass);
console.log('   --shadow-xl:', shadow);
console.log('');

// 3. Check for weather theme classes
const hasWeatherClass = document.documentElement.classList.toString().includes('weather-');
console.log('3. Has weather theme class?', hasWeatherClass);
if (hasWeatherClass) {
  const weatherClass = Array.from(document.documentElement.classList).find(c => c.startsWith('weather-'));
  console.log('   Active weather theme:', weatherClass);
}
console.log('');

// 4. Check dark mode
const isDark = document.documentElement.classList.contains('dark');
console.log('4. Dark mode active?', isDark);
console.log('   (Weather themes only work in LIGHT mode)');
console.log('');

// 5. Expected colors for each theme
console.log('5. Expected accent colors by theme:');
console.log('   Sunny:  #FDB813 (golden yellow)');
console.log('   Rainy:  #4A90E2 (steel blue)');
console.log('   Snowy:  #64B5F6 (ice blue)');
console.log('   Severe: #EF5350 (alert red)');
console.log('   Default: #15803d (vermont green)');
console.log('');

console.log('=== END DEBUG ===');
