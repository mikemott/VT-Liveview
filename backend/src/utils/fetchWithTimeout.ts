/**
 * Fetch with timeout utility
 * Prevents hanging requests from exhausting the event loop
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Fetch with automatic timeout via AbortSignal
 * @param url - URL to fetch
 * @param init - Fetch options (merged with abort signal)
 * @param timeoutMs - Timeout in milliseconds (default: 15s)
 * @returns Fetch response
 */
export async function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });
  return response;
}
