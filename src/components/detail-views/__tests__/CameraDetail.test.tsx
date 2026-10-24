import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import CameraDetail from '../CameraDetail';
import { fetchCameraImage, type TrafficCamera } from '../../../services/cameraApi';

vi.mock('../../../services/cameraApi', () => ({ fetchCameraImage: vi.fn() }));
const imageMock = vi.mocked(fetchCameraImage);

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
});
