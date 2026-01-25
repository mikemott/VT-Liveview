/**
 * StatusBadge - Small status indicator badge
 */

import type { ReactNode } from 'react';
import './StatusBadge.css';

export type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export default function StatusBadge({
  variant,
  children,
  icon,
  className = '',
}: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge-${variant} ${className}`} role="status">
      {icon && <span className="status-badge-icon">{icon}</span>}
      <span className="status-badge-text">{children}</span>
    </span>
  );
}
