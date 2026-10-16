import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeTask {
  expression: string;
  fire: () => void;
  stop: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({
  tasks: [] as FakeTask[],
  isDatabaseEnabled: vi.fn<() => boolean>(),
  weather: vi.fn<() => Promise<number>>(),
  alerts: vi.fn<() => Promise<number>>(),
  traffic: vi.fn<() => Promise<number>>(),
  gauges: vi.fn<() => Promise<number>>(),
}));

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((expression: string, fire: () => void) => {
      const task = { expression, fire, stop: vi.fn() };
      mocks.tasks.push(task);
      return task;
    }),
  },
}));
vi.mock('../../db/index.js', () => ({ isDatabaseEnabled: mocks.isDatabaseEnabled }));
vi.mock('../../collectors/weather.js', () => ({ collectWeatherObservations: mocks.weather }));
vi.mock('../../collectors/alerts.js', () => ({ collectWeatherAlerts: mocks.alerts }));
vi.mock('../../collectors/traffic.js', () => ({ collectTrafficIncidents: mocks.traffic }));
vi.mock('../../collectors/gauges.js', () => ({ collectRiverGauges: mocks.gauges }));

type SchedulerModule = typeof import('../index.js');

/** Fresh module so collector status and the env cache don't leak between tests. */
async function loadScheduler(env: Record<string, string> = {}): Promise<SchedulerModule> {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  return import('../index.js');
}

function task(expression: string): FakeTask {
  const found = mocks.tasks.find((t) => t.expression === expression);
  if (!found) throw new Error(`no cron task for ${expression}`);
  return found;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 16, 10, 58, 30));
  mocks.tasks.length = 0;
  mocks.isDatabaseEnabled.mockReset().mockReturnValue(true);
  for (const fn of [mocks.weather, mocks.alerts, mocks.traffic, mocks.gauges]) {
    fn.mockReset().mockResolvedValue(1);
  }
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('startScheduler', () => {
  it('does nothing when ENABLE_COLLECTOR is not "true"', async () => {
    const scheduler = await loadScheduler({ ENABLE_COLLECTOR: 'false' });

    expect(scheduler.startScheduler()).toBe(false);
    expect(mocks.tasks).toHaveLength(0);
    expect(scheduler.getCollectorStatus().enabled).toBe(false);
  });

  it('does nothing when the database is not configured', async () => {
    mocks.isDatabaseEnabled.mockReturnValue(false);
    const scheduler = await loadScheduler();

    expect(scheduler.startScheduler()).toBe(false);
    expect(mocks.tasks).toHaveLength(0);
    expect(scheduler.getCollectorStatus().enabled).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.weather).not.toHaveBeenCalled();
  });

  it('registers one cron job per collector and computes the next run', async () => {
    const scheduler = await loadScheduler();

    expect(scheduler.startScheduler()).toBe(true);
    expect(mocks.tasks.map((t) => t.expression)).toEqual([
      '*/5 * * * *',
      '*/2 * * * *',
      '*/3 * * * *',
      '*/10 * * * *',
    ]);

    const { enabled, collectors } = scheduler.getCollectorStatus();
    expect(enabled).toBe(true);
    // 10:58:30 local -> next */5 and */10 slot is 11:00, */2 is 11:00, */3 is 11:00 (60 % 3 == 0)
    expect(collectors.weather?.nextRun).toEqual(new Date(2026, 9, 16, 11, 0, 0));
    expect(collectors.alerts?.nextRun).toEqual(new Date(2026, 9, 16, 11, 0, 0));
    expect(collectors.traffic?.nextRun).toEqual(new Date(2026, 9, 16, 11, 0, 0));
    expect(collectors.gauges?.nextRun).toEqual(new Date(2026, 9, 16, 11, 0, 0));
    expect(collectors.weather).toMatchObject({ lastRun: null, lastResult: null, lastError: null });
  });

  it('computes next run within the hour', async () => {
    vi.setSystemTime(new Date(2026, 9, 16, 10, 3, 10));
    const scheduler = await loadScheduler();
    scheduler.startScheduler();

    const { collectors } = scheduler.getCollectorStatus();
    expect(collectors.alerts?.nextRun).toEqual(new Date(2026, 9, 16, 10, 4, 0));
    expect(collectors.traffic?.nextRun).toEqual(new Date(2026, 9, 16, 10, 6, 0));
    expect(collectors.weather?.nextRun).toEqual(new Date(2026, 9, 16, 10, 5, 0));
    expect(collectors.gauges?.nextRun).toEqual(new Date(2026, 9, 16, 10, 10, 0));
  });
});

