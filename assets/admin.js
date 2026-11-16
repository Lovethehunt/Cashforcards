(() => {
  const STATUS_LABELS = {
    new: 'New',
    reviewing: 'Reviewing',
    offer_sent: 'Offer sent',
    accepted: 'Accepted',
    received: 'Cards received',
    paid: 'Paid',
    passed: 'Passed',
    sent_to_partner: 'Sent to partner',
    declined_by_seller: 'Seller declined',
  };
  const CATEGORY_LABELS = { pokemon: 'Pokémon', sports: 'Sports', mtg: 'MTG', other: 'Other', mixed: 'Mixed' };
  const PAYOUT_LABELS = { paypal: 'PayPal', venmo: 'Venmo', zelle: 'Zelle', cashapp: 'Cash App' };
  const KEY = 'cfc-admin-key';

  const $ = (id) => document.getElementById(id);
  let key = '';
  try { key = sessionStorage.getItem(KEY) || ''; } catch (_) {}
  let filter = '';
  let all = [];
  let counts = {};

  async function api(method, body, query = '') {
    const res = await fetch(`/api/submissions${query}`, {
      method,
      headers: { 'x-admin-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { signOut(); throw new Error('Wrong password.'); }
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function signOut() {
    key = '';
    try { sessionStorage.removeItem(KEY); } catch (_) {}
    $('app').hidden = true;
    $('logout').hidden = true;
    $('login').hidden = false;
  }

  $('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    key = $('pw').value;
    $('login-error').hidden = true;
    try {
      await load();
      try { sessionStorage.setItem(KEY, key); } catch (_) {}
      $('pw').value = '';
    } catch (err) {
      $('login-error').textContent = err.message;
      $('login-error').hidden = false;
    }
  });
  $('logout').addEventListener('click', signOut);
  $('refresh').addEventListener('click', () => load().catch(alertErr));
  $('search').addEventListener('input', render);

  function alertErr(err) { console.error(err); $('empty').hidden = false; $('empty').textContent = err.message; }

  async function load() {
    const data = await api('GET');
    all = data.submissions;
    counts = data.counts || {};
    $('login').hidden = true;
    $('app').hidden = false;
    $('logout').hidden = false;
    renderFilters();
    render();
  }

  function renderFilters() {
    const wrap = $('filters');
    wrap.innerHTML = '';
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const entries = [['', 'All', total], ...Object.keys(STATUS_LABELS).map((s) => [s, STATUS_LABELS[s], counts[s] || 0])];
    for (const [value, label, n] of entries) {
      if (value && !n && value !== 'new') continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(filter === value));
      b.innerHTML = `${label}<span class="n">${n}</span>`;
      b.addEventListener('click', () => { filter = value; renderFilters(); render(); });
      wrap.append(b);
    }
  }

  const fmtDate = (s) => new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const money = (v) => (v === null || v === undefined || v === '' ? '' : String(Number(v)));

  function render() {
    const q = $('search').value.trim().toLowerCase();
    const rows = all.filter((s) => (!filter || s.status === filter) &&
      (!q || [s.name, s.email, s.items, String(s.id)].some((v) => (v || '').toLowerCase().includes(q))));
    const list = $('list');
    list.innerHTML = '';
    $('empty').hidden = rows.length > 0;
    $('empty').textContent = 'No submissions here yet.';
    rows.forEach((s) => list.append(card(s)));
  }

  function card(s) {
    const node = $('tpl').content.firstElementChild.cloneNode(true);
    node.querySelector('.sub-title').textContent = `#${s.id} · ${s.kind === 'bulk' ? 'Bulk lot' : 'Singles'} · ${CATEGORY_LABELS[s.category] || s.category}`;
    node.querySelector('.sub-meta').textContent = `${fmtDate(s.created_at)} · ${(s.photos || []).length} photo(s)`;
    const chip = node.querySelector('.status-chip');
    chip.dataset.s = s.status;
    chip.textContent = STATUS_LABELS[s.status] || s.status;

    const facts = [
      ['Name', s.name],
      ['Email', s.email],
      ['Payout', PAYOUT_LABELS[s.payout_method] || 'No preference'],
      ...(s.kind === 'bulk' ? [['Weight', `${Number(s.weight_lbs)} lbs`], ['Count', s.card_count ?? '—']] : []),
      ['Partner OK', s.partner_consent ? 'Yes' : 'No'],
    ];
    const dl = node.querySelector('.facts');
    for (const [k, v] of facts) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      if (k === 'Partner OK' && s.partner_consent) dd.className = 'yes';
      dl.append(dt, dd);
    }
    node.querySelector('.items').textContent = s.items;

    const ph = node.querySelector('.photos');
    (s.photos || []).forEach((u, i) => {
      const a = document.createElement('a');
      a.href = u; a.target = '_blank'; a.rel = 'noopener';
      const img = document.createElement('img');
      img.src = u; img.loading = 'lazy'; img.alt = `Photo ${i + 1} for submission ${s.id}`;
      a.append(img);
      ph.append(a);
    });

    const form = node.querySelector('.sub-edit');
    const sel = form.elements.status;
    for (const [v, label] of Object.entries(STATUS_LABELS)) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      if (v === 'sent_to_partner' && !s.partner_consent) { o.disabled = true; o.textContent += ' (no consent)'; }
      sel.append(o);
    }
    sel.value = s.status;
    form.elements.offer_amount.value = money(s.offer_amount);
    form.elements.partner_name.value = s.partner_name || '';
    form.elements.notes.value = s.notes || '';
    const partnerFld = form.querySelector('.partner-fld');
    partnerFld.hidden = !s.partner_consent;

    const subj = encodeURIComponent(`Your cashforcards.app offer — submission #${s.id}`);
    form.querySelector('.reply').href = `mailto:${encodeURIComponent(s.email)}?subject=${subj}`;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saved = form.querySelector('.saved');
      saved.textContent = 'Saving…';
      try {
        const { submission } = await api('PATCH', {
          id: s.id,
          status: sel.value,
          offer_amount: form.elements.offer_amount.value,
          notes: form.elements.notes.value,
          partner_name: form.elements.partner_name.value,
        });
        const prev = s.status;
        Object.assign(s, submission);
        if (prev !== s.status) {
          counts[prev] = Math.max(0, (counts[prev] || 1) - 1);
          counts[s.status] = (counts[s.status] || 0) + 1;
          renderFilters();
        }
        chip.dataset.s = s.status;
        chip.textContent = STATUS_LABELS[s.status] || s.status;
        saved.textContent = 'Saved';
        setTimeout(() => { saved.textContent = ''; }, 2000);
      } catch (err) {
        saved.textContent = err.message;
      }
    });
    return node;
  }

  if (key) load().catch(() => signOut());
})();
