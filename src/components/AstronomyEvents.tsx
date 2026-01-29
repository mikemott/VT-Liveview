import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Calendar, Circle } from 'lucide-react';
import { getUpcomingShowers, getActiveShowerTonight } from '../data/meteorShowers';
import { getPlanetVisibility } from '../utils/astronomy';
import type { MeteorShower } from '../types/stargazing';
import './AstronomyEvents.css';

interface AstronomyEventsProps {
  isDark?: boolean;
}

export default function AstronomyEvents({ isDark = false }: AstronomyEventsProps) {
  const [expanded, setExpanded] = useState(true); // Expanded by default

  const upcomingShowers = getUpcomingShowers(90); // Next 90 days
  const activeShower = getActiveShowerTonight();
  const visiblePlanets = getPlanetVisibility();

  // Format date
  const formatDate = (month: number, day: number): string => {
    const date = new Date(2024, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get shower status badge
  const getShowerBadge = (shower: typeof upcomingShowers[0]) => {
    if (shower.isPeak) {
      return <span className="badge peak">Peak Tonight!</span>;
    }
    if (shower.isActive) {
      return <span className="badge active">Active Now</span>;
    }
    if (shower.daysUntilPeak <= 7) {
      return <span className="badge soon">{shower.daysUntilPeak}d</span>;
    }
    return <span className="badge upcoming">{shower.daysUntilPeak}d</span>;
  };

  return (
    <div className={`astronomy-events ${isDark ? 'dark' : ''}`}>
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <h4>
          <Sparkles size={14} className="section-icon" />
          <span>Sky Events</span>
          {activeShower && <span className="active-indicator" title="Active meteor shower!" />}
        </h4>
        <button
          className="expand-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse events' : 'Expand events'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="events-content">
          {/* Active/Upcoming Meteor Showers */}
          <div className="events-section">
            <h5>
              <Calendar size={12} />
              Meteor Showers
            </h5>
            {upcomingShowers.length > 0 ? (
              <div className="showers-list">
                {upcomingShowers.slice(0, 3).map((shower) => (
                  <ShowerCard
                    key={shower.id}
                    shower={shower}
                    badge={getShowerBadge(shower)}
                    formatDate={formatDate}
                    isDark={isDark}
                  />
                ))}
              </div>
            ) : (
              <p className="no-events">No major showers in the next 90 days</p>
            )}
          </div>

          {/* Visible Planets */}
          <div className="events-section">
            <h5>
              <Circle size={12} />
              Visible Planets
            </h5>
            {visiblePlanets.length > 0 ? (
              <div className="planets-list">
                {visiblePlanets.map((planet) => (
                  <div key={planet.name} className="planet-item">
                    <span className="planet-name">{planet.name}</span>
                    <span className="planet-period">{planet.visibilityPeriod}</span>
                    <span className="planet-mag">mag {planet.magnitude.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-events">Check back for planet visibility updates</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Shower card sub-component
interface ShowerCardProps {
  shower: MeteorShower & { daysUntilPeak: number; isActive: boolean; isPeak: boolean };
  badge: React.ReactNode;
  formatDate: (month: number, day: number) => string;
  isDark: boolean;
}

function ShowerCard({ shower, badge, formatDate, isDark }: ShowerCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={`shower-card ${shower.isActive ? 'active' : ''} ${shower.isPeak ? 'peak' : ''}`}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="shower-header">
        <div className="shower-name">
          <span>{shower.name}</span>
          {badge}
        </div>
        <div className="shower-rate">~{shower.zenithalHourlyRate}/hr</div>
      </div>

      <div className="shower-meta">
        <span>Peak: {formatDate(shower.peakMonth, shower.peakDay)}</span>
        <span className="constellation">{shower.radiantConstellation}</span>
      </div>

      {showDetails && (
        <div className={`shower-details ${isDark ? 'dark' : ''}`}>
          <p className="shower-description">{shower.description}</p>
          <p className="shower-tips">{shower.viewingTips}</p>
        </div>
      )}
    </div>
  );
}
