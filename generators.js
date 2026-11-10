// Question generators: each family makes a fresh question (new numbers, names, order) every time,
// computes the correct answer itself and writes a plain-language step-by-step explanation.
// Every generator returns { q, options, answer, steps, trick } with answer = index into options.
window.GEN = (() => {
  'use strict';
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const N = (n) => (Number.isInteger(n) ? n.toLocaleString('en-US') : (+n.toFixed(2)).toLocaleString('en-US'));
  const money = (n) => (n < 0 ? '−$' : '$') + (Number.isInteger(n) ? N(Math.abs(n)) : Math.abs(n).toFixed(2));
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const lcm = (a, b) => (a * b) / gcd(a, b);
  const frac = (a, b) => { const g = gcd(a, b); return b / g === 1 ? `${a / g}` : `${a / g}/${b / g}`; };
  const seq = (arr) => `<div class="seq">${arr.map(N).join(', ')}, ?</div>`;

  // Build options: correct first, then unique distractors (strings), padded from fallbacks.
  function opts(correct, cands, n = 4) {
    const out = [correct];
    for (const c of cands) if (c != null && c !== '' && !out.includes(c) && out.length < n) out.push(c);
    if (out.length < n) throw new Error('distractors');
    return { options: out, answer: 0 };
  }
  // Numeric options: distractors must be finite, positive (unless allowNeg), and different.
  function numOpts(ans, cands, f = N, { allowNeg = false, n = 4 } = {}) {
    const intAns = Number.isInteger(ans);
    const good = (x) => Number.isFinite(x) && (allowNeg || x > 0) && Math.abs(x - ans) > 1e-9 && (!intAns || Number.isInteger(+x.toFixed(6)));
    const pool = [...cands, ans + 1, ans - 1, ans + 2, ans * 2, ans + 10, ans - 2].filter(good).map((x) => +x.toFixed(2));
    return opts(f(ans), pool.map(f), n);
  }

  // Percentage working: returns explanation steps + value for p% of n.
  function pctSteps(p, n) {
    const t = n / 10, v = (p * n) / 100;
    if (p === 50) return [[`50% means half.`, `${N(n)} ÷ 2 = ${N(v)}.`], v];
    if (p === 25) return [[`25% means one quarter.`, `${N(n)} ÷ 4 = ${N(v)}.`], v];
    if (p === 75) return [[`75% means three quarters.`, `A quarter is ${N(n)} ÷ 4 = ${N(n / 4)}; three quarters = 3 × ${N(n / 4)} = ${N(v)}.`], v];
    const s = [`Find 10% first: ${N(n)} ÷ 10 = ${N(t)}.`];
    if (p === 5) s.push(`5% is half of 10%: ${N(t)} ÷ 2 = ${N(v)}.`);
    else if (p % 10 === 0) s.push(`${p}% is ${p / 10} lots of 10%: ${p / 10} × ${N(t)} = ${N(v)}.`);
    else s.push(`${p}% = ${(p - 5) / 10} × 10% + 5% (half of 10%): ${N(((p - 5) / 10) * t)} + ${N(t / 2)} = ${N(v)}.`);
    return [s, v];
  }

  // ======================= MATHS =======================
  const maths = [
    { id: 'm-pct', level: 1, gen() {
      const p = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]); const n = R(2, 40) * 20;
      const [s, v] = pctSteps(p, n);
      return { q: `What is ${p}% of ${N(n)}?`, ...numOpts(v, [v + n / 10, v * 2, n - v, v / 2 + n / 20, v + 5]), steps: [...s, `So ${p}% of ${N(n)} = <strong>${N(v)}</strong>.`], trick: '10% = ÷10, 50% = ÷2, 25% = ÷4. Build other percentages from these pieces.' };
    } },
    { id: 'm-bodmas', level: 1, gen() {
      if (Math.random() < 0.5) {
        const a = R(3, 9), b = R(3, 9), d = R(2, 6), c = d * R(2, 9); const v = a * b - c / d;
        return { q: `Work out: ${a} × ${b} − ${c} ÷ ${d}`, ...numOpts(v, [(a * b - c) / d, a * b - c, a * (b - c / d), v + d]), steps: ['Multiplication and division come before + and − (BODMAS).', `${a} × ${b} = ${a * b} and ${c} ÷ ${d} = ${c / d}.`, `${a * b} − ${c / d} = <strong>${v}</strong>.`], trick: 'Do × and ÷ first, then + and −, from left to right.' };
      }
      const a = R(2, 20), b = R(2, 9), c = R(2, 9); const v = a + b * c;
      return { q: `Work out: ${a} + ${b} × ${c}`, ...numOpts(v, [(a + b) * c, a + b + c, a * b + c]), steps: ['Multiplication comes before addition (BODMAS).', `${b} × ${c} = ${b * c}.`, `${a} + ${b * c} = <strong>${v}</strong>.`], trick: 'Do × and ÷ first, then + and −, from left to right.' };
    } },
    { id: 'm-discount', level: 1, gen() {
      const P = R(2, 15) * 20, d = pick([10, 15, 20, 25, 30, 35, 40]); const item = pick(['shirt', 'pair of shoes', 'bag', 'jacket', 'lamp', 'watch']);
      const [s, off] = pctSteps(d, P); const v = P - off;
      return { q: `A ${item} costs ${money(P)}. It is on sale for ${d}% off. What is the sale price?`, ...numOpts(v, [off, P - d, P - off / 2, v - 5, v + 5], money), steps: [`First find the discount, ${d}% of ${money(P)}.`, ...s, `Sale price = ${money(P)} − ${money(off)} = <strong>${money(v)}</strong>.`], trick: 'Find the discount first, then subtract it. Don’t stop at the discount!' };
    } },
    { id: 'm-ratio', level: 1, gen() {
      const [a, b] = pick([[1, 2], [2, 3], [3, 5], [2, 5], [3, 4], [4, 5], [1, 3], [3, 7], [5, 7]]); const k = R(3, 12); const tot = k * (a + b);
      const [x, y, place] = pick([['boys', 'girls', 'a class'], ['red marbles', 'blue marbles', 'a bag'], ['cats', 'dogs', 'an animal shelter'], ['tea drinkers', 'coffee drinkers', 'an office']]);
      const v = k * b;
      return { q: `In ${place} of ${tot}, the ratio of ${x} to ${y} is ${a} : ${b}. How many ${y} are there?`, ...numOpts(v, [k * a, tot / b, k * (b + 1), tot - b]), steps: [`${a} + ${b} = ${a + b} parts in total.`, `${tot} ÷ ${a + b} = ${k} in each part.`, `${y[0].toUpperCase() + y.slice(1)} = ${b} parts × ${k} = <strong>${v}</strong>.`], trick: 'Add the ratio parts, find the size of one part, then multiply.' };
    } },
    { id: 'm-seqlin', level: 1, gen() {
      const m = pick([2, 2, 3]), c = pick(m === 3 ? [-1, 1, 2] : [-1, 1, 2, 3]); let x = R(1, 5); if (m * x + c <= x) x += 2;
      const t = [x]; for (let i = 0; i < 4; i++) t.push(t[i] * m + c); const v = t[4] * m + c; const g = t.slice(1).map((y, i) => y - t[i]);
      return { q: 'What is the next number?' + seq(t), ...numOpts(v, [t[4] * m, t[4] + g[3] * 2, v + 1, v - 1, t[4] + g[3]]), steps: [`Gaps between numbers: ${g.map((d) => '+' + d).join(', ')}. Each gap is ${m === 2 ? 'double' : 'three times'} the one before, so the next gap is +${g[3] * m}.`, `${N(t[4])} + ${N(g[3] * m)} = <strong>${N(v)}</strong>.`, `Another way to see it: each number × ${m}, then ${c > 0 ? '+ ' + c : '− ' + -c}.`], trick: 'Check the gaps first. If the gaps make a pattern, keep it going.' };
    } },
    { id: 'm-time', level: 1, gen() {
      const h = R(7, 11), mi = R(0, 11) * 5, dh = R(1, 3), dm = R(1, 11) * 5; const start = h * 60 + mi, end = start + dh * 60 + dm;
      const T = (m) => { const H = Math.floor(m / 60) % 24, M = m % 60; return `${H % 12 === 0 ? 12 : H % 12}:${String(M).padStart(2, '0')} ${H < 12 ? 'am' : 'pm'}`; };
      const what = pick(['A meeting', 'A train journey', 'A training course', 'A film']);
      return { q: `${what} starts at ${T(start)} and lasts ${dh} hour${dh > 1 ? 's' : ''} ${dm} minutes. What time does it finish?`, ...opts(T(end), [T(end - 10), T(end + 60), T(end - 60), T(end + 10), T(end + 40)]), steps: [`Add the hours first: ${T(start)} + ${dh} h = ${T(start + dh * 60)}.`, `Then add ${dm} minutes: ${T(start + dh * 60)} + ${dm} min = <strong>${T(end)}</strong>.`, 'Remember: 60 minutes make an hour, so carry over when you pass :60.'], trick: 'Add hours and minutes separately; carry 60 minutes into one hour.' };
    } },
    { id: 'm-interest', level: 1, gen() {
      const P = R(2, 20) * 500, r = pick([2, 3, 4, 5, 6, 8]), t = pick([2, 3, 4, 5]); const I = (P * r * t) / 100;
      const askTotal = Math.random() < 0.4; const v = askTotal ? P + I : I;
      return { q: `${money(P)} is saved at ${r}% simple interest per year for ${t} years. What is the ${askTotal ? 'total amount at the end' : 'total interest earned'}?`, ...numOpts(v, askTotal ? [I, P + (P * r) / 100, P + I / t * (t + 1)] : [(P * r) / 100, P + I, I * 2, I / 2], money), steps: [`Interest for 1 year = ${r}% of ${money(P)} = ${money((P * r) / 100)}.`, `For ${t} years: ${t} × ${money((P * r) / 100)} = ${money(I)}.`, askTotal ? `Total = savings + interest = ${money(P)} + ${money(I)} = <strong>${money(v)}</strong>.` : `Total interest = <strong>${money(I)}</strong>.`], trick: 'Simple interest = Amount × Rate × Years ÷ 100. Read carefully: interest only, or total?' };
    } },
    { id: 'm-speed', level: 2, gen() {
      const t = pick([1.5, 2, 2.5, 3, 4, 0.5, 0.75, 1.25]); const s = t % 0.5 ? R(10, 22) * 4 : R(15, 45) * 2; const d = s * t;
      const tt = (x) => { const h = Math.floor(x), m = Math.round((x - h) * 60); return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`; };
      const v = pick(['speed', 'time', 'dist']);
      const base = ['Speed = Distance ÷ Time. (Time = Distance ÷ Speed, Distance = Speed × Time.)'];
      if (v === 'speed') return { q: `A car travels ${N(d)} km in ${tt(t)}. What is its average speed?`, ...numOpts(s, [d / Math.round(t + 0.5), d * t, s + 5, s - 5, d / (t + 1)], (x) => `${N(Math.round(x))} km/h`), steps: [...base, `${tt(t)} = ${t} hours.`, `${N(d)} ÷ ${t} = <strong>${N(s)} km/h</strong>.`], trick: 'Turn minutes into hours (30 min = 0.5 h, 15 min = 0.25 h) before dividing.' };
      if (v === 'time') return { q: `A cyclist rides ${N(d)} km at ${s} km/h. How long does the ride take?`, ...opts(tt(t), [tt(t + 0.5), tt(t - 0.25 > 0 ? t - 0.25 : t + 1), tt(t + 1), tt(d / s / 2 || 1.75)]), steps: [...base, `${N(d)} ÷ ${s} = ${t} hours.`, `${t} hours = <strong>${tt(t)}</strong>.`], trick: '0.5 h = 30 min, 0.25 h = 15 min, 0.75 h = 45 min.' };
      return { q: `A train runs at ${s} km/h for ${tt(t)}. How far does it travel?`, ...numOpts(d, [s / t, s + t, d + s / 2, d - s / 2], (x) => `${N(x)} km`), steps: [...base, `${tt(t)} = ${t} hours.`, `${s} × ${t} = <strong>${N(d)} km</strong>.`], trick: 'Distance = Speed × Time. Check: a longer time should give a longer distance.' };
    } },
    { id: 'm-seqmult', level: 2, gen() {
      const s = pick([1, 2, 3, 4, 5]), k = pick([2, 3]); const t = [s]; for (let i = 0; i < 4; i++) t.push(t[i] * (k + i)); const mult = k + 4; const v = t[4] * mult;
      return { q: 'What is the next number?' + seq(t), ...numOpts(v, [t[4] * (mult - 1), t[4] * (mult + 1), t[4] * 2, t[4] + (t[4] - t[3]) * 2]), steps: [`Divide each number by the one before: ${t.slice(1).map((y, i) => `${N(t[i])}×${k + i}=${N(y)}`).join(', ')}.`, `The multiplier goes up by 1 each time, so next is ×${mult}.`, `${N(t[4])} × ${mult} = <strong>${N(v)}</strong>.`], trick: 'When numbers grow very fast, divide each by the one before to find the multiplier.' };
    } },
    { id: 'm-seq2', level: 2, gen() {
      const a = R(1, 10), d = R(2, 6), st = R(1, 3); const t = [a]; for (let i = 0; i < 5; i++) t.push(t[i] + d + st * i); const g = d + st * 5; const v = t[5] + g;
      return { q: 'What is the next number?' + seq(t), ...numOpts(v, [v + st, v - st, t[5] + d + st * 4, v + 1]), steps: [`Gaps: ${t.slice(1).map((y, i) => '+' + (y - t[i])).join(', ')}. Each gap grows by ${st}.`, `Next gap: +${g}.`, `${t[5]} + ${g} = <strong>${v}</strong>.`], trick: 'If the gaps grow steadily, find how much they grow by, and continue.' };
    } },
    { id: 'm-seqalt', level: 2, gen() {
      const a = R(1, 9), p = R(2, 5), b = R(20, 40), q = R(1, 4); const t = []; for (let i = 0; i < 4; i++) { t.push(a + p * i); t.push(b - q * i); }
      const shown = t.slice(0, 7); const v = t[7];
      return { q: 'What is the next number?' + seq(shown), ...numOpts(v, [shown[6] + p, b - q * 4, v + q, v - q * 2, shown[6] - q]), steps: ['Two patterns are mixed together. Split them by position.', `1st, 3rd, 5th, 7th numbers: ${t.filter((_, i) => i % 2 === 0).map(N).join(', ')} (going up by ${p}).`, `2nd, 4th, 6th numbers: ${t.filter((_, i) => i % 2 === 1).slice(0, 3).join(', ')} (going down by ${q}).`, `The next number is the 8th, from the second pattern: ${t[5]} − ${q} = <strong>${v}</strong>.`], trick: 'If the numbers jump up and down, look at every other number.' };
    } },
    { id: 'm-seqsq', level: 2, gen() {
      const cube = Math.random() < 0.3; const s = R(1, cube ? 3 : 6), c = cube ? 0 : pick([-1, 0, 1, 2]); const f = (n) => (cube ? n ** 3 : n * n + c);
      const t = [0, 1, 2, 3, 4].map((i) => f(s + i)); const v = f(s + 5);
      const desc = cube ? 'cube numbers (n × n × n)' : `square numbers${c ? (c > 0 ? ' plus ' + c : ' minus ' + -c) : ''}`;
      return { q: 'What is the next number?' + seq(t), ...numOpts(v, [t[4] + (t[4] - t[3]), v + 1, v - 1, v + (cube ? 25 : 2), f(s + 6)]), steps: [`Gaps: ${t.slice(1).map((y, i) => '+' + (y - t[i])).join(', ')}, which grow, so try squares or cubes.`, `These are ${desc}: ${[0, 1, 2, 3, 4].map((i) => `${cube ? (s + i) + '³' : (s + i) + '²' + (c ? (c > 0 ? '+' + c : c) : '')}`).join(', ')}.`, `Next: ${cube ? (s + 5) + '³' : (s + 5) + '²' + (c ? (c > 0 ? '+' + c : c) : '')} = <strong>${v}</strong>.`], trick: 'Know your squares (1, 4, 9, 16, 25, 36…) and cubes (1, 8, 27, 64, 125…). They appear often.' };
    } },
    { id: 'm-avg', level: 2, gen() {
      const n = pick([4, 5, 6]); const xs = Array.from({ length: n - 1 }, () => R(5, 40)); const sum = xs.reduce((a, b) => a + b, 0);
      let m = R(5, 45); m += (n - ((sum + m) % n)) % n; const avg = (sum + m) / n;
      return { q: `The average of ${n} numbers is ${avg}. ${n - 1} of them are ${xs.join(', ')}. What is the missing number?`, ...numOpts(m, [avg, m + n, m - n, sum / (n - 1), m + 1]), steps: [`Average × how many = total: ${avg} × ${n} = ${avg * n}.`, `The known numbers add up to ${sum}.`, `Missing number = ${avg * n} − ${sum} = <strong>${m}</strong>.`], trick: 'Turn the average back into a total, then subtract what you know.' };
    } },
    { id: 'm-workers', level: 2, gen() {
      let w1, d1, w2, tot; do { w1 = R(2, 8); d1 = R(4, 20); tot = w1 * d1; const ds = []; for (let x = 2; x <= 30; x++) if (tot % x === 0 && x !== w1) ds.push(x); w2 = ds.length ? pick(ds) : 0; } while (!w2);
      const d2 = tot / w2; const who = pick(['workers', 'painters', 'machines', 'cleaners']);
      return { q: `${w1} ${who} can finish a job in ${d1} days. How many days would ${w2} ${who} take, working at the same rate?`, ...numOpts(d2, [(d1 * w2) / w1, d1 + (w1 - w2), d1 - (w2 - w1), d2 + 1, d2 * 2]), steps: [`Total work = ${w1} × ${d1} days = ${tot} “${who.slice(0, -1)}-days”.`, `With ${w2}: ${tot} ÷ ${w2} = <strong>${d2} days</strong>.`, w2 > w1 ? 'More helpers → fewer days. ✔' : 'Fewer helpers → more days. ✔'], trick: 'Multiply to get the total work, then divide by the new number of helpers.' };
    } },
    { id: 'm-updown', level: 2, gen() {
      const x = pick([10, 20, 25, 30, 50]); const up = Math.random() < 0.5; const net = (x * x) / 100; const a = 100 * (1 + (up ? x : -x) / 100), b = a * (1 + (up ? -x : x) / 100);
      return { q: `A price ${up ? 'rises' : 'falls'} by ${x}%, then the new price ${up ? 'falls' : 'rises'} by ${x}%. Overall, the price has…`, ...opts(`fallen by ${N(net)}%`, ['stayed the same', `risen by ${N(net)}%`, `fallen by ${N(net * 2)}%`, `fallen by ${N(x / 2)}%`]), steps: ['Use an easy starting price: $100.', `${up ? '+' : '−'}${x}% → $${N(a)}.`, `${up ? '−' : '+'}${x}% of $${N(a)} is $${N(Math.abs(a - b))} → $${N(b)}.`, `$${N(b)} is <strong>${N(net)}% less</strong> than $100.`], trick: 'The second percentage is taken from a different amount, so it never cancels out exactly. Test with 100.' };
    } },
    { id: 'm-dice', level: 2, gen() {
      const s = R(3, 11); const w = 6 - Math.abs(s - 7); const pairs = []; for (let i = 1; i <= 6; i++) { const j = s - i; if (j >= 1 && j <= 6) pairs.push(`(${i},${j})`); }
      return { q: `Two fair dice are rolled. What is the probability that the total is ${s}?`, ...opts(frac(w, 36), [frac(w + 1, 36), frac(Math.max(1, w - 1), 36), '1/11', frac(1, s), frac(w, 12)]), steps: ['All possible outcomes: 6 × 6 = 36.', `Pairs that make ${s}: ${pairs.join(' ')} = ${w} pair${w > 1 ? 's' : ''}.`, `${w} ÷ 36 = <strong>${frac(w, 36)}</strong>.`], trick: 'Probability = ways you want ÷ all possible ways. (3,4) and (4,3) are different ways!' };
    } },
    { id: 'm-taps', level: 2, gen() {
      const [a, b] = pick([[6, 3], [12, 6], [4, 12], [10, 15], [3, 6], [20, 30], [6, 12], [8, 24], [5, 20], [12, 4], [9, 18], [15, 10]]); const t = (a * b) / (a + b); const L = lcm(a, b);
      return { q: `Tap A fills a tank in ${a} hours. Tap B fills it in ${b} hours. How long do both taps take together?`, ...numOpts(t, [(a + b) / 2, a + b, Math.min(a, b) / 2, Math.abs(a - b), t + 1], (x) => `${N(x)} hours`), steps: [`Imagine the tank holds ${L} litres (a number both ${a} and ${b} divide into).`, `A fills ${L / a} litres/hour, B fills ${L / b} litres/hour → together ${L / a + L / b} litres/hour.`, `${L} ÷ ${L / a + L / b} = <strong>${N(t)} hours</strong>.`, 'Check: together must be faster than the faster tap alone. ✔'], trick: 'Pick a tank size both times divide into, find litres per hour, add, then divide.' };
    } },
    { id: 'm-fracof', level: 2, gen() {
      const [a, b] = pick([[1, 2], [2, 3], [3, 4], [1, 4], [2, 5], [3, 5], [1, 3]]); const [c, d] = pick([[1, 2], [2, 3], [3, 4], [1, 4], [4, 5], [1, 3]]); const n = b * d * R(2, 8); const mid = (n * c) / d, v = (mid * a) / b;
      return { q: `What is ${a}/${b} of ${c}/${d} of ${N(n)}?`, ...numOpts(v, [mid, (n * a) / b, v * 2, n - v]), steps: [`Work from the right: ${c}/${d} of ${N(n)} = ${N(n)} ÷ ${d} × ${c} = ${N(mid)}.`, `Then ${a}/${b} of ${N(mid)} = ${N(mid)} ÷ ${b} × ${a} = <strong>${N(v)}</strong>.`], trick: '“Of” means multiply. Divide by the bottom number, multiply by the top.' };
    } },
    { id: 'm-profit', level: 2, gen() {
      let C, p; do { C = pick([40, 50, 80, 120, 200, 250, 400, 60]); p = pick([10, 20, 25, 30, 40, 50]); } while ((C * p) % 100);
      const S = C + (C * p) / 100;
      return { q: `A shop buys an item for ${money(C)} and sells it for ${money(S)}. What is the profit as a percentage of the cost?`, ...numOpts(p, [Math.round(((S - C) / S) * 100), S - C, p + 5, p - 5, p * 2], (x) => `${N(x)}%`), steps: [`Profit = ${money(S)} − ${money(C)} = ${money(S - C)}.`, `As a % of the cost: ${N(S - C)} ÷ ${N(C)} × 100 = <strong>${p}%</strong>.`], trick: 'Profit % is always compared with the cost price, not the selling price.' };
    } },
    { id: 'm-rect', level: 2, gen() {
      const l = R(6, 20); let w = R(2, 12); if (w === l) w++; const P = 2 * (l + w); const A = l * w;
      return { q: `A rectangle is ${l} cm long and its perimeter is ${P} cm. What is its area?`, ...numOpts(A, [l * (P / 2), P * l / 4, l * (P - 2 * l), A + l, (P / 4) ** 2], (x) => `${N(x)} cm²`), steps: [`Perimeter = 2 × (length + width), so length + width = ${P} ÷ 2 = ${P / 2}.`, `Width = ${P / 2} − ${l} = ${w} cm.`, `Area = ${l} × ${w} = <strong>${A} cm²</strong>.`], trick: 'Perimeter goes around the outside (add sides). Area fills the inside (length × width).' };
    } },
    { id: 'm-share', level: 2, gen() {
      const r = shuffle([1, 2, 3, 4, 5]).slice(0, 3); const k = R(2, 12) * 10; const tot = k * (r[0] + r[1] + r[2]); const big = Math.random() < 0.6;
      const names = shuffle(['Ana', 'Ben', 'Chloe', 'Dev', 'Ella', 'Faiz']).slice(0, 3); const v = k * (big ? Math.max(...r) : Math.min(...r));
      return { q: `${money(tot)} is shared between ${names.join(', ')} in the ratio ${r.join(' : ')}. How much is the ${big ? 'largest' : 'smallest'} share?`, ...numOpts(v, [tot / 3, k * r[1] === v ? k * r[0] : k * r[1], v + k, tot / Math.max(...r), v * 2], money), steps: [`Total parts: ${r.join(' + ')} = ${r[0] + r[1] + r[2]}.`, `One part = ${money(tot)} ÷ ${r[0] + r[1] + r[2]} = ${money(k)}.`, `The ${big ? 'largest' : 'smallest'} share has ${big ? Math.max(...r) : Math.min(...r)} parts: <strong>${money(v)}</strong>.`], trick: 'Add the parts, find one part, then multiply.' };
    } },
    { id: 'm-pctchg', level: 2, gen() {
      let A, p, up; do { A = pick([40, 50, 80, 120, 200, 250, 400, 60]); p = pick([10, 20, 25, 40, 50]); up = Math.random() < 0.5; } while ((A * p) % 100);
      const B = A + ((up ? 1 : -1) * A * p) / 100; const d = Math.abs(B - A);
      return { q: `The number of visitors went from ${A} to ${B}. What is the percentage ${up ? 'increase' : 'decrease'}?`, ...numOpts(p, [Math.round((d / B) * 100), d, p + 10, p / 2], (x) => `${N(x)}%`), steps: [`Change = ${Math.max(A, B)} − ${Math.min(A, B)} = ${d}.`, `Compare with the starting number: ${d} ÷ ${A} × 100 = <strong>${p}%</strong>.`], trick: 'Percentage change = change ÷ ORIGINAL × 100.' };
    } },
    { id: 'm-lcm', level: 2, gen() {
      let a, b; do { a = pick([6, 8, 9, 10, 12, 15, 20, 18, 4]); b = pick([6, 8, 9, 10, 12, 15, 20, 18, 4]); } while (a === b || lcm(a, b) > 120 || lcm(a, b) === a * b && a * b > 120);
      const L = lcm(a, b); const T = (m) => `${8 + Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} am`;
      return { q: `Bus A leaves every ${a} minutes and bus B every ${b} minutes. Both leave together at 8:00 am. When do they next leave together?`, ...opts(T(L), [T(a + b), a * b !== L && a * b < 240 ? T(a * b) : T(L + Math.min(a, b)), T(Math.max(a, b)), T(L / 2 === Math.floor(L / 2) && L / 2 > Math.max(a, b) ? L / 2 : L + 5)]), steps: [`Bus A times: ${[1, 2, 3, 4, 5].map((i) => a * i).filter((x) => x <= L).join(', ')} minutes after 8:00.`, `Bus B times: ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => b * i).filter((x) => x <= L).join(', ')} minutes after 8:00.`, `First shared number (lowest common multiple) = ${L} minutes → <strong>${T(L)}</strong>.`], trick: 'List the multiples of each number until they meet: that is the lowest common multiple.' };
    } },
    { id: 'm-coins', level: 3, gen() {
      const n = pick([3, 4, 5]); const k = R(1, n - 1); const C = (a, b) => { let r = 1; for (let i = 1; i <= b; i++) r = (r * (a - i + 1)) / i; return r; }; const w = C(n, k); const all = 2 ** n;
      const arr = []; if (n <= 4) for (let m = 0; m < all; m++) { const s = m.toString(2).padStart(n, '0'); if ([...s].filter((c) => c === '1').length === k) arr.push(s.replace(/1/g, 'H').replace(/0/g, 'T')); }
      return { q: `A fair coin is flipped ${n} times. What is the probability of getting exactly ${k} head${k > 1 ? 's' : ''}?`, ...opts(frac(w, all), [frac(w + 1, all), frac(w - 1 || w + 2, all), frac(k, n), '1/2', frac(1, all)]), steps: [`Each flip has 2 results, so ${Array(n).fill(2).join(' × ')} = ${all} possible outcomes.`, n <= 4 ? `Ways to get exactly ${k} head${k > 1 ? 's' : ''}: ${arr.join(', ')} = ${w}.` : `Ways to choose which ${k} of the ${n} flips are heads = ${w} (count them, or use “${n} choose ${k}”).`, `${w} ÷ ${all} = <strong>${frac(w, all)}</strong>.`], trick: 'Count the outcomes you want, then divide by all possible outcomes.' };
    } },
    { id: 'm-ev', level: 3, gen() {
      const C = pick([5, 10, 20]); const p1 = pick([0.1, 0.05, 0.2]), p2 = pick([0.2, 0.25, 0.3]); const B = R(4, 15) * 20, S = R(2, 10) * 4;
      const ev = Math.round((p1 * B + p2 * S - C) * 100) / 100; const win = Math.round((p1 * B + p2 * S) * 100) / 100; const p0 = Math.round((1 - p1 - p2) * 100);
      return { q: `A game costs ${money(C)} to play. You win ${money(B)} with probability ${p1}, win ${money(S)} with probability ${p2}, and otherwise win nothing. What is the expected profit per game?`, ...numOpts(ev, [win, ev + C / 2, -C, ev - 1, ev + 2], money, { allowNeg: true }), steps: [`Expected winnings = (${p1} × ${money(B)}) + (${p2} × ${money(S)}) = ${money(p1 * B)} + ${money(p2 * S)} = ${money(win)}.`, `Subtract the cost: ${money(win)} − ${money(C)} = <strong>${money(ev)}</strong>.`, `Note: ${p0}% of the time you win nothing. “Expected” is the average over many games, not what happens in one game.`], trick: 'Multiply each prize by its chance, add them, then subtract the cost.' };
    } },
    { id: 'm-compound', level: 3, gen() {
      const P = pick([1000, 2000, 5000, 800, 1500, 4000]), r = pick([10, 20, 5]); const y1 = P * (1 + r / 100), y2 = y1 * (1 + r / 100); const what = pick(['house is worth', 'savings account holds', 'collection is valued at']);
      return { q: `A ${what} ${money(P)}. Its value grows by ${r}% each year. What is it worth after 2 years?`, ...numOpts(y2, [P + (2 * P * r) / 100, y1, (P * r * 2) / 100, y2 + (P * r) / 100], money), steps: [`Year 1: ${money(P)} + ${r}% = ${money(y1)}.`, `Year 2: the ${r}% is now taken from ${money(y1)}: ${money(y1)} + ${money(y1 * r / 100)} = <strong>${money(y2)}</strong>.`, `That’s more than ${money(P + (2 * P * r) / 100)}, because year 2 grows on the bigger amount.`], trick: 'Compound growth: apply the percentage one year at a time, each time to the new amount.' };
    } },
    { id: 'm-ages', level: 3, gen() {
      const [k, m, f] = pick([[3, 2, 1], [4, 3, 2], [5, 3, 1], [4, 2, 0.5], [5, 4, 3], [6, 4, 1.5], [5, 2, 1 / 3]]); let y; do { y = R(2, 20); } while (!Number.isInteger(y * f) || y * f < 3 || y * f * k > 75);
      const s = y * f; const [who, kid] = pick([['A mother', 'her daughter'], ['A father', 'his son'], ['An aunt', 'her nephew']]);
      return { q: `${who} is ${k} times as old as ${kid}. In ${y} years, ${who.includes('father') ? 'he' : 'she'} will be ${m} times as old. How old is the ${kid.split(' ')[1]} now?`, ...numOpts(s, [y, s + y, k * s, s * 2, s + 1]), steps: [`Let the ${kid.split(' ')[1]}’s age be <em>s</em>. Then the ${who.split(' ')[1].toLowerCase()} is ${k}s.`, `In ${y} years: ${k}s + ${y} = ${m} × (s + ${y}) = ${m}s + ${m * y}.`, `So ${k - m}s = ${m * y - y}, which gives s = <strong>${s}</strong>.`, `Check: now ${s} and ${k * s}; in ${y} years ${s + y} and ${k * s + y}, and ${k * s + y} = ${m} × ${s + y}. ✔`], trick: 'Write ages as letters, move everyone forward the same number of years, then check your answer.' };
    } },
    { id: 'm-clock', level: 3, gen() {
      const h = R(1, 11), m = pick([0, 30, 0, 30, 15]); let a = Math.abs(30 * h - 5.5 * m); if (a > 180) a = 360 - a; let wrong = Math.abs(30 * h - 6 * m); if (wrong > 180) wrong = 360 - wrong;
      return { q: `What is the smaller angle between the hour and minute hands at ${h}:${String(m).padStart(2, '0')}?`, ...numOpts(a, [wrong, 30 * h > 180 ? 360 - 30 * h : 30 * h, a + 15, a - 15, a + 30, 180 - a, a + 45], (x) => `${N(x)}°`), steps: ['The hour hand moves 30° per hour, plus 0.5° per minute. The minute hand moves 6° per minute.', `Hour hand: ${h} × 30 + ${m} × 0.5 = ${30 * h + 0.5 * m}°. Minute hand: ${m} × 6 = ${6 * m}°.`, `Difference: ${Math.abs(30 * h + 0.5 * m - 6 * m)}°${Math.abs(30 * h - 5.5 * m) > 180 ? `, and the smaller side is 360 − that = ${a}°` : ''} → <strong>${N(a)}°</strong>.`], trick: 'Don’t forget the hour hand also moves during the minutes (half a degree per minute).' };
    } },
    { id: 'm-leak', level: 3, gen() {
      const [a, b] = pick([[3, 6], [4, 12], [6, 12], [2, 6], [4, 6], [3, 4], [6, 10], [10, 15], [5, 20]]); const t = (a * b) / (b - a); const L = lcm(a, b);
      return { q: `A tap fills a tank in ${a} hours, but a leak empties a full tank in ${b} hours. With both happening, how long does it take to fill the tank?`, ...numOpts(t, [(a * b) / (a + b), b - a, a + b, t / 2, t + a], (x) => `${N(x)} hours`), steps: [`Imagine the tank holds ${L} litres.`, `The tap adds ${L / a} litres/hour; the leak removes ${L / b} litres/hour. Net: ${L / a - L / b} litres/hour.`, `${L} ÷ ${L / a - L / b} = <strong>${N(t)} hours</strong>.`, 'Check: it must be slower than the tap alone. ✔'], trick: 'Filling adds, leaking subtracts. Find the net litres per hour.' };
    } },
  ];

  // ======================= LOGIC =======================
  const P3 = ['A', 'B', 'C'];
  function truthLie() {
    const T = { A: 0, B: 0, C: 0 };
    const kinds = [
      (s, o) => { const x = pick(o); return { text: `${x} is lying.`, f: (t) => !t[x] }; },
      (s, o) => { const x = pick(o); return { text: `${x} is telling the truth.`, f: (t) => t[x] }; },
      (s, o) => ({ text: `${o[0]} and ${o[1]} are both lying.`, f: (t) => !t[o[0]] && !t[o[1]] }),
      (s, o) => ({ text: `Exactly one of ${o[0]} and ${o[1]} is lying.`, f: (t) => t[o[0]] !== t[o[1]] }),
      (s, o) => { const k = pick([1, 2]); return { text: `Exactly ${k === 1 ? 'one' : 'two'} of us ${k === 1 ? 'is' : 'are'} telling the truth.`, f: (t) => P3.filter((p) => t[p]).length === k }; },
    ];
    for (let tries = 0; tries < 500; tries++) {
      const st = P3.map((s) => pick(kinds)(s, P3.filter((p) => p !== s)));
      const sols = [];
      for (let m = 0; m < 8; m++) { const t = { A: !!(m & 1), B: !!(m & 2), C: !!(m & 4) }; if (P3.every((p, i) => st[i].f(t) === t[p])) sols.push(t); }
      if (sols.length !== 1) continue;
      const sol = sols[0]; const honest = P3.filter((p) => sol[p]);
      const qtext = P3.map((p, i) => `${p} says: “${st[i].text}”`).join('<br>') + '<br><br>Each person either <em>always</em> tells the truth or <em>always</em> lies.';
      const check = P3.map((p, i) => `${p} says “${st[i].text}” → that is ${st[i].f(sol) ? 'true' : 'false'}, and ${p} is ${sol[p] ? 'truthful' : 'a liar'}. ✔`);
      const label = (arr) => (arr.length === 0 ? 'Nobody' : arr.length === 3 ? 'All three' : arr.length === 1 ? `Only ${arr[0]}` : `${arr[0]} and ${arr[1]}`);
      const base = ['“Always truthful or always lying” means everything a person says is completely true or completely false.', 'Method: assume one person is truthful, follow what that means for the others, and look for a contradiction. If you find one, flip your assumption.'];
      if (Math.random() < 0.5) {
        return { q: qtext + ' How many of them are telling the truth?', ...opts(String(honest.length), ['0', '1', '2', '3']), steps: [...base, `The only arrangement with no contradiction: ${P3.map((p) => `${p} ${sol[p] ? 'truthful' : 'lying'}`).join(', ')}.`, ...check, `So <strong>${honest.length}</strong> ${honest.length === 1 ? 'person tells' : 'people tell'} the truth.`], trick: 'Assume → Follow → Check. A contradiction means your assumption was wrong.' };
      }
      const all = [[], ['A'], ['B'], ['C'], ['A', 'B'], ['A', 'C'], ['B', 'C'], ['A', 'B', 'C']].map(label);
      return { q: qtext + ' Who is telling the truth?', ...opts(label(honest), shuffle(all), 5), steps: [...base, `The only arrangement with no contradiction: ${P3.map((p) => `${p} ${sol[p] ? 'truthful' : 'lying'}`).join(', ')}.`, ...check, `Answer: <strong>${label(honest)}</strong>.`], trick: 'Assume → Follow → Check. A contradiction means your assumption was wrong.' };
    }
    throw new Error('truthLie');
  }

  function perms(a) { if (a.length <= 1) return [a]; const out = []; a.forEach((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).forEach((p) => out.push([x, ...p]))); return out; }
  const ALLP5 = perms(['A', 'B', 'C', 'D', 'E']);
  function seating() {
    for (let tries = 0; tries < 400; tries++) {
      const sol = pick(ALLP5); const pos = (p, x) => p.indexOf(x);
      const L = ['A', 'B', 'C', 'D', 'E'];
      const pool = [];
      for (const x of L) for (const y of L) if (x !== y) {
        pool.push({ t: `${x} sits immediately left of ${y}`, f: (p) => pos(p, y) - pos(p, x) === 1 });
        pool.push({ t: `${x} sits somewhere left of ${y}`, f: (p) => pos(p, x) < pos(p, y) });
        if (x < y) pool.push({ t: `${x} does not sit next to ${y}`, f: (p) => Math.abs(pos(p, x) - pos(p, y)) !== 1 });
      }
      for (const x of L) { pool.push({ t: `${x} is not at either end`, f: (p) => pos(p, x) > 0 && pos(p, x) < 4 }); pool.push({ t: `${x} sits at one of the ends`, f: (p) => pos(p, x) === 0 || pos(p, x) === 4 }); }
      const seatClue = L.map((x) => ({ t: `${x} is in seat ${pos(sol, x) + 1}`, f: (p) => pos(p, x) === pos(sol, x), seat: 1 }));
      const trueClues = shuffle(pool.filter((c) => c.f(sol)).concat(Math.random() < 0.4 ? [pick(seatClue)] : []));
      const clues = []; let cand = ALLP5;
      for (const c of trueClues) {
        const next = cand.filter(c.f); if (next.length === cand.length) continue;
        clues.push(c); cand = next;
        if (clues.length >= 3 && cand.length <= 3) break;
        if (clues.length >= 5) break;
      }
      if (cand.length > 3 || clues.length < 3) continue;
      const stm = [];
      for (const x of L) for (let k = 0; k < 5; k++) stm.push({ t: `${x} is in seat ${k + 1}`, f: (p) => pos(p, x) === k });
      for (const x of L) for (const y of L) if (x < y) stm.push({ t: `${x} sits next to ${y}`, f: (p) => Math.abs(pos(p, x) - pos(p, y)) === 1 });
      for (const x of L) stm.push({ t: `${x} is at one end`, f: (p) => pos(p, x) === 0 || pos(p, x) === 4 });
      const trivial = (s) => clues.some((c) => ALLP5.every((p) => !c.f(p) || s.f(p)));
      const must = stm.filter((s) => cand.every(s.f) && !trivial(s));
      const some = stm.filter((s) => cand.some(s.f) && !cand.every(s.f));
      const none = stm.filter((s) => !cand.some(s.f));
      if (!must.length || some.length + none.length < 4) continue;
      const m = pick(must); const wrong = shuffle(some).slice(0, 3).concat(shuffle(none)).slice(0, 4);
      return {
        q: `Five people A, B, C, D, E sit in a row of 5 seats (seat 1 is the far left).<ul>${clues.map((c) => `<li>${c.t}</li>`).join('')}</ul>Which of these <strong>must</strong> be true?`,
        ...opts(m.t, wrong.map((w) => w.t), 5),
        steps: ['Draw 5 seats in a row. Place the strongest clues first (fixed seats, “immediately left”), then test the rest.', `Only ${cand.length === 1 ? 'one arrangement fits' : cand.length + ' arrangements fit'}: ${cand.map((p) => `<strong>${p.join(' ')}</strong>`).join(' or ')}.`, `“${m.t}” is true in ${cand.length === 1 ? 'that arrangement' : 'every one of them'}.`, 'Each other option is false in at least one valid arrangement, so it is not guaranteed.'],
        trick: '“Must be true” means true in EVERY possible arrangement. List them all, then check.',
      };
    }
    throw new Error('seating');
  }

  const NAMES = ['Amir', 'Beth', 'Chen', 'Dina', 'Eli', 'Farah', 'Gus', 'Hana', 'Ivan', 'Jia', 'Kofi', 'Lena'];
  function ordering() {
    const n = pick([4, 5]); const ppl = shuffle(NAMES).slice(0, n);
    const [more, less, top, bottom, ord] = pick([
      ['is taller than', 'is shorter than', 'tallest', 'shortest', (k) => `${['', 'second ', 'third ', 'fourth '][k]}tallest`],
      ['is older than', 'is younger than', 'oldest', 'youngest', (k) => `${['', 'second ', 'third ', 'fourth '][k]}oldest`],
      ['finished before', 'finished after', 'first', 'last', (k) => ['first', 'second', 'third', 'fourth', 'fifth'][k]],
      ['scored higher than', 'scored lower than', 'top scorer', 'lowest scorer', (k) => `${['', 'second ', 'third ', 'fourth '][k]}highest scorer`],
    ]);
    const clues = shuffle(ppl.slice(1).map((p, i) => (Math.random() < 0.6 ? `${ppl[i]} ${more} ${p}.` : `${p} ${less} ${ppl[i]}.`)));
    const k = R(0, n - 1); const askLabel = k === 0 ? top : k === n - 1 ? bottom : ord(k);
    const race = more.includes('finished');
    return { q: `${clues.join('<br>')}<br><br>Who ${race ? 'finished' : 'is the'} <strong>${askLabel}</strong>?`, ...opts(ppl[k], shuffle(ppl.filter((_, i) => i !== k)), n), steps: ['Turn every clue into the same direction (“X is ahead of Y”).', 'Link them into one chain, starting with the person nobody beats.', `Order: ${ppl.join(' → ')}.`, `So the ${askLabel} is <strong>${ppl[k]}</strong>.`], trick: 'Rewrite “shorter / younger / after” clues as “taller / older / before” so every arrow points the same way.' };
  }

  const WORDS = ['CAT', 'DOG', 'SUN', 'MAP', 'PEN', 'BOX', 'FISH', 'BIRD', 'LAMP', 'DESK', 'ROAD', 'TREE', 'MILK', 'GOLD', 'RAIN', 'STAR', 'HOME', 'BOOK', 'CODE', 'TEAM', 'PLAN', 'WORK', 'TIME', 'NOTE'];
  const shiftW = (w, k) => [...w].map((c) => String.fromCharCode(((c.charCodeAt(0) - 65 + k + 26 * 3) % 26) + 65)).join('');
  const rev = (w) => [...w].reverse().join('');
  const mirror = (w) => [...w].map((c) => String.fromCharCode(90 - (c.charCodeAt(0) - 65))).join('');
  function code() {
    const [w1, w2] = shuffle(WORDS.filter((w) => !/Z/.test(w))).slice(0, 2);
    const type = pick(['shift', 'shift', 'revshift', 'mirror']);
    if (type === 'shift') {
      const k = pick([1, 2, 3, -1, -2]); const enc = (w) => shiftW(w, k);
      return { q: `In a code, <strong>${w1}</strong> is written as <strong>${enc(w1)}</strong>. How is <strong>${w2}</strong> written?`, ...opts(enc(w2), [shiftW(w2, k + 1), shiftW(w2, -k), rev(enc(w2)), shiftW(w2, k - 1 || k + 2)]), steps: [`Compare letter by letter: ${[...w1].map((c, i) => `${c}→${enc(w1)[i]}`).join(', ')}.`, `Each letter moves ${Math.abs(k)} step${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'forward' : 'back'} in the alphabet.`, `${[...w2].map((c, i) => `${c}→${enc(w2)[i]}`).join(', ')} → <strong>${enc(w2)}</strong>.`], trick: 'Write the alphabet position under each letter and look for the shift.' };
    }
    if (type === 'revshift') {
      const enc = (w) => shiftW(rev(w), 1);
      return { q: `In a code, <strong>${w1}</strong> is written as <strong>${enc(w1)}</strong>. How is <strong>${w2}</strong> written?`, ...opts(enc(w2), [shiftW(w2, 1), rev(w2), shiftW(rev(w2), -1), shiftW(rev(w2), 2)]), steps: [`The code letters look like ${w1} backwards: ${rev(w1)}.`, `Then each letter moves 1 step forward: ${rev(w1)} → ${enc(w1)}.`, `${w2} backwards is ${rev(w2)}; +1 each → <strong>${enc(w2)}</strong>.`], trick: 'If the shift seems random, try reading the word backwards first.' };
    }
    return { q: `In a code, <strong>${w1}</strong> is written as <strong>${mirror(w1)}</strong>. How is <strong>${w2}</strong> written?`, ...opts(mirror(w2), [shiftW(w2, 1), rev(mirror(w2)), shiftW(mirror(w2), 1), rev(w2)]), steps: [`Look at the alphabet positions: ${[...w1].map((c, i) => `${c}(${c.charCodeAt(0) - 64})→${mirror(w1)[i]}(${mirror(w1).charCodeAt(i) - 64})`).join(', ')}.`, 'Each pair adds up to 27: A↔Z, B↔Y, C↔X… The alphabet is flipped.', `${w2} → <strong>${mirror(w2)}</strong>.`], trick: 'If letters jump far, check if position + code position = 27 (a mirror alphabet).' };
  }

  function directions() {
    const H = ['north', 'east', 'south', 'west'], DX = [0, 1, 0, -1], DY = [1, 0, -1, 0];
    for (let tries = 0; tries < 2000; tries++) {
      let h = 0, x = 0, y = 0; const legs = []; const steps = [];
      const nLegs = pick([3, 4]);
      for (let i = 0; i < nLegs; i++) {
        let turn = null;
        if (i > 0) { turn = pick(['right', 'left']); h = (h + (turn === 'right' ? 1 : 3)) % 4; }
        const d = R(1, 8); x += DX[h] * d; y += DY[h] * d; legs.push({ turn, d });
        steps.push(`${i === 0 ? 'Start facing north' : `Turn ${turn} → now facing ${H[h]}`}, walk ${d} km.`);
      }
      const dist = Math.hypot(x, y);
      if (dist === 0) continue;
      const desc = legs.map((l, i) => (i === 0 ? `walk ${l.d} km north` : `turn ${l.turn} and walk ${l.d} km`)).join(', ');
      const qBase = `You ${desc.replace(/, ([^,]*)$/, ', then $1')}.`;
      if (x === 0 || y === 0) {
        const dirOf = (xx, yy) => `${Math.abs(xx || yy)} km ${xx > 0 ? 'east' : xx < 0 ? 'west' : yy > 0 ? 'north' : 'south'}`;
        const ans = dirOf(x, y); const total = legs.reduce((s, l) => s + l.d, 0);
        return { q: qBase + ' Where are you now compared with your starting point?', ...opts(ans, [dirOf(-x, -y), dirOf(y, x), `${total} km ${x ? (x > 0 ? 'east' : 'west') : y > 0 ? 'north' : 'south'}`, 'Back at the start', dirOf(-y, -x)], 5), steps: [...steps, `Add up: east–west ${x >= 0 ? x + ' east' : -x + ' west'}, north–south ${y >= 0 ? y + ' north' : -y + ' south'}.`, `You end up <strong>${ans}</strong> of the start.`], trick: 'Sketch it. Right turn from north = east; from east = south; from south = west; from west = north.' };
      }
      if (!Number.isInteger(dist)) continue;
      return { q: qBase + ' How far are you from the starting point in a straight line?', ...numOpts(dist, [Math.abs(x) + Math.abs(y), legs.reduce((s, l) => s + l.d, 0), dist + 1, dist - 1, Math.abs(Math.abs(x) - Math.abs(y))], (v) => `${N(v)} km`), steps: [...steps, `Overall: ${Math.abs(x)} km ${x > 0 ? 'east' : 'west'} and ${Math.abs(y)} km ${y > 0 ? 'north' : 'south'}.`, `These make a right-angled triangle: √(${Math.abs(x)}² + ${Math.abs(y)}²) = √${x * x + y * y} = <strong>${dist} km</strong>.`], trick: 'Straight-line distance uses Pythagoras: √(across² + up²). Remember 3-4-5 and 6-8-10.' };
    }
    throw new Error('dir');
  }

  function oddOne() {
    const type = pick(['prime', 'square', 'mult', 'cube']);
    let good, bad, rule;
    if (type === 'prime') { good = shuffle([3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]).slice(0, 4); bad = pick([9, 15, 21, 27, 33, 35, 39, 45, 51, 57]); rule = [`${good.slice().sort((a, b) => a - b).join(', ')} are prime numbers: they can only be divided evenly by 1 and themselves.`, `${bad} = ${(() => { for (let f = 3; f < bad; f += 2) if (bad % f === 0) return f + ' × ' + bad / f; return ''; })()}, so it is not prime.`]; }
    else if (type === 'square') { good = shuffle([4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144]).slice(0, 4); do { bad = R(10, 140); } while (Number.isInteger(Math.sqrt(bad))); rule = [`${good.slice().sort((a, b) => a - b).map((g) => `${g} = ${Math.sqrt(g)}²`).join(', ')}: all square numbers.`, `${bad} is not a square number (no whole number times itself makes ${bad}).`]; }
    else if (type === 'cube') { good = shuffle([1, 8, 27, 64, 125, 216]).slice(0, 4); do { bad = pick([9, 16, 36, 49, 100, 81, 50, 99, 30]); } while (good.includes(bad)); rule = [`${good.slice().sort((a, b) => a - b).map((g) => `${g} = ${Math.round(Math.cbrt(g))}³`).join(', ')}: all cube numbers.`, `${bad} is not a cube number.`]; }
    else { const k = pick([6, 7, 8, 9, 11, 12]); good = shuffle(Array.from({ length: 12 }, (_, i) => k * (i + 2))).slice(0, 4); do { bad = R(k * 2, k * 13); } while (bad % k === 0 || bad % 2 !== good[0] % 2 && Math.random() < 0.7); rule = [`${good.slice().sort((a, b) => a - b).join(', ')} are all multiples of ${k}.`, `${bad} ÷ ${k} is not a whole number, so it does not belong.`]; }
    const list = [...good, bad].sort((a, b) => a - b);
    return { q: `Which number does not belong?<div class="seq">${list.join(', ')}</div>`, ...opts(String(bad), good.map(String), 5), steps: [...rule, `Odd one out: <strong>${bad}</strong>.`], trick: 'Check: even/odd, primes, squares, cubes, multiples of the same number.' };
  }

  const A2 = (i) => String.fromCharCode(65 + (((i % 26) + 26) % 26));
  function letters() {
    const type = pick(['step', 'grow', 'pairs']);
    if (type === 'step') { const s = R(0, 8), k = pick([2, 3, 4, 5]); const t = [0, 1, 2, 3, 4].map((i) => A2(s + k * i)); const v = A2(s + k * 5); return { q: `What comes next?<div class="seq">${t.join(', ')}, ?</div>`, ...opts(v, [A2(s + k * 5 + 1), A2(s + k * 5 - 1), A2(s + k * 4 + 1), A2(s + k * 6)]), steps: [`Count the jumps in the alphabet: each letter moves ${k} forward (skipping ${k - 1}).`, `${t[4]} + ${k} = <strong>${v}</strong>.`], trick: 'Write letter positions (A=1, B=2…) and treat it like a number sequence.' }; }
    if (type === 'grow') { const s = R(0, 4); const pos = [s]; for (let i = 1; i < 6; i++) pos.push(pos[i - 1] + i); const t = pos.slice(0, 5).map(A2); const v = A2(pos[5]); return { q: `What comes next?<div class="seq">${t.join(', ')}, ?</div>`, ...opts(v, [A2(pos[5] - 1), A2(pos[5] + 1), A2(pos[4] + 4), A2(pos[5] + 2)]), steps: ['Count the jumps: +1, +2, +3, +4. The jump grows by 1 each time.', `Next jump is +5: ${t[4]} + 5 = <strong>${v}</strong>.`], trick: 'Write letter positions (A=1, B=2…) and look at the gaps.' }; }
    const s = R(0, 5); const pr = (i) => A2(s + i) + A2(25 - s - i); const t = [0, 1, 2, 3].map(pr); const v = pr(4);
    return { q: `What comes next?<div class="seq">${t.join(', ')}, ?</div>`, ...opts(v, [A2(s + 4) + A2(25 - s - 3), A2(s + 5) + A2(25 - s - 4), A2(s + 4) + A2(s + 4 + 1), A2(25 - s - 4) + A2(s + 4)]), steps: ['The first letters go forward: ' + t.map((x) => x[0]).join(', ') + '.', 'The second letters go backward from the end of the alphabet: ' + t.map((x) => x[1]).join(', ') + '.', `Next: ${A2(s + 4)} and ${A2(25 - s - 4)} → <strong>${v}</strong>.`], trick: 'Split letter pairs and follow each half separately.' };
  }

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function days() {
    const d0 = R(0, 6);
    if (Math.random() < 0.6) {
      const n = R(10, 200); const v = DAYS[(d0 + n) % 7];
      return { q: `Today is ${DAYS[d0]}. What day of the week will it be in ${n} days?`, ...opts(v, [DAYS[(d0 + n + 1) % 7], DAYS[(d0 + n + 6) % 7], DAYS[d0], DAYS[(d0 + (n % 10)) % 7], ...shuffle(DAYS)]), steps: ['Every 7 days the week repeats, so only the remainder after dividing by 7 matters.', `${n} ÷ 7 = ${Math.floor(n / 7)} weeks remainder ${n % 7}.`, `${DAYS[d0]} + ${n % 7} day${n % 7 === 1 ? '' : 's'} = <strong>${v}</strong>.`], trick: 'Divide by 7 and only count the leftover days.' };
    }
    const back = R(2, 5), fwd = R(1, 3); const today = (d0 + back) % 7; const v = DAYS[(today + fwd) % 7];
    const fw = fwd === 1 ? 'tomorrow' : fwd === 2 ? 'the day after tomorrow' : 'three days from today';
    return { q: `${back} days ago it was ${DAYS[d0]}. What day will it be ${fw}?`, ...opts(v, [DAYS[(d0 + fwd) % 7], DAYS[(today) % 7], DAYS[(today + fwd + 1) % 7], DAYS[(today + 7 - fwd) % 7], ...shuffle(DAYS)]), steps: [`If ${back} days ago was ${DAYS[d0]}, then today is ${DAYS[d0]} + ${back} = ${DAYS[today]}.`, `${fw[0].toUpperCase() + fw.slice(1)} is ${DAYS[today]} + ${fwd} = <strong>${v}</strong>.`], trick: 'First find today, then move forward or back.' };
  }

  const logic = [
    { id: 'l-truth', kind: 'truth', gen: truthLie },
    { id: 'l-seat', kind: 'seat', gen: seating },
    { id: 'l-order', kind: 'order', gen: ordering },
    { id: 'l-code', kind: 'code', gen: code },
    { id: 'l-dir', kind: 'dir', gen: directions },
    { id: 'l-odd', kind: 'odd', gen: oddOne },
    { id: 'l-letters', kind: 'letters', gen: letters },
    { id: 'l-days', kind: 'days', gen: days },
  ];

  return { maths, logic, shuffle, pick, R };
})();
