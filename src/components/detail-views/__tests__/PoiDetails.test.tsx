/**
 * Side-panel views for the point-of-interest layers (VTL-64). These took over
 * from the map popups, so they carry the popup content assertions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SkiDetail from '../SkiDetail';
import BeachDetail from '../BeachDetail';
import CreemeeDetail from '../CreemeeDetail';
import CampgroundDetail from '../CampgroundDetail';
import CampingAreaDetail from '../CampingAreaDetail';
import DarkSkyDetail from '../DarkSkyDetail';
import { getBeachDisplay } from '../../../utils/beachStatus';
import { stateParkUrl } from '../../../utils/campingAreas';
import {
  makeBackcountrySite,
  makeBeach,
  makeCampingArea,
  makeCreemeeStand,
  makeDarkSkySite,
  makeRecreationSite,
  makeSkiResort,
  omit,
} from '../../../__fixtures__/components/data';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../../__fixtures__/components/xss';

function badge(container: HTMLElement): HTMLElement {
  return container.querySelector('.layer-badge') as HTMLElement;
}

afterEach(() => {
  delete window.__xss;
});

describe('SkiDetail', () => {
  it('shows conditions rows under the Ski badge', () => {
    const { container } = render(
      <SkiDetail
        resort={makeSkiResort({ logoUrl: 'https://example.com/stowe.png' })}
        isDark={false}
      />,
    );
    expect(badge(container)).toHaveTextContent('Ski area');
    expect(badge(container).style.getPropertyValue('--layer-color')).toBe('#0891b2');
    expect(screen.getByText('Stowe')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Good conditions');
    expect(screen.getByText('4"')).toBeInTheDocument();
    expect(screen.getByText('80 / 116')).toBeInTheDocument();
    expect(screen.getByText('8 / 12')).toBeInTheDocument();
    expect(screen.getByText('22°F')).toBeInTheDocument();
    expect(container.querySelector('img.ski-detail-logo')).toHaveAttribute(
      'src',
      'https://example.com/stowe.png',
    );
  });

  it('says "not reporting" instead of empty rows off-season', () => {
    const { container } = render(
      <SkiDetail
        resort={makeSkiResort({
          color: 'red',
          snowfall24hr: null,
          snowfallCumulative: null,
          baseDepth: null,
          tempCurrent: null,
          liftsOpen: 0,
          liftsTotal: 1,
          trailsOpen: 0,
          trailsTotal: 1,
        })}
        isDark
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Not reporting conditions yet');
    expect(container.querySelector('.detail-rows')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders hostile strings as text', () => {
    const { container } = render(
      <SkiDetail resort={makeSkiResort({ name: XSS_PAYLOAD })} isDark={false} />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});

describe('BeachDetail', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['open', 'alert', 'closed', 'unknown'] as const)(
    'shows the %s status label from getBeachDisplay',
    (status) => {
      const beach = makeBeach({ status });
      render(<BeachDetail beach={beach} isDark={false} />);
      expect(screen.getByRole('status')).toHaveTextContent(getBeachDisplay(beach).label);
    },
  );

  it('shows water quality, amenities and the Beaches badge', () => {
    const { container } = render(<BeachDetail beach={makeBeach()} isDark={false} />);
    expect(badge(container)).toHaveTextContent('Beach');
    expect(badge(container).style.getPropertyValue('--layer-color')).toBe('#115e59');
    expect(screen.getByText('Burlington')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('12 per 100 mL')).toBeInTheDocument();
    expect(screen.getByText('68°F')).toBeInTheDocument();
    expect([...container.querySelectorAll('.detail-tags li')].map((l) => l.textContent)).toEqual([
      'parking',
      'restrooms',
    ]);
  });

  it('shows an advisory and omits empty amenities', () => {
    const { container } = render(
      <BeachDetail
        beach={makeBeach({ status: 'closed', advisory: 'Cyanobacteria bloom', amenities: [] })}
        isDark={false}
      />,
    );
    expect(screen.getByText('Cyanobacteria bloom')).toBeInTheDocument();
    expect(container.querySelector('.detail-tags')).toBeNull();
  });

  it('hides quality rows for stale and unmonitored beaches', () => {
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
    const { rerender } = render(
      <BeachDetail beach={makeBeach({ lastTested: '09/21/2026 11:45 AM' })} isDark={false} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Season over');
    expect(screen.getByRole('status')).toHaveTextContent('Last tested Sep 21 (Open)');
    expect(screen.queryByText('Water quality')).toBeNull();

    rerender(
      <BeachDetail
        beach={makeBeach({ status: 'unknown', lastTested: null, waterQualityGrade: null })}
        isDark={false}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Not monitored');
    expect(screen.queryByText('Water quality')).toBeNull();
  });

  it('renders hostile strings as text', () => {
    const { container } = render(
      <BeachDetail
        beach={makeBeach({
          name: XSS_PAYLOAD,
          town: XSS_PAYLOAD,
          advisory: XSS_PAYLOAD,
          amenities: [XSS_PAYLOAD],
        })}
        isDark={false}
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});

describe('CreemeeDetail', () => {
  it('shows featured stands, description and specialties', () => {
    const { container } = render(<CreemeeDetail stand={makeCreemeeStand()} isDark={false} />);
    expect(badge(container)).toHaveTextContent('Creemee stand · Featured');
    expect(badge(container).style.getPropertyValue('--layer-color')).toBe('#9d174d');
    expect(screen.getByText('Waitsfield, VT')).toBeInTheDocument();
    expect(screen.getByText('Maple creemees')).toBeInTheDocument();
    expect(container.querySelector('.detail-tags')).toHaveTextContent('Maple');
  });

  it('omits optional sections', () => {
    const { container } = render(
      <CreemeeDetail
        stand={omit(makeCreemeeStand({ featured: false, specialties: [] }), 'description')}
        isDark
      />,
    );
    expect(badge(container)).toHaveTextContent(/^Creemee stand$/);
    expect(container.querySelector('.detail-note')).toBeNull();
    expect(container.querySelector('.detail-tags')).toBeNull();
  });

  it('renders hostile strings as text', () => {
    const { container } = render(
      <CreemeeDetail
        stand={makeCreemeeStand({
          name: XSS_PAYLOAD,
          town: XSS_PAYLOAD,
          description: XSS_PAYLOAD,
          specialties: [XSS_PAYLOAD],
        })}
        isDark={false}
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});

describe('CampgroundDetail', () => {
  it('shows site counts, contact rows and feature tags', () => {
    const { container } = render(<CampgroundDetail site={makeRecreationSite()} isDark={false} />);
    expect(badge(container)).toHaveTextContent('Campground');
    expect(badge(container).style.getPropertyValue('--layer-color')).toBe('#15803d');
    expect(screen.getByText('3444 Little River Rd, Waterbury')).toBeInTheDocument();
    expect(screen.getByText('VT FPR')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '802-244-7103' })).toHaveAttribute(
      'href',
      'tel:802-244-7103',
    );
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('Waterbury Reservoir')).toBeInTheDocument();
    expect(screen.getByText('12,000 acres')).toBeInTheDocument();
    // Zero hookups are not listed
    expect(screen.queryByText('Electric hookups')).toBeNull();
    expect([...container.querySelectorAll('.detail-tags li')].map((l) => l.textContent)).toEqual([
      'group camping',
      'beach',
      'lake swimming',
      'boat rental',
      'picnic area',
    ]);
  });

  it('handles a site without camping or swimming details', () => {
    render(
      <CampgroundDetail
        site={makeRecreationSite({
          isPublic: false,
          phone: null,
          address: null,
          town: null,
          amenities: {
            camping: null,
            swimming: null,
            boatRental: false,
            picnicArea: false,
            playground: false,
          },
        })}
        isDark
      />,
    );
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Tent sites')).toBeNull();
  });

  it('renders hostile strings as text', () => {
    const { container } = render(
      <CampgroundDetail
        site={makeRecreationSite({
          name: XSS_PAYLOAD,
          address: XSS_PAYLOAD,
          organization: XSS_PAYLOAD,
          phone: XSS_PAYLOAD,
        })}
        isDark={false}
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});

describe('CampingAreaDetail', () => {
  it('shows site count and types, with no park link for a state forest', () => {
    const { container } = render(
      <CampingAreaDetail
        area={makeCampingArea({
          sites: [makeBackcountrySite(), makeBackcountrySite({ id: 'b2' })],
        })}
        isDark={false}
      />,
    );
    expect(badge(container)).toHaveTextContent('Backcountry camping');
    expect(badge(container).style.getPropertyValue('--layer-color')).toBe('#15803d');
    expect(screen.getByText('State forest')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Lean-to')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('links state parks to vtstateparks.com', () => {
    const area = makeCampingArea({ name: 'Little River State Park', type: 'state_park' });
    render(<CampingAreaDetail area={area} isDark />);
    expect(screen.getByRole('link', { name: /Park website/ })).toHaveAttribute(
      'href',
      'https://vtstateparks.com/little-river',
    );
    expect(stateParkUrl(area)).toBe('https://vtstateparks.com/little-river');
    expect(stateParkUrl({ name: 'Groton', type: 'state_forest' })).toBeNull();
  });

  it('renders hostile strings as text and keeps the link slug safe', () => {
    const { container } = render(
      <CampingAreaDetail
        area={makeCampingArea({
          name: XSS_PAYLOAD,
          type: 'state_park',
          sites: [makeBackcountrySite({ siteType: XSS_PAYLOAD })],
        })}
        isDark={false}
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
    expect(container.querySelector('a')?.getAttribute('href')).toMatch(
      /^https:\/\/vtstateparks\.com\/[a-z0-9-]*$/,
    );
  });
});

describe('DarkSkyDetail', () => {
  it('shows sky quality, description, rows and facilities', () => {
    const { container } = render(
      <DarkSkyDetail site={makeDarkSkySite({ sqmReading: 21.6, elevation: 500 })} isDark={false} />,
    );
    expect(badge(container)).toHaveTextContent('Dark sky site');
    expect(badge(container).style.getPropertyValue('--layer-color')).toBe('#a855f7');
    expect(screen.getByText('State forest')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Bortle 2:/);
    expect(screen.getByText('Remote bog with open horizons')).toBeInTheDocument();
    expect(screen.getByText('Bring bug spray')).toBeInTheDocument();
    expect(screen.getByText('21.6 mag/arcsec²')).toBeInTheDocument();
    expect(screen.getByText('1,641 ft')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Milky Way')).toBeInTheDocument();
    expect([...container.querySelectorAll('.detail-tags li')].map((l) => l.textContent)).toEqual([
      'parking',
      'camping',
    ]);
  });

  it('renders hostile strings as text', () => {
    const { container } = render(
      <DarkSkyDetail
        site={makeDarkSkySite({
          name: XSS_PAYLOAD,
          description: XSS_PAYLOAD,
          viewingNotes: XSS_PAYLOAD,
        })}
        isDark
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});
