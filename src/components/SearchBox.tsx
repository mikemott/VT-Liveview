import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, TriangleAlert, type LucideIcon } from 'lucide-react';
import { LAYER_STYLES, layerColorVars, type LayerStyleKey } from '../config/layers';
import { searchPlaces, type SearchItem, type SearchKind } from '../utils/search';
import './SearchBox.css';

/** Kinds that belong to a map layer take its icon and color (VTL-64). */
const KIND_LAYER: Partial<Record<SearchKind, LayerStyleKey>> = {
  ski: 'skiResorts',
  beach: 'beachSites',
  creemee: 'creemeeStands',
  campground: 'campingSites',
  station: 'weatherStations',
  camera: 'trafficCameras',
  road: 'seasonalRoads',
  roadWeather: 'roadWeather',
  airQuality: 'airQuality',
  river: 'riverGauges',
};

/** The result's map layer: its own (incident type) or the one its kind implies */
function resultLayer(item: SearchItem): LayerStyleKey | undefined {
  return item.layer ?? KIND_LAYER[item.kind];
}

function resultIcon(item: SearchItem): LucideIcon {
  const layer = resultLayer(item);
  if (layer) return LAYER_STYLES[layer].icon;
  return item.kind === 'incident' ? TriangleAlert : MapPin;
}

const KIND_LABEL: Record<SearchKind, string> = {
  town: 'Town',
  ski: 'Ski area',
  beach: 'Beach',
  creemee: 'Creemee stand',
  campground: 'Campground',
  station: 'Weather station',
  camera: 'Traffic camera',
  road: 'Seasonal road',
  roadWeather: 'Road weather station',
  airQuality: 'Air quality monitor',
  river: 'River gauge',
  incident: 'Travel incident',
};

interface SearchBoxProps {
  items: readonly SearchItem[];
  onSelect: (item: SearchItem) => void;
  /** Called the first time the box is focused, to lazy-load searchable data. */
  onActivate?: () => void;
  /** True while extra (non-town) results are still loading. */
  loadingMore?: boolean;
  isDark: boolean;
}

/**
 * Accessible combobox (WAI-ARIA 1.2 pattern): type to filter, arrows to move,
 * Enter to pick, Escape to clear. "/" focuses it from anywhere on the page.
 */
export default function SearchBox({
  items,
  onSelect,
  onActivate,
  loadingMore = false,
  isDark,
}: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activated = useRef(false);
  const listId = useId();

  const results = useMemo(() => searchPlaces(items, query), [items, query]);
  const showList = open && query.trim().length >= 2;

  // "/" to focus search, unless the user is typing somewhere else
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activate = (): void => {
    if (!activated.current) {
      activated.current = true;
      onActivate?.();
    }
    setOpen(true);
  };

  const choose = (item: SearchItem): void => {
    onSelect(item);
    setQuery(item.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      if (results.length) setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      const item = results[active];
      if (showList && item) {
        e.preventDefault();
        choose(item);
      }
    } else if (e.key === 'Escape') {
      if (query) {
        e.stopPropagation(); // don't also close the detail panel
        setQuery('');
      }
      setOpen(false);
    }
  };

  const activeId = showList && results[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div className={`search-box ${isDark ? 'dark' : ''}`}>
      <div className="search-input-wrap">
        <Search size={16} className="search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          placeholder="Search towns, ski areas, roads…"
          value={query}
          role="combobox"
          aria-label="Search places"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          onFocus={activate}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          // Delay so a click on an option registers before the list closes
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="search-shortcut" aria-hidden="true">
            /
          </kbd>
        )}
      </div>

      <ul id={listId} role="listbox" className="search-results" hidden={!showList}>
        {results.map((item, i) => {
          const Icon = resultIcon(item);
          const layer = resultLayer(item);
          return (
            <li
              key={item.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`search-result ${i === active ? 'active' : ''}`}
              // mousedown: fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <Icon
                size={16}
                className={`search-kind kind-${item.kind}`}
                aria-hidden="true"
                {...(layer ? { style: layerColorVars(layer) } : {})}
              />
              <span className="search-text">
                <span className="search-name">{item.name}</span>
                <span className="search-detail">
                  {KIND_LABEL[item.kind]}
                  {item.detail ? ` · ${item.detail}` : ''}
                </span>
              </span>
            </li>
          );
        })}
        {showList && results.length === 0 && (
          <li className="search-empty" role="presentation">
            {loadingMore ? 'Searching…' : 'No matching places'}
          </li>
        )}
      </ul>
    </div>
  );
}
