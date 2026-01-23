/**
 * Scheduled data collection using node-cron.
 * Runs collectors at configured intervals.
 */

import cron, { type ScheduledTask } from 'node-cron';
import {
  withRetry,
  collectWeatherObservations,
  collectWeatherAlerts,
  collectTrafficIncidents,
  collectRiverGauges,
} from '../collectors/index.js';
import { isDatabaseEnabled } from '../db/index.js';
import { getEnv, isDev } from '../types/env.js';

// Track scheduled tasks for graceful shutdown
const scheduledTasks: ScheduledTask[] = [];

// Track last run times and results
interface CollectorStatus {
  lastRun: Date | null;
  lastResult: number | null;
  lastError: string | null;
  nextRun: Date | null;
}

const collectorStatus: Record<string, CollectorStatus> = {
  weather: { lastRun: null, lastResult: null, lastError: null, nextRun: null },
  alerts: { lastRun: null, lastResult: null, lastError: null, nextRun: null },
  traffic: { lastRun: null, lastResult: null, lastError: null, nextRun: null },
  gauges: { lastRun: null, lastResult: null, lastError: null, nextRun: null },
};

/**
 * Get current collector status for health checks.
 */
export function getCollectorStatus(): {
  enabled: boolean;
  collectors: Record<string, CollectorStatus>;
} {
  const env = getEnv();
  return {
    enabled: env.ENABLE_COLLECTOR && isDatabaseEnabled(),
    collectors: collectorStatus,
  };
}

/**
 * Create a scheduled collector job.
 */
function scheduleCollector(
  name: string,
  schedule: string,
  collector: () => Promise<number>
): ScheduledTask {
  const task = cron.schedule(schedule, async () => {
    const status = collectorStatus[name];
    if (!status) return;

    try {
      const result = await withRetry(collector, name);
      status.lastRun = new Date();
      status.lastResult = result;
      status.lastError = null;

      if (isDev()) {
        console.log(`[Scheduler] ${name}: collected ${result ?? 0} records`);
      }
    } catch (error) {
      status.lastRun = new Date();
      status.lastError = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[Scheduler] ${name} failed:`, status.lastError);
    }
  });

  // Calculate next run time
  const status = collectorStatus[name];
  if (status) {
    status.nextRun = getNextRunTime(schedule);
  }

  return task;
}

/**
 * Start the scheduler with all collectors.
 * Returns false if collector is disabled or database not configured.
 */
export function startScheduler(): boolean {
  const env = getEnv();

  if (!env.ENABLE_COLLECTOR) {
    if (isDev()) {
      console.log('[Scheduler] Collector disabled via ENABLE_COLLECTOR=false');
    }
    return false;
  }

  if (!isDatabaseEnabled()) {
    if (isDev()) {
      console.log('[Scheduler] Database not configured, scheduler disabled');
    }
    return false;
  }

  console.log('[Scheduler] Starting data collection scheduler...');

  // Schedule collectors at different intervals
  // Weather observations: every 5 minutes
  scheduledTasks.push(
    scheduleCollector('weather', '*/5 * * * *', collectWeatherObservations)
  );

  // Weather alerts: every 2 minutes (more frequent for time-sensitive data)
  scheduledTasks.push(
    scheduleCollector('alerts', '*/2 * * * *', collectWeatherAlerts)
  );

  // Traffic incidents: every 3 minutes
  scheduledTasks.push(
    scheduleCollector('traffic', '*/3 * * * *', collectTrafficIncidents)
  );

  // River gauges: every 10 minutes (USGS updates less frequently)
  scheduledTasks.push(
    scheduleCollector('gauges', '*/10 * * * *', collectRiverGauges)
  );

  console.log('[Scheduler] Scheduled jobs:');
  console.log('  - Weather observations: every 5 minutes');
  console.log('  - Weather alerts: every 2 minutes');
  console.log('  - Traffic incidents: every 3 minutes');
  console.log('  - River gauges: every 10 minutes');

  // Run initial collection after a short delay
  setTimeout(async () => {
    console.log('[Scheduler] Running initial data collection...');
    await runImmediateCollection();
  }, 5000);

  return true;
}

/**
 * Run all collectors immediately (for initial data load).
 */
async function runImmediateCollection(): Promise<void> {
  const collectors = [
    { name: 'weather', fn: collectWeatherObservations },
    { name: 'alerts', fn: collectWeatherAlerts },
    { name: 'traffic', fn: collectTrafficIncidents },
    { name: 'gauges', fn: collectRiverGauges },
  ];

  for (const { name, fn } of collectors) {
    const status = collectorStatus[name];
    if (!status) continue;

    try {
      const result = await withRetry(fn, name);
      status.lastRun = new Date();
      status.lastResult = result;
      status.lastError = null;

      if (isDev()) {
        console.log(`[Scheduler] Initial ${name}: collected ${result ?? 0} records`);
      }
    } catch (error) {
      status.lastRun = new Date();
      status.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Scheduler] Initial ${name} failed:`, status.lastError);
    }
  }
}

/**
 * Stop the scheduler gracefully.
 */
export function stopScheduler(): void {
  console.log('[Scheduler] Stopping scheduler...');

  for (const task of scheduledTasks) {
    task.stop();
  }

  scheduledTasks.length = 0;
  console.log('[Scheduler] Scheduler stopped');
}

/**
 * Calculate next run time from cron expression.
 * Simple implementation - returns approximate next run.
 */
function getNextRunTime(schedule: string): Date {
  // Parse simple cron patterns like "*/5 * * * *"
  const parts = schedule.split(' ');
  const minutePart = parts[0] || '*';

  const now = new Date();
  const nextRun = new Date(now);

  if (minutePart.startsWith('*/')) {
    const interval = parseInt(minutePart.slice(2), 10);
    const currentMinute = now.getMinutes();
    const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;

    if (nextMinute >= 60) {
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(nextMinute - 60);
    } else {
      nextRun.setMinutes(nextMinute);
    }
  }

  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);

  return nextRun;
}
