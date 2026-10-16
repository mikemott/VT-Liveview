import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';
import CampingContent from '../CampingContent';
import AstronomyEvents from '../AstronomyEvents';
import { getActiveShowerTonight, getUpcomingShowers } from '../../data/meteorShowers';
import { getPlanetVisibility } from '../../utils/astronomy';
import type { MeteorShower } from '../../types/stargazing';

vi.mock('../../data/meteorShowers', () => ({
  getUpcomingShowers: vi.fn(),
  getActiveShowerTonight: vi.fn(),
}));
vi.mock('../../utils/astronomy', () => ({ getPlanetVisibility: vi.fn() }));

const upcomingMock = vi.mocked(getUpcomingShowers);
const activeMock = vi.mocked(getActiveShowerTonight);
const planetsMock = vi.mocked(getPlanetVisibility);

function shower(
  id: string,
  extra: { daysUntilPeak: number; isActive: boolean; isPeak: boolean },
): MeteorShower & { daysUntilPeak: number; isActive: boolean; isPeak: boolean } {
  return {
    id,
    name: `Shower ${id}`,
    peakMonth: 8,
    peakDay: 12,
    activeStartMonth: 7,
    activeStartDay: 17,
    activeEndMonth: 8,
    activeEndDay: 24,
    zenithalHourlyRate: 100,
    radiantConstellation: 'Perseus',
    description: `Description ${id}`,
    viewingTips: `Tips ${id}`,
    ...extra,
  };
}

describe('ThemeToggle', () => {
  it('offers dark mode in light theme and calls onToggle', () => {
    const onToggle = vi.fn();
    render(<ThemeToggle isDark={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Switch to dark mode' });
    expect(button).not.toHaveClass('dark');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers light mode in dark theme', () => {
    render(<ThemeToggle isDark onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveClass('dark');
  });
});

describe('CampingContent', () => {
  const props = {
    showCampgrounds: true,
    onToggleCampgrounds: vi.fn(),
    showBackcountrySites: false,
    onToggleBackcountrySites: vi.fn(),
    campgroundCount: 12,
    backcountryCount: 0,
  };

  it('reflects toggle state and counts and forwards toggles', () => {
    render(<CampingContent {...props} />);
    const campgrounds = screen.getByRole('checkbox', { name: /Campgrounds/ });
    const backcountry = screen.getByRole('checkbox', { name: /Backcountry Areas/ });
    expect(campgrounds).toBeChecked();
    expect(backcountry).not.toBeChecked();
    expect(screen.getByText(/12 locations/)).toBeInTheDocument();
    fireEvent.click(campgrounds);
    fireEvent.click(backcountry);
    expect(props.onToggleCampgrounds).toHaveBeenCalledTimes(1);
    expect(props.onToggleBackcountrySites).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Backcountry Tips')).toBeNull();
  });

  it('shows backcountry tips only when backcountry sites are shown and present', () => {
    render(<CampingContent {...props} showBackcountrySites backcountryCount={5} />);
    expect(screen.getByText('Backcountry Tips')).toBeInTheDocument();
    expect(screen.getByText(/5 sites/)).toBeInTheDocument();
  });

  it.todo('tips do not promise marker clustering that the map does not implement (FINDINGS H13)');
});

describe('AstronomyEvents', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists up to three showers with status badges and visible planets', () => {
    upcomingMock.mockReturnValue([
      shower('a', { daysUntilPeak: 0, isActive: true, isPeak: true }),
      shower('b', { daysUntilPeak: 3, isActive: true, isPeak: false }),
      shower('c', { daysUntilPeak: 5, isActive: false, isPeak: false }),
      shower('d', { daysUntilPeak: 40, isActive: false, isPeak: false }),
    ]);
    activeMock.mockReturnValue(shower('a', { daysUntilPeak: 0, isActive: true, isPeak: true }));
    planetsMock.mockReturnValue([
      {
        name: 'Jupiter',
        isVisible: true,
        visibilityPeriod: 'evening',
        magnitude: -2.04,
        description: '',
      },
    ]);
    const { container } = render(<AstronomyEvents isDark />);
    expect(upcomingMock).toHaveBeenCalledWith(90);
    expect(container.querySelector('.astronomy-events')).toHaveClass('dark');
    expect(container.querySelector('.active-indicator')).not.toBeNull();
    expect(screen.getByText('Peak Tonight!')).toBeInTheDocument();
    expect(screen.getByText('Active Now')).toBeInTheDocument();
    expect(screen.getByText('5d')).toHaveClass('soon');
    expect(screen.queryByText('Shower d')).toBeNull();
    expect(screen.getAllByText('Peak: Aug 12')).toHaveLength(3);
    expect(screen.getByText('Jupiter')).toBeInTheDocument();
    expect(screen.getByText('mag -2.0')).toBeInTheDocument();
  });

  it('expands a shower card to show details', () => {
    upcomingMock.mockReturnValue([
      shower('a', { daysUntilPeak: 30, isActive: false, isPeak: false }),
    ]);
    activeMock.mockReturnValue(null);
    planetsMock.mockReturnValue([]);
    render(<AstronomyEvents />);
    expect(screen.getByText('30d')).toHaveClass('upcoming');
    expect(screen.queryByText('Description a')).toBeNull();
    fireEvent.click(screen.getByText('Shower a'));
    expect(screen.getByText('Description a')).toBeInTheDocument();
    expect(screen.getByText('Tips a')).toBeInTheDocument();
  });

  it('shows empty states and collapses', () => {
    upcomingMock.mockReturnValue([]);
    activeMock.mockReturnValue(null);
    planetsMock.mockReturnValue([]);
    render(<AstronomyEvents />);
    expect(screen.getByText('No major showers in the next 90 days')).toBeInTheDocument();
    expect(screen.getByText('Check back for planet visibility updates')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse events' }));
    expect(screen.queryByText('Meteor Showers')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand events' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
