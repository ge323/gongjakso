// 🤣 아재개그 뽑기 — v1
const SB_URL = 'https://mamunluhjcrmharnrqdz.supabase.co';
const SB_KEY = 'sb_publishable_eh0u-VyFBgXRSovoBPrgsQ_F2pYPjWU';

// 서버 함수 호출 → { data, error }
const db = {
  async rpc(fn, args = {}) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
        body: JSON.stringify(args),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) return { data: null, error: new Error((j && (j.message || j.hint)) || `HTTP ${r.status}`) };
      return { data: j, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },
};

// ---------- 기기 신원 ----------
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
}
function store(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
let PLAYER = null;
try {
  PLAYER = localStorage.getItem('dad-joke-player');
  if (!PLAYER) { PLAYER = uuid(); localStorage.setItem('dad-joke-player', PLAYER); }
} catch { PLAYER = uuid(); }

// ---------- 상태 ----------
let jokes = [];                 // {id,q,a,lol,cold,wins,games,today_lol}
const byId = new Map();
const mine = new Map();         // joke_id → 'lol' | 'cold'
const vsDone = new Set(store('dad-joke-vs-done', []));   // '작은id-큰id'
let deck = [];
let current = null;
let pair = null;
let rankMode = 'today';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------- 공통 ----------
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2000);
}
function errMsg(e) {
  const m = (e && e.message) || '';
  if (m.includes('limit')) return '오늘은 투표를 너무 많이 했어요. 내일 또 와 주세요!';
  return '연결이 불안정해요. 잠시 후 다시 눌러 주세요.';
}
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }

function renderTotal() {
  const lol = jokes.reduce((s, j) => s + j.lol, 0);
  const cold = jokes.reduce((s, j) => s + j.cold, 0);
  $('#total').textContent = (lol + cold) ? `지금까지 😏 ${lol.toLocaleString()} · 🥶 ${cold.toLocaleString()}` : '';
}

// ---------- 탭 ----------
function showTab(name) {
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'tab-' + name));
  if (name === 'vs' && !pair) nextPair();
  if (name === 'rank') renderRank();
}
$$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ---------- 🎲 뽑기 ----------
function buildDeck() {
  // 아직 반응 안 한 개그 먼저, 그다음 나머지
  const fresh = shuffle(jokes.filter(j => !mine.has(j.id)));
  const seen = shuffle(jokes.filter(j => mine.has(j.id)));
  deck = [...fresh, ...seen];
}
function nextJoke() {
  if (!deck.length) buildDeck();
  let j = deck.shift();
  if (current && j && j.id === current.id && deck.length) j = deck.shift();   // 같은 개그 연속 방지
  showJoke(j, false);
}
function showJoke(j, revealNow) {
  current = j;
  $('#drawQ').textContent = j.q;
  $('#drawA').textContent = '';
  $('#drawA').classList.remove('pop');
  $('#drawStat').innerHTML = '';
  $('#reactBox').hidden = true;
  $('#nextJoke').hidden = true;
  $('#revealBtn').hidden = false;
  if (revealNow) reveal();
}
function reveal() {
  if (!current) return;
  const a = $('#drawA');
  a.textContent = current.a;
  void a.offsetWidth;
  a.classList.add('pop');
  $('#revealBtn').hidden = true;
  $('#reactBox').hidden = false;
  $('#nextJoke').hidden = false;
  renderReact();
}
function renderReact() {
  const k = mine.get(current.id);
  $$('.react-btn').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  const n = current.lol + current.cold;
  if (!k) { $('#drawStat').innerHTML = ''; return; }
  const p = pct(current.lol, n);
  $('#drawStat').innerHTML = `${n}명 중 ${p}%가 피식 <span class="bar"><i style="width:${p}%"></i></span>`;
}
async function react(kind) {
  if (!current) return;
  const j = current;
  const before = mine.get(j.id);
  if (before === kind) return;

  // 먼저 화면에 반영
  if (before) j[before]--;
  j[kind]++;
  if (!before && kind === 'lol') j.today_lol++;
  if (before === 'lol') j.today_lol = Math.max(0, j.today_lol - 1);
  mine.set(j.id, kind);
  renderReact();
  renderTotal();
  vibrate(15);

  const { data, error } = await db.rpc('dj_react', { p_player: PLAYER, p_joke: j.id, p_kind: kind });
  if (error) {
    // 되돌리기
    j[kind]--;
    if (before) { j[before]++; mine.set(j.id, before); } else mine.delete(j.id);
    if (current === j) renderReact();
    renderTotal();
    toast(errMsg(error));
    return;
  }
  const r = Array.isArray(data) ? data[0] : data;
  if (r) { j.lol = r.lol; j.cold = r.cold; }
  if (current === j) renderReact();
  renderTotal();
}
$('#revealBtn').addEventListener('click', reveal);
$('#drawCard').addEventListener('click', e => {
  if (e.target.closest('button')) return;
  if (!$('#revealBtn').hidden) reveal();
});
$$('.react-btn').forEach(b => b.addEventListener('click', () => react(b.dataset.k)));
$('#nextJoke').addEventListener('click', nextJoke);

