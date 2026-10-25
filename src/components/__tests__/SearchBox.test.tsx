import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchBox from '../SearchBox';
import type { SearchItem } from '../../utils/search';

const ITEMS: SearchItem[] = [
  {
    id: 'town:Stowe',
    kind: 'town',
    name: 'Stowe',
    detail: 'Lamoille County',
    lat: 44.48,
    lng: -72.72,
  },
  { id: 'ski:stowe', kind: 'ski', name: 'Stowe Mountain Resort', lat: 44.53, lng: -72.78 },
  { id: 'town:Barre City', kind: 'town', name: 'Barre City', lat: 44.2, lng: -72.5 },
];

function setup(props: Partial<React.ComponentProps<typeof SearchBox>> = {}) {
  const onSelect = vi.fn();
  const onActivate = vi.fn();
  render(
    <SearchBox
      items={ITEMS}
      onSelect={onSelect}
      onActivate={onActivate}
      isDark={false}
      {...props}
    />,
  );
  const input = screen.getByRole('combobox', { name: 'Search places' });
  return { input, onSelect, onActivate };
}

describe('SearchBox', () => {
  it('lazy-activates once on first focus', () => {
    const { input, onActivate } = setup();
    fireEvent.focus(input);
    fireEvent.focus(input);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('lists matches with a kind label and supports arrow keys and Enter', () => {
    const { input, onSelect } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'stowe' } });

    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'StoweTown · Lamoille County',
      'Stowe Mountain ResortSki area',
    ]);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
    expect(input).toHaveValue('Stowe Mountain Resort');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('colors results by map layer, including each incident type (VTL-64)', () => {
    const { input } = setup({
      items: [
        ...ITEMS,
        {
          id: 'incident:1',
          kind: 'incident',
          layer: 'CLOSURE',
          name: 'Stowe bridge closed',
          lat: 44.5,
          lng: -72.7,
        },
      ],
    });
    fireEvent.change(input, { target: { value: 'stowe' } });
    const icon = (name: RegExp): SVGElement =>
      screen.getByRole('option', { name }).querySelector('svg.search-kind')!;
    expect(icon(/Stowe Mountain Resort/).getAttribute('style')).toContain('#0891b2');
    expect(icon(/Stowe bridge closed/).getAttribute('style')).toContain('#b91c1c');
    // Towns aren't a map layer: no layer color
    expect(icon(/Lamoille County/).getAttribute('style')).toBeNull();
  });

  it('selects with the mouse', () => {
    const { input, onSelect } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'barre' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Barre City/ }));
    expect(onSelect).toHaveBeenCalledWith(ITEMS[2]);
  });

  it('shows an empty state, or "Searching…" while more sources load', () => {
    const { input } = setup({ loadingMore: true });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('Searching…')).toBeInTheDocument();
  });

  it('Escape clears the query without bubbling (so the detail panel stays open)', () => {
    const { input } = setup();
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'stowe' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    expect(onWindowKey).not.toHaveBeenCalled();
    window.removeEventListener('keydown', onWindowKey);
  });

  it('focuses on "/" unless the user is typing elsewhere', () => {
    const { input } = setup();
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    fireEvent.keyDown(other, { key: '/' });
    expect(document.activeElement).toBe(other);

    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(input);
    other.remove();
  });
});
