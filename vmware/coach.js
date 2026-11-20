// AI coach for the VMware prep app (DeepSeek). Same API key and model as the aptitude test:
// the key lives only in this browser's localStorage and is sent only to api.deepseek.com.
window.VCoach = (() => {
  'use strict';
  const API = 'https://api.deepseek.com/chat/completions';
  const K_KEY = 'aptitude.deepseek.key';
  const K_MODEL = 'aptitude.deepseek.model';
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const getKey = () => ls.get(K_KEY) || '';
  const setKey = (v) => ls.set(K_KEY, v.trim());
  const clearKey = () => ls.del(K_KEY);
  const getModel = () => ls.get(K_MODEL) || 'deepseek-chat';
  const setModel = (v) => ls.set(K_MODEL, v);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;

  // Tiny, safe markdown: escape first, then **bold**, *italic*, `code`, bullet / numbered lines.
  function md(text) {
    const lines = esc(text).split('\n');
    let html = '', list = null;
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
    for (const raw of lines) {
      const l = raw.trim();
      const b = l.match(/^[-•*]\s+(.*)/), n = l.match(/^\d+[.)]\s+(.*)/);
      const want = b ? 'ul' : n ? 'ol' : null;
      if (list && want !== list) { html += `</${list}>`; list = null; }
      if (want) { if (!list) { html += `<${want}>`; list = want; } html += `<li>${inline((b || n)[1])}</li>`; }
      else if (l) html += `<p>${inline(l)}</p>`;
    }
    if (list) html += `</${list}>`;
    return html;
  }

  async function* stream(messages, signal) {
    const res = await fetch(API, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey()}` },
      body: JSON.stringify({ model: getModel(), messages, stream: true, temperature: 0.6, max_tokens: 900 }),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error?.message || ''; } catch { /* ignore */ }
      const why = { 401: 'Your DeepSeek key was rejected. Check it in ⚙ Settings.', 402: 'Your DeepSeek account has no balance left. Top up at platform.deepseek.com.', 429: 'Too many requests. Wait a moment and try again.' }[res.status];
      throw new Error(why || `DeepSeek error ${res.status}${detail ? ': ' + detail : ''}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const d = JSON.parse(data).choices?.[0]?.delta || {};
          if (d.content) yield { text: d.content };
        } catch { /* partial line */ }
      }
    }
  }

  async function testKey(key) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 2 }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, msg: res.status === 401 ? 'Key rejected (401). Check you copied the whole key.' : res.status === 402 ? 'Key works, but the account has no balance (402).' : `DeepSeek answered ${res.status}.` };
  }

  function keyFormHTML(compact) {
    return `
      <form class="keyform" data-keyform>
        ${compact ? '' : '<p class="muted small">The coach uses your own DeepSeek API key. It is saved only in this browser and sent only to DeepSeek. If you already saved it in the aptitude test, it works here too.</p>'}
        <div class="row">
          <input type="password" name="key" placeholder="sk-…" autocomplete="off" spellcheck="false" aria-label="DeepSeek API key">
          <button class="btn primary">Save</button>
        </div>
        <p class="small muted keymsg" aria-live="polite">Get a key at <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">platform.deepseek.com</a>.</p>
      </form>`;
  }
  function bindKeyForm(form, onSaved) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = form.key.value.trim();
      const msg = form.querySelector('.keymsg');
      if (!v) { msg.textContent = 'Paste your key first.'; return; }
      msg.textContent = 'Checking key…';
      try {
        const r = await testKey(v);
        if (!r.ok && !/balance/.test(r.msg)) { msg.textContent = r.msg; return; }
        setKey(v);
        msg.textContent = r.ok ? 'Saved ✓' : r.msg + ' Saved anyway.';
        setTimeout(onSaved, 500);
      } catch {
        msg.textContent = 'Could not reach DeepSeek. Check your internet connection.';
      }
    });
  }

  // ---------- UI ----------
  // ctx: { id, title?, systemPrompt(): string, chips(): [[label, text | fn | null]], intro?, defaultOpen?, placeholder? }
  const threads = new Map(); // ctx.id → { msgs, draft, busy, error, open }

  function mount(el, ctx) {
    let t = threads.get(ctx.id);
    if (!t) { t = { msgs: [], draft: '', busy: false, error: '', open: !!ctx.defaultOpen }; threads.set(ctx.id, t); }
    const title = ctx.title || 'Coach';

    const msgHTML = () => t.msgs.map((m, i) => `
      <div class="msg ${m.role}">${m.role === 'assistant'
        ? `<div class="bubble" ${i === t.msgs.length - 1 && t.busy ? 'data-live' : ''}>${m.content ? md(m.content) : '<span class="typing"><i></i><i></i><i></i></span>'}</div>`
        : `<div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div>`}</div>`).join('');

    const chips = () => (ctx.chips ? ctx.chips() : []).map(([label, text], k) => `<button type="button" class="chip-btn" data-chip="${k}">${esc(label)}</button>`).join('');

    function render() {
      if (!getKey()) {
        el.innerHTML = `<div class="coach ${t.open ? 'open' : ''}"><button type="button" class="coach-head" aria-expanded="${t.open}"><span class="coach-title"><span class="spark">✳</span> ${esc(title)}</span><span class="muted small">${t.open ? 'Hide' : 'Add key to turn on'}</span></button>${t.open ? keyFormHTML(false) : ''}</div>`;
        el.querySelector('.coach-head').onclick = () => { t.open = !t.open; render(); };
        if (t.open) bindKeyForm(el.querySelector('[data-keyform]'), () => { t.open = true; render(); });
        return;
      }
      el.innerHTML = `
        <div class="coach ${t.open ? 'open' : ''}">
          <button type="button" class="coach-head" aria-expanded="${t.open}">
            <span class="coach-title"><span class="spark">✳</span> ${esc(title)}</span>
            <span class="muted small">${t.open ? 'Hide' : t.msgs.length ? `${t.msgs.length} messages` : 'Ask for help'}</span>
          </button>
          <div class="coach-body">
            ${t.msgs.length ? '' : `<p class="coach-intro">${esc(ctx.intro || 'Ask me anything about this.')}</p>`}
            <div class="msgs">${msgHTML()}</div>
            ${t.error ? `<p class="coach-err">${esc(t.error)}</p>` : ''}
            <div class="chips-row">${chips()}</div>
            <form class="ask">
              <textarea rows="2" placeholder="${esc(ctx.placeholder || 'Write your question or your thinking…')}" enterkeyhint="send" aria-label="Message to coach">${esc(t.draft)}</textarea>
              <button class="btn primary send" aria-label="Send" ${t.busy ? 'disabled' : ''}>↑</button>
            </form>
          </div>
        </div>`;
      el.querySelector('.coach-head').onclick = () => { t.open = !t.open; render(); if (t.open) el.querySelector('textarea')?.focus({ preventScroll: true }); };
      const ta = el.querySelector('textarea');
      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; };
      ta.oninput = () => { t.draft = ta.value; grow(); };
      ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !coarse()) { e.preventDefault(); send(ta.value); } };
      el.querySelector('.ask').onsubmit = (e) => { e.preventDefault(); send(ta.value); };
      const list = ctx.chips ? ctx.chips() : [];
      el.querySelectorAll('.chip-btn').forEach((b) => (b.onclick = () => {
        const text = list[+b.dataset.chip][1];
        const v = typeof text === 'function' ? text() : text;
        if (v) send(v);
        else { ta.value = t.draft = 'Here is my thinking: '; grow(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      }));
      if (t.open) { grow(); const m = el.querySelector('.msgs'); m.scrollTop = m.scrollHeight; }
    }

    async function send(text) {
      text = (text || '').trim();
      if (!text || t.busy) return;
      t.msgs.push({ role: 'user', content: text });
      t.msgs.push({ role: 'assistant', content: '' });
      t.draft = ''; t.busy = true; t.error = ''; t.open = true;
      render();
      const reply = t.msgs[t.msgs.length - 1];
      const history = [{ role: 'system', content: ctx.systemPrompt() }, ...t.msgs.slice(0, -1).map(({ role, content }) => ({ role, content }))];
      try {
        for await (const chunk of stream(history)) {
          if (chunk.text) reply.content += chunk.text;
          const live = el.isConnected && el.querySelector('[data-live]');
          if (live && chunk.text) { live.innerHTML = md(reply.content); live.scrollIntoView({ block: 'nearest' }); }
        }
        if (!reply.content) reply.content = '(No reply. Please try again.)';
      } catch (err) {
        t.msgs.pop();
        t.error = err.name === 'TypeError' ? 'Could not reach DeepSeek. Check your internet connection.' : err.message;
      }
      t.busy = false;
      if (el.isConnected) render();
    }

    render();
  }

  return { mount, getKey, setKey, clearKey, getModel, setModel, testKey, keyFormHTML, bindKeyForm, md };
})();
