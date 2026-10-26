import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DetailPanel from '../DetailPanel';
import type { DetailPanelContent } from '../../types';
import {
  makeAlertFeature,
  makeVT511Incident,
  makeStation,
} from '../../__fixtures__/components/data';

vi.mock('../../hooks/useAirQuality', () => ({ useAirQuality: () => ({ data: undefined }) }));
vi.mock('../../hooks/useForecast', () => ({
  useForecast: () => ({ data: undefined, isLoading: true, error: null }),
}));

describe('DetailPanel', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders closed with no content', () => {
    const { container } = render(<DetailPanel content={null} onClose={vi.fn()} isDark={false} />);
    expect(container.querySelector('.detail-panel')).not.toHaveClass('open');
    expect(container.querySelector('.detail-panel-backdrop')).toBeNull();
    expect(container.querySelector('.detail-panel-content')).toBeEmptyDOMElement();
    expect(document.body.style.overflow).toBe('');
  });

  it.each<[string, DetailPanelContent, string]>([
    ['alert', { type: 'alert', data: makeAlertFeature() }, 'Weather Alert'],
    ['incident', { type: 'incident', data: makeVT511Incident() }, 'Traffic Incident'],
    ['station', { type: 'station', data: makeStation() }, 'Weather Station'],
    ['location', { type: 'location', coordinates: { lat: 44.26, lng: -72.58 } }, "What's Here"],
  ])('renders the %s view with its title', (_type, content, title) => {
    const { container } = render(<DetailPanel content={content} onClose={vi.fn()} isDark />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(container.querySelector('.detail-panel')).toHaveClass('open', 'dark');
    expect(container.querySelector('.detail-view')).not.toBeNull();
  });

  it('offers a share menu for stations but not incidents (VTL-52, VTL-70)', () => {
    const getShare = vi.fn(() => ({
      url: 'https://vtliveview.com/?sel=station:KBTV',
      text: 'Weather station: Burlington',
    }));
    const onClose = vi.fn();
    const { rerender } = render(
      <DetailPanel
        content={{ type: 'station', data: makeStation() }}
        onClose={onClose}
        getShare={getShare}
        isDark={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Share a link to this' }));
    expect(getShare).toHaveBeenCalledTimes(1);
    const menu = screen.getByRole('dialog', { name: 'Share a link to this' });
    expect(menu).toHaveTextContent('Weather station: Burlington');
    // Escape closes the menu, not the panel behind it
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Share a link to this' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <DetailPanel
        content={{ type: 'incident', data: makeVT511Incident() }}
        onClose={vi.fn()}
        getShare={getShare}
        isDark={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Share a link to this' })).toBeNull();
  });

  it('closes via the close button, the backdrop and Escape', () => {
    const onClose = vi.fn();
    const { container } = render(
      <DetailPanel
        content={{ type: 'station', data: makeStation() }}
        onClose={onClose}
        isDark={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close detail panel' }));
    fireEvent.click(container.querySelector('.detail-panel-backdrop')!);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('locks body scroll while open and releases it on close/unmount', () => {
    const content: DetailPanelContent = { type: 'station', data: makeStation() };
    const { rerender, unmount } = render(
      <DetailPanel content={content} onClose={vi.fn()} isDark={false} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<DetailPanel content={null} onClose={vi.fn()} isDark={false} />);
    expect(document.body.style.overflow).toBe('');
    rerender(<DetailPanel content={content} onClose={vi.fn()} isDark={false} />);
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('stops listening for Escape once closed', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <DetailPanel
        content={{ type: 'station', data: makeStation() }}
        onClose={onClose}
        isDark={false}
      />,
    );
    rerender(<DetailPanel content={null} onClose={onClose} isDark={false} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
