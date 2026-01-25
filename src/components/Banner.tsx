/**
 * Banner - Full-width alert banner for system-level messages
 * Typically displayed at top of page
 */

import { AlertTriangle, Info, X } from 'lucide-react';
import './Banner.css';

export type BannerType = 'warning' | 'info' | 'system';

export interface BannerProps {
  type: BannerType;
  title: string;
  message?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export default function Banner({
  type,
  title,
  message,
  dismissible = true,
  onDismiss,
  className = '',
}: BannerProps) {
  return (
    <div className={`banner banner-${type} ${className}`} role="alert">
      <div className="banner-content">
        {type === 'warning' && (
          <AlertTriangle className="banner-icon" size={20} aria-hidden="true" />
        )}
        {type === 'info' && (
          <Info className="banner-icon" size={20} aria-hidden="true" />
        )}
        <div className="banner-text">
          <div className="banner-title">{title}</div>
          {message && <div className="banner-message">{message}</div>}
        </div>
      </div>
      {dismissible && onDismiss && (
        <button
          className="banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss banner"
          type="button"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
