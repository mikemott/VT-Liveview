import './RadarControl.css';

function RadarControl({ showRadar, setShowRadar, opacity, setOpacity }) {
  return (
    <div className="radar-control">
      <div className="control-header">
        <span className="control-title">Weather Radar</span>
      </div>
      
      <div className="control-item">
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={showRadar}
            onChange={(e) => setShowRadar(e.target.checked)}
          />
          <span className="slider"></span>
        </label>
        <span className="control-label">{showRadar ? 'On' : 'Off'}</span>
      </div>

      {showRadar && (
        <div className="control-item">
          <label className="opacity-label">Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="opacity-slider"
          />
          <span className="opacity-value">{Math.round(opacity * 100)}%</span>
        </div>
      )}
    </div>
  );
}

export default RadarControl;
