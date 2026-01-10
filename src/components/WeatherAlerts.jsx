import { useState, useEffect } from 'react';
import './WeatherAlerts.css';

function WeatherAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchAlerts();
    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('https://api.weather.gov/alerts/active?area=VT');
      const data = await response.json();

      if (data.features) {
        setAlerts(data.features);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'Extreme': '#ff0000',
      'Severe': '#ff8c00',
      'Moderate': '#ffd700',
      'Minor': '#4169e1',
      'Unknown': '#64748b'
    };
    return colors[severity] || colors['Unknown'];
  };

  const getSeverityBadge = (severity) => {
    return (
      <span 
        className="severity-badge" 
        style={{ 
          backgroundColor: getSeverityColor(severity),
          color: severity === 'Moderate' || severity === 'Minor' ? '#000' : '#fff'
        }}
      >
        {severity}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="weather-alerts">
        <div className="alerts-header">
          <h3>Weather Alerts</h3>
        </div>
        <div className="alerts-loading">Loading alerts...</div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="weather-alerts">
        <div className="alerts-header">
          <h3>Weather Alerts</h3>
          <span className="alert-count">0</span>
        </div>
        <div className="no-alerts">
          <div className="no-alerts-icon">✓</div>
          <div className="no-alerts-text">No active alerts for Vermont</div>
        </div>
      </div>
    );
  }

  return (
    <div className="weather-alerts">
      <div className="alerts-header" onClick={() => setExpanded(!expanded)}>
        <h3>Weather Alerts</h3>
        <span className="alert-count">{alerts.length}</span>
        <button className="expand-button">
          {expanded ? '▼' : '▶'}
        </button>
      </div>
      
      {expanded && (
        <div className="alerts-list">
          {alerts.map((alert, index) => (
            <a
              key={index}
              href={alert.id}
              target="_blank"
              rel="noopener noreferrer"
              className="alert-item"
              title="Click to view full alert details on weather.gov"
            >
              <div className="alert-header-row">
                <div className="alert-event">{alert.properties.event}</div>
                {getSeverityBadge(alert.properties.severity)}
              </div>
              <div className="alert-headline">{alert.properties.headline}</div>
              <div className="alert-time">
                {new Date(alert.properties.effective).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default WeatherAlerts;
