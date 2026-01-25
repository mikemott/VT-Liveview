/**
 * Tooltip - Contextual help tooltip
 */

import { useState, useId, isValidElement, cloneElement } from 'react';
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

  // Check if children are already focusable
  const isFocusable = (child: ReactNode): boolean => {
    if (!isValidElement(child)) return false;
    const props = child.props as Record<string, unknown>;
    return !!(
      props.tabIndex !== undefined ||
      props.href ||
      props.role === 'button' ||
      typeof child.type === 'string' &&
        ['button', 'input', 'select', 'textarea', 'a'].includes(child.type)
    );
  };

  return (
    <div
      className={`tooltip-wrapper ${className} ${isVisible ? 'tooltip-visible' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children ? (
        isFocusable(children) ? (
          cloneElement(children as React.ReactElement, {
            'aria-describedby': tooltipId,
            tabIndex: (children as React.ReactElement).props.tabIndex ?? 0,
          })
        ) : (
          <div
            className="tooltip-trigger-wrapper"
            tabIndex={0}
            aria-describedby={tooltipId}
          >
            {children}
          </div>
        )
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
        aria-hidden={!isVisible}
      >
        {content}
      </div>
    </div>
  );
}
