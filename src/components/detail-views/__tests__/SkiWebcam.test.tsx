import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SkiWebcam from '../SkiWebcam';
import SkiDetail from '../SkiDetail';
import { useSkiWebcams } from '../../../hooks/useSkiWebcams';
import { previewUrl, snapshotStamp, type SkiWebcams } from '../../../services/skiWebcamsApi';
import { makeSkiResort } from '../../../__fixtures__/components/data';

vi.mock('../../../hooks/useSkiWebcams', () => ({ useSkiWebcams: vi.fn() }));
const useSkiWebcamsMock = vi.mocked(useSkiWebcams);

const yt = (id: string) => ({
  preview: `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg`,
  embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0`,
});

const DATA: SkiWebcams = {
  checkedAt: '2026-11-18T01:00:00Z',
  youtubeLookup: true,
  resorts: {
    sugarbush: {
      page: 'https://www.sugarbush.com/mountain/webcams/',
      status: 'ok',
      camera: { name: 'Gate House Plaza', kind: 'live', refreshPreview: false, ...yt('newLive') },
    },
    stowe: {
      page: 'https://www.stowe.com/explore/webcams/',
      status: 'ok',
      camera: {
        name: 'Spruce Peak village',
        kind: 'live',
        preview: 'https://player.brownrice.com/snapshot/stowevillage2',
        refreshPreview: true,
        embed: 'https://player.brownrice.com/embed/stowevillage2',
      },
    },
    'jay-peak': {
      page: 'https://jaypeakresort.com/resort/photo-day',
      status: 'ok',
      camera: {
        name: 'Tramside',
        kind: 'still',
        preview: 'https://b10.hdrelay.com/camera/abc/snapshot',
        refreshPreview: true,
        embed: null,
      },
    },
    killington: {
      page: 'https://www.killington.com/the-mountain/conditions-weather/webcam/',
      status: 'ok',
      camera: {
        name: 'K-1 Lodge panorama',
        kind: 'panorama',
        preview: null,
        refreshPreview: false,
        embed: 'https://killington.roundshot.com/baselodge/',
      },
    },
    'smugglers-notch': {
      page: 'https://smuggs.com/conditions-stats/web-cams',
      status: 'offline',
      camera: null,
      reason: 'not live',
    },
    'pico-mountain': {
      page: 'https://www.picomountain.com/the-mountain/conditions-weather/webcams/',
      status: 'unavailable',
      camera: null,
      reason: 'image HTTP 403',
    },
  },
};

beforeEach(() => {
  useSkiWebcamsMock.mockReturnValue({ data: DATA } as unknown as ReturnType<typeof useSkiWebcams>);
});

describe('SkiWebcam (VTL-87/88)', () => {
  it('shows the resolved live stream and loads the player only when tapped', () => {
    const { container } = render(<SkiWebcam resortId="sugarbush" resortName="Sugarbush" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByAltText('Sugarbush base camera')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/newLive/hqdefault_live.jpg',
    );
    expect(screen.getByText(/Live · Gate House Plaza/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play Sugarbush live camera' }));
    expect(screen.getByTitle('Sugarbush — Gate House Plaza (live)').getAttribute('src')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/newLive\?autoplay=1&mute=1/,
    );
  });

  it('falls back to the plain thumbnail, then a neutral tile, when images fail', () => {
    render(<SkiWebcam resortId="sugarbush" resortName="Sugarbush" />);
    fireEvent.error(screen.getByAltText('Sugarbush base camera'));
    expect(screen.getByAltText('Sugarbush base camera')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/newLive/hqdefault.jpg',
    );
    fireEvent.error(screen.getByAltText('Sugarbush base camera'));
    expect(screen.getByText('Camera image unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play Sugarbush live camera' })).toBeInTheDocument();
  });

  it('stamps snapshot previews so an open panel refreshes', () => {
    render(<SkiWebcam resortId="stowe" resortName="Stowe" />);
    expect(screen.getByAltText('Stowe base camera').getAttribute('src')).toMatch(
      /^https:\/\/player\.brownrice\.com\/snapshot\/stowevillage2\?t=\d+$/,
    );
  });

  it('shows a still with a link to the live view, never a player', () => {
    const { container } = render(<SkiWebcam resortId="jay-peak" resortName="Jay Peak" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/Latest still · Tramside/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Live view at Jay Peak ↗' });
    expect(link).toHaveAttribute('href', 'https://jaypeakresort.com/resort/photo-day');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('opens the Killington panorama on tap', () => {
    render(<SkiWebcam resortId="killington" resortName="Killington" />);
    expect(screen.getByText('360° panorama')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play Killington live camera' }));
    expect(screen.getByTitle('Killington — K-1 Lodge panorama (live)')).toHaveAttribute(
      'src',
      'https://killington.roundshot.com/baselodge/',
    );
  });

  it('turns an off-season or broken camera into the resort link', () => {
    render(<SkiWebcam resortId="smugglers-notch" resortName="Smugglers Notch" />);
    expect(screen.getByText(/Base camera is off right now/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Webcams at Smugglers Notch ↗' })).toHaveAttribute(
      'href',
      'https://smuggs.com/conditions-stats/web-cams',
    );
    render(<SkiWebcam resortId="pico-mountain" resortName="Pico Mountain" />);
    expect(screen.getByRole('link', { name: 'Webcams at Pico Mountain ↗' })).toBeInTheDocument();
    expect(screen.queryAllByText(/off right now/)).toHaveLength(1); // Pico isn't "off", just not embeddable
  });

  it('shows nothing for unknown resorts or before the check loads', () => {
    const { container } = render(<SkiWebcam resortId="saskadena-six" resortName="Saskadena Six" />);
    expect(container).toBeEmptyDOMElement();
    useSkiWebcamsMock.mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof useSkiWebcams
    >);
    const { container: loading } = render(
      <SkiWebcam resortId="sugarbush" resortName="Sugarbush" />,
    );
    expect(loading).toBeEmptyDOMElement();
  });

  it('sits in the ski panel', () => {
    render(
      <SkiDetail resort={makeSkiResort({ id: 'sugarbush', name: 'Sugarbush' })} isDark={false} />,
    );
    expect(screen.getByRole('button', { name: 'Play Sugarbush live camera' })).toBeInTheDocument();
  });
});

describe('previewUrl', () => {
  it('stamps snapshots in ten-minute windows and leaves others alone', () => {
    const now = Date.UTC(2026, 10, 17, 15, 7);
    const stowe = DATA.resorts.stowe!.camera!;
    expect(previewUrl(stowe, now)).toBe(
      `https://player.brownrice.com/snapshot/stowevillage2?t=${snapshotStamp(now)}`,
    );
    expect(snapshotStamp(now)).toBe(snapshotStamp(now + 60_000));
    expect(previewUrl(DATA.resorts.sugarbush!.camera!, now)).toBe(
      'https://i.ytimg.com/vi/newLive/hqdefault_live.jpg',
    );
    expect(previewUrl(DATA.resorts.killington!.camera!, now)).toBeNull();
  });
});
