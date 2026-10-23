import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MapUnavailable from '../MapUnavailable';
import { fetchMergedAlerts, type MergedAlertData } from '../../services/graphqlClient';
import { fetchAllIncidents, type TravelIncident } from '../../services/travelApi';
import { createQueryWrapper } from '../../test/helpers/queryWrapper';

vi.mock('../CurrentWeather', () => ({ default: () => <div>current weather</div> }));
vi.mock('../../services/graphqlClient', () => ({ fetchMergedAlerts: vi.fn() }));
vi.mock('../../services/travelApi', () => ({ fetchAllIncidents: vi.fn() }));

const alertsMock = vi.mocked(fetchMergedAlerts);
const incidentsMock = vi.mocked(fetchAllIncidents);

const ALERT = {
  id: 'a1',
  event: 'Winter Storm Warning',
  headline: 'Heavy snow expected',
  severity: 'Severe',
  areaDesc: 'Lamoille',
} as MergedAlertData;

const CLOSURE = {
  id: 'i1',
  type: 'CLOSURE',
  title: 'Road closed',
  description: 'VT-108 closed through Smugglers Notch',
  roadName: 'VT-108',
} as TravelIncident;

describe('MapUnavailable', () => {
  afterEach(() => vi.clearAllMocks());

  it('explains the problem and lists alerts and incidents', async () => {
    alertsMock.mockResolvedValue([ALERT]);
    incidentsMock.mockResolvedValue([CLOSURE]);
    const { wrapper } = createQueryWrapper();

    render(<MapUnavailable reason="WebGL is not available" />, { wrapper });

    expect(
      screen.getByRole('heading', { name: "The map can't load in this browser" }),
    ).toBeInTheDocument();
    expect(screen.getByText('current weather')).toBeInTheDocument();
    expect(await screen.findByText('Winter Storm Warning')).toBeInTheDocument();
    expect(await screen.findByText('VT-108 closed through Smugglers Notch')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Road closures (1)' })).toBeInTheDocument();
  });

  it('shows empty states when nothing is active', async () => {
    alertsMock.mockResolvedValue([]);
    incidentsMock.mockResolvedValue([]);
    const { wrapper } = createQueryWrapper();

    render(<MapUnavailable />, { wrapper });

    expect(await screen.findByText('No active weather alerts for Vermont.')).toBeInTheDocument();
    expect(await screen.findByText('No travel incidents reported.')).toBeInTheDocument();
  });

  it('shows an error message when a source fails', async () => {
    alertsMock.mockRejectedValue(new Error('down'));
    incidentsMock.mockRejectedValue(new Error('down'));
    const { wrapper } = createQueryWrapper();

    render(<MapUnavailable />, { wrapper });

    expect(await screen.findByText("Couldn't load alerts right now.")).toBeInTheDocument();
    expect(
      await screen.findByText("Couldn't load travel incidents right now."),
    ).toBeInTheDocument();
  });
});
