import { neon } from '@neondatabase/serverless';

let sqlClient;
let ready;

export function sql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

// Creates the table on first use, so there is no separate migration step.
export async function ensureSchema() {
  if (!ready) {
    const db = sql();
    ready = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS submissions (
          id              BIGSERIAL PRIMARY KEY,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
          kind            TEXT NOT NULL CHECK (kind IN ('single', 'bulk')),
          category        TEXT NOT NULL,
          name            TEXT NOT NULL,
          email           TEXT NOT NULL,
          items           TEXT NOT NULL,
          weight_lbs      NUMERIC(8,2),
          card_count      INTEGER,
          payout_method   TEXT,
          photos          JSONB NOT NULL DEFAULT '[]'::jsonb,
          partner_consent BOOLEAN NOT NULL DEFAULT false,
          status          TEXT NOT NULL DEFAULT 'new',
          offer_amount    NUMERIC(10,2),
          notes           TEXT NOT NULL DEFAULT '',
          partner_name    TEXT NOT NULL DEFAULT '',
          ip              TEXT,
          user_agent      TEXT
        )`;
      await db`CREATE INDEX IF NOT EXISTS submissions_created_idx ON submissions (created_at DESC)`;
      await db`CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status)`;
    })().catch((err) => {
      ready = undefined;
      throw err;
    });
  }
  return ready;
}
