// VMware prep app: lessons, quizzes, scenario challenges, your environment, and an AI tutor.
(() => {
  'use strict';
  const V = window.VMW;
  const C = window.VCoach;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const app = $('#app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const plain = (html) => String(html).replace(/<br>|<li>|<\/p>|<\/h3>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\n\s*\n/g, '\n').trim();
  const LETTERS = 'ABCD';
  const modOf = (id) => V.MODULES.find((m) => m.id === id);

  // ---------- progress (browser only) ----------
  const PK = 'vmware.progress.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(PK)) || {}; } catch { return {}; } };
  const P = load();
  P.q = P.q || {}; P.c = P.c || {}; P.l = P.l || {};
  const save = () => { try { localStorage.setItem(PK, JSON.stringify(P)); } catch { /* private mode */ } };
  const record = (id, ok) => {
    const o = P.q[id] || { r: 0, w: 0 };
    if (ok) o.r++; else o.w++;
    o.ok = ok; P.q[id] = o; save();
  };
  const priority = (id) => { const o = P.q[id]; return (o ? o.r - o.w * 2 + 1 : 0) + Math.random() * 0.8; };
  const pickSet = (pool, n) => pool.slice().sort((a, b) => priority(a.id) - priority(b.id)).slice(0, n);
  const mastery = (mod) => {
    const qs = V.QUESTIONS.filter((q) => q.mod === mod);
    return Math.round((100 * qs.filter((q) => P.q[q.id] && P.q[q.id].ok).length) / qs.length);
  };

  // ---------- header and screen helper ----------
  const hdr = { bar: $('#hdr'), title: $('#hdr-section'), home: $('#hdr-home'), settings: $('#hdr-settings'), timer: $('#hdr-timer') };
  let onLeave = null;
  let keepTimer = false;
  function show(html, title) {
    app.innerHTML = html;
    hdr.bar.hidden = false;
    hdr.title.textContent = title || 'VMware prep';
    if (!keepTimer) { hdr.timer.textContent = ''; hdr.timer.className = 'timer'; }
    window.scrollTo(0, 0);
  }
  const go = (fn, ...a) => { if (onLeave) { onLeave(); onLeave = null; } fn(...a); };
  hdr.home.addEventListener('click', () => go(home));

  // ---------- coach prompts ----------
  const BASE = `You are a patient, practical VMware tutor sitting beside a learner. The learner is a Windows and infrastructure admin who is new to deep VMware, storage and server hardware, and is preparing for a technical interview. Use plain, simple English. Keep replies short: 2 to 6 sentences or a short list, one question at a time. Use **bold** sparingly. No tables, no headings, no LaTeX. Use real-world analogies from Windows and everyday life when they help. Be accurate: if you are not sure of something, say so. You may relate ideas to the learner's own environment, described below, but do not invent facts about it beyond this summary; if something is unknown, say where to check it in vCenter.

LEARNER'S ENVIRONMENT: ${V.ENV_SUMMARY}`;

  // ---------- coach-key card ----------
  function coachCard() {
    if (C.getKey()) return `<div class="coach-ok"><span class="spark">✳</span><span>AI coach is on (${esc(C.getModel())}). Every question and challenge has a coach panel.</span></div>`;
    return `<div class="coach-card"><p class="coach-title"><span class="spark">✳</span> Turn on the AI coach</p>${C.keyFormHTML(false)}</div>`;
  }
  function bindCoachCard() { const f = $('[data-keyform]', app); if (f) C.bindKeyForm(f, () => go(home)); }

  // ---------- home ----------
  function home() {
    const total = V.QUESTIONS.length;
    const seen = V.QUESTIONS.filter((q) => P.q[q.id]).length;
    const right = V.QUESTIONS.filter((q) => P.q[q.id] && P.q[q.id].ok).length;
    const chDone = V.CHALLENGES.filter((c) => P.c[c.id]).length;
    show(`
      <section class="card hero">
        <p class="kicker">VMware prep</p>
        <h1>Understand your VMware, storage and hardware</h1>
        <p class="lead">Seven modules built around your own environment. Learn, take quizzes, solve scenario challenges, and ask the AI coach anything.</p>
        <p class="stat-line"><span><strong>${right}</strong>/${total} questions mastered</span><span><strong>${seen}</strong> seen</span><span><strong>${chDone}</strong>/${V.CHALLENGES.length} challenges</span></p>
        <div class="coach-setup">${coachCard()}</div>
        <div class="actions">
          <button class="btn primary" data-act="mixed">Mixed quiz (10)</button>
          <button class="btn" data-act="weak">Weak spots</button>
          <button class="btn" data-act="exam">Interview round (20 min, no hints)</button>
          <button class="btn" data-act="build">🛠 Build Lab: build a vSphere environment</button>
          <button class="btn" data-act="cheat">Cheat sheet</button>
          <button class="btn" data-act="challenges">Scenario challenges</button>
          <button class="btn" data-act="lab">Visual lab (interactive diagrams)</button>
          <button class="btn" data-act="env">My environment</button>
          <button class="btn" data-act="tutor">Ask the tutor</button>
        </div>
      </section>
      <h3 class="sect">Modules</h3>
      <div class="mods">
        ${V.MODULES.map((m) => `
          <article class="card mod">
            <div class="mod-head"><span class="mod-ic" aria-hidden="true">${m.icon}</span><div><h2>${esc(m.title)}</h2><p class="muted small">${esc(m.blurb)}</p></div></div>
            <div class="meter" title="Mastery"><span style="width:${mastery(m.id)}%"></span></div>
            <p class="small muted">${mastery(m.id)}% mastered · ${V.QUESTIONS.filter((q) => q.mod === m.id).length} questions · ${P.l[m.id] ? 'lesson read' : 'lesson not read'}</p>
            <div class="row gap"><button class="btn" data-lesson="${m.id}">Learn</button><button class="btn primary" data-quiz="${m.id}">Quiz</button></div>
          </article>`).join('')}
      </div>
      <p class="muted small foot">Your progress is saved only in this browser. The coach sends your questions only to DeepSeek.</p>`);
    bindCoachCard();
    $$('[data-lesson]').forEach((b) => (b.onclick = () => go(lesson, b.dataset.lesson)));
    $$('[data-quiz]').forEach((b) => (b.onclick = () => go(startModuleQuiz, b.dataset.quiz)));
    $$('[data-act]').forEach((b) => (b.onclick = () => go(({ mixed: startMixed, weak: startWeak, exam: startExam, challenges: challengeList, env: envPage, tutor: tutorPage, lab, cheat: cheatSheet, build: () => window.BuildLab.start(app, { show, go, home, esc, coach: C, BASE }) })[b.dataset.act])));
  }

  // ---------- interactive diagrams ----------
  function mountWidgets(root = app) {
    $$('.wmount', root).forEach((el) => { const fn = V.WIDGETS[el.dataset.w]; if (fn) { try { fn(el); } catch (e) { el.textContent = 'Diagram could not load.'; } } });
  }
  function lab() {
    const ids = Object.keys(V.WIDGETS);
    show(`
      <section class="card"><p class="kicker">Visual lab</p><h1>Learn by touching</h1><p class="lead">Interactive diagrams. Tap parts, drag sliders, and break things to see what happens.</p>
        <div class="chips">${ids.map((id) => `<a class="chip" href="#w-${id}" data-jump="${id}">${esc(V.WIDGET_TITLES[id].split(' (')[0])}</a>`).join('')}</div></section>
      ${ids.map((id) => `<section class="card" id="w-${id}"><div class="wmount" data-w="${id}"></div></section>`).join('')}
      <div class="nav"><button class="btn" id="back">← Home</button><span></span></div>`, 'Visual lab');
    mountWidgets();
    $$('[data-jump]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const t = $('#w-' + a.dataset.jump); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    $('#back').onclick = () => go(home);
  }

  // ---------- lesson ----------
  function lesson(mod) {
    const m = modOf(mod), L = V.LESSONS[mod];
    P.l[mod] = true; save();
    const idx = V.MODULES.indexOf(m), next = V.MODULES[idx + 1];
    show(`
      <section class="card">
        <p class="kicker">Module ${idx + 1} of ${V.MODULES.length}</p>
        <h1>${m.icon} ${esc(m.title)}</h1>
        <p class="lead">${esc(L.intro)}</p>
      </section>
      ${L.sections.map((s) => `<section class="card"><h2>${esc(s.t)}</h2><div class="prose">${s.h}</div>${s.w ? `<div class="wmount" data-w="${s.w}"></div>` : ''}</section>`).join('')}
      <section class="card yours"><p class="kicker">In your environment</p><p>${esc(L.yours)}</p></section>
      <section class="card"><h2>Key terms</h2><table class="summary">${L.terms.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</table></section>
      <div id="coach"></div>
      <div class="nav"><button class="btn" id="back">← Home</button><button class="btn primary" id="quiz">Take the ${esc(m.title)} quiz</button></div>
      ${next ? `<p class="center muted small"><button class="link" id="next">Next module: ${esc(next.title)} →</button></p>` : ''}`, m.title);
    mountWidgets();
    const lessonText = `${m.title}. ${L.intro} ` + L.sections.map((s) => `${s.t}: ${plain(s.h)}`).join(' ') + ' In their environment: ' + L.yours;
    C.mount($('#coach'), {
      id: 'lesson-' + mod, title: 'Ask about this lesson', intro: 'Ask anything about this module. I will explain it in simple words and link it to your environment.',
      placeholder: 'Ask a question about this lesson…',
      systemPrompt: () => `${BASE}\n\nTHE LEARNER IS READING THIS LESSON:\n${lessonText}\n\nExplain concepts simply, use an analogy, then check understanding with ONE short question. If they ask something outside this lesson, answer briefly and connect it back.`,
      chips: () => [['Explain it like I am a Windows admin', 'Explain this lesson to me like I am a Windows admin who has never used VMware.'], ['Quiz me on this lesson', 'Ask me one question about this lesson, wait for my answer, then give feedback.'], ['Where do I see this in vCenter?', 'Where in the vSphere Client can I see these things in my own environment? Give me the click path.'], ['What will an interviewer ask?', 'What would an interviewer ask me about this topic, and how should I answer in 30 seconds?']],
    });
    $('#back').onclick = () => go(home);
    $('#quiz').onclick = () => go(startModuleQuiz, mod);
    const nx = $('#next'); if (nx) nx.onclick = () => go(lesson, next.id);
  }

  // ---------- quizzes ----------
  const build = (q) => {
    const opts = shuffle(q.opts.map((t, k) => ({ t, ok: k === 0 })));
    return { id: q.id, mod: q.mod, q: q.q, why: q.why, fig: q.fig, figAfter: q.figAfter, opts: opts.map((o) => o.t), answer: opts.findIndex((o) => o.ok), picked: null, locked: false };
  };
  function startModuleQuiz(mod) { const m = modOf(mod); runQuiz({ title: m.title, qs: shuffle(V.QUESTIONS.filter((q) => q.mod === mod)).slice(0, 12) }); }
  function startMixed() { runQuiz({ title: 'Mixed quiz', qs: pickSet(V.QUESTIONS, 10) }); }
  function startExam() { runQuiz({ title: 'Interview round', qs: shuffle(pickSet(V.QUESTIONS, 40)).slice(0, 20), exam: true }); }
  function startWeak() {
    const weak = V.QUESTIONS.filter((q) => P.q[q.id] && (!P.q[q.id].ok || P.q[q.id].w >= P.q[q.id].r));
    if (!weak.length) {
      show(`<section class="card center"><h2>No weak spots yet</h2><p class="muted">Answer some questions first. Anything you miss will show up here.</p><div class="row gap" style="justify-content:center"><button class="btn primary" id="m">Start a mixed quiz</button><button class="btn" id="h">Home</button></div></section>`, 'Weak spots');
      $('#m').onclick = () => go(startMixed); $('#h').onclick = () => go(home);
      return;
    }
    runQuiz({ title: 'Weak spots', qs: shuffle(weak).slice(0, 12) });
  }

  function runQuiz({ title, qs, exam }) {
    const items = qs.map(build);
    let i = 0;
    let timerId = null, ended = false;
    if (exam) {
      const end = Date.now() + items.length * 60 * 1000; // 1 minute per question
      keepTimer = true;
      const tick = () => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        hdr.timer.textContent = '⏱ ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
        hdr.timer.className = 'timer' + (left <= 60 ? ' warn' : '');
        if (left <= 0 && !ended) { ended = true; stopTimer(); finish(true); }
      };
      const stopTimer = () => { if (timerId) clearInterval(timerId); timerId = null; keepTimer = false; };
      onLeave = stopTimer;
      tick(); timerId = setInterval(tick, 250);
    }
    const stopAll = () => { if (onLeave) { onLeave(); onLeave = null; } };

    const questionPrompt = (it) => () => {
      const opts = it.opts.map((o, k) => `${LETTERS[k]}) ${o}`).join('\n');
      const status = it.locked
        ? `The learner has locked in ${LETTERS[it.picked]}, which is ${it.picked === it.answer ? 'CORRECT' : 'WRONG'}. You may now explain fully.`
        : `The learner has ${it.picked === null ? 'not picked' : 'selected ' + LETTERS[it.picked] + ' but not locked in'} an answer. Do NOT reveal the correct option or the final answer, and do not narrow the options down to one. Guide their thinking with a hint or a question.`;
      return `${BASE}\n\nQUIZ QUESTION (${modOf(it.mod).title}): ${it.q}\nOPTIONS\n${opts}\n\nHIDDEN, FOR YOU ONLY: the correct answer is ${LETTERS[it.answer]}. Official explanation: ${it.why}\n\n${status}\nWhen the learner shares reasoning: say what is right, point to the first step that goes wrong, end with one guiding question. When they are stuck: give the smallest useful nudge.`;
    };

    const figHTML = (it) => {
      const id = it.locked && it.figAfter ? null : it.fig; // after checking, the labelled picture is shown in the feedback instead
      return id && V.FIGS[id] ? `<div class="qfig">${V.FIGS[id]()}</div>` : '';
    };
    function render() {
      const it = items[i];
      const last = i === items.length - 1;
      const verdict = it.locked
        ? `<div class="feedback ${it.picked === it.answer ? 'ok' : 'bad'}"><p class="verdict">${it.picked === it.answer ? '✅ Correct!' : `❌ Not quite. The answer is <strong>${LETTERS[it.answer]}</strong>.`}</p><p>${esc(it.why)}</p>${it.figAfter && V.FIGS[it.figAfter] ? `<div class="qfig after">${V.FIGS[it.figAfter]()}</div>` : ''}</div>` : '';
      let nav;
      if (exam) nav = `<button class="btn" id="prev" ${i === 0 ? 'disabled' : ''}>← Back</button><button class="btn primary" id="next">${last ? 'Finish' : 'Next →'}</button>`;
      else if (!it.locked) nav = `<button class="btn" id="skip">Skip</button><button class="btn primary" id="check" ${it.picked === null ? 'disabled' : ''}>Check answer</button>`;
      else nav = `<span></span><button class="btn primary" id="next">${last ? 'See results' : 'Next →'}</button>`;
      show(`
        <section class="card qcard">
          <p class="kicker">${esc(title)} · Question ${i + 1} of ${items.length}${modOf(it.mod).title === title ? '' : ' · ' + esc(modOf(it.mod).title)}</p>
          <div class="qtext">${esc(it.q)}</div>
          ${figHTML(it)}
          <div class="options">${it.opts.map((o, k) => {
            let cls = it.picked === k ? 'sel' : '';
            if (it.locked) cls = k === it.answer ? 'right' : it.picked === k ? 'wrong' : '';
            return `<button class="opt ${cls}" data-k="${k}" ${it.locked ? 'disabled' : ''}><span class="lbl">${LETTERS[k]}</span><span class="otext">${esc(o)}</span></button>`;
          }).join('')}</div>
          ${verdict}
          ${exam ? '' : '<div id="coach"></div>'}
          <div class="pips">${items.map((x, k) => `<span class="pip ${k === i ? 'cur' : ''} ${x.locked || (exam && x.picked !== null) ? 'done' : ''}">${k + 1}</span>`).join('')}</div>
          <div class="nav">${nav}</div>
        </section>`, title);
      if (!exam) {
        C.mount($('#coach'), {
          id: 'q-' + it.id, title: 'Coach', intro: 'Tell me how you are thinking and I will guide you. I will not give the answer away before you check.',
          placeholder: 'Write your thinking…', systemPrompt: questionPrompt(it),
          chips: () => it.locked
            ? [['Explain it step by step', 'Please walk me through the full explanation step by step.'], ['Why were the other options wrong?', 'Why were the other options wrong?'], ['Where do I see this in vCenter?', 'Where would I see or check this in the vSphere Client in my own environment?'], ['Give me a similar question', 'Give me a similar practice question and coach me through it.']]
            : [['Give me a small hint', 'I am stuck. Can you give me a small hint without giving the answer?'], ['Explain the question simply', 'Can you explain what this question is asking, in simpler words?'], ['Check my thinking…', null]],
        });
      }
      $$('.opt').forEach((b) => (b.onclick = () => {
        if (it.locked) return;
        it.picked = +b.dataset.k;
        $$('.opt').forEach((x) => x.classList.toggle('sel', x === b));
        const c = $('#check'); if (c) c.disabled = false;
        const p = $$('.pip')[i]; if (exam && p) p.classList.add('done');
      }));
      const ck = $('#check');
      if (ck) ck.onclick = () => { it.locked = true; record(it.id, it.picked === it.answer); render(); const f = $('.feedback'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      const sk = $('#skip'); if (sk) sk.onclick = () => { if (last) finish(); else { i++; render(); } };
      const nx = $('#next'); if (nx) nx.onclick = () => { if (last) finish(); else { i++; render(); } };
      const pv = $('#prev'); if (pv) pv.onclick = () => { i--; render(); };
    }

    function finish(timeUp) {
      if (exam) {
        const left = items.filter((x) => x.picked === null).length;
        if (!timeUp && left && !confirm(`${left} question(s) unanswered. Finish anyway?`)) return;
        stopAll();
        items.forEach((x) => { if (!x.locked) { x.locked = true; if (x.picked !== null) record(x.id, x.picked === x.answer); else record(x.id, false); } });
      }
      const good = items.filter((x) => x.picked === x.answer).length;
      const missed = items.filter((x) => x.picked !== x.answer);
      const pct = Math.round((100 * good) / items.length);
      const mods = {};
      items.forEach((x) => { const m = (mods[x.mod] = mods[x.mod] || { r: 0, n: 0 }); m.n++; if (x.picked === x.answer) m.r++; });
      show(`
        <section class="card">
          <p class="kicker">${esc(title)} · Results</p>
          <div class="score"><span class="num">${good}/${items.length}</span><span>${pct}%</span></div>
          ${timeUp ? '<p class="w-alert">⏱ Time is up. Unanswered questions count as wrong.</p>' : ''}
          <p class="lead">${pct >= 85 ? 'Excellent. You are interview-ready on these topics.' : pct >= 60 ? 'Good progress. Review the ones you missed below.' : 'Keep going. Read the lessons for the weak modules, then retry.'}</p>
          <table class="summary">${Object.entries(mods).map(([k, v]) => `<tr><th>${esc(modOf(k).title)}</th><td>${v.r}/${v.n}<div class="meter"><span style="width:${Math.round((100 * v.r) / v.n)}%"></span></div></td></tr>`).join('')}</table>
          <div class="row gap">${missed.length ? '<button class="btn primary" id="retry">Retry the ones I missed</button>' : ''}<button class="btn" id="home2">Home</button></div>
        </section>
        ${missed.length ? `<h3 class="sect">Review what you missed</h3>${missed.map((x) => `<details class="rev bad"><summary>${esc(x.q)}</summary><p><strong>Answer:</strong> ${esc(x.opts[x.answer])}</p><p><strong>You chose:</strong> ${x.picked === null ? 'no answer' : esc(x.opts[x.picked])}</p><p>${esc(x.why)}</p>${x.figAfter && V.FIGS[x.figAfter] ? `<div class="qfig after">${V.FIGS[x.figAfter]()}</div>` : x.fig && V.FIGS[x.fig] ? `<div class="qfig after">${V.FIGS[x.fig]()}</div>` : ''}</details>`).join('')}` : ''}`, title);
      const r = $('#retry'); if (r) r.onclick = () => go(() => runQuiz({ title: 'Retry', qs: missed.map((x) => V.QUESTIONS.find((q) => q.id === x.id)) }));
      $('#home2').onclick = () => go(home);
    }
    render();
  }

  // ---------- challenges ----------
  const levelCls = { 'Warm-up': 'l1', Core: 'l2', Hard: 'l3' };
  function challengeList() {
    show(`
      <section class="card"><p class="kicker">Scenario challenges</p><h1>Think like an engineer</h1><p class="lead">Each challenge is an interview-style scenario. Write your answer, ask the coach to review it, then compare with the model answer and tick the points you covered.</p></section>
      ${V.MODULES.map((m) => {
        const list = V.CHALLENGES.filter((c) => c.mod === m.id);
        if (!list.length) return '';
        return `<h3 class="sect">${m.icon} ${esc(m.title)}</h3>${list.map((c) => `
          <button class="card chal" data-c="${c.id}"><span class="tag ${levelCls[c.level]}">${esc(c.level)}</span><span class="chal-t">${esc(c.title)}</span><span class="muted small">${P.c[c.id] ? `Done · ${P.c[c.id].score}/${c.rubric.length}` : 'Not tried'}</span></button>`).join('')}`;
      }).join('')}`, 'Challenges');
    $$('[data-c]').forEach((b) => (b.onclick = () => go(challenge, b.dataset.c)));
  }

  function challenge(id) {
    const c = V.CHALLENGES.find((x) => x.id === id);
    const DK = 'vmware.draft.' + id;
    let revealed = !!P.c[id];
    const draft = () => { try { return localStorage.getItem(DK) || ''; } catch { return ''; } };
    const saveDraft = (v) => { try { localStorage.setItem(DK, v); } catch { /* ignore */ } };
    const ticks = (P.c[id] && P.c[id].ticks) || [];

    const body = () => `
      <section class="card">
        <p class="kicker"><span class="tag ${levelCls[c.level]}">${esc(c.level)}</span> ${esc(modOf(c.mod).title)}</p>
        <h1>${esc(c.title)}</h1>
        <p class="qtext sm">${esc(c.scenario)}</p>
        <label class="reflect"><span>Your answer</span><textarea id="ans" rows="7" placeholder="Write your answer as if you were speaking to the interviewer…">${esc(draft())}</textarea></label>
        <div class="row gap"><button class="btn primary" id="review">Ask the coach to review it</button>${revealed ? '' : '<button class="btn" id="reveal">Show rubric and model answer</button>'}</div>
      </section>
      ${revealed ? `
      <section class="card">
        <h2>Did you cover these points?</h2>
        <p class="muted small">Tick each point you made in your answer.</p>
        <div class="checks">${c.rubric.map((r, k) => `<label class="chk"><input type="checkbox" data-t="${k}" ${ticks.includes(k) ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}</div>
        <p class="score-line"><strong id="sc">${ticks.length}</strong> of ${c.rubric.length} points</p>
        <h2>Model answer</h2>
        <p class="model">${esc(c.model)}</p>
        <div class="row gap"><button class="btn primary" id="done">Save and finish</button></div>
      </section>` : ''}
      <div id="coach"></div>
      <div class="nav"><button class="btn" id="back">← All challenges</button><span></span></div>`;

    function render() {
      show(body(), 'Challenge');
      const ta = $('#ans');
      const reviewText = () => {
        const a = (ta.value || '').trim();
        return a ? `Here is my answer to the challenge. Please review it: say what is right, what is missing or wrong, and ask me one guiding question.\n\n${a}` : 'I have not written an answer yet. Can you help me get started with a first step?';
      };
      C.mount($('#coach'), {
        id: 'chal-' + id, title: 'Coach', defaultOpen: false, intro: 'Write your answer above, then press "Ask the coach to review it". I will point out what is good and what is missing.',
        placeholder: 'Ask for a hint or discuss your answer…',
        systemPrompt: () => `${BASE}\n\nSCENARIO CHALLENGE: ${c.title}\n${c.scenario}\n\nHIDDEN GRADING POINTS (for you only): ${c.rubric.join('; ')}.\nModel answer: ${c.model}\n\n${revealed ? 'The learner has now revealed the model answer, so you may discuss it fully.' : 'The learner has NOT revealed the model answer. Do not recite the grading points or the model answer. When reviewing their answer, say clearly what is right, then name the TOPICS they have not covered as guiding questions (not the answers), and end with one question. When they are stuck, give a small nudge.'}`,
        chips: () => [['Review my answer', reviewText], ['Give me a hint', 'Give me a small hint to start, without giving the answer.'], ['What am I missing?', 'What important points might I be missing? Ask me guiding questions, do not just tell me.']].concat(revealed ? [['Explain the model answer simply', 'Explain the model answer in simple words, step by step.']] : []),
      });
      ta.oninput = () => saveDraft(ta.value);
      $('#review').onclick = () => {
        saveDraft(ta.value);
        const chip = $$('.chip-btn')[0];
        if (!C.getKey()) { alert('Add your DeepSeek key in the coach panel first (open it below), then try again.'); return; }
        if (chip) chip.click();
      };
      const rv = $('#reveal'); if (rv) rv.onclick = () => { if (!ta.value.trim() && !confirm('You have not written an answer yet. Show the model answer anyway?')) return; saveDraft(ta.value); revealed = true; render(); };
      $$('[data-t]').forEach((b) => (b.onchange = () => { $('#sc').textContent = $$('[data-t]:checked').length; }));
      const dn = $('#done');
      if (dn) dn.onclick = () => { const t = $$('[data-t]:checked').map((x) => +x.dataset.t); P.c[id] = { score: t.length, ticks: t }; save(); go(challengeList); };
      $('#back').onclick = () => go(challengeList);
    }
    render();
  }

  // ---------- cheat sheet ----------
  function cheatSheet() {
    const row = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
    show(`
      <section class="card cheat">
        <p class="kicker">Read this 10 minutes before the call</p>
        <h1>Cheat sheet</h1>
        <h2>My environment in one breath</h2>
        <p class="lead">About 50 ESXi 8.0 U3 hosts (HPE DL380, Dell R640/R740) in 9 clusters under vCenter 8.0 U3, HA and DRS on. About 1,100 running VMs, roughly 55% Linux, 45% Windows Server. Hitachi FC SAN, 307 VMFS datastores, 2 paths per LUN, Round Robin. Distributed switches on 10GbE.</p>
        <h2>Numbers to know</h2>
        <table class="summary">
          ${row('CPU Ready', 'Above ~5% per vCPU = VMs waiting for cores')}
          ${row('Disk latency', 'Under ~20 ms fine, 30 ms+ is a problem. GAVG ≈ DAVG (device) + KAVG (ESXi queue)')}
          ${row('Memory', 'Ballooning = host short of RAM. Swapping = much worse')}
          ${row('Admission control', 'Failover level 1 = keep one host free. 2-host cluster ≈ 50% usable')}
          ${row('Snapshots', 'Hours to days, never a backup. Old ones = big delta, slow I/O')}
          ${row('vSphere support', '9.1 latest · 9.0 to Sep 2027 · 8.0 to 11 Oct 2027 · 7.0 ended 2 Oct 2025')}
          ${row('esxtop keys', 'c CPU (%RDY, %CSTP) · m memory (MCTLSZ, SWCUR) · d/u/v disk · n network')}
        </table>
        <h2>"Why is this slow?" method</h2>
        <ol class="prose"><li>Scope: one VM or many, since when, what changed?</li><li>Guest: CPU, memory, disk latency (perfmon Avg. Disk sec/Transfer), network.</li><li>VM in vCenter: CPU Ready, ballooning/swapping, limits, snapshots, disk latency.</li><li>Shared? Same host → host. Same datastore → storage. Neither → something shared (DNS, AD, network, backups).</li><li>Fix, then prove it with the same metric.</li></ol>
        <h2>Classic answers</h2>
        <ul class="prose">
          <li><strong>HA vs DRS vs vMotion:</strong> vMotion moves a running VM; DRS uses vMotion to balance; HA restarts VMs after a host dies.</li>
          <li><strong>Over-sized VM:</strong> more vCPUs can be slower (CPU Ready, NUMA). Right-size from data.</li>
          <li><strong>Limits:</strong> apply even when the host is idle. Check them when a VM swaps on a host with free RAM.</li>
          <li><strong>VMFS 5 → 6:</strong> no in-place upgrade. New datastore, Storage vMotion, retire old LUN.</li>
          <li><strong>vSphere 9:</strong> ESX name, vLCM images only, vCenter 9 manages ESX 8.0+. Upgrade vCenter first.</li>
          <li><strong>Don't know?</strong> Say so, then say how you would find out.</li>
        </ul>
        <div class="row gap"><button class="btn" id="pr">Print</button><button class="btn primary" id="back">← Home</button></div>
      </section>`, 'Cheat sheet');
    $('#pr').onclick = () => window.print();
    $('#back').onclick = () => go(home);
  }

  // ---------- my environment ----------
  function envPage() {
    const E = V.ENV;
    const S = E.storage;
    show(`
      <section class="card">
        <p class="kicker">My environment</p>
        <h1>Know your numbers</h1>
        <p class="lead">From your RVTools export. Names are generalised. Learn the headline figures; in an interview they show real experience.</p>
        <table class="summary">
          <tr><th>Management</th><td>${esc(E.vcenter)}, ${esc(E.esxi)}</td></tr>
          <tr><th>Hosts</th><td>${E.hosts} hosts in ${E.clusters.length} clusters (HA and DRS on)</td></tr>
          <tr><th>VMs</th><td>${E.vms.total.toLocaleString()} total: ${E.vms.on.toLocaleString()} on, ${E.vms.off} off, ${E.vms.templates} templates. Linux ${E.vms.linux}, Windows Server ${E.vms.windows}</td></tr>
          <tr><th>Storage</th><td>${S.datastores} datastores, ${esc(S.type)}, ${S.tib.toLocaleString()} TiB (${S.free} free). VMFS 6: ${S.vmfs6}, VMFS 5: ${S.vmfs5}. Paths: ${esc(S.paths)}. HBA: ${esc(S.hba)}</td></tr>
          <tr><th>Network</th><td>${esc(E.network.speed)}; ${E.network.dvs} distributed switches; ${esc(E.network.vss)}; ${esc(E.network.vmk)}</td></tr>
        </table>
      </section>
      <section class="card"><div class="wmount" data-w="envmap"></div></section>
      <section class="card"><h2>Clusters</h2><table class="summary">${E.clusters.map((c) => `<tr><th>${esc(c.name)}</th><td>${c.hosts} hosts${c.note ? ` · <span class="muted">${esc(c.note)}</span>` : ''}</td></tr>`).join('')}</table></section>
      <section class="card"><h2>Hardware</h2><div class="scrollx"><table class="summary wide"><tr><th>Hosts</th><th>Model</th><th>CPU</th><th>Cores</th><th>RAM</th></tr>${E.hardware.map((h) => `<tr><td>${h.n}</td><td>${esc(h.model)}</td><td>${esc(h.cpu)}</td><td>${h.cores}</td><td>${esc(h.ram)}</td></tr>`).join('')}</table></div></section>
      <section class="card"><h2>Things worth fixing (and talking about)</h2><ul class="prose">
        <li><strong>${E.housekeeping.snapshots} snapshots</strong> on ${E.housekeeping.snapVMs} VMs; oldest from ${esc(E.housekeeping.oldest)}.</li>
        <li><strong>${E.storage.vmfs5} datastores</strong> still on VMFS 5.</li>
        <li><strong>Admission control off</strong> in the Internal cluster.</li>
        <li><strong>GPU cluster HA warnings</strong> (isolation address, heartbeat datastores).</li>
        <li><strong>${E.housekeeping.ntp} hosts</strong> with NTP missing or not running.</li>
        <li><strong>${E.housekeeping.toolsUpgradable} VMs</strong> with an upgradable VMware Tools.</li>
        <li><strong>${E.housekeeping.zombies.toLocaleString()}</strong> "possible zombie vmdk" warnings to verify (never delete blindly).</li>
        <li><strong>${E.housekeeping.cdrom} VMs</strong> with a CD-ROM connected.</li>
        <li><strong>${S.empty} empty datastores</strong>, lowest at ${esc(S.lowest)}.</li>
        <li>vMotion probably shares the management network (confirm in vCenter).</li></ul></section>
      <div class="nav"><button class="btn" id="back">← Home</button><button class="btn primary" id="q">Quiz me on my environment</button></div>`, 'My environment');
    mountWidgets();
    $('#back').onclick = () => go(home);
    $('#q').onclick = () => go(startModuleQuiz, 'm7');
  }

  // ---------- tutor ----------
  function tutorPage() {
    show(`
      <section class="card"><p class="kicker">AI tutor</p><h1>Ask anything</h1><p class="lead">Ask about VMware, storage, hardware or your own environment. You can also practise a spoken-style mock interview.</p></section>
      <div id="coach"></div>
      <div class="nav"><button class="btn" id="back">← Home</button><span></span></div>`, 'Tutor');
    C.mount($('#coach'), {
      id: 'tutor', title: 'Tutor', defaultOpen: true, intro: 'Ask a question, or start a mock interview below.',
      placeholder: 'Ask a VMware, storage or hardware question…',
      systemPrompt: () => `${BASE}\n\nYou are in free tutor mode. Teach from the basics, in small steps, and finish most replies with ONE short check question. If asked for a mock interview, act as a senior systems engineer who specialises in VMware vSphere, Windows, x86 hardware and performance troubleshooting ("why is this slow?"): ask ONE question at a time, wait for the learner's answer, give 2 to 3 sentences of honest feedback (what was good, what to add), then ask the next question. Base questions on the learner's environment and basics. Do not reveal answers before they attempt.`,
      chips: () => [['Start a mock interview', 'Start a mock interview. Ask me the first question.'], ['Explain a concept simply…', null], ['Test me on my environment', 'Ask me one question about my own environment (hosts, clusters, storage, network), wait for my answer, then give feedback.'], ['What is the most important thing to learn?', 'Given my environment and the interview, what are the 5 most important things I must understand? Keep it short.']],
    });
    $('#back').onclick = () => go(home);
  }

  // ---------- settings ----------
  const dlg = $('#settings');
  function openSettings() {
    const has = !!C.getKey();
    dlg.innerHTML = `
      <form method="dialog" class="settings">
        <h2>Settings</h2>
        <div class="field"><span>DeepSeek API key</span>${has ? '<p class="muted small">A key is saved in this browser.</p><button type="button" class="btn" id="rmkey">Remove key</button>' : C.keyFormHTML(true)}</div>
        <label class="field"><span>Model</span><select id="model"><option value="deepseek-chat">deepseek-chat (fast)</option><option value="deepseek-reasoner">deepseek-reasoner (slower, thinks more)</option></select></label>
        <div class="field"><span>Progress</span><button type="button" class="btn" id="reset">Reset my progress</button></div>
        <div class="row gap"><button class="btn primary" value="close">Close</button></div>
      </form>`;
    $('#model', dlg).value = C.getModel();
    $('#model', dlg).onchange = (e) => C.setModel(e.target.value);
    const rm = $('#rmkey', dlg); if (rm) rm.onclick = () => { C.clearKey(); dlg.close(); go(home); };
    const kf = $('[data-keyform]', dlg); if (kf) C.bindKeyForm(kf, () => { dlg.close(); go(home); });
    $('#reset', dlg).onclick = () => { if (confirm('Reset all quiz and challenge progress?')) { P.q = {}; P.c = {}; P.l = {}; save(); dlg.close(); go(home); } };
    dlg.showModal();
  }
  hdr.settings.addEventListener('click', openSettings);

  home();
})();
