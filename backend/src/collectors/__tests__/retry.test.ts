import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  weather: vi.fn<() => Promise<number>>(),
  alerts: vi.fn<() => Promise<number>>(),
  traffic: vi.fn<() => Promise<number>>(),
  gauges: vi.fn<() => Promise<number>>(),
}));
vi.mock('../weather.js', () => ({ collectWeatherObservations: mocks.weather }));
vi.mock('../alerts.js', () => ({ collectWeatherAlerts: mocks.alerts }));
vi.mock('../traffic.js', () => ({ collectTrafficIncidents: mocks.traffic }));
vi.mock('../gauges.js', () => ({ collectRiverGauges: mocks.gauges }));

const { withRetry, runAllCollectors } = await import('../index.js');

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  for (const fn of Object.values(mocks)) fn.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('withRetry', () => {
  it('returns the first successful result without waiting', async () => {
    const fn = vi.fn().mockResolvedValue(7);
    await expect(withRetry(fn, 'test')).resolves.toBe(7);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries with exponential backoff (1s, 2s) and returns a later success', async () => {
    const fn = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValue(3);

    const result = withRetry(fn, 'test');
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);

    await expect(result).resolves.toBe(3);
  });

  it('rethrows the last error after all attempts fail (FINDINGS H2)', async () => {
    const fn = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValueOnce(new Error('third'));

    const result = withRetry(fn, 'test');
    const assertion = expect(result).rejects.toThrow('third');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledWith('[Collector:test] All 3 attempts failed: third');
  });

  it('honours custom maxRetries and baseDelay', async () => {
    const fn = vi.fn<() => Promise<number>>().mockRejectedValue(new Error('nope'));

    const result = withRetry(fn, 'test', 2, 10);
    const assertion = expect(result).rejects.toThrow('nope');
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('never resolves to null when no attempt is allowed', async () => {
    const fn = vi.fn<() => Promise<number>>();
    await expect(withRetry(fn, 'test', 0)).rejects.toThrow('maxRetries must be >= 1');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('runAllCollectors', () => {
  it('collects counts from every collector', async () => {
    mocks.weather.mockResolvedValue(10);
    mocks.alerts.mockResolvedValue(2);
    mocks.traffic.mockResolvedValue(5);
    mocks.gauges.mockResolvedValue(30);

    const result = await runAllCollectors();

    expect(result).toEqual({
      weather: 10,
      alerts: 2,
      traffic: 5,
      gauges: 30,
      timestamp: expect.any(Date) as Date,
      errors: [],
    });
  });

  it('isolates failures: one exhausted collector does not affect the others', async () => {
    mocks.weather.mockResolvedValue(10);
    mocks.alerts.mockRejectedValue(new Error('NOAA 503'));
    mocks.traffic.mockRejectedValueOnce(new Error('blip')).mockResolvedValue(4);
    mocks.gauges.mockResolvedValue(1);

    const pending = runAllCollectors();
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(mocks.alerts).toHaveBeenCalledTimes(3);
    expect(mocks.traffic).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      weather: 10,
      alerts: null,
      traffic: 4,
      gauges: 1,
      errors: ['Alerts: NOAA 503'],
    });
  });

  it('reports non-Error rejections as "Unknown error"', async () => {
    mocks.weather.mockRejectedValue('string failure');
    mocks.alerts.mockResolvedValue(0);
    mocks.traffic.mockResolvedValue(0);
    mocks.gauges.mockResolvedValue(0);

    const pending = runAllCollectors();
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.weather).toBeNull();
    expect(result.errors).toEqual(['Weather: Unknown error']);
  });
});
