// Quick Quiz mental-arithmetic questions (category "mental"), generated once at load time
// with a fixed seed so ids and content are stable between runs.

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = makeRng(20261031);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// Each template returns { zh, en, ans } for one diff level.
const TEMPLATES = {
  1: [
    () => { const a = ri(11, 49), b = ri(11, 49); return { expr: `${a} + ${b}`, ans: a + b }; },
    () => { const a = ri(40, 99), b = ri(11, a - 5); return { expr: `${a} - ${b}`, ans: a - b }; },
    () => { const a = ri(3, 9), b = ri(3, 9); return { expr: `${a} × ${b}`, ans: a * b }; },
    () => { const b = ri(3, 9), c = ri(3, 12); return { expr: `${b * c} ÷ ${b}`, ans: c }; },
  ],
  2: [
    () => { const a = ri(120, 480), b = ri(120, 480); return { expr: `${a} + ${b}`, ans: a + b }; },
    () => { const a = ri(300, 900), b = ri(120, a - 50); return { expr: `${a} - ${b}`, ans: a - b }; },
    () => { const a = ri(12, 25), b = ri(3, 9); return { expr: `${a} × ${b}`, ans: a * b }; },
    () => { const b = ri(6, 14), c = ri(8, 19); return { expr: `${b * c} ÷ ${b}`, ans: c }; },
    () => { const a = ri(2, 9) * 10, p = [10, 20, 25, 50][ri(0, 3)]; return { expr: `${a * 4}的${p}%`, exprEn: `${p}% of ${a * 4}`, ans: a * 4 * p / 100 }; },
  ],
  3: [
    () => { const a = ri(13, 29), b = ri(13, 29); return { expr: `${a} × ${b}`, ans: a * b }; },
    () => { const a = ri(1100, 4800), b = ri(1100, 4800); return { expr: `${a} + ${b}`, ans: a + b }; },
    () => { const a = ri(6, 9) * 100 + ri(11, 89), b = ri(11, 48) * 7; return { expr: `${a} - ${b}`, ans: a - b }; },
    () => { const a = ri(11, 19), b = ri(11, 19), c = ri(2, 9); return { expr: `${a} × ${b} - ${c}`, ans: a * b - c }; },
    () => { const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9), d = ri(2, 9); return { expr: `${a} × ${b} + ${c} × ${d}`, ans: a * b + c * d }; },
  ],
};

function distractors(ans) {
  const set = new Set();
  const cands = [ans + 1, ans - 1, ans + 10, ans - 10, ans + 2, ans - 2, ans + 100, ans - 100, ans + 5, ans - 5];
  const s = String(ans);
  if (s.length >= 2) {
    const swapped = Number(s.slice(0, -2) + s.slice(-1) + s.slice(-2, -1));
    if (swapped !== ans) cands.unshift(swapped);
  }
  for (const c of cands) {
    if (c !== ans && c >= 0 && !set.has(c)) set.add(c);
    if (set.size >= 3) break;
  }
  return Array.from(set).slice(0, 3);
}

function build() {
  const out = [];
  const plan = [[1, 24], [2, 24], [3, 12]];
  let n = 0;
  for (const [diff, count] of plan) {
    const seen = new Set();
    let guard = 0;
    while (seen.size < count && guard++ < 500) {
      const t = TEMPLATES[diff][ri(0, TEMPLATES[diff].length - 1)]();
      if (seen.has(t.expr)) continue;
      seen.add(t.expr);
      const ds = distractors(t.ans);
      const answerPos = n % 4;
      const opts = ds.slice();
      opts.splice(answerPos, 0, t.ans);
      n += 1;
      out.push({
        id: `mental${n}`,
        cat: 'mental',
        diff,
        zh: { q: `${t.expr} = ?`, opts: opts.map(String) },
        en: { q: `${t.exprEn || t.expr} = ?`, opts: opts.map(String) },
        answer: answerPos,
      });
    }
  }
  return out;
}

module.exports = build();
