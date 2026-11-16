import { sql, ensureSchema } from './_lib/db.js';
import { json, isAdmin, clean, STATUSES } from './_lib/util.js';

// GET  /api/submissions?status=new&limit=100  → list (admin only)
export async function GET(request) {
  if (!isAdmin(request)) return json({ error: 'Unauthorized' }, 401);
  try {
    await ensureSchema();
    const db = sql();
    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const limit = Math.min(Math.max(Number(params.get('limit')) || 200, 1), 500);
    const rows = status && STATUSES.includes(status)
      ? await db`SELECT * FROM submissions WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit}`
      : await db`SELECT * FROM submissions ORDER BY created_at DESC LIMIT ${limit}`;
    const counts = await db`SELECT status, count(*)::int AS n FROM submissions GROUP BY status`;
    return json({ submissions: rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) });
  } catch (err) {
    console.error('list failed', err);
    return json({ error: 'Could not load submissions.' }, 500);
  }
}

// PATCH /api/submissions  { id, status?, offer_amount?, notes?, partner_name? }  (admin only)
export async function PATCH(request) {
  if (!isAdmin(request)) return json({ error: 'Unauthorized' }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Missing id.' }, 400);

  try {
    await ensureSchema();
    const db = sql();
    const [current] = await db`SELECT * FROM submissions WHERE id = ${id}`;
    if (!current) return json({ error: 'Not found.' }, 404);

    const status = body.status !== undefined ? clean(body.status, 30) : current.status;
    if (!STATUSES.includes(status)) return json({ error: 'Unknown status.' }, 422);
    if (status === 'sent_to_partner' && !current.partner_consent) {
      return json({ error: 'This seller did not agree to partner sharing.' }, 422);
    }
    const offer =
      body.offer_amount === undefined ? current.offer_amount
        : body.offer_amount === '' || body.offer_amount === null ? null
          : Number(body.offer_amount);
    if (offer !== null && offer !== undefined && !(Number(offer) >= 0)) return json({ error: 'Offer must be a number.' }, 422);
    const notes = body.notes !== undefined ? clean(body.notes, 5000) : current.notes;
    const partner = body.partner_name !== undefined ? clean(body.partner_name, 200) : current.partner_name;

    const [row] = await db`
      UPDATE submissions
      SET status = ${status}, offer_amount = ${offer}, notes = ${notes},
          partner_name = ${partner}, updated_at = now()
      WHERE id = ${id}
      RETURNING *`;
    return json({ submission: row });
  } catch (err) {
    console.error('update failed', err);
    return json({ error: 'Could not save changes.' }, 500);
  }
}
