// AI coach: a Socratic assessor under each question, powered by the DeepSeek API.
// The API key is stored only in this browser's localStorage and sent only to api.deepseek.com.
window.Coach = (() => {
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
  const strip = (html) => String(html).replace(/<br>|<li>|<div[^>]*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();
  const LETTERS = 'ABCDE';
  const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;

  // Tiny, safe markdown: escape first, then **bold**, *italic*, bullet / numbered lines.
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

  // ---------- prompt ----------
  function systemPrompt(ctx) {
    const q = ctx.question;
    const sel = ctx.getSelected();
    const opts = q.options.map((o, k) => `${LETTERS[k]}) ${q.visual ? '[picture]' : strip(o)}`).join('\n');
    const answered = ctx.isAnswered();
    return `You are a warm, patient assessor sitting beside a learner who is practising for a job aptitude test. Your job is to GUIDE their thinking toward the answer, like a good tutor, never to hand the answer over.

RULES
1. Never reveal the correct option letter or the final answer value, and never eliminate options down to one, ${answered ? '(EXCEPTION: the learner has now locked in an answer, so you may explain fully).' : 'unless the learner has already locked in their answer.'}
2. When the learner shares their reasoning: first say clearly what is RIGHT in it. Then, if something is wrong, point to the FIRST step that goes wrong and why it is suspicious, without doing the fix for them. End with one guiding question.
3. When the learner is stuck: give the smallest useful nudge (a question, a method name, a simpler example with different numbers). Give a bigger hint only if they stay stuck.
4. If they name an answer and ask if it is right: you may say right or not right. If right but their reasoning is weak, say so and help fix the reasoning. If not right, do NOT say which option is correct; help them find the mistake.
5. Use plain, simple English (the learner may not be a native speaker). Keep replies short: 2–5 sentences, one question at a time. Use **bold** sparingly. No LaTeX, no tables, no headings.
6. Stay on this question. Be encouraging but honest; praise good thinking specifically.

THE QUESTION (${ctx.section})
${q.describe || strip(q.q)}

OPTIONS
${opts}

HIDDEN, FOR YOU ONLY: correct answer is ${LETTERS[q.answer]}.
Official worked solution: ${q.steps.map(strip).join(' ')}
Trick to remember: ${strip(q.trick || '')}

LEARNER STATUS: currently selected option: ${sel === null ? 'none yet' : LETTERS[sel]}. ${answered ? `They have locked in ${sel === null ? 'no answer' : LETTERS[sel]}, which is ${sel === q.answer ? 'CORRECT' : 'WRONG'}.` : 'They have not locked in an answer yet.'}`;
  }

  // ---------- API ----------
  async function* stream(messages, signal) {
    const res = await fetch(API, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey()}` },
      body: JSON.stringify({ model: getModel(), messages, stream: true, temperature: 0.6, max_tokens: 700 }),
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
          else if (d.reasoning_content) yield { thinking: true };
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

  // ---------- UI ----------
  const threads = new WeakMap(); // question object → { msgs, draft, busy, error, open }

  function keyFormHTML(compact) {
    return `
      <form class="keyform" data-keyform>
        ${compact ? '' : '<p class="muted small">The coach uses your own DeepSeek API key. It is saved only in this browser and sent only to DeepSeek.</p>'}
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

  function mount(el, ctx) {
    let t = threads.get(ctx.question);
    if (!t) { t = { msgs: [], draft: '', busy: false, error: '', open: ctx.defaultOpen }; threads.set(ctx.question, t); }

    const msgHTML = () => t.msgs.map((m, i) => `
      <div class="msg ${m.role}">${m.role === 'assistant'
        ? `<div class="bubble" ${i === t.msgs.length - 1 && t.busy ? 'data-live' : ''}>${m.content ? md(m.content) : '<span class="typing"><i></i><i></i><i></i></span>'}</div>`
        : `<div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div>`}</div>`).join('');

    const chips = () => {
      const c = ctx.isAnswered()
        ? [['Explain the answer step by step', 'Please walk me through the full solution now.'], ['Why was my answer wrong?', 'Why was my answer wrong? Where did my thinking go off track?'], ['Give me a similar question', 'Give me a similar practice question (different numbers) and coach me through it.']]
        : [['I’m stuck: give me a nudge', 'I’m stuck. Can you give me a small nudge without giving the answer?'], ['Explain the question simply', 'Can you explain what this question is asking, in simpler words?'], ['Check my thinking…', null]];
      return c.map(([label, text]) => `<button type="button" class="chip-btn" ${text ? `data-say="${esc(text)}"` : 'data-prefill'}>${label}</button>`).join('');
    };

    function render() {
      if (!getKey()) {
        el.innerHTML = `<div class="coach ${t.open ? 'open' : ''}"><button type="button" class="coach-head" aria-expanded="${t.open}"><span class="coach-title"><span class="spark">✳</span> Coach</span><span class="muted small">${t.open ? 'Hide' : 'Add key to turn on'}</span></button>${t.open ? keyFormHTML(false) : ''}</div>`;
        el.querySelector('.coach-head').onclick = () => { t.open = !t.open; render(); };
        if (t.open) bindKeyForm(el.querySelector('[data-keyform]'), () => { t.open = true; render(); });
        return;
      }
      el.innerHTML = `
        <div class="coach ${t.open ? 'open' : ''}">
          <button type="button" class="coach-head" aria-expanded="${t.open}">
            <span class="coach-title"><span class="spark">✳</span> Coach</span>
            <span class="muted small">${t.open ? 'Hide' : t.msgs.length ? `${t.msgs.length} messages` : 'Ask for guidance'}</span>
          </button>
          <div class="coach-body">
            ${t.msgs.length ? '' : `<p class="coach-intro">Tell me how you’re thinking about it, and I’ll tell you if you’re on the right track. I won’t give the answer away.</p>`}
            <div class="msgs">${msgHTML()}</div>
            ${t.error ? `<p class="coach-err">${esc(t.error)}</p>` : ''}
            <div class="chips-row">${chips()}</div>
            <form class="ask">
              <textarea rows="2" placeholder="Write your thinking… (S Pen: write straight into this box)" enterkeyhint="send" aria-label="Message to coach">${esc(t.draft)}</textarea>
              <button class="btn primary send" aria-label="Send" ${t.busy ? 'disabled' : ''}>↑</button>
            </form>
          </div>
        </div>`;
      const head = el.querySelector('.coach-head');
      head.onclick = () => { t.open = !t.open; render(); if (t.open) el.querySelector('textarea')?.focus({ preventScroll: true }); };
      const ta = el.querySelector('textarea');
      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; };
      ta.oninput = () => { t.draft = ta.value; grow(); };
      ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !coarse()) { e.preventDefault(); send(ta.value); } };
      el.querySelector('.ask').onsubmit = (e) => { e.preventDefault(); send(ta.value); };
      el.querySelectorAll('.chip-btn').forEach((b) => (b.onclick = () => {
        if (b.dataset.say) send(b.dataset.say);
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
      const history = [{ role: 'system', content: systemPrompt(ctx) }, ...t.msgs.slice(0, -1).map(({ role, content }) => ({ role, content }))];
      try {
        for await (const chunk of stream(history)) {
          if (chunk.text) reply.content += chunk.text;
          const live = el.isConnected && el.querySelector('[data-live]');
          if (live && chunk.text) { live.innerHTML = md(reply.content); live.scrollIntoView({ block: 'nearest' }); }
        }
        if (!reply.content) reply.content = '(No reply. Please try again.)';
      } catch (err) {
        t.msgs.pop(); // drop the empty assistant bubble
        t.error = err.name === 'TypeError' ? 'Could not reach DeepSeek. Check your internet connection.' : err.message;
      }
      t.busy = false;
      if (el.isConnected) render();
    }

    render();
  }

  return { mount, getKey, setKey, clearKey, getModel, setModel, testKey, keyFormHTML, bindKeyForm };
})();
