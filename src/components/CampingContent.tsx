import { memo } from 'react';
import { Tent, Flame, MapPin } from 'lucide-react';
import './CampingContent.css';

interface CampingContentProps {
  showCampgrounds: boolean;
  onToggleCampgrounds: () => void;
  showBackcountrySites: boolean;
  onToggleBackcountrySites: () => void;
  campgroundCount: number;
  backcountryCount: number;
}

function CampingContent({
  showCampgrounds,
  onToggleCampgrounds,
  showBackcountrySites,
  onToggleBackcountrySites,
  campgroundCount,
  backcountryCount,
}: CampingContentProps) {
  return (
    <div className="camping-content">
      <div className="camping-content-inner">
        {/* Layer Toggles */}
        <div className="camping-layer-toggles">
          <h4 className="camping-section-title">Camping & Outdoor Recreation</h4>

          {/* Campgrounds */}
          <label className="camping-layer-toggle">
            <input
              type="checkbox"
              checked={showCampgrounds}
              onChange={onToggleCampgrounds}
            />
            <span className="toggle-icon campground-icon">
              <Tent size={16} />
            </span>
            <span className="toggle-content">
              <span className="toggle-label">Campgrounds</span>
              <span className="toggle-description">
                Developed sites with facilities • {campgroundCount} locations
              </span>
            </span>
          </label>

          {/* Backcountry Sites */}
          <label className="camping-layer-toggle">
            <input
              type="checkbox"
              checked={showBackcountrySites}
              onChange={onToggleBackcountrySites}
            />
            <span className="toggle-icon backcountry-icon">
              <Flame size={16} />
            </span>
            <span className="toggle-content">
              <span className="toggle-label">Backcountry Areas</span>
              <span className="toggle-description">
                Grouped by wilderness area • {backcountryCount} sites
              </span>
            </span>
          </label>
        </div>

        {/* Info Panel */}
        <div className="camping-info-panel">
          <div className="info-section">
            <h5>Legend</h5>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-color campground-color"></span>
                <span>Campgrounds - Full facilities</span>
              </div>
              <div className="legend-item">
                <span className="legend-color backcountry-color"></span>
                <span>Backcountry - Grouped by area</span>
              </div>
            </div>
          </div>

          {showBackcountrySites && backcountryCount > 0 && (
            <div className="info-section">
              <h5>Backcountry Tips</h5>
              <ul className="tips-list">
                <li>Clustered markers show multiple nearby sites</li>
                <li>Click clusters to zoom in and reveal individual sites</li>
                <li>Click individual markers for site details</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CampingContent);
