/**
 * Tooltip - Contextual help tooltip
 */

import { useState, useId } from 'react';
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
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);
  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => setIsVisible(false);

  return (
    <div
      className={`tooltip-wrapper ${className} ${isVisible ? 'tooltip-visible' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children ? (
        <div
          className="tooltip-trigger-wrapper"
          tabIndex={0}
          aria-describedby={tooltipId}
        >
          {children}
        </div>
      ) : (
        <Info
          className="tooltip-trigger"
          size={16}
          aria-label="Information"
          tabIndex={0}
          aria-describedby={tooltipId}
        />
      )}
      <div
        id={tooltipId}
        className={`tooltip tooltip-${position}`}
        role="tooltip"
      >
        {content}
      </div>
    </div>
  );
}