// ---------- ⚔️ 대결 ----------
function pairKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }
function nextPair() {
  if (jokes.length < 2) return;
  let a, b, tries = 0;
  do {
    a = jokes[Math.floor(Math.random() * jokes.length)];
    b = jokes[Math.floor(Math.random() * jokes.length)];
    tries++;
  } while ((a === b || vsDone.has(pairKey(a.id, b.id))) && tries < 60);
  if (a === b) b = jokes.find(j => j !== a);
  pair = [a, b];
  pairOpen = false;
  $$('.vs-card').forEach((card, i) => {
    const j = pair[i];
    card.querySelector('.q').textContent = j.q;
    const ans = card.querySelector('.a');
    ans.textContent = '';
    ans.classList.remove('pop');
    card.querySelector('.stat').textContent = '';
    card.classList.remove('win', 'lose');
    card.disabled = false;
  });
  $('#vsHint').textContent = '정답을 보고 더 웃긴 쪽을 골라 주세요';
  $('#vsReveal').hidden = false;
  $('#nextVs').hidden = true;
}
// 두 개그 정답을 한꺼번에 공개 → 그다음부터 카드를 누르면 투표
let pairOpen = false;
function revealPair() {
  if (!pair || pairOpen) return;
  pairOpen = true;
  $$('.vs-card').forEach((card, i) => {
    const ans = card.querySelector('.a');
    ans.textContent = pair[i].a;
    void ans.offsetWidth;
    ans.classList.add('pop');
  });
  $('#vsHint').textContent = '더 웃긴 쪽은?';
  $('#vsReveal').hidden = true;
}
function renderPairStat() {
  $$('.vs-card').forEach((card, i) => {
    const j = pair[i];
    card.querySelector('.stat').textContent = j.games ? `승률 ${pct(j.wins, j.games)}% · ${j.games}판` : '첫 대결';
  });
}
async function vote(side) {
  if (!pair) return;
  const [w, l] = side === 0 ? pair : [pair[1], pair[0]];
  const key = pairKey(w.id, l.id);
  const first = !vsDone.has(key);

  $$('.vs-card').forEach((card, i) => {
    card.disabled = true;
    card.classList.add(i === side ? 'win' : 'lose');
  });
  $('#nextVs').hidden = false;
  vibrate(15);

  if (first) { w.wins++; w.games++; l.games++; }
  renderPairStat();

  const { data, error } = await db.rpc('dj_battle', { p_player: PLAYER, p_winner: w.id, p_loser: l.id });
  if (error) {
    if (first) { w.wins--; w.games--; l.games--; }
    $$('.vs-card').forEach(card => { card.disabled = false; card.classList.remove('win', 'lose'); card.querySelector('.stat').textContent = ''; });
    $('#nextVs').hidden = true;
    toast(errMsg(error));
    return;
  }
  vsDone.add(key);
  save('dad-joke-vs-done',[...vsDone].slice(-3000));
  const r = Array.isArray(data) ? data[0] : data;
  if (r) { w.wins = r.winner_wins; w.games = r.winner_games; l.wins = r.loser_wins; l.games = r.loser_games; }
  renderPairStat();
}
$$('.vs-card').forEach(card => card.addEventListener('click', () => {
  if (!pairOpen) revealPair();
  else vote(+card.dataset.side);
}));
$('#vsReveal').addEventListener('click', revealPair);
$('#nextVs').addEventListener('click', nextPair);

