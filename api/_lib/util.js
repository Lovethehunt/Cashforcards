import { timingSafeEqual } from 'node:crypto';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export function isAdmin(request) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const given = request.headers.get('x-admin-key') || '';
  if (!expected || expected.length < 8) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clean(value, max = 500) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const CATEGORIES = {
  pokemon: 'Pokémon',
  sports: 'Sports cards',
  mtg: 'Magic: The Gathering',
  other: 'Other trading cards',
  mixed: 'Mixed',
};

export const STATUSES = [
  'new',
  'reviewing',
  'offer_sent',
  'accepted',
  'received',
  'paid',
  'passed',
  'sent_to_partner',
  'declined_by_seller',
];

export const PAYOUT_METHODS = ['paypal', 'venmo', 'zelle', 'cashapp'];
