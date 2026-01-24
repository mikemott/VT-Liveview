/**
 * Tooltip - Contextual help tooltip
 */

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import './Tooltip.css';

export interface TooltipProps {
  content: string;
  children?: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
}: TooltipProps) {
  return (
    <div className={`tooltip-wrapper ${className}`}>
      {children || (
        <Info className="tooltip-trigger" size={16} aria-label="Information" />
      )}
      <div className={`tooltip tooltip-${position}`} role="tooltip">
        {content}
      </div>
    </div>
  );
}
