/**
 * Minimal in-memory stand-in for the Drizzle query builder used by collectors and
 * resolvers. It records every query (table, WHERE rendered to SQL, set/values,
 * limit) and resolves selects from a FIFO queue. Not a test file.
 */
import { getTableName, type SQL, type Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { getDb } from '../index.js';

export type QueryOp = 'select' | 'update' | 'insert';

export interface RecordedQuery {
  op: QueryOp;
  table: string | null;
  fields: string[] | null;
  set: Record<string, unknown> | null;
  values: unknown[] | null;
  where: { sql: string; params: unknown[] } | null;
  orderBy: string[];
  limit: number | null;
  onConflictDoNothing: boolean;
}

export type DrizzleDb = NonNullable<ReturnType<typeof getDb>>;

export interface FakeDb {
  /** Pass to `getDb` mocks. */
  db: DrizzleDb;
  queries: RecordedQuery[];
  /** Rows returned by the next awaited select (FIFO). Unqueued selects return []. */
  queueSelect(rows: unknown[]): void;
  /** Make the next awaited query with this op reject. */
  failNext(op: QueryOp, error: Error): void;
  ofType(op: QueryOp): RecordedQuery[];
}

const dialect = new PgDialect();

function render(sql: SQL | undefined): { sql: string; params: unknown[] } | null {
  if (!sql) return null;
  const query = dialect.sqlToQuery(sql);
  return { sql: query.sql, params: query.params };
}

export function createFakeDb(): FakeDb {
  const queries: RecordedQuery[] = [];
  const selectQueue: unknown[][] = [];
  const failures: Array<{ op: QueryOp; error: Error }> = [];

  function chain(op: QueryOp, fields?: Record<string, unknown>): unknown {
    const query: RecordedQuery = {
      op,
      table: null,
      fields: fields ? Object.keys(fields) : null,
      set: null,
      values: null,
      where: null,
      orderBy: [],
      limit: null,
      onConflictDoNothing: false,
    };
    queries.push(query);

    const settle = (): Promise<unknown[]> => {
      const failureIndex = failures.findIndex((f) => f.op === op);
      if (failureIndex >= 0) {
        const [failure] = failures.splice(failureIndex, 1);
        return Promise.reject(failure?.error ?? new Error('fake failure'));
      }
      return Promise.resolve(op === 'select' ? (selectQueue.shift() ?? []) : []);
    };

    const builder = {
      from(table: Table) {
        query.table = getTableName(table);
        return builder;
      },
      where(condition: SQL | undefined) {
        query.where = render(condition);
        return builder;
      },
      orderBy(...columns: SQL[]) {
        query.orderBy = columns.map((c) => render(c)?.sql ?? '');
        return builder;
      },
      limit(n: number) {
        query.limit = n;
        return builder;
      },
      set(values: Record<string, unknown>) {
        query.set = values;
        return builder;
      },
      values(rows: unknown[]) {
        query.values = rows;
        return builder;
      },
      onConflictDoNothing() {
        query.onConflictDoNothing = true;
        return builder;
      },
      then<R1, R2 = never>(
        onFulfilled?: (rows: unknown[]) => R1 | PromiseLike<R1>,
        onRejected?: (reason: unknown) => R2 | PromiseLike<R2>,
      ): Promise<R1 | R2> {
        return settle().then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const db = {
    select: (fields?: Record<string, unknown>) => chain('select', fields),
    update: (table: Table) => {
      const b = chain('update') as { from(t: Table): unknown };
      return b.from(table);
    },
    insert: (table: Table) => {
      const b = chain('insert') as { from(t: Table): unknown };
      return b.from(table);
    },
  };

  return {
    db: db as unknown as DrizzleDb,
    queries,
    queueSelect: (rows) => {
      selectQueue.push(rows);
    },
    failNext: (op, error) => {
      failures.push({ op, error });
    },
    ofType: (op) => queries.filter((q) => q.op === op),
  };
}
