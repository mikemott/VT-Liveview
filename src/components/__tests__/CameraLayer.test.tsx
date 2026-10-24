import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CameraLayer from '../CameraLayer';
import { fetchCameras, type TrafficCamera } from '../../services/cameraApi';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/cameraApi', () => ({ fetchCameras: vi.fn() }));
const fetchMock = vi.mocked(fetchCameras);

const CAMS: TrafficCamera[] = [
  {
    id: 'I-89 SB BERLIN',
    name: 'I-89 SB Berlin',
    lat: 44.21,
    lng: -72.58,
    roadway: 'I-89',
    direction: 'South',
    online: true,
  },
  {
    id: 'VT-108',
    name: 'VT-108 Notch',
    lat: 44.56,
    lng: -72.79,
    roadway: 'VT-108',
    direction: 'North',
    online: false,
  },
];

describe('CameraLayer', () => {
  let fake: FakeMap;
  beforeEach(() => {
    fake = new FakeMap();
    fetchMock.mockResolvedValue(CAMS);
  });
  afterEach(() => {
    resetMaplibreMock();
    vi.clearAllMocks();
  });

  it('loads cameras even while hidden (for search and shared links), without markers', async () => {
    const onLoaded = vi.fn();
    render(
      <CameraLayer
        map={fake.asMap()}
        visible={false}
        onCameraClick={vi.fn()}
        onCamerasLoaded={onLoaded}
      />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(CAMS));
    expect(liveMarkers()).toHaveLength(0);
  });

  it('adds accessible markers when visible and reports clicks and Enter', async () => {
    const onClick = vi.fn();
    render(<CameraLayer map={fake.asMap()} visible onCameraClick={onClick} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const [online, offline] = liveMarkers().map((m) => m.getElement());
    expect(online!.getAttribute('aria-label')).toBe('Traffic camera: I-89 SB Berlin');
    expect(offline!.classList.contains('offline')).toBe(true);
    expect(offline!.getAttribute('aria-label')).toBe('Traffic camera: VT-108 Notch (offline)');

    online!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    offline!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onClick.mock.calls.map(([c]) => (c as TrafficCamera).id)).toEqual([
      'I-89 SB BERLIN',
      'VT-108',
    ]);
  });

  it('removes markers when hidden', async () => {
    const { rerender } = render(<CameraLayer map={fake.asMap()} visible onCameraClick={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    rerender(<CameraLayer map={fake.asMap()} visible={false} onCameraClick={vi.fn()} />);
    expect(liveMarkers()).toHaveLength(0);
  });
});
