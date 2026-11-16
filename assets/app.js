(() => {
  const MAX_PHOTOS = 40;
  const MAX_EDGE = 2000;          // longest side after resizing, in px
  const MAX_UPLOAD = 4 * 1024 * 1024;

  const form = document.getElementById('sell-form');
  const success = document.getElementById('success');
  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit');
  const fileInput = document.getElementById('f-photos');
  const drop = document.getElementById('drop');
  const thumbs = document.getElementById('thumbs');
  const photoHint = document.getElementById('photo-hint');

  let photos = []; // { id, file, url }
  let nextId = 1;

  const kind = () => form.elements.kind.value;

  function applyKind() {
    const k = kind();
    form.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== k; });
    photoHint.textContent = k === 'bulk'
      ? 'The lot spread out, plus a photo of the scale reading. Up to 40.'
      : 'Front and back of each card. JPG, PNG or HEIC. Up to 40.';
  }
  form.querySelectorAll('input[name="kind"]').forEach((r) => r.addEventListener('change', applyKind));
  applyKind();

  function renderThumbs() {
    thumbs.innerHTML = '';
    photos.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'thumb';
      const img = document.createElement('img');
      img.src = p.url;
      img.alt = p.file.name;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `Remove ${p.file.name}`);
      rm.addEventListener('click', () => {
        URL.revokeObjectURL(p.url);
        photos = photos.filter((x) => x.id !== p.id);
        renderThumbs();
      });
      div.append(img, rm);
      thumbs.append(div);
    });
    drop.querySelector('b').textContent = photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} added — add more` : 'Add photos';
  }

  function addFiles(list) {
    const files = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) { showError(`You can add up to ${MAX_PHOTOS} photos.`); break; }
      photos.push({ id: nextId++, file, url: URL.createObjectURL(file) });
    }
    renderThumbs();
  }

  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer && addFiles(e.dataTransfer.files));

  // Shrink a photo to MAX_EDGE as JPEG. Falls back to the original if the browser can't decode it.
  async function shrink(file) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      bitmap.close && bitmap.close();
      for (const q of [0.86, 0.75, 0.6]) {
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
        if (blob && blob.size <= MAX_UPLOAD) return blob;
      }
    } catch (_) { /* fall through */ }
    return file;
  }

  async function uploadOne(file) {
    const blob = await shrink(file);
    if (blob.size > MAX_UPLOAD) throw new Error(`"${file.name}" is too large. Try a smaller photo.`);
    let type = blob.type || '';
    if (!type && /\.heic$/i.test(file.name)) type = 'image/heic';
    const res = await fetch('/api/photo', { method: 'POST', headers: { 'content-type': type || 'image/jpeg' }, body: blob });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'A photo failed to upload.');
    return data.url;
  }

  async function uploadAll(onProgress) {
    const urls = new Array(photos.length);
    let done = 0;
    let i = 0;
    const worker = async () => {
      while (i < photos.length) {
        const idx = i++;
        urls[idx] = await uploadOne(photos[idx].file);
        onProgress(++done, photos.length);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    return urls;
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function validate() {
    const f = form.elements;
    const problems = [];
    if (f.name.value.trim().length < 2) problems.push('your name');
    if (!f.email.checkValidity() || !f.email.value.trim()) problems.push('a valid email');
    if (!f.category.value) problems.push('a card type');
    const items = kind() === 'bulk' ? f.bulk_items.value : f.items.value;
    if (items.trim().length < 3) problems.push(kind() === 'bulk' ? 'a description of your lot' : 'the cards you want to sell');
    if (kind() === 'bulk' && !(Number(f.weight_lbs.value) > 0)) problems.push('the total weight in lbs');
    if (!photos.length) problems.push('at least one photo');
    if (!f.consent.checked) problems.push('your OK to be contacted by email');
    return problems.length ? `Please add ${problems.join(', ')}.` : '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const problem = validate();
    if (problem) return showError(problem);

    const f = form.elements;
    submitBtn.disabled = true;
    try {
      submitBtn.textContent = `Uploading photos 0/${photos.length}…`;
      const urls = await uploadAll((d, t) => { submitBtn.textContent = `Uploading photos ${d}/${t}…`; });
      submitBtn.textContent = 'Sending…';
      const payload = {
        kind: kind(),
        category: f.category.value,
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        payout_method: f.payout_method.value,
        items: (kind() === 'bulk' ? f.bulk_items.value : f.items.value).trim(),
        weight_lbs: kind() === 'bulk' ? f.weight_lbs.value : null,
        card_count: kind() === 'bulk' ? f.card_count.value : null,
        photos: urls,
        consent: f.consent.checked,
        partner_consent: f.partner_consent.checked,
        website: f.website.value,
      };
      const res = await fetch('/api/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');

      document.getElementById('ref').textContent = `#${data.id}`;
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get my cash offer';
    }
  });

  document.getElementById('again').addEventListener('click', () => {
    const keep = { name: form.elements.name.value, email: form.elements.email.value };
    form.reset();
    form.elements.name.value = keep.name;
    form.elements.email.value = keep.email;
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    photos = [];
    renderThumbs();
    applyKind();
    success.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
