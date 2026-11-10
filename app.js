(() => {
  'use strict';

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const app = $('#app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const LETTERS = 'ABCDEFGHI';
  const plain = (html) => { const s = html.replace(/<br>|<li>|<div[^>]*>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); return s.length > 90 ? s.slice(0, 88) + '…' : s; };

  // Only the currently running section may paint the screen. Skipping a section bumps the token,
  // so any of its pending async steps silently stop.
  let token = 0;
  const alive = (t) => t === token;
  const paint = (t, html) => { if (alive(t)) { app.innerHTML = html; window.scrollTo(0, 0); } return alive(t); };

  // ---------- header: timers + skip ----------
  const hdr = { sec: $('#hdr-section'), timer: $('#hdr-timer'), total: $('#hdr-total'), skip: $('#hdr-skip'), bar: $('#hdr') };
  let countdown = null;
  let skipFn = null;
  let overall = null;
  const setTimer = (text, cls = '') => { hdr.timer.textContent = text; hdr.timer.className = 'timer ' + cls; };
  const stopCountdown = () => { if (countdown) clearInterval(countdown); countdown = null; };
  function startCountdown(seconds, onEnd) {
    stopCountdown();
    const end = Date.now() + seconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setTimer('⏱ ' + fmt(left), left <= 10 ? 'warn' : '');
      if (left <= 0) { stopCountdown(); onEnd(); }
    };
    tick();
    countdown = setInterval(tick, 200);
  }
  hdr.skip.addEventListener('click', () => {
    if (skipFn && confirm('Skip the rest of this section? Unanswered items will score zero.')) skipFn();
  });

  // ---------- state ----------
  const state = { mode: 'exam', results: {}, started: 0, sections: [] };

  // ---------- visual reasoning generator (fresh shapes, angles and patterns every time) ----------
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const SHAPES = [
    { name: 'F-shaped pentomino (5 squares)', cells: [[2, 1], [3, 1], [1, 2], [2, 2], [2, 3]] },
    { name: 'L-shaped pentomino (4 squares in a line with a foot)', cells: [[2, 0], [2, 1], [2, 2], [2, 3], [3, 3]] },
    { name: 'N-shaped pentomino', cells: [[2, 0], [2, 1], [2, 2], [1, 2], [1, 3]] },
    { name: 'P-shaped pentomino (a 2x2 block with one extra square)', cells: [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3]] },
    { name: 'Y-shaped pentomino (4 squares in a line with a bump on the side)', cells: [[2, 0], [2, 1], [2, 2], [2, 3], [1, 1]] },
    { name: 'L-shaped tetromino (3 squares in a line with a foot)', cells: [[2, 1], [2, 2], [2, 3], [3, 3]] },
  ];
  const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];
  const cellsSVG = (shape, color, rot, mirror) => {
    const t = `rotate(${rot % 360} 50 50)` + (mirror ? ' translate(100 0) scale(-1 1)' : '');
    const rects = shape.cells.map(([x, y]) => `<rect x="${x * 16 + 10}" y="${y * 16 + 10}" width="16" height="16" rx="1.5"/>`).join('');
    return `<svg viewBox="0 0 100 100" class="fig" aria-hidden="true"><g transform="${t}" fill="${color}" stroke="var(--bg)" stroke-width="1.2">${rects}</g></svg>`;
  };
  function rotationQuestion(shape, color) {
    const base = pick([0, 90, 180, 270]), bm = Math.random() < 0.5;
    const findMirror = Math.random() < 0.35;
    let opts;
    if (!findMirror) {
      const r = pick([90, 180, 270]);
      opts = shuffle([{ ok: true, rot: r, m: false }, ...shuffle([0, 90, 180, 270]).slice(0, 3).map((x) => ({ ok: false, rot: x, m: true }))]);
    } else {
      opts = shuffle([...[90, 180, 270].map((x) => ({ ok: false, rot: x, m: false })), { ok: true, rot: pick([0, 90, 180, 270]), m: true }]);
    }
    const answer = opts.findIndex((o) => o.ok);
    const what = (o) => (o.m ? `a MIRROR image (flipped) of the target, turned ${o.rot}°` : `the target turned ${o.rot}° clockwise`);
    return {
      visual: true,
      q: findMirror
        ? 'Three options are the target only <strong>turned</strong>. Which one is <strong>flipped</strong> (a mirror image)?'
        : 'Which option is the <strong>same shape</strong> as the target, only <strong>turned</strong> (rotated), not flipped?',
      figure: `<div class="target"><span>Target</span>${cellsSVG(shape, color, base, bm)}</div>`,
      options: opts.map((o) => cellsSVG(shape, color, base + o.rot, o.m !== bm)),
      answer,
      describe: `Shape-rotation question. The target is an ${shape.name}. ${findMirror ? 'The learner must find the one option that is a mirror image.' : 'The learner must pick the option that is only rotated, not mirrored.'} ` +
        opts.map((o, k) => `Option ${LETTERS[k]}: ${what(o)}.`).join(' ') + ' Good method: track one distinctive square (the nub) while mentally rotating; mirror images can never be matched by rotation.',
      steps: [
        'Flipped (mirror-image) shapes look similar but can never be matched just by turning, like your left and right glove.',
        findMirror ? `Options ${opts.map((o, k) => (o.ok ? null : LETTERS[k])).filter(Boolean).join(', ')} are the target turned to different angles.` : `Option ${LETTERS[answer]} is the target turned ${opts[answer].rot}° clockwise.`,
        findMirror ? `Option <strong>${LETTERS[answer]}</strong> is flipped. However you turn it, it never matches.` : 'The other options are mirror images, turned to different angles to confuse you.',
      ],
      trick: 'Pick one stand-out part (the little “nub”) and track where it goes as you mentally turn the shape.',
    };
  }

  const frame = (inner) => `<svg viewBox="0 0 60 60" class="fig sm" aria-hidden="true"><rect x="2" y="2" width="56" height="56" rx="5" class="frame"/>${inner}</svg>`;
  const qmark = `<svg viewBox="0 0 60 60" class="fig sm" aria-hidden="true"><rect x="2" y="2" width="56" height="56" rx="5" class="frame dashed"/><text x="30" y="40" text-anchor="middle" class="qm">?</text></svg>`;
  const seqFigure = (frames) => `<div class="seqrow">${frames.join('<span class="arrow">→</span>')}<span class="arrow">→</span>${qmark}</div>`;
  // Shuffle 4 candidate answers (first is correct) that must all look different (by key).
  const visOpts = (correct, wrongs, key) => {
    const out = [correct]; for (const w of wrongs) if (out.length < 4 && !out.some((o) => key(o) === key(w))) out.push(w);
    const s = shuffle(out.map((o, i) => ({ o, ok: i === 0 })));
    return { list: s.map((x) => x.o), answer: s.findIndex((x) => x.ok) };
  };
  const visQ = (q, frames, render, v, describe, steps, trick) => ({ visual: true, q, figure: seqFigure(frames.map(render)), options: v.list.map(render), answer: v.answer, describe: describe + ' Options: ' + v.list.map((o, k) => `${LETTERS[k]}) ${o.d}`).join('; ') + '.', steps, trick });

  const QN = { TL: 'top-left', TR: 'top-right', BR: 'bottom-right', BL: 'bottom-left' };
  const posName = ([x, y]) => (x === 1 && y === 1 ? 'centre' : `${['top', 'middle', 'bottom'][y]}-${['left', 'middle', 'right'][x]}`);
  const BORDER = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
  const ord = ['1st', '2nd', '3rd', '4th'];

  const PATTERNS = [
    function dotWalk() {
      const s = R8(), k = pick([1, 1, 2]), d = pick([1, -1]); const at = (i) => BORDER[(((s + d * k * i) % 8) + 8) % 8];
      const grid = '<path d="M21 4V56M39 4V56M4 21H56M4 39H56" class="gridline"/>';
      const render = (o) => frame(`${grid}<circle cx="${12 + o.p[0] * 18}" cy="${12 + o.p[1] * 18}" r="6" class="ink"/>`);
      const mk = (p) => ({ p, d: `dot at ${posName(p)}` });
      const v = visOpts(mk(at(4)), [mk(at(5)), mk(at(3)), mk([1, 1]), mk(at(-4 + 8)), mk(at(6)), mk(at(2))], (o) => o.p.join());
      const dir = d === 1 ? 'clockwise' : 'anticlockwise';
      return visQ('Which picture comes next in the pattern?', [0, 1, 2, 3].map((i) => mk(at(i))), render, v,
        `Picture sequence on a 3x3 grid; a dot moves around the edge. Frames: ${[0, 1, 2, 3].map((i) => `${ord[i]} ${posName(at(i))}`).join(', ')}. What comes next?`,
        [`The dot moves around the outside edge, ${k} square${k > 1 ? 's' : ''} at a time, ${dir}: ${[0, 1, 2, 3].map((i) => posName(at(i))).join(' → ')}.`, `One more move ${dir} lands on <strong>${posName(at(4))}</strong>.`],
        'Describe each step in words (“moves two squares clockwise”) and repeat that rule once more.');
    },
    function arrowTurn() {
      const a0 = pick([0, 45, 90, 135, 180, 225, 270, 315]), st = pick([45, 90, 135]) * pick([1, -1]); const ang = (i) => (((a0 + st * i) % 360) + 360) % 360;
      const render = (o) => frame(`<g transform="rotate(${o.a} 30 30)"><path d="M30 12 L40 26 H34 V48 H26 V26 H20 Z" class="ink"/></g>`);
      const NAMES = { 0: 'up', 45: 'up-right', 90: 'right', 135: 'down-right', 180: 'down', 225: 'down-left', 270: 'left', 315: 'up-left' };
      const mk = (a) => ({ a, d: `arrow pointing ${NAMES[a]}` });
      const v = visOpts(mk(ang(4)), [mk((ang(4) + 45) % 360), mk((ang(4) + 315) % 360), mk((ang(4) + 180) % 360), mk(ang(3)), mk(ang(5))], (o) => o.a);
      const dir = st > 0 ? 'clockwise' : 'anticlockwise';
      return visQ('Which picture comes next in the pattern?', [0, 1, 2, 3].map((i) => mk(ang(i))), render, v,
        `Picture sequence of an arrow. Frames point: ${[0, 1, 2, 3].map((i) => NAMES[ang(i)]).join(', ')}. What comes next?`,
        [`The arrow turns ${Math.abs(st)}° ${dir} each time: ${[0, 1, 2, 3].map((i) => NAMES[ang(i)]).join(' → ')}.`, `One more turn: it points <strong>${NAMES[ang(4)]}</strong>.`],
        `For rotations, work out the turn per step (here ${Math.abs(st)}°, ${Math.abs(st) === 45 ? 'an eighth' : Math.abs(st) === 90 ? 'a quarter' : 'three eighths'} of a circle) and add it once more.`);
    },
    function polygons() {
      const up = Math.random() < 0.6; const n0 = up ? pick([3, 4]) : pick([8, 9]); const n = (i) => n0 + (up ? i : -i);
      const render = (o) => {
        const pts = Array.from({ length: o.n }, (_, k) => { const t = -Math.PI / 2 + (2 * Math.PI * k) / o.n; return `${(30 + 21 * Math.cos(t)).toFixed(1)},${(31 + 21 * Math.sin(t)).toFixed(1)}`; }).join(' ');
        return frame(`<polygon points="${pts}" class="ink-outline"/>`);
      };
      const mk = (x) => ({ n: x, d: `a ${x}-sided shape` });
      const ans = n(4); const v = visOpts(mk(ans), [mk(ans + 1), mk(ans - 1), mk(ans + 2), mk(ans - 2)].filter((o) => o.n >= 3), (o) => o.n);
      return visQ('Which picture comes next in the pattern?', [0, 1, 2, 3].map((i) => mk(n(i))), render, v,
        `Picture sequence of regular shapes with ${[0, 1, 2, 3].map(n).join(', ')} sides. What comes next? (The learner must count sides.)`,
        [`Count the sides: ${[0, 1, 2, 3].map(n).join(', ')}.`, `One side is ${up ? 'added' : 'removed'} each time, so next is a <strong>${ans}-sided shape</strong>.`],
        'When shapes change, count something: sides, dots, lines or corners.');
    },
    function quarterDots() {
      const order = Math.random() < 0.5 ? ['TL', 'TR', 'BR', 'BL'] : ['TL', 'BL', 'BR', 'TR']; const s = R4(); const q = (i) => order[(s + i) % 4];
      const down = Math.random() < 0.35; const d0 = down ? pick([5, 6]) : pick([1, 2]); const n = (i) => d0 + (down ? -i : i);
      const Q = { TL: [4, 4], TR: [30, 4], BR: [30, 30], BL: [4, 30] };
      const render = (o) => {
        const [x, y] = Q[o.q];
        const dots = Array.from({ length: o.n }, (_, k) => `<circle cx="${30 + (k - (o.n - 1) / 2) * 7.5}" cy="30" r="3" class="dot"/>`).join('');
        return frame(`<rect x="${x}" y="${y}" width="26" height="26" class="shade"/><path d="M30 4V56M4 30H56" class="gridline"/>${dots}`);
      };
      const mk = (qq, nn) => ({ q: qq, n: nn, d: `${QN[qq]} shaded with ${nn} dot${nn === 1 ? '' : 's'}` });
      const v = visOpts(mk(q(4), n(4)), [mk(q(5), n(4)), mk(q(4), n(3)), mk(q(3), n(4)), mk(q(5), n(5)), mk(q(4), n(5))].filter((o) => o.n >= 1), (o) => o.q + o.n);
      const dir = order[1] === 'TR' ? 'clockwise' : 'anticlockwise';
      return visQ('Two things change at once. Which picture comes next?', [0, 1, 2, 3].map((i) => mk(q(i), n(i))), render, v,
        `Picture sequence: a square split into 4 quarters, one shaded, with dots in the middle. Frames: ${[0, 1, 2, 3].map((i) => `${QN[q(i)]} shaded + ${n(i)} dots`).join('; ')}. What comes next?`,
        [`Rule 1: the shaded quarter moves ${dir}: ${[0, 1, 2, 3].map((i) => QN[q(i)]).join(' → ')} → next <strong>${QN[q(4)]}</strong>.`, `Rule 2: the dots go ${down ? 'down' : 'up'} by one: ${[0, 1, 2, 3].map(n).join(', ')} → <strong>${n(4)}</strong>.`, 'Only one option follows both rules.'],
        'Track each changing feature separately, then find the option that satisfies all the rules.');
    },
    function gridFill() {
      const st = pick([1, 2]); const c0 = st === 2 ? 1 : pick([1, 2]); const c = (i) => c0 + st * i; const ans = c(4);
      if (ans > 9) return gridFill();
      const render = (o) => frame(Array.from({ length: 9 }, (_, k) => `<rect x="${7 + (k % 3) * 16}" y="${7 + Math.floor(k / 3) * 16}" width="14" height="14" rx="2" class="${k < o.c ? 'shade' : 'cell'}"/>`).join(''));
      const mk = (x) => ({ c: x, d: `${x} squares filled` });
      const v = visOpts(mk(ans), [mk(ans - 1), mk(ans + 1), mk(c(3)), mk(ans - 2), mk(ans - 3), mk(ans + 2)].filter((o) => o.c >= 1 && o.c <= 9), (o) => o.c);
      return visQ('Which picture comes next in the pattern?', [0, 1, 2, 3].map((i) => mk(c(i))), render, v,
        `Picture sequence of 3x3 grids filled in reading order. Filled squares per frame: ${[0, 1, 2, 3].map(c).join(', ')}. What comes next?`,
        [`Count the filled squares: ${[0, 1, 2, 3].map(c).join(', ')}.`, `They go up by ${st} each time, so next has <strong>${ans}</strong> filled squares.`],
        'Count first. Most picture patterns hide a simple number pattern.');
    },
  ];
  const R8 = () => Math.floor(Math.random() * 8), R4 = () => Math.floor(Math.random() * 4);

  function visualQuestions() {
    const colors = shuffle(COLORS);
    const rot = shuffle(SHAPES).slice(0, 4).map((s, i) => rotationQuestion(s, colors[i]));
    const pat = shuffle(PATTERNS).slice(0, 4).map((f) => f());
    return [rot[0], pat[0], rot[1], pat[1], rot[2], pat[2], rot[3], pat[3]];
  }

  // ---------- building a fresh test: least-seen first, options shuffled ----------
  const SEEN_KEY = 'aptitude.seen.v1';
  const seenLoad = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch { return {}; } };
  const seenSave = (s) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch { /* private mode */ } };
  const leastSeen = (items, n, seen, key = (x) => x.id) => shuffle(items).sort((a, b) => (seen[key(a)] || 0) - (seen[key(b)] || 0)).slice(0, n);
  const shuffleOptions = (q) => {
    const idx = shuffle(q.options.map((_, i) => i));
    return { ...q, options: idx.map((i) => q.options[i]), answer: idx.indexOf(q.answer) };
  };
  function buildQuestions(bank) {
    const G = window.GEN, seen = seenLoad(); let qs = [];
    const used = [];
    if (bank === 'visual') return visualQuestions();
    if (bank === 'maths') {
      const lv = (l) => G.maths.filter((f) => f.level === l);
      for (const [l, n] of [[1, 4], [2, 7], [3, 4]]) {
        const fams = leastSeen(lv(l), n, seen); used.push(...fams.map((f) => f.id));
        qs.push(...fams.map((f) => ({ id: f.id, ...f.gen() })));
      }
    } else if (bank === 'logic') {
      const gens = leastSeen(G.logic, 6, seen); used.push(...gens.map((f) => f.id));
      qs.push(...gens.map((f) => ({ id: f.id, ...f.gen() })));
      const pool = (k) => B.staticLogic.filter((q) => q.kind === k);
      const statics = [...leastSeen(pool('syll'), 2, seen), ...leastSeen(pool('cond'), 1, seen), ...leastSeen(pool('fam'), 1, seen)];
      used.push(...statics.map((q) => q.id)); qs.push(...statics);
      qs = shuffle(qs);
    } else if (bank === 'vocab') {
      for (const [k, n] of Object.entries(B.vocabMix)) {
        const items = leastSeen(B.vocab.filter((q) => q.kind === k), n, seen); used.push(...items.map((q) => q.id)); qs.push(...items);
      }
      qs = shuffle(qs);
    }
    used.forEach((id) => { seen[id] = (seen[id] || 0) + 1; });
    seenSave(seen);
    return qs.map(shuffleOptions);
  }
  function fluencyRounds() {
    const F = B.fluency; const [c1, c2] = shuffle(F.categories); const L = pick(F.letters);
    return [
      { prompt: `Name as many <strong>${c1[0]}</strong> as you can.`, hint: `e.g. ${c1[1]}` },
      { prompt: `Type as many words as you can that start with the letter <strong>${L}</strong>.`, letter: L.toLowerCase(), hint: 'Any real word counts. No names of people or places.' },
      { prompt: `Name as many <strong>${c2[0]}</strong> as you can.`, hint: `e.g. ${c2[1]}` },
    ];
  }
  const resetSeen = () => { try { localStorage.removeItem(SEEN_KEY); } catch { /* ignore */ } };

  // ---------- section definitions ----------
  const B = window.BANK;
  const ALL_SECTIONS = [
    { id: 'fluency', title: 'Verbal fluency', est: 4, type: 'fluency',
      intro: 'Three quick rounds of <strong>60 seconds</strong> each. Type a word and press <kbd>Enter</kbd> to add it. Go for quantity, and don’t worry about spelling. Repeats only count once.' },
    { id: 'digits', title: 'Number sequence memory', est: 6, type: 'span', kind: 'digits',
      intro: 'Numbers will flash one at a time. Then type them back, <strong>first in the same order</strong>, later <strong>in reverse order</strong>. Sequences get longer until you miss two in a row at the same length.' },
    { id: 'maths', title: 'Mathematics', est: 15, minutes: 15, type: 'mcq', bank: 'maths',
      intro: '15 questions, from simple calculations to problem-solving. About 1 minute each. Use the scratch paper under each question. You can move back and forth between questions.' },
    { id: 'logic', title: 'Logical reasoning', est: 10, minutes: 10, type: 'mcq', bank: 'logic',
      intro: '10 puzzles: truth/lie, ordering, “must be true” statements, codes and directions. Read each word carefully, especially <em>all</em>, <em>some</em> and <em>must</em>.' },
    { id: 'visual', title: 'Visual reasoning', est: 8, minutes: 8, type: 'mcq', bank: 'visual',
      intro: '8 questions: match a rotated shape (watch out for mirror images!) and find what comes next in picture patterns.' },
    { id: 'coding', title: 'Symbol–letter matching', est: 4, type: 'coding',
      intro: 'A key links 9 symbols to letters A–I. Round 1 (<strong>90 s</strong>): see a symbol, pick its letter. Round 2 (<strong>90 s</strong>): reverse it, see a letter and pick its symbol. Be fast <em>and</em> accurate.' },
    { id: 'dots', title: 'Dot sequence (Simon says)', est: 5, type: 'span', kind: 'dots',
      intro: 'Dots will light up one after another. Click them in the <strong>same order</strong>, and later in <strong>reverse order</strong>. Sequences get longer until you miss two in a row at the same length.' },
    { id: 'vocab', title: 'Words & meanings', est: 6, minutes: 6, type: 'mcq', bank: 'vocab',
      intro: '15 vocabulary questions: synonyms, opposites, meaning in context, spelling and analogies. Go with your first instinct if unsure.' },
    { id: 'reflect', title: 'Reflection & discussion', est: 3, type: 'reflect',
      intro: 'Short written answers to discuss with the assessor afterwards. There are no right or wrong answers. Be honest and specific.' },
  ];

  // ---------- coach key setup & settings ----------
  function renderCoachSetup() {
    const el = $('#coach-setup');
    if (!el) return;
    if (window.Coach.getKey()) {
      el.innerHTML = `<div class="coach-ok"><span class="spark">✳</span><span><strong>AI coach is on.</strong> Find it under every question: share your thinking and it guides you without giving the answer away.</span><button class="link" id="open-settings">Settings</button></div>`;
      $('#open-settings').onclick = openSettings;
    } else {
      el.innerHTML = `<div class="coach-card"><p class="coach-title"><span class="spark">✳</span> Turn on the AI coach</p><p class="small">A coach under every question checks your reasoning and nudges you toward the answer. Paste your DeepSeek API key once; it stays on this device.</p>${window.Coach.keyFormHTML(true)}<button class="link small" id="skip-key">Continue without coach</button></div>`;
      window.Coach.bindKeyForm(el.querySelector('[data-keyform]'), renderCoachSetup);
      $('#skip-key').onclick = () => { el.innerHTML = ''; };
    }
  }

  function openSettings() {
    const dlg = $('#settings');
    const key = window.Coach.getKey();
    dlg.innerHTML = `
      <div class="settings">
        <h2>Settings</h2>
        <p class="small muted">AI coach (DeepSeek). The key is stored only in this browser.</p>
        <p>${key ? `Key saved: <code>${esc(key.slice(0, 5))}…${esc(key.slice(-4))}</code>` : 'No key saved.'}</p>
        <div id="settings-key">${window.Coach.keyFormHTML(true)}</div>
        <label class="field"><span>Model</span>
          <select id="model">
            <option value="deepseek-chat">deepseek-chat (fast, recommended)</option>
            <option value="deepseek-reasoner">deepseek-reasoner (thinks longer, slower)</option>
          </select>
        </label>
        <div class="row gap">
          ${key ? '<button type="button" class="btn" id="forget">Remove key</button>' : ''}
          <button type="button" class="btn" id="reset-seen">Reset question history</button>
          <button type="button" class="btn primary" id="done">Done</button>
        </div>
      </div>`;
    $('#done', dlg).onclick = () => dlg.close();
    $('#model', dlg).value = window.Coach.getModel();
    $('#model', dlg).onchange = (e) => window.Coach.setModel(e.target.value);
    window.Coach.bindKeyForm($('[data-keyform]', dlg), () => { openSettings(); renderCoachSetup(); });
    $('#reset-seen', dlg).onclick = (e) => { resetSeen(); e.target.textContent = 'History cleared ✓'; };
    const f = $('#forget', dlg);
    if (f) f.onclick = () => { window.Coach.clearKey(); openSettings(); renderCoachSetup(); };
    if (!dlg.open) dlg.showModal();
  }

  // ---------- start screen ----------
  function home() {
    token++; stopCountdown(); skipFn = null; if (overall) clearInterval(overall);
    hdr.bar.hidden = true;
    const total = ALL_SECTIONS.reduce((s, x) => s + x.est, 0);
    app.innerHTML = `
      <section class="card hero">
        <h1>Aptitude Test</h1>
        <p class="lead">A full practice assessment of about <strong>${total} minutes</strong> covering memory, maths, logic, visual reasoning, speed and vocabulary. Every question comes with a step-by-step explanation in plain language.</p>
        <p class="small muted">Every attempt is a fresh mix: new numbers, shapes and puzzles, and the questions you’ve seen least come first.</p>
        <ol class="toc">
          ${ALL_SECTIONS.map((s) => `<li><label><input type="checkbox" name="sec" value="${s.id}" checked> <span>${s.title}</span><small>${s.est} min</small></label></li>`).join('')}
        </ol>
        <fieldset class="mode">
          <legend>Mode</legend>
          <label><input type="radio" name="mode" value="exam" checked> <span><strong>Exam</strong>: timed sections, answers and explanations at the end</span></label>
          <label><input type="radio" name="mode" value="practice"> <span><strong>Practice</strong>: no time limit on questions, explanation right after each answer</span></label>
        </fieldset>
        <div class="coach-setup" id="coach-setup"></div>
        <p class="tip">Before you start: find a quiet spot, keep your S Pen or scrap paper ready, and allow an uninterrupted hour.</p>
        <button class="btn primary big" id="go">Start test</button>
      </section>`;
    renderCoachSetup();
    $('#go').onclick = () => {
      const chosen = $$('input[name=sec]:checked').map((i) => i.value);
      if (!chosen.length) { alert('Pick at least one section.'); return; }
      state.mode = $('input[name=mode]:checked').value;
      state.sections = ALL_SECTIONS.filter((s) => chosen.includes(s.id));
      state.results = {};
      state.started = Date.now();
      hdr.bar.hidden = false;
      overall = setInterval(() => { hdr.total.textContent = 'Total ' + fmt(Math.floor((Date.now() - state.started) / 1000)); }, 500);
      runSection(0);
    };
  }

  // ---------- section runner ----------
  function runSection(i) {
    if (i >= state.sections.length) return showResults();
    const sec = state.sections[i];
    const t = ++token;
    stopCountdown(); skipFn = null;
    hdr.sec.textContent = `${i + 1}/${state.sections.length} · ${sec.title}`;
    setTimer('');
    hdr.skip.hidden = true;
    const timing = sec.minutes ? (state.mode === 'practice' ? 'Untimed in practice mode' : `Time limit: ${sec.minutes} minutes`) : `About ${sec.est} minutes`;
    paint(t, `
      <section class="card">
        <p class="kicker">Section ${i + 1} of ${state.sections.length}</p>
        <h2>${sec.title}</h2>
        <p>${sec.intro}</p>
        <p class="muted">${timing}</p>
        <button class="btn primary" id="begin">Begin section</button>
      </section>`);
    $('#begin').onclick = () => {
      hdr.skip.hidden = false;
      let finished = false;
      const done = (res) => {
        if (finished) return; finished = true;
        state.results[sec.id] = res;
        runSection(i + 1);
      };
      const runners = { mcq: runMCQ, span: runSpan, coding: runCoding, fluency: runFluency, reflect: runReflect };
      runners[sec.type](sec, t, done);
    };
  }

  // ---------- multiple choice ----------
  const explain = (q) => `<ol class="steps">${q.steps.map((s) => `<li>${s}</li>`).join('')}</ol>${q.trick ? `<p class="trick"><strong>Simple trick:</strong> ${q.trick}</p>` : ''}`;

  let scratchOpen = false;
  function runMCQ(sec, t, done) {
    const qs = buildQuestions(sec.bank);
    const answers = new Array(qs.length).fill(null);
    const practice = state.mode === 'practice';
    let i = 0;
    const finish = () => {
      stopCountdown();
      done({ type: 'mcq', questions: qs, answers, score: answers.filter((a, k) => a === qs[k].answer).length, total: qs.length });
    };
    skipFn = finish;
    if (practice) setTimer('Practice'); else startCountdown(sec.minutes * 60, finish);

    const render = () => {
      const q = qs[i];
      const qi = i;
      const locked = practice && answers[i] !== null;
      const nav = practice
        ? `<span></span><button class="btn primary" id="next" ${locked ? '' : 'disabled'}>${i === qs.length - 1 ? 'Finish section' : 'Next →'}</button>`
        : `<button class="btn" id="prev" ${i === 0 ? 'disabled' : ''}>← Back</button>
           ${i === qs.length - 1 ? '<button class="btn primary" id="fin">Finish section</button>' : '<button class="btn primary" id="next">Next →</button>'}`;
      if (!paint(t, `
        <section class="card qcard">
          <p class="kicker">Question ${i + 1} of ${qs.length}</p>
          <div class="qtext">${q.q}</div>
          ${q.figure ? `<div class="figure">${q.figure}</div>` : ''}
          <div class="options ${q.visual ? 'visual' : ''}">
            ${q.options.map((o, k) => {
              let cls = answers[i] === k ? 'sel' : '';
              if (locked) cls += k === q.answer ? ' right' : answers[i] === k ? ' wrong' : '';
              return `<button class="opt ${cls}" data-k="${k}" ${locked ? 'disabled' : ''}><span class="lbl">${LETTERS[k]}</span><span class="otext">${o}</span></button>`;
            }).join('')}
          </div>
          ${locked ? `<div class="feedback ${answers[i] === q.answer ? 'ok' : 'bad'}"><p class="verdict">${answers[i] === q.answer ? '✅ Correct!' : `❌ Not quite. The answer is <strong>${LETTERS[q.answer]}</strong>.`}</p>${explain(q)}</div>` : ''}
          <div id="coach"></div>
          <details class="scratch" ${scratchOpen ? 'open' : ''}><summary>✎ Scratch paper</summary><div id="scratch"></div></details>
          ${practice ? '' : `<div class="pips">${qs.map((_, k) => `<button class="pip ${k === i ? 'cur' : ''} ${answers[k] !== null ? 'done' : ''}" data-go="${k}" aria-label="Question ${k + 1}">${k + 1}</button>`).join('')}</div>`}
          <div class="nav">${nav}</div>
        </section>`)) return;
      window.Coach.mount($('#coach'), {
        question: q, section: sec.title, defaultOpen: practice,
        getSelected: () => answers[qi],
        isAnswered: () => practice && answers[qi] !== null,
      });
      const sc = $('details.scratch');
      const mountScratch = () => { if (sc.open && !sc.dataset.ready) { sc.dataset.ready = '1'; window.Scratch.mount($('#scratch'), q); } };
      sc.addEventListener('toggle', () => { scratchOpen = sc.open; mountScratch(); });
      mountScratch();
      $$('.opt').forEach((b) => (b.onclick = () => {
        answers[i] = +b.dataset.k;
        if (practice) { render(); const fb = $('.feedback'); if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        // exam mode: update in place so the coach chat and scratch paper stay as they are
        $$('.opt').forEach((x) => x.classList.toggle('sel', x === b));
        const pip = $(`.pip[data-go="${i}"]`); if (pip) pip.classList.add('done');
      }));
      $$('.pip').forEach((b) => (b.onclick = () => { i = +b.dataset.go; render(); }));
      const nx = $('#next'); if (nx) nx.onclick = () => { if (i === qs.length - 1) finish(); else { i++; render(); } };
      const pv = $('#prev'); if (pv) pv.onclick = () => { i--; render(); };
      const fn = $('#fin'); if (fn) fn.onclick = () => {
        const left = answers.filter((a) => a === null).length;
        if (left && !confirm(`${left} question(s) unanswered. Finish anyway?`)) return;
        finish();
      };
    };
    render();
  }

  // ---------- memory span (digits & dots) ----------
  const DOTPOS = [[18, 22], [52, 12], [84, 26], [30, 50], [66, 44], [14, 80], [46, 78], [80, 66], [88, 90]];
  const dotBoard = (lit = -1, clickable = false) => `
    <div class="board ${clickable ? 'live' : ''}">
      ${DOTPOS.map(([x, y], k) => `<button class="spot ${k === lit ? 'lit' : ''}" style="left:${x}%;top:${y}%" data-k="${k}" ${clickable ? '' : 'tabindex="-1"'} aria-label="dot ${k + 1}"></button>`).join('')}
    </div>`;

  function runSpan(sec, t, done) {
    const dots = sec.kind === 'dots';
    const out = { type: 'span', kind: sec.kind, forward: 0, backward: 0, trials: [] };
    skipFn = () => done(out);
    setTimer('Untimed');

    const waitBtn = (html, label) => new Promise((res) => {
      if (!paint(t, `<section class="card">${html}<button class="btn primary" id="ok">${label}</button></section>`)) return;
      $('#ok').onclick = res;
    });
    const gen = (n) => { const s = []; while (s.length < n) { const d = dots ? Math.floor(Math.random() * 9) : 1 + Math.floor(Math.random() * 9); if (d !== s[s.length - 1]) s.push(d); } return s; };

    async function present(seq, dir) {
      const head = `<p class="kicker">${dir === 'forward' ? 'Same order' : 'Reverse order'} · length ${seq.length}</p>`;
      if (!paint(t, `<section class="card center">${head}<p class="muted">Watch carefully…</p>${dots ? dotBoard() : '<div class="flash"></div>'}</section>`)) return false;
      await sleep(900);
      for (const d of seq) {
        if (!alive(t)) return false;
        if (dots) { $$('.spot').forEach((s, k) => s.classList.toggle('lit', k === d)); }
        else $('.flash').textContent = d;
        await sleep(dots ? 700 : 1000);
        if (!alive(t)) return false;
        if (dots) $$('.spot').forEach((s) => s.classList.remove('lit'));
        else $('.flash').textContent = '';
        await sleep(dots ? 300 : 250);
      }
      return alive(t);
    }

    const collect = (len, dir) => new Promise((res) => {
      const head = `<p class="kicker">${dir === 'forward' ? 'Same order' : 'Reverse order'} · length ${len}</p>`;
      const ask = dir === 'forward' ? 'in the <strong>same order</strong>' : 'in <strong>reverse order</strong> (last one first)';
      if (dots) {
        if (!paint(t, `<section class="card center">${head}<p>Click the dots ${ask}.</p>${dotBoard(-1, true)}<p class="muted" id="cnt">0 / ${len}</p><button class="btn" id="clr">Start over</button></section>`)) return;
        let picks = [];
        $$('.spot').forEach((s) => (s.onclick = async () => {
          if (picks.length >= len) return;
          picks.push(+s.dataset.k);
          s.classList.add('lit'); setTimeout(() => s.classList.remove('lit'), 220);
          $('#cnt').textContent = `${picks.length} / ${len}`;
          if (picks.length === len) { await sleep(350); res(picks); }
        }));
        $('#clr').onclick = () => { picks = []; $('#cnt').textContent = `0 / ${len}`; };
      } else {
        if (!paint(t, `<section class="card center">${head}<p>Type the numbers ${ask}.</p><form id="f"><input id="ans" class="digits" inputmode="numeric" autocomplete="off" maxlength="${len}" aria-label="Your answer"><button class="btn primary">Submit</button></form></section>`)) return;
        const inp = $('#ans'); inp.focus();
        inp.oninput = () => { inp.value = inp.value.replace(/\D/g, ''); };
        $('#f').onsubmit = (e) => { e.preventDefault(); res(inp.value.split('').map(Number)); };
      }
    });

    (async () => {
      for (const dir of ['forward', 'backward']) {
        const intro = dir === 'forward'
          ? `<h2>Part 1: same order</h2><p>Example: if you see <strong>${dots ? 'dot 1, then dot 2, then dot 3' : '4 · 7 · 2'}</strong>, you answer <strong>${dots ? '1, 2, 3' : '472'}</strong>.</p>`
          : `<h2>Part 2: reverse order</h2><p>Now answer <strong>backwards</strong>. Example: if you see <strong>${dots ? 'dot 1, then dot 2, then dot 3' : '4 · 7 · 2'}</strong>, you answer <strong>${dots ? '3, 2, 1' : '274'}</strong>.</p>`;
        await waitBtn(intro, 'Start');
        if (!alive(t)) return;
        let len = dir === 'forward' ? 3 : 2;
        const max = dir === 'forward' ? 9 : 8;
        while (len <= max) {
          let hits = 0;
          for (let trial = 0; trial < 2; trial++) {
            const seq = gen(len);
            if (!(await present(seq, dir))) return;
            const resp = await collect(len, dir);
            if (!alive(t)) return;
            const target = dir === 'forward' ? seq : seq.slice().reverse();
            const ok = resp.join() === target.join();
            out.trials.push({ dir, len, ok });
            if (ok) { hits++; out[dir] = Math.max(out[dir], len); }
            const show = dots ? target.map((d) => d + 1).join(' → ') : target.join(' ');
            if (!paint(t, `<section class="card center"><p class="big-verdict ${ok ? 'ok' : 'bad'}">${ok ? '✅ Correct' : '❌ Missed'}</p>${ok ? '' : `<p class="muted">Correct answer${dots ? ' (dot numbers, left to right as placed)' : ''}: ${show}</p>`}</section>`)) return;
            await sleep(ok ? 800 : 1700);
            if (!alive(t)) return;
          }
          if (!hits) break;
          len++;
        }
      }
      done(out);
    })();
  }

  // ---------- symbol ↔ letter coding ----------
  const SYMBOLS = ['★', '●', '▲', '■', '◆', '♥︎', '✚', '☾', '♣︎'];
  function runCoding(sec, t, done) {
    const syms = shuffle(SYMBOLS); // syms[k] ↔ LETTERS[k]
    const out = { type: 'coding', forward: { right: 0, wrong: 0 }, reverse: { right: 0, wrong: 0 } };
    let onKey = null;
    const cleanup = () => { stopCountdown(); if (onKey) document.removeEventListener('keydown', onKey); onKey = null; };
    skipFn = () => { cleanup(); done(out); };
    setTimer('');
    const keyHTML = `<div class="codekey">${syms.map((s, k) => `<div><span class="sym">${s}</span><span>${LETTERS[k]}</span></div>`).join('')}</div>`;

    const phase = (name) => new Promise((res) => {
      const fwd = name === 'forward';
      const intro = fwd
        ? '<h2>Round 1: symbol → letter</h2><p>A symbol appears. Click (or type) its letter from the key. 90 seconds.</p>'
        : '<h2>Round 2: letter → symbol</h2><p>Now a letter appears. Click its symbol. 90 seconds.</p>';
      if (!paint(t, `<section class="card">${intro}${keyHTML}<button class="btn primary" id="ok">Start round</button></section>`)) return;
      $('#ok').onclick = () => {
        const score = out[name];
        let cur = -1;
        const next = () => { let n; do { n = Math.floor(Math.random() * 9); } while (n === cur); cur = n; $('#prompt').innerHTML = fwd ? syms[cur] : LETTERS[cur]; };
        const choices = fwd ? LETTERS.split('') : shuffle(syms.map((s, k) => k)).map((k) => syms[k]);
        paint(t, `
          <section class="card center">
            ${keyHTML}
            <div id="prompt" class="prompt"></div>
            <div class="choices ${fwd ? '' : 'symchoices'}">${choices.map((c) => `<button class="btn choice" data-v="${esc(c)}">${c}</button>`).join('')}</div>
            <p class="muted" id="tally">✅ 0 · ❌ 0</p>
          </section>`);
        const answer = (v) => {
          const ok = fwd ? v === LETTERS[cur] : v === syms[cur];
          ok ? score.right++ : score.wrong++;
          $('#tally').textContent = `✅ ${score.right} · ❌ ${score.wrong}`;
          const p = $('#prompt'); p.classList.remove('ok', 'bad'); void p.offsetWidth; p.classList.add(ok ? 'ok' : 'bad');
          next();
        };
        $$('.choice').forEach((b) => (b.onclick = () => answer(b.dataset.v)));
        if (fwd) {
          onKey = (e) => { const L = e.key.toUpperCase(); if (L.length === 1 && LETTERS.includes(L)) answer(L); };
          document.addEventListener('keydown', onKey);
        }
        next();
        startCountdown(90, () => { cleanup(); res(); });
      };
    });

    (async () => {
      await phase('forward'); if (!alive(t)) return;
      await phase('reverse'); if (!alive(t)) return;
      done(out);
    })();
  }

  // ---------- verbal fluency ----------
  function runFluency(sec, t, done) {
    const out = { type: 'fluency', rounds: [] };
    const rounds = fluencyRounds();
    skipFn = () => { stopCountdown(); done(out); };
    setTimer('');
    const round = (r) => new Promise((res) => {
      if (!paint(t, `<section class="card"><p class="kicker">Round ${out.rounds.length + 1} of ${rounds.length}</p><h2>${r.prompt}</h2><p class="muted">${r.hint}</p><button class="btn primary" id="ok">Start 60 seconds</button></section>`)) return;
      $('#ok').onclick = () => {
        const words = [];
        const rejected = [];
        paint(t, `
          <section class="card">
            <h2>${r.prompt}</h2>
            <form id="f" class="row"><input id="w" autocomplete="off" autocapitalize="off" placeholder="Type and press Enter" aria-label="Word"><button class="btn">Add</button></form>
            <p class="muted"><span id="n">0</span> counted</p>
            <div id="chips" class="chips"></div>
          </section>`);
        const inp = $('#w'); inp.focus();
        $('#f').onsubmit = (e) => {
          e.preventDefault();
          const w = inp.value.trim().toLowerCase(); inp.value = '';
          if (!w) return;
          const bad = (r.letter && !w.startsWith(r.letter)) || w.length < 2;
          if (bad) rejected.push(w);
          else if (!words.includes(w)) words.push(w);
          $('#n').textContent = words.length;
          $('#chips').insertAdjacentHTML('afterbegin', `<span class="chip ${bad ? 'x' : ''}">${esc(w)}</span>`);
        };
        startCountdown(60, () => {
          out.rounds.push({ prompt: r.prompt, words, rejected, count: words.length });
          inp.disabled = true;
          if (!alive(t)) return;
          $('#f').insertAdjacentHTML('afterend', `<p class="big-verdict">Time! ${words.length} counted.</p><button class="btn primary" id="nx">Continue</button>`);
          $('#nx').onclick = res;
        });
      };
    });
    (async () => {
      for (const r of rounds) { await round(r); if (!alive(t)) return; }
      done(out);
    })();
  }

  // ---------- reflection ----------
  function runReflect(sec, t, done) {
    setTimer('Untimed');
    const collect = () => ({ type: 'reflect', answers: B.reflection.map((q, k) => ({ q, a: ($('#r' + k) || {}).value || '' })) });
    skipFn = () => done(collect());
    paint(t, `
      <section class="card">
        <h2>Reflection & discussion</h2>
        ${B.reflection.map((q, k) => `<label class="reflect"><span>${k + 1}. ${q}</span><textarea id="r${k}" rows="3"></textarea></label>`).join('')}
        <button class="btn primary" id="ok">Finish test</button>
      </section>`);
    $('#ok').onclick = () => done(collect());
  }

  // ---------- results ----------
  function showResults() {
    token++; stopCountdown(); skipFn = null; if (overall) clearInterval(overall);
    hdr.sec.textContent = 'Results'; setTimer(''); hdr.skip.hidden = true;
    const R = state.results;
    const elapsed = fmt(Math.floor((Date.now() - state.started) / 1000));
    let mcqScore = 0, mcqTotal = 0;
    const rows = [];
    const lines = [`Aptitude test results (${new Date().toLocaleString()}), time taken ${elapsed}`];

    for (const sec of state.sections) {
      const r = R[sec.id];
      if (!r) continue;
      let val = '', note = '';
      if (r.type === 'mcq') {
        mcqScore += r.score; mcqTotal += r.total;
        const pct = Math.round((100 * r.score) / r.total);
        val = `${r.score} / ${r.total}`;
        note = `<div class="meter"><span style="width:${pct}%"></span></div>`;
      } else if (r.type === 'span') {
        val = `Forward ${r.forward || '-'} · Reverse ${r.backward || '-'}`;
        note = r.kind === 'digits' ? 'Longest sequence recalled. Typical adult range: forward 5–8, reverse 4–6.' : 'Longest sequence recalled. Typical adult range: forward 5–7, reverse 4–6.';
      } else if (r.type === 'coding') {
        const acc = (s) => (s.right + s.wrong ? Math.round((100 * s.right) / (s.right + s.wrong)) + '%' : '-');
        val = `Round 1: ${r.forward.right} correct (${acc(r.forward)}) · Round 2: ${r.reverse.right} correct (${acc(r.reverse)})`;
        note = 'Correct answers in 90 seconds, with accuracy. Round 2 is usually slower; that’s normal.';
      } else if (r.type === 'fluency') {
        val = r.rounds.map((x) => x.count).join(' · ') || '-';
        note = 'Words per 60-second round. Typing is slower than speaking; roughly 10+ typed per round is a solid result.';
      } else if (r.type === 'reflect') {
        val = `${r.answers.filter((a) => a.a.trim()).length} / ${r.answers.length} answered`;
      }
      rows.push(`<tr><th>${sec.title}</th><td><strong>${val}</strong>${note ? `<div class="muted small">${note}</div>` : ''}</td></tr>`);
      lines.push(`${sec.title}: ${val.replace(/<[^>]+>/g, '')}`);
    }
    const pct = mcqTotal ? Math.round((100 * mcqScore) / mcqTotal) : null;
    if (pct !== null) lines.splice(1, 0, `Multiple-choice total: ${mcqScore}/${mcqTotal} (${pct}%)`);

    const review = state.sections.filter((s) => R[s.id] && R[s.id].type === 'mcq').map((s) => {
      const r = R[s.id];
      return `<h3>${s.title} <span class="muted">${r.score}/${r.total}</span></h3>` + r.questions.map((q, k) => {
        const a = r.answers[k];
        const ok = a === q.answer;
        const yours = a === null ? 'No answer' : q.visual ? `Option ${LETTERS[a]}` : `${LETTERS[a]}. ${q.options[a]}`;
        const right = q.visual ? `Option ${LETTERS[q.answer]}` : `${LETTERS[q.answer]}. ${q.options[q.answer]}`;
        return `<details class="rev ${ok ? 'ok' : 'bad'}" ${!ok && a !== null ? 'open' : ''}>
          <summary><span>${ok ? '✅' : '❌'}</span> Q${k + 1}. ${esc(plain(q.q))}</summary>
          <div class="qtext sm">${q.q}</div>
          ${q.figure ? `<div class="figure">${q.figure}</div>` : ''}
          ${q.visual ? `<div class="options visual mini">${q.options.map((o, j) => `<div class="opt ${j === q.answer ? 'right' : j === a ? 'wrong' : ''}"><span class="lbl">${LETTERS[j]}</span>${o}</div>`).join('')}</div>` : ''}
          <p>Your answer: <strong>${yours}</strong>${ok ? '' : ` · Correct: <strong>${right}</strong>`}</p>
          ${explain(q)}
        </details>`;
      }).join('');
    }).join('');

    const refl = R.reflect ? `<h3>Your reflection notes</h3>${R.reflect.answers.map((x) => `<p><strong>${esc(x.q)}</strong><br>${esc(x.a) || '<span class="muted">(blank)</span>'}</p>`).join('')}` : '';
    if (R.reflect) R.reflect.answers.forEach((x) => lines.push(`- ${x.q} ${x.a}`));

    app.innerHTML = `
      <section class="card">
        <h1>Your results</h1>
        <p class="muted">Time taken: ${elapsed} · Mode: ${state.mode}</p>
        ${pct !== null ? `<div class="score"><span class="num">${pct}%</span><span>${mcqScore} of ${mcqTotal} multiple-choice questions correct</span></div>` : ''}
        <table class="summary">${rows.join('')}</table>
        <div class="row gap">
          <button class="btn" id="copy">Copy summary</button>
          <button class="btn" onclick="window.print()">Print / save PDF</button>
          <button class="btn primary" id="again">Take again</button>
        </div>
      </section>
      ${review ? `<section class="card"><h2>Answers explained</h2><p class="muted">Wrong answers are opened for you. Click any other question to see its step-by-step explanation.</p>${review}</section>` : ''}
      ${refl ? `<section class="card">${refl}</section>` : ''}`;
    window.scrollTo(0, 0);
    $('#again').onclick = home;
    $('#copy').onclick = async () => {
      try { await navigator.clipboard.writeText(lines.join('\n')); $('#copy').textContent = 'Copied ✓'; }
      catch { prompt('Copy your summary:', lines.join(' | ')); }
    };
  }

  $('#hdr-settings').onclick = openSettings;
  $('#hdr-home').onclick = () => { if (confirm('Leave the test and return to the start? Progress will be lost.')) home(); };
  home();
})();