describe('cron ticks', () => {
  it('records the result of a successful run', async () => {
    const scheduler = await loadScheduler();
    scheduler.startScheduler();
    mocks.weather.mockResolvedValue(42);

    vi.setSystemTime(new Date(2026, 9, 16, 11, 0, 5));
    task('*/5 * * * *').fire();
    await vi.advanceTimersByTimeAsync(0);

    expect(scheduler.getCollectorStatus().collectors.weather).toEqual({
      lastRun: new Date(2026, 9, 16, 11, 0, 5),
      lastResult: 42,
      lastError: null,
      nextRun: new Date(2026, 9, 16, 11, 5, 0),
    });
  });

  it('records lastError once all retries fail (FINDINGS H2)', async () => {
    const scheduler = await loadScheduler();
    scheduler.startScheduler();
    mocks.alerts.mockRejectedValue(new Error('NOAA 503'));

    task('*/2 * * * *').fire();
    await vi.advanceTimersByTimeAsync(3_000); // 1s + 2s backoff

    expect(mocks.alerts).toHaveBeenCalledTimes(3);
    const status = scheduler.getCollectorStatus().collectors.alerts;
    expect(status?.lastError).toBe('NOAA 503');
    expect(status?.lastRun).toBeInstanceOf(Date);
    expect(console.error).toHaveBeenCalledWith('[Scheduler] alerts failed:', 'NOAA 503');
  });

  it('clears lastError after a later success', async () => {
    const scheduler = await loadScheduler();
    scheduler.startScheduler();
    mocks.traffic.mockRejectedValueOnce(new Error('a'));
    mocks.traffic.mockRejectedValueOnce(new Error('b'));
    mocks.traffic.mockRejectedValueOnce(new Error('c'));

    task('*/3 * * * *').fire();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(scheduler.getCollectorStatus().collectors.traffic?.lastError).toBe('c');

    mocks.traffic.mockResolvedValue(9);
    task('*/3 * * * *').fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.getCollectorStatus().collectors.traffic).toMatchObject({
      lastResult: 9,
      lastError: null,
    });
  });

  it('records "Unknown error" for non-Error rejections', async () => {
    const scheduler = await loadScheduler();
    scheduler.startScheduler();
    mocks.gauges.mockRejectedValue('boom');

    task('*/10 * * * *').fire();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(scheduler.getCollectorStatus().collectors.gauges?.lastError).toBe('Unknown error');
  });

  it.todo(
    'skips a tick while the previous run of the same collector is still in flight (FINDINGS H5)',
  );
});

describe('initial collection', () => {
  it('runs every collector once, 5s after start, and records status', async () => {
    const scheduler = await loadScheduler();
    scheduler.startScheduler();
    mocks.weather.mockResolvedValue(10);
    mocks.alerts.mockRejectedValue(new Error('alerts down'));
    mocks.gauges.mockResolvedValue(3);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(mocks.weather).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(3_000); // alerts retries

    for (const fn of [mocks.weather, mocks.traffic, mocks.gauges]) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
    expect(mocks.alerts).toHaveBeenCalledTimes(3);

    const { collectors } = scheduler.getCollectorStatus();
    expect(collectors.weather).toMatchObject({ lastResult: 10, lastError: null });
    expect(collectors.alerts).toMatchObject({ lastError: 'alerts down' });
    expect(collectors.alerts?.lastRun).toBeInstanceOf(Date);
    expect(collectors.traffic).toMatchObject({ lastResult: 1, lastError: null });
    expect(collectors.gauges).toMatchObject({ lastResult: 3, lastError: null });
  });

  it('is cancelled by stopScheduler before it fires', async () => {
    const scheduler = await loadScheduler();
    scheduler.startScheduler();
    scheduler.stopScheduler();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.weather).not.toHaveBeenCalled();
  });
});

describe('stopScheduler', () => {
  it('stops every task once and can be called again safely', async () => {
    const scheduler = await loadScheduler();
    scheduler.startScheduler();
    const tasks = [...mocks.tasks];

    scheduler.stopScheduler();
    scheduler.stopScheduler();

    for (const t of tasks) expect(t.stop).toHaveBeenCalledTimes(1);
  });

  it('allows a restart that registers fresh tasks', async () => {
    const scheduler = await loadScheduler();
    scheduler.startScheduler();
    scheduler.stopScheduler();
    scheduler.startScheduler();

    expect(mocks.tasks).toHaveLength(8);
    scheduler.stopScheduler();
    for (const t of mocks.tasks.slice(4)) expect(t.stop).toHaveBeenCalledTimes(1);
  });
});
