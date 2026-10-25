/**
 * ShareMenu (VTL-70): the share button and its menu of places to share to.
 *
 * Each network opens its own post screen with the link and a line about the
 * view filled in (nothing is posted until the person presses Post there).
 * Copy link covers everything else, e.g. Front Porch Forum; "More…" opens the
 * device's share sheet where there is one.
 */
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, Link2, Mail, MessageSquare, Share2, Upload } from 'lucide-react';
import { shareTargets, type ShareTarget } from '../utils/sharePreview';
import './ShareMenu.css';

interface ShareMenuProps {
  /** Called when the menu opens: the link and one line describing the view */
  getShare: () => { url: string; text: string };
  isDark: boolean;
  /**
   * map: the floating map button (menu opens beside it);
   * panel: the side panel's header button (menu drops down below it)
   */
  variant?: 'map' | 'panel';
  /** Accessible name and tooltip for the button */
  label?: string;
}

/** Short brand marks: text badges in each network's color (no logo files) */
const BADGES: Record<Exclude<ShareTarget['id'], 'email' | 'sms'>, string> = {
  facebook: 'f',
  x: '𝕏',
  bluesky: 'b',
  reddit: 'r',
};

const GAP = 8;

/**
 * Fixed position for the menu: under the side panel's button (right-aligned),
 * or beside the map button: to its left on desktop (top-right corner), to its
 * right on phones (the buttons sit top-left there, WeatherMap.css).
 */
function menuPosition(variant: 'map' | 'panel', button: HTMLElement): CSSProperties {
  const r = button.getBoundingClientRect();
  if (variant === 'panel') {
    return { top: r.bottom + GAP, right: Math.max(GAP, window.innerWidth - r.right) };
  }
  if (window.innerWidth <= 768) return { top: r.top, left: r.right + GAP };
  return { top: r.top, right: window.innerWidth - r.left + GAP };
}

const isTouch = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

export default function ShareMenu({
  getShare,
  isDark,
  variant = 'map',
  label = 'Share this view',
}: ShareMenuProps) {
  const [share, setShare] = useState<{ url: string; text: string } | null>(null);
  // Where the menu goes. It's portaled to <body> and placed from the button, so
  // no parent can clip it, blur it or stack over it (the weather card, the
  // side panel's blurred header)
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = share !== null;

  const close = useCallback((refocus: boolean): void => {
    setShare(null);
    setCopied('idle');
    if (refocus) buttonRef.current?.focus();
  }, []);

  // Escape and outside clicks close it
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // Capture phase + stop: Escape closes the menu, not the side panel behind it
      e.stopPropagation();
      close(true);
    };
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) close(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, close]);

  // Move focus into the menu when it opens
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('.share-menu-item')?.focus();
  }, [open]);

  const copy = async (): Promise<void> => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };

  const nativeShare = async (): Promise<void> => {
    if (!share) return;
    try {
      await navigator.share({ title: share.text, text: share.text, url: share.url });
      close(true);
    } catch {
      // Cancelled or unsupported: leave the menu open
    }
  };

  const targets = share ? shareTargets(share.url, share.text, { sms: isTouch() }) : [];
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const menu = share ? (
    <div
      ref={menuRef}
      id={menuId}
      className={`share-menu ${isDark ? 'dark' : ''}`}
      style={anchor ?? undefined}
      role="dialog"
      aria-label={label}
    >
      <p className="share-menu-text">{share.text}</p>
      <ul className="share-menu-list">
        {targets.map((t) => (
          <li key={t.id}>
            <a
              className="share-menu-item"
              href={t.href}
              target={t.id === 'email' || t.id === 'sms' ? undefined : '_blank'}
              rel="noopener noreferrer"
              onClick={() => close(false)}
            >
              {t.id === 'email' ? (
                <Mail size={16} aria-hidden="true" className="share-menu-icon" />
              ) : t.id === 'sms' ? (
                <MessageSquare size={16} aria-hidden="true" className="share-menu-icon" />
              ) : (
                <span className={`share-badge share-badge--${t.id}`} aria-hidden="true">
                  {BADGES[t.id]}
                </span>
              )}
              <span>{t.label}</span>
            </a>
          </li>
        ))}
        <li>
          <button type="button" className="share-menu-item" onClick={() => void copy()}>
            {copied === 'copied' ? (
              <Check size={16} aria-hidden="true" className="share-menu-icon" />
            ) : (
              <Link2 size={16} aria-hidden="true" className="share-menu-icon" />
            )}
            <span>{copied === 'copied' ? 'Link copied' : 'Copy link'}</span>
          </button>
        </li>
        {canNativeShare && (
          <li>
            <button type="button" className="share-menu-item" onClick={() => void nativeShare()}>
              <Upload size={16} aria-hidden="true" className="share-menu-icon" />
              <span>More…</span>
            </button>
          </li>
        )}
      </ul>
      <p className="share-menu-status" role="status">
        {copied === 'copied'
          ? 'Paste it anywhere, like Front Porch Forum.'
          : copied === 'failed'
            ? "Couldn't copy. You can copy the link from the address bar."
            : ''}
      </p>
    </div>
  ) : null;

  return (
    <div className={`share-menu-wrap share-menu-wrap--${variant}`} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={
          variant === 'map'
            ? `map-share-button ${isDark ? 'dark' : ''}`
            : 'detail-panel-close detail-panel-share'
        }
        onClick={() => {
          if (open) {
            close(false);
            return;
          }
          if (buttonRef.current) setAnchor(menuPosition(variant, buttonRef.current));
          setShare(getShare());
        }}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <Share2 size={18} />
      </button>

      {menu && createPortal(menu, document.body)}
    </div>
  );
}
