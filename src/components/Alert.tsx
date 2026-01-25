/**
 * Alert - Inline alert component for persistent messages
 * Stays visible until dismissed
 */

import { XCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import './Alert.css';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  type: AlertType;
  title?: string;
  message?: string;
  children?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: 'success' | 'error' | 'warning' | 'info' | null;
  className?: string;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function Alert({
  type,
  title,
  message,
  children,
  dismissible = false,
  onDismiss,
  icon,
  className = '',
}: AlertProps) {
  const IconComponent = icon !== null ? icons[icon || type] : null;

  return (
    <div className={`alert alert-${type} ${className}`} role="alert">
      {IconComponent && (
        <IconComponent className="alert-icon" size={20} aria-hidden="true" />
      )}
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        {message && <div className="alert-message">{message}</div>}
        {children && <div className="alert-children">{children}</div>}
      </div>
      {dismissible && onDismiss && (
        <button
          className="alert-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          type="button"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
