/**
 * Every GraphQL query the frontend sends must be valid against the backend
 * schema. A field the schema doesn't have fails validation and takes the whole
 * request down with it, as the location panel's forecast did (VTL-65).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSchema, parse, validate } from 'graphql';

const ROOT = join(__dirname, '..', '..', '..');
const schema = buildSchema(readFileSync(join(ROOT, 'backend/src/schema.graphql'), 'utf8'));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** gql`…` template literals (none of ours interpolate) */
const queries = sourceFiles(join(ROOT, 'src')).flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/gql`([^`]*)`/g)].map((m) => ({
    file: relative(ROOT, file),
    source: m[1]!,
  })),
);

describe('frontend GraphQL queries match the backend schema', () => {
  it('finds the queries', () => {
    expect(queries.length).toBeGreaterThanOrEqual(5);
  });

  it.each(queries.map((q) => [`${q.file}: ${q.source.trim().split('\n')[0]}`, q.source]))(
    '%s',
    (_name, source) => {
      const errors = validate(schema, parse(source)).map((e) => e.message);
      expect(errors).toEqual([]);
    },
  );
});
