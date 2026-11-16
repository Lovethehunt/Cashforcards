import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { json } from './_lib/util.js';

const MAX_BYTES = 4 * 1024 * 1024; // Vercel functions accept bodies up to ~4.5 MB
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

// One photo per request; the browser shrinks photos before sending them.
export async function POST(request) {
  try {
    const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = TYPES[type];
    if (!ext) return json({ error: 'Please upload JPG, PNG, WEBP or HEIC photos.' }, 415);

    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) return json({ error: 'That photo is too large (max 4 MB).' }, 413);

    const body = await request.arrayBuffer();
    if (body.byteLength === 0) return json({ error: 'Empty file.' }, 400);
    if (body.byteLength > MAX_BYTES) return json({ error: 'That photo is too large (max 4 MB).' }, 413);

    const month = new Date().toISOString().slice(0, 7);
    const blob = await put(`submissions/${month}/${randomUUID()}.${ext}`, body, {
      access: 'public',
      contentType: type,
      addRandomSuffix: true,
    });
    return json({ url: blob.url });
  } catch (err) {
    console.error('photo upload failed', err);
    return json({ error: 'Upload failed. Please try again.' }, 500);
  }
}
