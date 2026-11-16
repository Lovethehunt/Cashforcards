import { sql, ensureSchema } from './_lib/db.js';
import { notifyOwner, confirmSeller } from './_lib/email.js';
import { json, clean, CATEGORIES, PAYOUT_METHODS } from './_lib/util.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_PHOTOS = 40;

function isBlobUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  // Honeypot: real people never fill this hidden field.
  if (clean(body.website)) return json({ ok: true, id: 0 });

  const kind = body.kind === 'bulk' ? 'bulk' : body.kind === 'single' ? 'single' : null;
  const category = clean(body.category, 20);
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const items = clean(body.items, 5000);
  const payout = clean(body.payout_method, 20);
  const photos = Array.isArray(body.photos) ? body.photos.filter(isBlobUrl).slice(0, MAX_PHOTOS) : [];
  const weight = body.weight_lbs === '' || body.weight_lbs == null ? null : Number(body.weight_lbs);
  const count = body.card_count === '' || body.card_count == null ? null : Math.round(Number(body.card_count));

  const errors = [];
  if (!kind) errors.push('Choose single cards or bulk lot.');
  if (!CATEGORIES[category]) errors.push('Choose a card type.');
  if (name.length < 2) errors.push('Enter your name.');
  if (!EMAIL_RE.test(email)) errors.push('Enter a valid email.');
  if (items.length < 3) errors.push('Tell us what you are selling.');
  if (photos.length === 0) errors.push('Add at least one photo.');
  if (payout && !PAYOUT_METHODS.includes(payout)) errors.push('Choose a payout method.');
  if (body.consent !== true) errors.push('Please agree to be contacted about your offer.');
  if (kind === 'bulk' && !(weight > 0 && weight < 10000)) errors.push('Enter the total weight in lbs.');
  if (count !== null && !(count >= 0 && count < 10000000)) errors.push('Card count looks off.');
  if (errors.length) return json({ error: errors.join(' ') }, 422);

  try {
    await ensureSchema();
    const db = sql();
    const ip = clean(request.headers.get('x-forwarded-for')?.split(',')[0], 64) || null;
    const ua = clean(request.headers.get('user-agent'), 300) || null;
    const [row] = await db`
      INSERT INTO submissions
        (kind, category, name, email, items, weight_lbs, card_count, payout_method,
         photos, partner_consent, ip, user_agent)
      VALUES
        (${kind}, ${category}, ${name}, ${email}, ${items},
         ${kind === 'bulk' ? weight : null}, ${kind === 'bulk' ? count : null}, ${payout || null},
         ${JSON.stringify(photos)}::jsonb, ${body.partner_consent === true}, ${ip}, ${ua})
      RETURNING *`;

    const siteUrl = new URL(request.url).origin;
    // Email problems never block the seller's submission.
    await Promise.allSettled([notifyOwner(row, siteUrl), confirmSeller(row)]).then((results) =>
      results.forEach((r) => r.status === 'rejected' && console.error('email failed', r.reason)),
    );

    return json({ ok: true, id: Number(row.id) });
  } catch (err) {
    console.error('submit failed', err);
    return json({ error: 'Something went wrong saving your submission. Please try again.' }, 500);
  }
}
