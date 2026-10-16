/**
 * Helpers for reading the synthetic upstream fixtures in this directory.
 * See README.md for the upstream URL each fixture stands in for.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));

/** Read a fixture file as text, path relative to src/__fixtures__/. */
export function loadText(relPath: string): string {
  return readFileSync(join(FIXTURE_DIR, relPath), 'utf8');
}

/**
 * Read and parse a JSON fixture. Returns a fresh object on every call, so
 * tests can mutate the result freely.
 */
export function loadJson<T>(relPath: string): T {
  return JSON.parse(loadText(relPath)) as T;
}
