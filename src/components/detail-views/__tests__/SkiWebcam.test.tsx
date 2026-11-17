import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SkiWebcam from '../SkiWebcam';
import SkiDetail from '../SkiDetail';
import { SKI_WEBCAMS, snapshotStamp, webcamEmbed, webcamPreview } from '../../../data/skiWebcams';
import { makeSkiResort } from '../../../__fixtures__/components/data';

describe('SkiWebcam (VTL-87)', () => {
  it('shows a YouTube preview and loads the privacy-mode player only when tapped', () => {
    const { container } = render(<SkiWebcam resortId="sugarbush" resortName="Sugarbush" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByAltText('Sugarbush base camera')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/jhCh3dsEv-M/hqdefault_live.jpg',
    );
    expect(screen.getByText(/Live · Gate House Plaza/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play Sugarbush live camera' }));
    const player = screen.getByTitle('Sugarbush — Gate House Plaza (live)');
    expect(player.getAttribute('src')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/jhCh3dsEv-M\?autoplay=1&mute=1/,
    );
  });

  it('falls back to the plain thumbnail, then a neutral tile, when images fail', () => {
    render(<SkiWebcam resortId="stratton" resortName="Stratton" />);
    const img = screen.getByAltText('Stratton base camera');
    fireEvent.error(img);
    expect(screen.getByAltText('Stratton base camera')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/H-_sGi4Sbtk/hqdefault.jpg',
    );
    fireEvent.error(screen.getByAltText('Stratton base camera'));
    expect(screen.queryByAltText('Stratton base camera')).toBeNull();
    expect(screen.getByText('Camera image unavailable')).toBeInTheDocument();
    // Still playable without a preview
    expect(screen.getByRole('button', { name: 'Play Stratton live camera' })).toBeInTheDocument();
  });

  it('shows the latest HDRelay still with a link to the live view, never a player', () => {
    const { container } = render(<SkiWebcam resortId="jay-peak" resortName="Jay Peak" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByAltText('Jay Peak base camera').getAttribute('src')).toMatch(
      /^https:\/\/b10\.hdrelay\.com\/camera\/[\w-]+\/snapshot\?t=\d+$/,
    );
    expect(screen.getByText(/Latest still · Tramside/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Live view at Jay Peak ↗' });
    expect(link).toHaveAttribute('href', 'https://jaypeakresort.com/resort/photo-day');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the Killington panorama as a tile that opens the Roundshot viewer', () => {
    render(<SkiWebcam resortId="killington" resortName="Killington" />);
    expect(screen.getByText('360° panorama')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play Killington live camera' }));
    expect(screen.getByTitle('Killington — K-1 Lodge panorama (live)')).toHaveAttribute(
      'src',
      'https://killington.roundshot.com/baselodge/',
    );
  });

  it('links to the resort when there is no embeddable camera, and is empty for unknown resorts', () => {
    render(<SkiWebcam resortId="burke-mountain" resortName="Burke Mountain" />);
    expect(screen.getByRole('link', { name: 'Webcams at Burke Mountain ↗' })).toHaveAttribute(
      'href',
      'https://skiburke.com/the-mountain/webcams',
    );
    const { container } = render(<SkiWebcam resortId="cochrans-ski-area" resortName="Cochran's" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sits in the ski panel', () => {
    render(<SkiDetail resort={makeSkiResort({ id: 'stowe', name: 'Stowe' })} isDark={false} />);
    expect(screen.getByRole('button', { name: 'Play Stowe live camera' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stowe cams ↗' })).toHaveAttribute(
      'href',
      'https://www.stowe.com/explore/webcams/',
    );
  });
});

describe('ski webcam sources', () => {
  it('builds each provider’s preview and player URLs', () => {
    const now = Date.UTC(2026, 10, 17, 15, 7);
    const stowe = SKI_WEBCAMS.stowe!.camera!;
    expect(webcamPreview(stowe, now)).toBe(
      `https://player.brownrice.com/snapshot/stowevillage2?t=${snapshotStamp(now)}`,
    );
    expect(webcamEmbed(stowe)).toBe('https://player.brownrice.com/embed/stowevillage2');
    expect(webcamEmbed(SKI_WEBCAMS['pico-mountain']!.camera!)).toBeNull();
    expect(snapshotStamp(now)).toBe(snapshotStamp(now + 60_000)); // same 10-minute window
  });

  it('only uses the resorts’ own sources and https links', () => {
    for (const [id, { page, camera }] of Object.entries(SKI_WEBCAMS)) {
      expect(page, id).toMatch(/^https:\/\//);
      if (!camera) continue;
      expect(camera.page, id).toMatch(/^https:\/\//);
      const urls = [webcamPreview(camera), webcamEmbed(camera)].filter(Boolean).join(' ');
      expect(urls, id).not.toMatch(/snowstash|onthesnow|ots-webcams|opensnow/);
    }
  });
});
