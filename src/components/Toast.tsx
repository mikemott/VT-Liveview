/**
 * Toast - Temporary notification component
 * Auto-dismisses after a set duration
 */

import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  type: ToastType;
  title: string;
  message?: string;
  onDismiss?: () => void;
  autoDismiss?: number; // milliseconds
  id?: string;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function Toast({
  type,
  title,
  message,
  onDismiss,
  autoDismiss = 3000,
  id,
}: ToastProps) {
  const Icon = icons[type];

  useEffect(() => {
    if (autoDismiss > 0 && onDismiss) {
      const timer = setTimeout(onDismiss, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss]);

  return (
    <div className={`toast toast-${type}`} id={id} role="alert" aria-live="polite">
      <Icon className="toast-icon" size={20} aria-hidden="true" />
      <div className="toast-content">
        <div className="toast-title">{title}</div>
        {message && <div className="toast-message">{message}</div>}
      </div>
      {onDismiss && (
        <button
          className="toast-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          type="button"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