// ---------- 🏆 순위 ----------
const MIN_VOTES = 3;
const RANKS = {
  today: {
    list: () => jokes.filter(j => j.today_lol > 0).sort((a, b) => b.today_lol - a.today_lol).slice(0, 5),
    num: j => `😏 ${j.today_lol}`,
    empty: '아직 오늘 피식한 개그가 없어요',
    note: '새벽 6시에 새로 시작',
  },
  lol: {
    list: () => jokes.filter(j => j.lol + j.cold >= MIN_VOTES)
      .sort((a, b) => pct(b.lol, b.lol + b.cold) - pct(a.lol, a.lol + a.cold) || b.lol - a.lol).slice(0, 10),
    num: j => `피식 ${pct(j.lol, j.lol + j.cold)}%`,
    empty: `투표가 ${MIN_VOTES}개 넘은 개그가 아직 없어요`,
    note: `투표 ${MIN_VOTES}개 이상인 개그만`,
  },
  cold: {
    list: () => jokes.filter(j => j.lol + j.cold >= MIN_VOTES)
      .sort((a, b) => pct(b.cold, b.lol + b.cold) - pct(a.cold, a.lol + a.cold) || b.cold - a.cold).slice(0, 10),
    num: j => `썰렁 ${pct(j.cold, j.lol + j.cold)}%`,
    empty: `투표가 ${MIN_VOTES}개 넘은 개그가 아직 없어요`,
    note: `투표 ${MIN_VOTES}개 이상인 개그만`,
  },
  vs: {
    list: () => jokes.filter(j => j.games >= MIN_VOTES)
      .sort((a, b) => pct(b.wins, b.games) - pct(a.wins, a.games) || b.games - a.games).slice(0, 10),
    num: j => `승률 ${pct(j.wins, j.games)}%`,
    empty: `${MIN_VOTES}판 넘게 대결한 개그가 아직 없어요`,
    note: `${MIN_VOTES}판 이상 대결한 개그만`,
  },
};
function renderRank() {
  const R = RANKS[rankMode];
  const list = R.list();
  const ol = $('#rankList');
  ol.innerHTML = '';
  list.forEach((j, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="no">${i + 1}</span><span class="txt"></span><span class="num"></span>`;
    // 정답은 숨기고 문제만 → 누르면 뽑기 탭에서 직접 정답 보기
    li.querySelector('.txt').textContent = j.q;
    li.querySelector('.num').textContent = R.num(j);
    li.addEventListener('click', () => { showTab('draw'); showJoke(j, false); });
    ol.append(li);
  });
  $('#rankNote').textContent = list.length ? R.note : R.empty;
}
$$('.seg-btn').forEach(b => b.addEventListener('click', () => {
  rankMode = b.dataset.r;
  $$('.seg-btn').forEach(x => x.classList.toggle('on', x === b));
  renderRank();
}));

// ---------- 시작 ----------
async function load() {
  const [list, my] = await Promise.all([
    db.rpc('dj_list'),
    db.rpc('dj_mine', { p_player: PLAYER }),
  ]);
  if (list.error || !list.data) {
    $('#drawQ').textContent = '개그를 불러오지 못했어요. 새로고침해 주세요.';
    return false;
  }
  jokes = list.data;
  jokes.forEach(j => byId.set(j.id, j));
  (my.data || []).forEach(r => mine.set(r.joke_id, r.kind));
  renderTotal();
  return true;
}
// 순위 등 숫자가 너무 오래되지 않게 1분마다 조용히 새로 받기
async function refresh() {
  const { data } = await db.rpc('dj_list');
  if (!data) return;
  data.forEach(n => {
    const j = byId.get(n.id);
    if (j) Object.assign(j, { lol: n.lol, cold: n.cold, wins: n.wins, games: n.games, today_lol: n.today_lol });
  });
  renderTotal();
  if ($('#tab-rank').classList.contains('on')) renderRank();
}

load().then(ok => {
  if (!ok) return;
  nextJoke();
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
});
