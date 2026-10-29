import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AlertFeature } from '../../types';
import AlertPopup from '../AlertPopup';

const alert = (event: string, severity: string): AlertFeature => ({
  type: 'Feature',
  properties: { id: event, event, headline: `${event} for Vermont`, severity, areaDesc: 'Vermont' },
  geometry: null,
});
const WARNING = alert('Flash Flood Warning', 'Severe');
const STATEMENT = alert('Special Weather Statement', 'Minor');
const ADVISORY = alert('Wind Advisory', 'Moderate');

function renderPopup(alerts: AlertFeature[], selectedKey: string | null = null) {
  const onSelect = vi.fn();
  const onDetails = vi.fn();
  const onDismiss = vi.fn();
  render(
    <AlertPopup
      alerts={alerts}
      isDark={false}
      selectedKey={selectedKey}
      onSelect={onSelect}
      onDetails={onDetails}
      onDismiss={onDismiss}
    />,
  );
  return { onSelect, onDetails, onDismiss };
}

const card = (event: string) =>
  screen.queryByRole('button', { name: new RegExp(`^Show the area of ${event}`) });

describe('AlertPopup (VTL-85)', () => {
  it('renders nothing without alerts', () => {
    const { container } = render(
      <AlertPopup
        alerts={[]}
        isDark={false}
        selectedKey={null}
        onSelect={vi.fn()}
        onDetails={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the first alert, with the rest a click away', () => {
    renderPopup([WARNING, ADVISORY, STATEMENT]);
    expect(screen.getByRole('heading', { name: 'Active Alerts (3)' })).toBeInTheDocument();
    expect(card('Flash Flood Warning')).toBeInTheDocument();
    expect(card('Wind Advisory')).toBeNull();

    const more = screen.getByRole('button', { name: '2 more alerts' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(card('Wind Advisory')).toBeInTheDocument();
    expect(card('Special Weather Statement')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(card('Wind Advisory')).toBeNull();
  });

  it('selects, opens and dismisses an alert', () => {
    const { onSelect, onDetails, onDismiss } = renderPopup([STATEMENT]);
    expect(screen.queryByRole('button', { name: /more alert/ })).toBeNull();
    fireEvent.click(card('Special Weather Statement')!);
    expect(onSelect).toHaveBeenCalledWith(STATEMENT);
    expect(onDetails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Details for Special Weather Statement' }));
    expect(onDetails).toHaveBeenCalledWith(STATEMENT);
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss Special Weather Statement alert' }),
    );
    expect(onDismiss).toHaveBeenCalledWith(STATEMENT);
  });

  it('marks the selected alert, and keeps it in view when collapsed', () => {
    renderPopup([WARNING, STATEMENT], STATEMENT.properties.id);
    expect(card('Special Weather Statement')).toHaveAttribute('aria-pressed', 'true');
    expect(card('Flash Flood Warning')).toBeNull();
  });

  it('shows the end time and area on one line', () => {
    renderPopup([
      {
        ...STATEMENT,
        properties: { ...STATEMENT.properties, expires: '2026-01-16T10:00:00-05:00' },
      },
    ]);
    expect(card('Special Weather Statement')).toHaveTextContent(/Until Jan 16, \d.* · Vermont/);
  });

  it('minimizes to a pill and back', () => {
    renderPopup([WARNING, STATEMENT]);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize weather alerts' }));
    expect(screen.queryByRole('heading')).toBeNull();
    const pill = screen.getByRole('button', { name: 'Show 2 weather alerts' });
    expect(pill).toHaveTextContent('2 weather alerts');
    fireEvent.click(pill);
    expect(card('Flash Flood Warning')).toBeInTheDocument();
  });

  it('names a single alert on the pill', () => {
    renderPopup([STATEMENT]);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize weather alerts' }));
    expect(screen.getByRole('button', { name: 'Show the weather alert' })).toHaveTextContent(
      'Special Weather Statement',
    );
  });
});
