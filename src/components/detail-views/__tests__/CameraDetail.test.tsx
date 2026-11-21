import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import CameraDetail from '../CameraDetail';
import { fetchCameraImage, type TrafficCamera } from '../../../services/cameraApi';
import type { RoadWeatherStation } from '../../../services/roadWeatherApi';
import { useCameraLocation, useSiteRoadWeather } from '../../../hooks/useCameraSite';

vi.mock('../../../services/cameraApi', () => ({ fetchCameraImage: vi.fn() }));
vi.mock('../../../hooks/useCameraSite', () => ({
  useCameraLocation: vi.fn(),
  useSiteRoadWeather: vi.fn(),
}));
const imageMock = vi.mocked(fetchCameraImage);
const locationMock = vi.mocked(useCameraLocation);
const siteWeatherMock = vi.mocked(useSiteRoadWeather);

const LOCATION = {
  town: 'Berlin',
  county: 'Washington',
  milepost: 50.1,
  nearestExit: { number: '7', name: 'Berlin–Barre', distanceMi: 0.2, direction: 'south' },
  streetName: null,
  addressBlock: null,
  speedLimitMph: 65,
};

const STATION: RoadWeatherStation = {
  id: 'BERLIN RWIS',
  name: 'I-89 Berlin',
  lat: 44.2121,
  lng: -72.5832,
  roadway: 'I-89',
  direction: 'South',
  location: null,
  surface: 'Dry',
  pavementTempC: -0.5,
  airTempC: -2,
  dewPointC: -6,
  friction: 0.8,
  precip: null,
  observedAt: '2026-10-24T18:15:00Z',
};

const CAM: TrafficCamera = {
  id: 'I-89 SB BERLIN',
  name: 'I-89 SB Berlin',
  lat: 44.21,
  lng: -72.58,
  roadway: 'I-89',
  direction: 'South',
  online: true,
};

describe('CameraDetail', () => {
  let revokeSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-24T18:22:00Z'));
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    locationMock.mockReturnValue({ data: undefined } as ReturnType<typeof useCameraLocation>);
    siteWeatherMock.mockReturnValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    imageMock.mockReset();
  });

  it('shows the image, road and how old it is', async () => {
    imageMock.mockResolvedValue({ url: 'blob:1', takenAt: new Date('2026-10-24T18:19:36Z') });
    render(<CameraDetail camera={CAM} isDark={false} />);
    expect(await screen.findByAltText('Latest view from I-89 SB Berlin')).toHaveAttribute(
      'src',
      'blob:1',
    );
    expect(screen.getByText('I-89 · Southbound')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Image 2 min ago \(as of /);
  });

  it('says when a camera has no current image', async () => {
    imageMock.mockResolvedValue(null);
    render(<CameraDetail camera={CAM} isDark={false} />);
    expect(await screen.findByText('This camera has no current image.')).toBeInTheDocument();
  });

  it('refreshes every minute and keeps the last picture if a refresh fails', async () => {
    imageMock.mockResolvedValueOnce({ url: 'blob:1', takenAt: new Date('2026-10-24T18:21:00Z') });
    render(<CameraDetail camera={CAM} isDark={false} />);
    await screen.findByAltText('Latest view from I-89 SB Berlin');

    imageMock.mockRejectedValueOnce(new Error('down'));
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(imageMock).toHaveBeenCalledTimes(2);
    expect(screen.getByAltText('Latest view from I-89 SB Berlin')).toHaveAttribute('src', 'blob:1');

    imageMock.mockResolvedValueOnce({ url: 'blob:2', takenAt: new Date('2026-10-24T18:22:00Z') });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(await screen.findByAltText('Latest view from I-89 SB Berlin')).toHaveAttribute(
      'src',
      'blob:2',
    );
    expect(revokeSpy).toHaveBeenCalledWith('blob:1');
  });

  it('shows where the camera is, with a map link (VTL-94)', async () => {
    imageMock.mockResolvedValue(null);
    locationMock.mockReturnValue({ data: LOCATION } as ReturnType<typeof useCameraLocation>);
    render(<CameraDetail camera={CAM} isDark={false} />);
    await screen.findByText('This camera has no current image.');

    const location = screen.getByRole('region', { name: 'Camera location' });
    const rows = within(location)
      .getAllByRole('term')
      .map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`);
    expect(rows).toEqual([
      'Mile marker: Mile 50.1',
      'Nearest exit: About 0.2 mi south of Exit 7 (Berlin–Barre)',
      'Town: Berlin, Washington County',
      'Speed limit: 65 mph',
      'Coordinates: 44.2100, -72.5800',
    ]);
    const link = within(location).getByRole('link', { name: 'Open in Maps ↗' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=44.21,-72.58',
    );
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('region', { name: 'Road weather at this camera' })).toBeNull();
  });

  it('still shows coordinates while the location loads or if it fails', async () => {
    imageMock.mockResolvedValue(null);
    render(<CameraDetail camera={CAM} isDark={false} />);
    await screen.findByText('This camera has no current image.');
    const location = screen.getByRole('region', { name: 'Camera location' });
    expect(
      within(location)
        .getAllByRole('term')
        .map((dt) => dt.textContent),
    ).toEqual(['Coordinates']);
  });

  it('shows the road weather station on the same site', async () => {
    imageMock.mockResolvedValue(null);
    siteWeatherMock.mockReturnValue(STATION);
    render(<CameraDetail camera={CAM} isDark={false} />);
    await screen.findByText('This camera has no current image.');

    const weather = screen.getByRole('region', { name: 'Road weather at this camera' });
    expect(within(weather).getByText('Surface').nextElementSibling).toHaveTextContent('Dry');
    expect(within(weather).getByText('Pavement').nextElementSibling).toHaveTextContent('31°F');
    expect(within(weather).getByText('Air').nextElementSibling).toHaveTextContent('28°F');
    expect(within(weather).getByText(/^Reading 7 min ago · I-89 Berlin$/)).toBeInTheDocument();
    expect(screen.getByText(/and road weather station$/)).toBeInTheDocument();
  });
});
