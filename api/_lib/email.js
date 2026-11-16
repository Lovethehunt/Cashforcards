import { escapeHtml, CATEGORIES } from './util.js';

async function send({ to, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { skipped: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function notifyOwner(sub, siteUrl) {
  const rows = [
    ['Type', sub.kind === 'bulk' ? 'Bulk lot' : 'Singles'],
    ['Category', CATEGORIES[sub.category] || sub.category],
    ['Name', sub.name],
    ['Email', sub.email],
    ['Payout', sub.payout_method || '—'],
    ...(sub.kind === 'bulk'
      ? [['Weight', `${sub.weight_lbs} lbs`], ['Approx. count', sub.card_count ?? '—']]
      : []),
    ['Partner sharing OK', sub.partner_consent ? 'Yes' : 'No'],
  ];
  const photos = (sub.photos || [])
    .map((u) => `<a href="${escapeHtml(u)}"><img src="${escapeHtml(u)}" width="160" style="margin:4px;border-radius:6px"></a>`)
    .join('');
  const html = `
    <h2 style="font-family:sans-serif">New submission #${sub.id}</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><b>${escapeHtml(v)}</b></td></tr>`).join('')}
    </table>
    <h3 style="font-family:sans-serif">Items</h3>
    <pre style="font-family:sans-serif;white-space:pre-wrap;background:#f6f4ee;padding:12px;border-radius:8px">${escapeHtml(sub.items)}</pre>
    <div>${photos}</div>
    <p style="font-family:sans-serif"><a href="${escapeHtml(siteUrl)}/admin">Open admin dashboard</a></p>`;
  return send({
    to: process.env.NOTIFY_EMAIL,
    subject: `New ${sub.kind} submission #${sub.id} — ${CATEGORIES[sub.category] || sub.category}`,
    html,
    replyTo: sub.email,
  });
}

export async function confirmSeller(sub) {
  if (process.env.SEND_SELLER_CONFIRMATION !== 'true') return { skipped: true };
  const html = `
    <div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#15171C">
      <p>Hi ${escapeHtml(sub.name.split(' ')[0])},</p>
      <p>Thanks for your submission to cashforcards.app (reference #${sub.id}). We'll review your photos and email you a cash offer within 24–48 hours.</p>
      <p>There's no obligation to accept. If you do, we'll send our shipping address. Sellers pay shipping; please use a tracked service.</p>
      <p>— Cash for Cards</p>
    </div>`;
  return send({ to: sub.email, subject: `We got your cards — submission #${sub.id}`, html });
}
